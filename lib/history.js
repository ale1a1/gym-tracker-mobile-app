// Past finished sessions of a workout, for the History modal (phone). The watch mirrors this logic.

export const HISTORY_PAGE = 10

export function sessionsOf(workoutHistory, workoutId) {
  return (workoutHistory || [])
    .filter((h) => h && h.originalId === workoutId && h.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
}

// One entry per session: its date and, for each exercise (or only `exerciseId`), sets / reps / kg
export function historyEntries(sessions, exerciseId = null) {
  return sessions
    .map((session) => ({
      key: session.sessionId || session.completedAt,
      date: new Date(session.completedAt),
      exercises: (session.exercises || [])
        .filter((ex) => ex && Array.isArray(ex.completed) && (!exerciseId || ex.id === exerciseId))
        .map((ex) => ({
          id: ex.id,
          name: ex.name,
          reps: ex.completed,
          // only ticked sets count for records
          doneReps: ex.completed.filter((_, i) => !Array.isArray(ex.setsCompleted) || ex.setsCompleted[i]),
          weight: ex.weight ?? null,
        })),
    }))
    .filter((entry) => entry.exercises.length > 0)
}

// Monday 00:00 of the week containing `date`
export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// Moves a month/week period back (-1) or forward (+1)
export function shiftPeriod(mode, start, direction) {
  return mode === "week"
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * direction)
    : new Date(start.getFullYear(), start.getMonth() + direction, 1)
}

export function inPeriod(mode, start, date) {
  const end = shiftPeriod(mode, start, 1)
  return date >= start && date < end
}

export function periodLabel(mode, start) {
  if (mode === "month") return start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  const fmt = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
}

export const formatHistoryDate = (date) =>
  date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })

// ---------- personal records ----------

// Best ever for each exercise: heaviest weight on a finished set, and the most reps at that weight
export function bestPerExercise(sessions) {
  const best = {}
  for (const session of sessions) {
    for (const ex of session.exercises || []) {
      if (!ex || !ex.id || ex.weight === null || ex.weight === undefined || !Array.isArray(ex.completed)) continue
      const done = ex.completed.filter((_, i) => !Array.isArray(ex.setsCompleted) || ex.setsCompleted[i])
      if (done.length === 0) continue
      const reps = Math.max(...done)
      const current = best[ex.id]
      if (!current || ex.weight > current.weight || (ex.weight === current.weight && reps > current.reps)) {
        best[ex.id] = { weight: ex.weight, reps }
      }
    }
  }
  return best
}

// A finished set beats the record: heavier, or same weight with more reps. No history = no record.
export function isNewRecord(best, weight, reps) {
  if (!best || weight === null || weight === undefined) return false
  return weight > best.weight || (weight === best.weight && reps > best.reps)
}

// Marks which history entries set a record when they happened (oldest to newest, per exercise)
export function markRecords(entries) {
  const best = {}
  const chronological = [...entries].sort((a, b) => a.date - b.date)
  for (const entry of chronological) {
    for (const ex of entry.exercises) {
      const done = ex.doneReps || ex.reps
      if (ex.weight === null || done.length === 0) continue
      const reps = Math.max(...done)
      const previous = best[ex.id || ex.name]
      ex.record = isNewRecord(previous, ex.weight, reps)
      if (!previous || ex.weight > previous.weight || (ex.weight === previous.weight && reps > previous.reps)) {
        best[ex.id || ex.name] = { weight: ex.weight, reps }
      }
    }
  }
  return entries
}
