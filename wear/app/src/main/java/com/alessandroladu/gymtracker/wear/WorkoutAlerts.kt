package com.alessandroladu.gymtracker.wear

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status

// Watch equivalents of the phone's lock-screen live timer and rest alarm:
// - an ongoing activity: the workout stopwatch / rest countdown on the watch face, drawn by the
//   system so it keeps ticking with the app closed
// - a rest alarm scheduled with AlarmManager: vibrates and rings when the rest ends, even if the
//   app is in the background or the screen is off
object WorkoutAlerts {
    private const val ONGOING_CHANNEL = "workout-ongoing"
    private const val REST_CHANNEL = "rest-alarm"
    private const val ONGOING_ID = 4310
    private const val REST_ID = 4311
    private const val REST_REQUEST = 4312

    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(ONGOING_CHANNEL, "Workout timer", NotificationManager.IMPORTANCE_DEFAULT).apply {
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(REST_CHANNEL, "Rest finished (alarm)", NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            },
        )
    }

    private fun canNotify(context: Context) =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun openAppIntent(context: Context) = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    // countDown = true: counts down to baseTimeMillis (rest); false: counts up from it (workout)
    fun showOngoing(context: Context, title: String, text: String, baseTimeMillis: Long, countDown: Boolean) {
        if (!canNotify(context)) return
        val builder = NotificationCompat.Builder(context, ONGOING_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_today)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(openAppIntent(context))
            .setWhen(baseTimeMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(countDown)

        val timer = if (countDown) Status.TimerPart(baseTimeMillis) else Status.StopwatchPart(baseTimeMillis)
        val status = Status.Builder()
            .addTemplate("#label# #time#")
            .addPart("label", Status.TextPart(text))
            .addPart("time", timer)
            .build()

        OngoingActivity.Builder(context, ONGOING_ID, builder)
            .setStaticIcon(android.R.drawable.ic_menu_today)
            .setTouchIntent(openAppIntent(context))
            .setStatus(status)
            .build()
            .apply(context)

        runCatching { NotificationManagerCompat.from(context).notify(ONGOING_ID, builder.build()) }
    }

    fun hideOngoing(context: Context) {
        NotificationManagerCompat.from(context).cancel(ONGOING_ID)
    }

    private fun restIntent(context: Context) = PendingIntent.getBroadcast(
        context,
        REST_REQUEST,
        Intent(context, RestAlarmReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    // Returns false if it couldn't be scheduled (the app then vibrates in-app instead)
    fun scheduleRestAlarm(context: Context, endsAtMillis: Long): Boolean {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return false
        return runCatching {
            if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAtMillis, restIntent(context))
            } else {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAtMillis, restIntent(context))
            }
        }.isSuccess
    }

    fun cancelRestAlarm(context: Context) {
        context.getSystemService(AlarmManager::class.java)?.cancel(restIntent(context))
        NotificationManagerCompat.from(context).cancel(REST_ID)
    }

    fun showRestFinished(context: Context) {
        if (!canNotify(context)) return
        val notification = NotificationCompat.Builder(context, REST_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_today)
            .setContentTitle("Rest is over 💪")
            .setContentText("Time for your next set")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setTimeoutAfter(30_000)
            .setContentIntent(openAppIntent(context))
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(REST_ID, notification) }
    }
}

class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WorkoutAlerts.createChannels(context)
        WorkoutAlerts.showRestFinished(context)
    }
}
