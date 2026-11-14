package com.alessandroladu.gymtracker.wear

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// The running workout (and rest countdown) saved on the watch after every change, so closing,
// minimising or swiping out of the app never loses it: it's restored the next time the app opens.
@Serializable
data class SavedWorkout(val live: LiveWorkout, val restEndsAtMillis: Long? = null, val restLabel: String = "")

object LiveStore {
    private const val PREFS = "live-workout"
    private const val KEY = "saved"
    private val json = Json { ignoreUnknownKeys = true }

    fun save(context: Context, saved: SavedWorkout) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY, json.encodeToString(SavedWorkout.serializer(), saved))
            .apply()
    }

    fun load(context: Context): SavedWorkout? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?.let { runCatching { json.decodeFromString(SavedWorkout.serializer(), it) }.getOrNull() }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }
}
