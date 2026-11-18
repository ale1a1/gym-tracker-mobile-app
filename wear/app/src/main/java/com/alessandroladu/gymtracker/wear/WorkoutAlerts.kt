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
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
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
    const val ONGOING_CHANNEL = "workout-ongoing"
    // v2: the system itself rings and vibrates (an app in the background is muted and can't vibrate)
    private const val REST_CHANNEL = "rest-alarm-2"
    private const val OLD_REST_CHANNEL = "rest-alarm"
    const val EXTRA_REST_OVER = "rest_over"
    const val ONGOING_ID = 4310

    // Latest workout timer notification, reused by WorkoutService when it (re)starts
    @Volatile var lastOngoing: android.app.Notification? = null
    private const val REST_ID = 4311
    private const val REST_REQUEST = 4312

    // The full-colour app icon (bicep on blue), shown as the notification picture; the small
    // status icon has to stay a one-colour silhouette (Android rule)
    private fun appIcon(context: Context) =
        BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.deleteNotificationChannel(OLD_REST_CHANNEL)
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
                vibrationPattern = longArrayOf(0, 700, 200, 700, 200, 900)
                setBypassDnd(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
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
            .setLargeIcon(appIcon(context))
            .setSmallIcon(R.drawable.ic_stat_bicep)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setContentIntent(openAppIntent(context))
        // baseTimeMillis <= 0: static (paused), no ticking time
        if (baseTimeMillis > 0) {
            builder.setWhen(baseTimeMillis).setUsesChronometer(true).setChronometerCountDown(countDown)
        }

        val status = if (baseTimeMillis > 0) {
            // Ongoing-activity timers count on the uptime clock (elapsedRealtime), not wall-clock time:
            // passing wall time made the watch face show 00:00 or a huge number
            val baseOnUptimeClock = SystemClock.elapsedRealtime() + (baseTimeMillis - System.currentTimeMillis())
            val timer = if (countDown) Status.TimerPart(baseOnUptimeClock) else Status.StopwatchPart(baseOnUptimeClock)
            // Only the time next to the bicep icon: a label ("Set rest · ...") got the seconds cut off
            Status.Builder()
                .addTemplate("#time#")
                .addPart("time", timer)
                .build()
        } else {
            Status.Builder().addTemplate(text).build()
        }

        OngoingActivity.Builder(context, ONGOING_ID, builder)
            .setStaticIcon(R.drawable.ic_stat_bicep)
            .setTouchIntent(openAppIntent(context))
            .setStatus(status)
            .build()
            .apply(context)

        val notification = builder.build()
        lastOngoing = notification
        runCatching { NotificationManagerCompat.from(context).notify(ONGOING_ID, notification) }
    }

    fun hideOngoing(context: Context) {
        lastOngoing = null
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

    // Rest is over: vibrate and beep as an ALARM ourselves. Wear OS mutes notification sounds and
    // handles notification vibration its own way, so the notification alone isn't reliable; alarm
    // usage goes through silent mode (Do Not Disturb set to block alarms can still stop it).
    fun alertRestFinished(context: Context, onDone: () -> Unit) {
        Log.i("GymTracker", "Rest finished: vibrate + beep")
        vibrateAlarm(context)

        val audio = context.getSystemService(AudioManager::class.java)
        val previousVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
        // Loud enough to hear in the gym, then put the alarm volume back
        runCatching { audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0) }

        val handler = Handler(Looper.getMainLooper())
        // The watch's own notification tone, played as an alarm; plain beeps only if it's missing
        val ringtone = runCatching {
            RingtoneManager.getRingtone(context, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))?.apply {
                audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
        }.getOrNull()
        var tone: ToneGenerator? = null
        if (ringtone != null) {
            ringtone.play()
        } else {
            tone = runCatching { ToneGenerator(AudioManager.STREAM_ALARM, ToneGenerator.MAX_VOLUME) }.getOrNull()
            listOf(0L, 450L, 900L).forEach { delay ->
                handler.postDelayed({ tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 300) }, delay)
            }
        }
        handler.postDelayed({
            runCatching { ringtone?.stop() }
            tone?.release()
            runCatching { audio.setStreamVolume(AudioManager.STREAM_ALARM, previousVolume, 0) }
            onDone()
        }, 3000L)

        showRestFinished(context)
    }

    private fun vibrateAlarm(context: Context) {
        val vibrator = if (Build.VERSION.SDK_INT >= 31) {
            context.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
        // Three long buzzes at full strength
        val timings = longArrayOf(0, 700, 200, 700, 200, 900)
        val effect = if (vibrator.hasAmplitudeControl()) {
            VibrationEffect.createWaveform(timings, intArrayOf(0, 255, 0, 255, 0, 255), -1)
        } else {
            VibrationEffect.createWaveform(timings, -1)
        }
        if (Build.VERSION.SDK_INT >= 33) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(effect, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
        }
    }

    // Opens the app on the "Rest is over" flash (alarm-style, also over the watch face)
    private fun restOverIntent(context: Context) = PendingIntent.getActivity(
        context,
        1,
        Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_REST_OVER, true),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    // "Rest is over": the notification rings and vibrates through the alarm channel (played by the
    // system, so it works with the app in the background) and brings the app to the front
    fun showRestFinished(context: Context) {
        if (!canNotify(context)) return
        val notification = NotificationCompat.Builder(context, REST_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_bicep)
            .setVibrate(longArrayOf(0, 700, 200, 700, 200, 900))
            .setFullScreenIntent(restOverIntent(context), true)
            .setLargeIcon(appIcon(context))
            .setContentTitle("Rest is over")
            .setContentText("Back to work")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setTimeoutAfter(30_000)
            .setContentIntent(restOverIntent(context))
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(REST_ID, notification) }
    }
}

// Fired by AlarmManager when the rest ends: works with the app open, in the background or closed
class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync() // keep the process alive while the beeps play
        WorkoutAlerts.createChannels(context)
        WorkoutAlerts.alertRestFinished(context) { pending.finish() }
    }
}
