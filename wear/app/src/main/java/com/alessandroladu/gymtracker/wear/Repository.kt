package com.alessandroladu.gymtracker.wear

import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json
import io.github.jan.supabase.logging.LogLevel
import kotlin.time.Duration.Companion.seconds
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

val supabase = createSupabaseClient(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY) {
    // The tables have more columns than the watch uses (videos, user_id, timestamps…): ignore them
    defaultSerializer = KotlinXSerializer(Json { ignoreUnknownKeys = true })
    // A request that hangs (e.g. flaky gym Wi-Fi) fails after 15s instead of spinning forever
    requestTimeout = 15.seconds
    defaultLogLevel = LogLevel.DEBUG
    install(Auth)
    install(Postgrest)
}

// All reads and writes the watch does. Same tables and row shapes as the phone (lib/sync.js),
// so a workout started on one device can be continued on the other.
object Repository {

    suspend fun signInWithGoogle(idToken: String) {
        supabase.auth.signInWith(IDToken) {
            this.idToken = idToken
            provider = Google
        }
    }

    suspend fun workouts(): List<WorkoutRow> =
        supabase.from("workouts")
            .select(Columns.raw("id, title, set_rest, exercise_rest, exercises(*)")) {
                order("created_at", Order.ASCENDING)
            }
            .decodeList<WorkoutRow>()
            .map { workout -> workout.copy(exercises = workout.exercises.sortedBy { it.position }) }

    // All finished sessions of a workout, newest first (for History)
    suspend fun completedSessions(workoutId: String): List<SessionRow> =
        supabase.from("workout_sessions")
            .select(Columns.raw("id, workout_id, title, status, started_at, completed_at, session_sets(*)")) {
                filter {
                    eq("workout_id", workoutId)
                    eq("status", "completed")
                }
                order("completed_at", Order.DESCENDING)
            }
            .decodeList<SessionRow>()

    suspend fun inProgressSession(workoutId: String): SessionRow? =
        supabase.from("workout_sessions")
            .select(Columns.raw("id, workout_id, title, status, started_at, completed_at, session_sets(*)")) {
                filter {
                    eq("workout_id", workoutId)
                    eq("status", "in_progress")
                }
                order("started_at", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SessionRow>()
            .firstOrNull()

    suspend fun saveSession(session: SessionWrite, sets: List<SetRow>) {
        supabase.from("workout_sessions").upsert(session)
        if (sets.isNotEmpty()) supabase.from("session_sets").upsert(sets)
    }

    suspend fun deleteSession(sessionId: String) {
        supabase.from("workout_sessions").delete { filter { eq("id", sessionId) } }
    }

    // The new weight becomes the workout's weight, so next time starts from it (same as the phone)
    suspend fun updateExerciseWeight(exerciseId: String, weight: Double?) {
        supabase.from("exercises").update({ set("weight", weight) }) { filter { eq("id", exerciseId) } }
    }

    suspend fun updateExerciseAlternatives(exerciseId: String, alternatives: List<AlternativeRow>) {
        supabase.from("exercises").update(AlternativesUpdate(alternatives)) { filter { eq("id", exerciseId) } }
    }
}
