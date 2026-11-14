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

