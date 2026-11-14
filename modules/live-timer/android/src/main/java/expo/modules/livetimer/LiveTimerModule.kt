package expo.modules.livetimer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "live-timer"
private const val NOTIFICATION_ID = 4210

// Ongoing notification with a native chronometer: it keeps ticking on the lock screen and in the
// status bar even when the app is closed, because Android draws the time, not the app.
class LiveTimerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiveTimer")

    // baseTime: epoch ms. countDown = true counts down to baseTime, false counts up from it.
    // baseTime <= 0 shows a static notification (e.g. paused).
    Function("show") { title: String, body: String, baseTime: Double, countDown: Boolean ->
      appContext.reactContext?.let { show(it, title, body, baseTime.toLong(), countDown) }
    }

    Function("hide") {
      appContext.reactContext?.let { NotificationManagerCompat.from(it).cancel(NOTIFICATION_ID) }
    }
  }

  private fun show(context: Context, title: String, body: String, baseTime: Long, countDown: Boolean) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    ensureChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        context,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(contentIntent)

    if (baseTime > 0) {
      builder
        .setWhen(baseTime)
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(countDown)
      if (countDown) {
        // Remove it when the rest ends instead of showing negative time; the app replaces it
        val remaining = baseTime - System.currentTimeMillis()
        builder.setTimeoutAfter(maxOf(remaining, 0L) + 1_000L)
      }
    }

    // Android 16+ Live Update (status bar chip). Ignored on older versions.
    builder.extras.putBoolean("android.requestPromotedOngoing", true)

    try {
      manager.notify(NOTIFICATION_ID, builder.build())
    } catch (e: SecurityException) {
      // Notification permission was revoked
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Workout timer", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Live workout and rest timer"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }
}
