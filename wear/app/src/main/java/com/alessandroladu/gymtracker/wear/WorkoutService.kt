package com.alessandroladu.gymtracker.wear

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

// Runs for as long as a workout is in progress. Android mutes the sound and blocks the vibration
// of apps in the background; a foreground service (like a music player's) keeps the app counted
// as active, so the "rest is over" alarm still rings and buzzes with the app minimised or the
// screen off. Its notification is the workout timer one (same id), updated by WorkoutAlerts.
class WorkoutService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        WorkoutAlerts.createChannels(this)
        val notification = WorkoutAlerts.lastOngoing ?: NotificationCompat.Builder(this, WorkoutAlerts.ONGOING_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_bicep)
            .setContentTitle("Workout in progress")
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        runCatching { ServiceCompat.startForeground(this, WorkoutAlerts.ONGOING_ID, notification, type) }
            .onFailure { stopSelf() }
        return START_NOT_STICKY
    }

    companion object {
        // Called while the app is on screen (a workout starts or is restored), as Android requires
        fun start(context: Context) {
            runCatching { ContextCompat.startForegroundService(context, Intent(context, WorkoutService::class.java)) }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, WorkoutService::class.java))
        }
    }
}
