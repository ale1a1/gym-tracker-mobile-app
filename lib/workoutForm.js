// Converts between stored workouts (numbers) and form state (strings for TextInputs)

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const emptyExercise = () => ({
  id: newId(),
  name: "",
  sets: "4",
  reps: "10",
  weight: "",
  settings: "",
  notes: "",
  videos: [],
  alternatives: [],
})

// An alternative exercise ("oppure"), e.g. when the machine is busy
export const emptyAlternative = () => ({
  id: newId(),
  name: "",
  sets: "4",
  reps: "10",
  weight: "",
  settings: "",
  notes: "",
  videos: [],
})

export const emptyWorkoutForm = () => ({
  title: "",
  totalTime: "60",
  setRest: "60",
  exerciseRest: "120",
  exercises: [],
})

const toText = (value) => (value === null || value === undefined ? "" : String(value))

export function workoutToForm(workout) {
  return {
    title: workout.title || "",
    totalTime: toText(workout.totalTime),
    setRest: toText(workout.setRest),
    exerciseRest: toText(workout.exerciseRest),
    exercises: (workout.exercises || []).map((ex) => ({
      id: ex.id,
      name: ex.name || "",
      sets: toText(ex.sets),
      reps: toText(ex.reps),
      weight: toText(ex.weight),
      settings: ex.settings || "",
      notes: ex.notes || "",
      videos: Array.isArray(ex.videos) ? [...ex.videos] : [],
      alternatives: (ex.alternatives || []).map((alt) => ({
        id: alt.id || newId(),
        name: alt.name || "",
        sets: toText(alt.sets),
        reps: toText(alt.reps),
        weight: toText(alt.weight),
        settings: alt.settings || "",
        notes: alt.notes || "",
        videos: Array.isArray(alt.videos) ? [...alt.videos] : [],
      })),
    })),
  }
}

const parseDecimal = (text) => {
  const value = Number.parseFloat(String(text).replace(",", "."))
  return Number.isFinite(value) ? value : null
}

// Returns { workout } on success or { error } with a message to show
export function formToWorkout(form, base = {}) {
  if (!form.title.trim()) return { error: "Please enter a workout title" }

  const totalTime = Number.parseInt(form.totalTime)
  if (!totalTime || totalTime <= 0) return { error: "Please enter a valid total time in minutes" }

  if (form.exercises.length === 0) return { error: "Please add at least one exercise" }

  const exercises = []
  for (const ex of form.exercises) {
    const sets = Number.parseInt(ex.sets)
    const reps = Number.parseInt(ex.reps)
    if (!ex.name.trim() || !sets || !reps) return { error: "Each exercise needs a name, sets and reps" }

    const weight = ex.weight.trim() === "" ? null : parseDecimal(ex.weight)
    if (ex.weight.trim() !== "" && weight === null) return { error: `"${ex.name}" has an invalid weight` }

    const alternatives = []
    for (const alt of ex.alternatives || []) {
      if (!alt.name.trim()) return { error: `An alternative of "${ex.name}" needs a name` }
      const altWeight = alt.weight.trim() === "" ? null : parseDecimal(alt.weight)
      if (alt.weight.trim() !== "" && altWeight === null) return { error: `"${alt.name}" has an invalid weight` }
      alternatives.push({
        id: alt.id,
        name: alt.name.trim(),
        sets: Number.parseInt(alt.sets) || sets,
        reps: Number.parseInt(alt.reps) || reps,
        weight: altWeight,
        settings: alt.settings.trim(),
        notes: alt.notes.trim(),
        videos: (alt.videos || []).map((url) => url.trim()).filter(Boolean),
      })
    }

    exercises.push({
      id: ex.id,
      name: ex.name.trim(),
      sets,
      reps,
      weight,
      settings: ex.settings.trim(),
      notes: ex.notes.trim(),
      videos: ex.videos.map((url) => url.trim()).filter(Boolean),
      alternatives,
    })
  }

  return {
    workout: {
      ...base,
      title: form.title.trim(),
      totalTime,
      setRest: Number.parseInt(form.setRest) || 60,
      exerciseRest: Number.parseInt(form.exerciseRest) || 120,
      exercises,
      createdAt: base.createdAt || new Date().toISOString(),
    },
  }
}

export const formatWeight = (weight) => (weight === null || weight === undefined ? null : `${Math.round(weight * 100) / 100} kg`)

// True when every set was ticked and reached the target reps
export function hitTarget(exercise) {
  if (!exercise || !Array.isArray(exercise.completed) || exercise.completed.length === 0) return false
  if (exercise.completed.length < (exercise.sets || 0)) return false
  const allTicked = !Array.isArray(exercise.setsCompleted) || exercise.setsCompleted.every(Boolean)
  return allTicked && exercise.completed.every((reps) => reps >= exercise.reps)
}
