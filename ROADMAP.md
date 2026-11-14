# Gym Tracker Roadmap

## Current state (Nov 2026)
- Expo SDK 58, React Native 0.88, Node 22.13 or newer. Android app `com.alessandroladu.gymtracker`.
- Installed on an Android Pixel as an APK built locally in `C:\p\gym`. Release key is in `C:\p\keys` (backed up).
- Data lives in **Supabase**, with a local copy on the phone for offline use. Login: automatic anonymous account, then link Google.

---

## 📱 Phone

### Done
- [x] One header everywhere: centered titles and a single back arrow (native stack navigator).
- [x] Home: **Do Workout** (workout cards) and **Create Workout**, plus a live banner while a workout runs or is paused.
- [x] Exercise fields: sets, reps, weight (optional, decimals), machine settings, notes, and YouTube videos (several allowed).
- [x] Weight during a workout: tap the edit button and type the exact number. There are no +/− buttons and nothing is planned ahead.
- [x] Target hit (every set at full reps): "Increase the weight next time". Next session: "Last time you hit every set. Increase the weight today", which opens the weight editor.
- [x] Videos: one link opens the in-app player; several links open a list first. Includes an "Open in YouTube" fallback.
- [x] Edit workout (from View and from the active workout) covers all fields.
- [x] Rest timer: loud notification with vibration when the rest ends, even with the phone locked.
- [x] Live timer on the lock screen and status bar (native module `modules/live-timer`).
- [x] Input text stays visible in dark mode. The keyboard no longer covers the field being typed.
- [x] Google sign-in button (links Google to the current account, keeping the data).
- [x] Alternatives ("oppure"), per-exercise rest, History modal (last 10, filter by month/week), app name "Gym Tracker" and bicep icon.

### To do / to verify on the phone
- [ ] Test the lock-screen live timer (stopwatch, rest countdown, paused).
- [ ] Test Google sign-in end to end ("Synced as …").
- [ ] Workout history screen: past sessions per workout, with weight and reps over time.

---

## 🔄 Shared (phone + watch + database)

### Done
- [x] Supabase tables `workouts`, `exercises`, `workout_sessions`, `session_sets`, with row-level security (each user sees only their own rows).
- [x] Offline-first sync: changes save locally at once and are queued, then pushed when online.
- [x] **Real-time workout saving**: a live session (`status = in_progress`) is created when a workout starts. Every set tick, reps change and weight change is pushed within a second. Finish marks it `completed`; cancel deletes it.

### To do
- [ ] Optional: CAPTCHA for anonymous sign-ups (Supabase suggests it; low priority for a personal app).

---

## ⌚ Pixel Watch (Wear OS)
- Native Kotlin app (Compose for Wear OS) in `wear/`. Expo/React Native can't build Wear OS apps. Same app id and signing key as the phone, same Supabase tables.
- **Split:** the phone creates and edits workouts. The watch is only for doing a workout. Workouts sync from the phone through Supabase (same Google account).
- Build: `cd wear` then `gradlew.bat :app:assembleRelease`. It reads the Supabase and Google ids from `../.env.local` and the key from `C:/p/keys`. Install with adb over Wi-Fi.

### Done (first version, to test on the watch)
- [x] Google sign-in (Credential Manager) into the same Supabase account as the phone.
- [x] Workout list synced from Supabase, with a Refresh button.
- [x] Start a workout, or **resume** one already in progress (e.g. started on the phone). Reps are prefilled from last time.
- [x] Exercise screen: stopwatch, name, target, machine settings, last reps, and the "Increase the weight today" flag. Prev/Next between exercises.
- [x] Reps +/− per set, and a set-done tick that starts the rest countdown (set or exercise rest) with wrist vibration. Tap to skip.
- [x] Weight: tap it to open a big keypad with decimals (e.g. 99.5). It is saved to the session and as the workout's weight. No +/− for weight.
- [x] Real-time saving of every change to the same live session as the phone. Finish & save, or discard.
- [x] The screen stays on during a workout so the timers keep running.
- [x] Timer on the watch face (ongoing activity): workout stopwatch, or the rest countdown while resting.
- [x] Rest alarm (AlarmManager + alarm-type notification): vibrates and rings when the rest ends, even with the app in the background.
- [x] Exercise notes and alternatives shown on the exercise screen.

### To do
- [ ] Test on the Pixel Watch: sign-in, sync, rest vibration.

---

## Housekeeping
- [x] One package manager (npm); removed unused expo-background-fetch / expo-task-manager and the old weight_step column.
