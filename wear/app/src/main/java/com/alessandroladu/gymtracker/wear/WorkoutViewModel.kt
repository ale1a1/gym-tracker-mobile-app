package com.alessandroladu.gymtracker.wear

import android.app.Application
import android.content.Context
import android.os.Build
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

        // Watch-face timer follows the workout: rest countdown, otherwise the workout stopwatch
        viewModelScope.launch {
            state.map { Triple(it.live?.let { live -> live.workout.title to live.startedAtMillis }, it.restEndsAtMillis, it.restLabel) }
                .distinctUntilChanged()
                .collect { (workout, restEndsAt, restLabel) ->
                    when {
                        workout == null -> WorkoutAlerts.hideOngoing(appContext)
                        restEndsAt != null -> WorkoutAlerts.showOngoing(appContext, workout.first, restLabel, restEndsAt, countDown = true)
                        else -> WorkoutAlerts.showOngoing(appContext, workout.first, "Workout", workout.second, countDown = false)
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
            .onFailure { e -> _state.update { it.copy(error = "Sign-in failed: ${e.message}") } }
        _state.update { it.copy(loading = false) }
    }

    fun showError(message: String) = _state.update { it.copy(error = message) }
    fun clearError() = _state.update { it.copy(error = null) }

    fun loadWorkouts() = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null) }
        runCatching { Repository.workouts() }
            .onSuccess { workouts -> _state.update { it.copy(workouts = workouts) } }
            .onFailure { e -> _state.update { it.copy(error = "Couldn't load workouts: ${e.message}") } }
        _state.update { it.copy(loading = false) }
    }

    // Resumes the live session if this workout is already in progress (e.g. started on the phone),
    // otherwise starts a new one. Reps are prefilled from last time, like on the phone.
    fun startWorkout(workout: WorkoutRow, onReady: () -> Unit) = viewModelScope.launch {
        _state.value.live?.let { if (it.workout.id == workout.id) { onReady(); return@launch } }
        _state.update { it.copy(loading = true, error = null) }
        runCatching {
            val last = Repository.lastCompletedSession(workout.id)
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
                current = exercises.indexOfFirst { !it.allDone }.coerceAtLeast(0),
            )
        }.onSuccess { live ->
            _state.update { it.copy(live = live) }
            save(live)
            onReady()
        }.onFailure { e ->
            _state.update { it.copy(error = "Couldn't start: ${e.message}") }
        }
        _state.update { it.copy(loading = false) }
    }

    // Navigation only: which exercise is shown doesn't need saving
    fun goToExercise(index: Int) {
        updateLive { live -> live.copy(current = index.coerceIn(0, live.exercises.lastIndex)) }
    }

    fun changeReps(setIndex: Int, delta: Int) {
        val live = updateLive { live ->
            live.withCurrent { ex -> ex.copy(reps = ex.reps.mapIndexed { i, r -> if (i == setIndex) (r + delta).coerceAtLeast(0) else r }) }
        } ?: return
        save(live)
    }

    fun toggleSetDone(setIndex: Int) {
        var startRest = false
        var exerciseFinished = false
        var exerciseRow: ExerciseRow? = null
        val live = updateLive { live ->
            live.withCurrent { ex ->
                val nowDone = !ex.done[setIndex]
                val updated = ex.copy(done = ex.done.mapIndexed { i, d -> if (i == setIndex) nowDone else d })
                startRest = nowDone
                exerciseFinished = updated.allDone
                exerciseRow = ex.row
                updated
            }
        } ?: return
        save(live)
        if (startRest) {
            // The exercise's own rest wins over the workout's general rule
            if (exerciseFinished) startRest(exerciseRow?.exerciseRest ?: live.workout.exerciseRest, "Exercise rest")
            else startRest(exerciseRow?.setRest ?: live.workout.setRest, "Set rest")
        }
    }

    // Typed on the watch keypad; also saved as the workout's weight for next time
    fun setWeight(weight: Double?) {
        val exerciseId = _state.value.live?.let { it.exercises[it.current].row.id } ?: return
        val live = updateLive { live -> live.withCurrent { ex -> ex.copy(weight = weight) } } ?: return
        save(live)
        viewModelScope.launch {
            runCatching { Repository.updateExerciseWeight(exerciseId, weight) }
                .onFailure { e -> _state.update { it.copy(error = "Weight not saved: ${e.message}") } }
        }
    }

    fun skipRest() {
        restJob?.cancel()
        WorkoutAlerts.cancelRestAlarm(appContext)
        _state.update { it.copy(restEndsAtMillis = null) }
    }

    fun finishWorkout() {
        val live = _state.value.live ?: return
        skipRest()
        val now = System.currentTimeMillis()
        viewModelScope.launch {
            saveLock.withLock {
                runCatching {
                    Repository.saveSession(
                        session(live, status = "completed", completedAt = Instant.ofEpochMilli(now).toString(), now = now),
                        sets(live),
                    )
                }.onFailure { e -> _state.update { it.copy(error = "Finish not saved: ${e.message}") } }
            }
            _state.update { it.copy(live = null) }
            loadWorkouts()
        }
    }

    fun discardWorkout() {
        val live = _state.value.live ?: return
        skipRest()
        _state.update { it.copy(live = null) }
        viewModelScope.launch {
            saveLock.withLock { runCatching { Repository.deleteSession(live.sessionId) } }
        }
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

    private fun LiveWorkout.withCurrent(transform: (LiveExercise) -> LiveExercise) =
        copy(exercises = exercises.mapIndexed { i, ex -> if (i == current) transform(ex) else ex })

    // Real-time save: every change pushes the whole live session (a few rows), latest wins
    private fun save(live: LiveWorkout) {
        viewModelScope.launch {
            saveLock.withLock {
                val latest = _state.value.live?.takeIf { it.sessionId == live.sessionId } ?: return@withLock
                runCatching { Repository.saveSession(session(latest, "in_progress", null, System.currentTimeMillis()), sets(latest)) }
                    .onFailure { e -> _state.update { it.copy(error = "Not saved (offline?): ${e.message}") } }
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
        durationSeconds = ((now - live.startedAtMillis) / 1000).toInt(),
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

    private fun startRest(seconds: Int, label: String) {
        restJob?.cancel()
        val endsAt = System.currentTimeMillis() + seconds * 1000L
        _state.update { it.copy(restEndsAtMillis = endsAt, restLabel = label) }
        // The alarm rings and vibrates even with the app in the background; vibrate in-app only if it failed
        val alarmScheduled = WorkoutAlerts.scheduleRestAlarm(appContext, endsAt)
        restJob = viewModelScope.launch {
            delay(seconds * 1000L)
            _state.update { it.copy(restEndsAtMillis = null) }
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
