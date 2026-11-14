// Cloud sync with Supabase. The app always writes locally first (AsyncStorage) and queues the
// change here; the queue is pushed whenever we're online, so the gym's bad signal never blocks you.
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase, ensureSignedIn } from "./supabase"

const QUEUE_KEY = "syncQueue"
const MIGRATED_KEY = "cloudMigrated"

// ---------- mapping between app objects and table rows ----------

const toNumberOrNull = (value) => (value === null || value === undefined ? null : Number(value))

function workoutFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    totalTime: row.total_time,
    setRest: row.set_rest,
    exerciseRest: row.exercise_rest,
    createdAt: row.created_at,
    exercises: (row.exercises || [])
      .sort((a, b) => a.position - b.position)
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: toNumberOrNull(ex.weight),
        setRest: ex.set_rest ?? null,
        exerciseRest: ex.exercise_rest ?? null,
        settings: ex.settings,
        notes: ex.notes,
        videos: ex.videos || [],
        alternatives: ex.alternatives || [],
      })),
  }
}

function sessionFromRow(row) {
  const byExercise = new Map()
  for (const set of [...(row.session_sets || [])].sort(
    (a, b) => a.exercise_position - b.exercise_position || a.set_index - b.set_index,
  )) {
    const key = set.exercise_id || set.exercise_name
    if (!byExercise.has(key)) {
      byExercise.set(key, {
        id: set.exercise_id,
        name: set.exercise_name,
        reps: set.target_reps,
        weight: toNumberOrNull(set.weight),
        completed: [],
        setsCompleted: [],
      })
    }
    const exercise = byExercise.get(key)
    exercise.completed.push(set.reps)
    exercise.setsCompleted.push(set.completed)
  }

  return {
    sessionId: row.id,
    id: row.workout_id,
    originalId: row.workout_id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration: row.duration_seconds,
    exercises: [...byExercise.values()].map((ex) => ({ ...ex, sets: ex.completed.length })),
  }
}

// ---------- remote operations ----------

async function upsertWorkoutRemote(workout) {
  const { error } = await supabase.from("workouts").upsert({
    id: workout.id,
    title: workout.title,
    total_time: workout.totalTime,
    set_rest: workout.setRest,
    exercise_rest: workout.exerciseRest,
    created_at: workout.createdAt || new Date().toISOString(),
  })
  if (error) throw error

  const exercises = workout.exercises || []
  if (exercises.length > 0) {
    const { error: exError } = await supabase.from("exercises").upsert(
      exercises.map((ex, position) => ({
        id: ex.id,
        workout_id: workout.id,
        position,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? null,
        set_rest: ex.setRest ?? null,
        exercise_rest: ex.exerciseRest ?? null,
        settings: ex.settings || "",
        notes: ex.notes || "",
        videos: ex.videos || [],
        alternatives: ex.alternatives || [],
      })),
    )
    if (exError) throw exError
  }

  // Remove exercises that were deleted from this workout
  let removeQuery = supabase.from("exercises").delete().eq("workout_id", workout.id)
  if (exercises.length > 0) {
    removeQuery = removeQuery.not("id", "in", `(${exercises.map((ex) => `"${ex.id}"`).join(",")})`)
  }
  const { error: removeError } = await removeQuery
  if (removeError) throw removeError
}

async function deleteWorkoutRemote(workoutId) {
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId)
  if (error) throw error
}

async function upsertSessionRemote(session) {
  const row = {
    id: session.sessionId,
    workout_id: session.originalId || null,
    title: session.title || "Workout",
    status: session.status || "completed",
    started_at: session.startedAt || null,
    completed_at: session.completedAt || null,
    duration_seconds: session.duration || 0,
  }

  let { error } = await supabase.from("workout_sessions").upsert(row)
  if (error && error.code === "23503") {
    // The workout was deleted: keep the session without the link
    ;({ error } = await supabase.from("workout_sessions").upsert({ ...row, workout_id: null }))
  }
  if (error) throw error

  const sets = []
  ;(session.exercises || []).forEach((ex, position) => {
    ;(ex.completed || []).forEach((reps, setIndex) => {
      sets.push({
        id: `${session.sessionId}-${ex.id ?? position}-${setIndex}`,
        session_id: session.sessionId,
        exercise_id: ex.id ?? null,
        exercise_name: ex.name || "Exercise",
        exercise_position: position,
        set_index: setIndex,
        target_reps: ex.reps ?? reps ?? 0,
        reps: reps ?? 0,
        weight: ex.weight ?? null,
        completed: Boolean(ex.setsCompleted?.[setIndex]),
      })
    })
  })
  if (sets.length > 0) {
    const { error: setsError } = await supabase.from("session_sets").upsert(sets)
    if (setsError) throw setsError
  }

  // Remove sets that no longer exist (e.g. sets count lowered during the workout)
  let removeQuery = supabase.from("session_sets").delete().eq("session_id", session.sessionId)
  if (sets.length > 0) removeQuery = removeQuery.not("id", "in", `(${sets.map((set) => `"${set.id}"`).join(",")})`)
  const { error: removeError } = await removeQuery
  if (removeError) throw removeError
}

