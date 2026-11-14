import { Platform } from "react-native"
import { requireOptionalNativeModule } from "expo"

// Only exists in a real Android build (APK). In Expo Go it is null and these calls do nothing.
const LiveTimer = Platform.OS === "android" ? requireOptionalNativeModule("LiveTimer") : null

export const isLiveTimerAvailable = !!LiveTimer

// Counts up from startTime (epoch ms)
export function showStopwatch(title, body, startTime) {
  LiveTimer?.show(title, body, startTime, false)
}

// Counts down to endTime (epoch ms)
export function showCountdown(title, body, endTime) {
  LiveTimer?.show(title, body, endTime, true)
}

// No ticking time, e.g. while paused
export function showStatic(title, body) {
  LiveTimer?.show(title, body, 0, false)
}

export function hideLiveTimer() {
  LiveTimer?.hide()
}
