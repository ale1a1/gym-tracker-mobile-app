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

### To do / to verify on the phone
- [ ] Test the lock-screen live timer (stopwatch, rest countdown, paused).
- [ ] Test Google sign-in end to end ("Synced as …").
- [ ] Workout history screen: past sessions per workout, with weight and reps over time.
- [ ] App icon and name (currently the Expo defaults / "GymTrackerSimple").

---

## 🔄 Shared (phone + watch + database)

### Done
- [x] Supabase tables `workouts`, `exercises`, `workout_sessions`, `session_sets`, with row-level security (each user sees only their own rows).
- [x] Offline-first sync: changes save locally at once and are queued, then pushed when online.
- [x] **Real-time workout saving**: a live session (`status = in_progress`) is created when a workout starts. Every set tick, reps change and weight change is pushed within a second. Finish marks it `completed`; cancel deletes it.

### To do
- [ ] Supabase Realtime subscription, so the phone and the watch see each other's changes instantly while both are open.
- [ ] Only one active workout at a time across devices (resume the live session from either device).
- [ ] Optional: CAPTCHA for anonymous sign-ups (Supabase suggests it; low priority for a personal app).

---

## ⌚ Pixel Watch (Wear OS)
- Native Kotlin app (Compose for Wear OS). Expo/React Native can't build Wear OS apps.
- **Split:** the phone creates and edits workouts. The watch is only for doing a workout. Workouts sync from the phone through Supabase (same Google account).

### To do
- [ ] Google sign-in on the watch (same account as the phone).
- [ ] Pick a workout from the synced list.
- [ ] Current exercise screen: name, target sets × reps, weight, machine settings, and the "increase the weight" flag.
- [ ] Reps: +/− per set. Tap "set done", which starts the rest countdown with wrist vibration.
- [ ] Weight: tap it to open a big numeric entry with decimals (e.g. 99.5). No +/− for weight.
- [ ] Workout stopwatch plus an ongoing activity on the watch face.
- [ ] Every change saved to the live session in real time, the same as the phone.

---

## Housekeeping
- [ ] Pick one package manager: there are both `package-lock.json` and `pnpm-lock.yaml`.
- [ ] Remove `expo-background-fetch` and `expo-task-manager` if they stay unused.
- [ ] The `weight_step` column in `exercises` is unused (kept with default 2). Drop it in a later migration.