async function deleteSessionRemote(sessionId) {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId)
  if (error) throw error
}

// ---------- queue ----------

async function readQueue() {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY)
    const queue = stored ? JSON.parse(stored) : []
    return Array.isArray(queue) ? queue : []
  } catch {
    return []
  }
}

// Ops with the same key replace each other, so ten weight taps upload once
export async function enqueue(op) {
  const queue = (await readQueue()).filter((item) => item.key !== op.key)
  queue.push({ ...op, queuedAt: Date.now() })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export const queueWorkoutUpsert = (workout) => enqueue({ key: `workout:${workout.id}`, type: "upsertWorkout", payload: workout })
export const queueWorkoutDelete = (workoutId) => enqueue({ key: `workout:${workoutId}`, type: "deleteWorkout", payload: workoutId })
export const queueSession = (session) => enqueue({ key: `session:${session.sessionId}`, type: "upsertSession", payload: session })
export const queueSessionDelete = (sessionId) => enqueue({ key: `session:${sessionId}`, type: "deleteSession", payload: sessionId })

let flushing = null
let flushAgain = false

// Pushes queued changes in order. Resolves true when the queue is empty.
// Called on every change, so the database follows the workout in real time.
export function flushQueue() {
  if (!supabase) return Promise.resolve(false)
  if (flushing) {
    flushAgain = true
    return flushing
  }

  flushing = (async () => {
    const user = await ensureSignedIn()
    if (!user) return false

    for (const op of await readQueue()) {
      try {
        if (op.type === "upsertWorkout") await upsertWorkoutRemote(op.payload)
        else if (op.type === "deleteWorkout") await deleteWorkoutRemote(op.payload)
        else if (op.type === "upsertSession" || op.type === "insertSession") await upsertSessionRemote(op.payload)
        else if (op.type === "deleteSession") await deleteSessionRemote(op.payload)
      } catch (error) {
        console.warn("Sync paused, will retry:", error.message || error)
        return false
      }
      // Remove only this exact op; a newer one with the same key may have been queued meanwhile
      const remaining = (await readQueue()).filter((item) => !(item.key === op.key && item.queuedAt === op.queuedAt))
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
    }
    return (await readQueue()).length === 0
  })().finally(() => {
    flushing = null
    if (flushAgain) {
      flushAgain = false
      flushQueue()
    }
  })

  return flushing
}

// First run with the cloud: upload everything that was only on the phone
export async function migrateLocalDataOnce(workouts, history) {
  if ((await AsyncStorage.getItem(MIGRATED_KEY)) === "true") return
  for (const workout of workouts || []) await queueWorkoutUpsert(workout)
  for (const session of history || []) {
    await queueSession({
      ...session,
      sessionId: session.sessionId || `${session.originalId || "session"}-${session.completedAt}`,
    })
  }
  await AsyncStorage.setItem(MIGRATED_KEY, "true")
}

// Latest data from the cloud, or null when offline / signed out
export async function pullFromCloud() {
  if (!supabase) return null
  const user = await ensureSignedIn()
  if (!user) return null

  const [workoutsResult, sessionsResult] = await Promise.all([
    supabase.from("workouts").select("*, exercises(*)").order("created_at"),
    supabase.from("workout_sessions").select("*, session_sets(*)").eq("status", "completed").order("completed_at"),
  ])
  if (workoutsResult.error || sessionsResult.error) {
    console.warn("Could not load from cloud:", (workoutsResult.error || sessionsResult.error).message)
    return null
  }

  return {
    workouts: workoutsResult.data.map(workoutFromRow),
    history: sessionsResult.data.map(sessionFromRow),
  }
}
