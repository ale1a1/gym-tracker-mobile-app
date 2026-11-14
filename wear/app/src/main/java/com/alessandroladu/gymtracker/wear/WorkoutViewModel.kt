package com.alessandroladu.gymtracker.wear

import android.app.Application
import android.content.Context
import android.os.Build
import android.util.Log
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.util.UUID

data class UiState(
    val signedIn: Boolean? = null, // null while the saved session loads
    val loading: Boolean = false,
    val error: String? = null,
    val workouts: List<WorkoutRow> = emptyList(),
    val live: LiveWorkout? = null,
    val restEndsAtMillis: Long? = null,
    val restLabel: String = "",
    // Set when a rest runs out with the app open: shows the "Rest is over" flash
    val restOverAtMillis: Long? = null,
    // The workout looks finished (last set of the last exercise ticked, or every set ticked):
    // show the congratulations screen
    val finishPrompt: Boolean = false,
)

class WorkoutViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    // Saves run one at a time, in order, so the database always ends with the latest state
    private val saveLock = Mutex()
    private var restJob: Job? = null

    private val appContext get() = getApplication<Application>()

    init {
        WorkoutAlerts.createChannels(appContext)

        // A workout that was running when the app was closed or minimised continues where it was
        LiveStore.load(appContext)?.let { saved ->
            val restEndsAt = saved.restEndsAtMillis?.takeIf { it > System.currentTimeMillis() }
            _state.update { it.copy(live = saved.live, restEndsAtMillis = restEndsAt, restLabel = saved.restLabel) }
            if (restEndsAt != null) startRestUntil(restEndsAt, saved.restLabel)
        }

        // Keep the running workout on the watch after every change (cleared when it ends)
        viewModelScope.launch {
            state.map { Triple(it.live, it.restEndsAtMillis, it.restLabel) }
                .distinctUntilChanged()
                .collect { (live, restEndsAt, restLabel) ->
                    if (live == null) LiveStore.clear(appContext)
                    else LiveStore.save(appContext, SavedWorkout(live, restEndsAt, restLabel))
                }
        }

        // Watch-face timer follows the workout: rest countdown, otherwise the workout stopwatch
        viewModelScope.launch {
            state.map { s -> Triple(s.live?.let { Triple(it.workout.title, it.startedAtMillis + it.pausedTotalMillis, it.paused) }, s.restEndsAtMillis, s.restLabel) }
                .distinctUntilChanged()
                .collect { (workout, restEndsAt, restLabel) ->
                    when {
                        workout == null -> WorkoutAlerts.hideOngoing(appContext)
                        workout.third -> WorkoutAlerts.showOngoing(appContext, workout.first, "Paused", 0L, countDown = false)
                        restEndsAt != null -> WorkoutAlerts.showOngoing(appContext, workout.first, restLabel, restEndsAt, countDown = true)
                        else -> WorkoutAlerts.showOngoing(appContext, workout.first, workout.first, workout.second, countDown = false)
                    }
                }
        }

        viewModelScope.launch {
            supabase.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        val wasSignedIn = _state.value.signedIn == true
                        _state.update { it.copy(signedIn = true) }
                        if (!wasSignedIn) loadWorkouts()
                    }
                    is SessionStatus.NotAuthenticated -> _state.update { it.copy(signedIn = false) }
                    else -> Unit
                }
            }
        }
    }

    fun signIn(idToken: String) = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null) }
        runCatching { Repository.signInWithGoogle(idToken) }
            .onFailure { e -> fail("Sign-in failed. Try again.", e) }
        _state.update { it.copy(loading = false) }
    }

    fun showError(message: String) = fail(message, null)
    fun clearError() {
        errorJob?.cancel()
        _state.update { it.copy(error = null) }
    }

    // Short message on screen (never the raw request/response), full details in the log;
    // it goes away by itself after a few seconds (or when tapped)
    private var errorJob: Job? = null
    private fun fail(message: String, e: Throwable?) {
        if (e != null) Log.e("GymTracker", message, e)
        _state.update { it.copy(error = message) }
        errorJob?.cancel()
        errorJob = viewModelScope.launch {
            delay(5000)
            _state.update { if (it.error == message) it.copy(error = null) else it }
        }
    }

    fun loadWorkouts() = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null) }
        runCatching { Repository.workouts() }
            .onSuccess { workouts -> _state.update { it.copy(workouts = workouts) } }
            .onFailure { e ->
                Log.e("GymTracker", "loadWorkouts failed", e)
                fail("Couldn't load workouts. Check the connection and tap refresh.", e)
            }
        _state.update { it.copy(loading = false) }
    }

    // Resumes the live session if this workout is already in progress (e.g. started on the phone),
    // otherwise starts a new one. Reps are prefilled from last time, like on the phone.
    fun startWorkout(workout: WorkoutRow, onReady: () -> Unit) = viewModelScope.launch {
        _state.value.live?.let { live ->
            if (live.workout.id == workout.id) onReady()
            else fail("Finish or close \"${live.workout.title}\" first", null)
            return@launch
        }
        _state.update { it.copy(loading = true, error = null) }
        runCatching {
            val completed = Repository.completedSessions(workout.id)
            val last = completed.firstOrNull()
            val existing = Repository.inProgressSession(workout.id)

            val exercises = workout.exercises.map { ex ->
                val lastSets = last?.sets.orEmpty().filter { it.exerciseId == ex.id }.sortedBy { it.setIndex }
                val lastReps = lastSets.map { it.reps }.takeIf { it.isNotEmpty() }
                val lastWeight = lastSets.firstOrNull()?.weight
                val lastHitTarget = lastSets.size >= ex.sets &&
                    lastSets.all { it.completed && it.reps >= it.targetReps }
                val increase = ex.weight != null && lastWeight != null && lastHitTarget && ex.weight <= lastWeight

                val liveSets = existing?.sets.orEmpty().filter { it.exerciseId == ex.id }.sortedBy { it.setIndex }
                val reps = List(ex.sets) { i ->
                    liveSets.getOrNull(i)?.reps ?: lastReps?.getOrNull(i) ?: ex.reps
                }
                val done = List(ex.sets) { i -> liveSets.getOrNull(i)?.completed ?: false }
                LiveExercise(ex, ex.weight, reps, done, lastReps, increase)
            }

            LiveWorkout(
                workout = workout,
                sessionId = existing?.id ?: UUID.randomUUID().toString(),
                startedAtMillis = existing?.startedAt?.let { parseTimestamp(it).toEpochMilli() } ?: System.currentTimeMillis(),
                exercises = exercises,
            )
        }.onSuccess { live ->
            _state.update { it.copy(live = live) }
            save(live)
            onReady()
        }.onFailure { e ->
            fail("Couldn't start the workout. Try again.", e)
        }
        _state.update { it.copy(loading = false) }
    }

    fun changeReps(exerciseIndex: Int, setIndex: Int, delta: Int) {
        val live = updateLive { live ->
            live.withExercise(exerciseIndex) { ex -> ex.copy(reps = ex.reps.mapIndexed { i, r -> if (i == setIndex) (r + delta).coerceAtLeast(0) else r }) }
        } ?: return
        save(live)
    }

    fun pause() {
        skipRest()
        updateLive { live -> if (live.paused) live else live.copy(pausedAtMillis = System.currentTimeMillis()) }
    }

    fun resume() {
        updateLive { live ->
            val pausedAt = live.pausedAtMillis ?: return@updateLive live
            live.copy(pausedAtMillis = null, pausedTotalMillis = live.pausedTotalMillis + (System.currentTimeMillis() - pausedAt))
        }
    }

    fun toggleSetDone(exerciseIndex: Int, setIndex: Int) {
        // Ticking a set while paused means you're training again
        if (_state.value.live?.paused == true) resume()
        var startRest = false
        var exerciseFinished = false
        var exerciseRow: ExerciseRow? = null
        val isLastSetOfLastExercise = _state.value.live?.let { l ->
            exerciseIndex == l.exercises.lastIndex && setIndex == l.exercises[exerciseIndex].done.lastIndex
        } ?: false
        val live = updateLive { live ->
            live.withExercise(exerciseIndex) { ex ->
                val nowDone = !ex.done[setIndex]
                val updated = ex.copy(done = ex.done.mapIndexed { i, d -> if (i == setIndex) nowDone else d })
                startRest = nowDone
                exerciseFinished = updated.allDone
                exerciseRow = ex.row
                updated
            }
        } ?: return
        save(live)
        // Done when every set is ticked, or when the very last set of the last exercise is ticked
        // (even if a set was left unticked earlier): no rest, show the congratulations instead
        val workoutComplete = startRest && (live.exercises.all { it.allDone } || isLastSetOfLastExercise)
        if (workoutComplete) {
            _state.update { it.copy(finishPrompt = true) }
        } else if (startRest) {
            // The exercise's own rest wins over the workout's general rule
            if (exerciseFinished) startRest(exerciseRow?.exerciseRest ?: live.workout.exerciseRest, "Exercise rest")
            else startRest(exerciseRow?.setRest ?: live.workout.setRest, "Set rest")
        }
    }

    // Typed on the watch keypad; also saved as the workout's weight for next time
    fun setWeight(exerciseIndex: Int, weight: Double?) {
        val exerciseId = _state.value.live?.exercises?.getOrNull(exerciseIndex)?.row?.id ?: return
        // Going heavier answers the "Increase the weight today" reminder, so it goes away
        val live = updateLive { live ->
            live.withExercise(exerciseIndex) { ex ->
                val increased = weight != null && ex.weight != null && weight > ex.weight
                ex.copy(weight = weight, increaseSuggested = ex.increaseSuggested && !increased)
            }
        } ?: return
        save(live)
        viewModelScope.launch {
            runCatching { Repository.updateExerciseWeight(exerciseId, weight) }
                .onFailure { e -> fail("Weight not saved to the cloud yet.", e) }
        }
    }

    fun clearRestOver() = _state.update { it.copy(restOverAtMillis = null) }

    fun dismissFinishPrompt() = _state.update { it.copy(finishPrompt = false) }

    fun skipRest() {
        restJob?.cancel()
        WorkoutAlerts.cancelRestAlarm(appContext)
        _state.update { it.copy(restEndsAtMillis = null) }
    }

    fun finishWorkout() {
        viewModelScope.launch {
            endCurrent(EndMode.FINISH)
            loadWorkouts()
        }
    }

    enum class EndMode { FINISH, DISCARD }

    // Another workout is running: finish or discard it, then start the new one
    fun switchWorkout(next: WorkoutRow, mode: EndMode, onReady: () -> Unit) {
        viewModelScope.launch {
            endCurrent(mode)
            startWorkout(next, onReady)
        }
    }

    private suspend fun endCurrent(mode: EndMode) {
        val live = _state.value.live ?: return
        skipRest()
        _state.update { it.copy(finishPrompt = false) }
        val now = System.currentTimeMillis()
        saveLock.withLock {
            runCatching {
                when (mode) {
                    EndMode.FINISH -> Repository.saveSession(
                        session(live, status = "completed", completedAt = Instant.ofEpochMilli(now).toString(), now = now),
                        sets(live),
                    )
                    EndMode.DISCARD -> Repository.deleteSession(live.sessionId)
                    // Stays "in progress" in the cloud; opening that workout again continues it
                }
            }.onFailure { e -> fail("Couldn't save. Check the connection.", e) }
        }
        _state.update { it.copy(live = null) }
    }

    // Ends the session on this watch; the live workout (if any) stays saved in the cloud
    fun signOut() {
        skipRest()
        LiveStore.clear(appContext)
        WorkoutAlerts.hideOngoing(appContext)
        _state.update { UiState(signedIn = false) }
        viewModelScope.launch { runCatching { supabase.auth.signOut() } }
    }

    fun discardWorkout() {
        viewModelScope.launch { endCurrent(EndMode.DISCARD) }
    }

    // ---------- helpers ----------

    private fun updateLive(transform: (LiveWorkout) -> LiveWorkout): LiveWorkout? {
        var result: LiveWorkout? = null
        _state.update { state ->
            val live = state.live ?: return@update state
            transform(live).also { result = it }.let { state.copy(live = it) }
        }
        return result
    }

    private fun LiveWorkout.withExercise(index: Int, transform: (LiveExercise) -> LiveExercise) =
        copy(exercises = exercises.mapIndexed { i, ex -> if (i == index) transform(ex) else ex })

    // Real-time save: every change pushes the whole live session (a few rows), latest wins
    private fun save(live: LiveWorkout) {
        viewModelScope.launch {
            saveLock.withLock {
                val latest = _state.value.live?.takeIf { it.sessionId == live.sessionId } ?: return@withLock
                runCatching { Repository.saveSession(session(latest, "in_progress", null, System.currentTimeMillis()), sets(latest)) }
                    .onFailure { e -> fail("Couldn't save. It will retry with your next change.", e) }
            }
        }
    }

    private fun session(live: LiveWorkout, status: String, completedAt: String?, now: Long) = SessionWrite(
        id = live.sessionId,
        workoutId = live.workout.id,
        title = live.workout.title,
        status = status,
        startedAt = Instant.ofEpochMilli(live.startedAtMillis).toString(),
        completedAt = completedAt,
        durationSeconds = (live.elapsedMillis(now) / 1000).toInt(),
    )

    // Same set ids as the phone: "<session>-<exercise>-<set index>"
    private fun sets(live: LiveWorkout) = live.exercises.flatMapIndexed { position, ex ->
        ex.reps.mapIndexed { i, reps ->
            SetRow(
                id = "${live.sessionId}-${ex.row.id}-$i",
                sessionId = live.sessionId,
                exerciseId = ex.row.id,
                exerciseName = ex.row.name,
                exercisePosition = position,
                setIndex = i,
                targetReps = ex.row.reps,
                reps = reps,
                weight = ex.weight,
                completed = ex.done[i],
            )
        }
    }

    private fun startRest(seconds: Int, label: String) =
        startRestUntil(System.currentTimeMillis() + seconds * 1000L, label)

    private fun startRestUntil(endsAt: Long, label: String) {
        restJob?.cancel()
        _state.update { it.copy(restEndsAtMillis = endsAt, restLabel = label) }
        // The alarm rings and vibrates even with the app in the background; vibrate in-app only if it failed
        val alarmScheduled = WorkoutAlerts.scheduleRestAlarm(appContext, endsAt)
        restJob = viewModelScope.launch {
            delay((endsAt - System.currentTimeMillis()).coerceAtLeast(0))
            _state.update { it.copy(restEndsAtMillis = null, restOverAtMillis = System.currentTimeMillis()) }
            if (!alarmScheduled) vibrate()
        }
    }

    private fun vibrate() {
        val context = getApplication<Application>()
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 250, 500, 250, 500), -1))
    }
}
