import { Platform } from "react-native"
import * as Notifications from "expo-notifications"

const REST_CHANNEL_ID = "rest-timer"

// Show the alert (banner + sound) even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function setupNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
        name: "Rest timer",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      })
    }

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync()
    }
  } catch (error) {
    console.error("Error setting up notifications:", error)
  }
}

// Schedules the "rest is over" alert. It fires even if the app is closed or the phone is locked.
export async function scheduleRestEndNotification(seconds, restType) {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rest is over 💪",
        body: restType === "set" ? "Time for your next set" : "Time for the next exercise",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: REST_CHANNEL_ID,
      },
    })
  } catch (error) {
    console.error("Error scheduling rest notification:", error)
    return null
  }
}

export async function cancelRestNotification(notificationId) {
  if (!notificationId) return
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch (error) {
    console.error("Error cancelling rest notification:", error)
  }
}
