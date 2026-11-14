package com.alessandroladu.gymtracker.wear

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Rows of the same Supabase tables the phone app uses (supabase/migrations in the repo).
// user_id is never sent: the database fills it from the signed-in user.

@Serializable
data class ExerciseRow(
    val id: String,
    @SerialName("workout_id") val workoutId: String,
    val position: Int,
    val name: String,
    val sets: Int,
    val reps: Int,
    val weight: Double? = null,
    // Own rest for this exercise (seconds); null = the workout's general rule
    @SerialName("set_rest") val setRest: Int? = null,
    @SerialName("exercise_rest") val exerciseRest: Int? = null,
    val settings: String = "",
    val notes: String = "",
    val alternatives: List<AlternativeRow> = emptyList(),
)

// "Oppure": another exercise to do instead (e.g. when the machine is busy)
@Serializable
data class AlternativeRow(
    val id: String? = null,
    val name: String,
    val sets: Int? = null,
    val reps: Int? = null,
    val weight: Double? = null,
    val settings: String = "",
    val notes: String = "",
    val videos: List<String> = emptyList(),
)

@Serializable
data class WorkoutRow(
    val id: String,
    val title: String,
    @SerialName("set_rest") val setRest: Int,
    @SerialName("exercise_rest") val exerciseRest: Int,
    val exercises: List<ExerciseRow> = emptyList(),
)

@Serializable
data class SetRow(
    val id: String,
    @SerialName("session_id") val sessionId: String,
    @SerialName("exercise_id") val exerciseId: String?,
    @SerialName("exercise_name") val exerciseName: String,
    @SerialName("exercise_position") val exercisePosition: Int,
    @SerialName("set_index") val setIndex: Int,
    @SerialName("target_reps") val targetReps: Int,
    val reps: Int,
    val weight: Double?,
    val completed: Boolean,
)

@Serializable
data class SessionRow(
    val id: String,
    @SerialName("workout_id") val workoutId: String? = null,
    val title: String,
    val status: String,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("session_sets") val sets: List<SetRow> = emptyList(),
)

// Written without defaults so every column is always sent (nulls included)
@Serializable
data class SessionWrite(
    val id: String,
    @SerialName("workout_id") val workoutId: String?,
    val title: String,
    val status: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("completed_at") val completedAt: String?,
    @SerialName("duration_seconds") val durationSeconds: Int,
)

// ---------- the workout being done on the watch ----------
// Serializable so it can be kept on the watch (LiveStore) and survive the app being closed

@Serializable
data class LiveExercise(
    val row: ExerciseRow,
    val weight: Double?,
    val reps: List<Int>,
    val done: List<Boolean>,
    val lastReps: List<Int>?,
    // Last time every set hit the target at this weight: go heavier today
    val increaseSuggested: Boolean,
) {
    val allDone get() = done.isNotEmpty() && done.all { it }
    val hitTarget get() = allDone && reps.all { it >= row.reps }
}

@Serializable
data class LiveWorkout(
    val workout: WorkoutRow,
    val sessionId: String,
    val startedAtMillis: Long,
    val exercises: List<LiveExercise>,
    // Pause: time spent paused is left out of the workout time
    val pausedAtMillis: Long? = null,
    val pausedTotalMillis: Long = 0,
) {
    val paused get() = pausedAtMillis != null

    // Active workout time (excludes pauses)
    fun elapsedMillis(now: Long): Long = (pausedAtMillis ?: now) - startedAtMillis - pausedTotalMillis
}

fun formatWeight(weight: Double?): String =
    if (weight == null) "—" else (if (weight % 1.0 == 0.0) weight.toLong().toString() else weight.toString()) + " kg"
