"use client"

import { createContext, useContext, useReducer, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

const WorkoutContext = createContext()

const initialState = {
  workouts: [],
  activeWorkout: null,
  isWorkoutRunning: false,
  workoutTimer: 0,
  workoutHistory: [],
  restTimer: 0,
  isResting: false,
  restType: "",
}

function workoutReducer(state, action) {
  switch (action.type) {
    case "SET_WORKOUTS":
      return { ...state, workouts: action.payload }
    case "ADD_WORKOUT":
      return { ...state, workouts: [...state.workouts, action.payload] }
    case "UPDATE_WORKOUT":
      return {
        ...state,
        workouts: state.workouts.map((workout) => (workout.id === action.payload.id ? action.payload : workout)),
      }
    case "DELETE_WORKOUT":
      return {
        ...state,
        workouts: state.workouts.filter((workout) => workout.id !== action.payload),
      }
    case "SET_ACTIVE_WORKOUT":
      return { ...state, activeWorkout: action.payload }
    case "SET_WORKOUT_RUNNING":
      return { ...state, isWorkoutRunning: action.payload }
    case "SET_WORKOUT_TIMER":
      return { ...state, workoutTimer: action.payload }
    case "INCREMENT_WORKOUT_TIMER":
      return { ...state, workoutTimer: state.workoutTimer + 1 }
    case "SET_WORKOUT_HISTORY":
      return { ...state, workoutHistory: action.payload }
    case "SET_REST_TIMER":
      return { ...state, restTimer: action.payload }
    case "DECREMENT_REST_TIMER":
      return { ...state, restTimer: Math.max(0, state.restTimer - 1) }
    case "SET_RESTING":
      return { ...state, isResting: action.payload }
    case "SET_REST_TYPE":
      return { ...state, restType: action.payload }
    default:
      return state
  }
}

export function WorkoutProvider({ children }) {
  const [state, dispatch] = useReducer(workoutReducer, initialState)

  // Global timer that runs continuously when workout is active
  useEffect(() => {
    let interval
    if (state.activeWorkout && state.isWorkoutRunning) {
      interval = setInterval(() => {
        dispatch({ type: "INCREMENT_WORKOUT_TIMER" })
        saveWorkoutTimer(state.workoutTimer + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [state.activeWorkout, state.isWorkoutRunning, state.workoutTimer])

  // Rest timer that runs when resting
  useEffect(() => {
    let interval
    if (state.isResting && state.restTimer > 0) {
      interval = setInterval(() => {
        dispatch({ type: "DECREMENT_REST_TIMER" })
        if (state.restTimer <= 1) {
          dispatch({ type: "SET_RESTING", payload: false })
          dispatch({ type: "SET_REST_TIMER", payload: 0 })
          dispatch({ type: "SET_REST_TYPE", payload: "" })
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [state.isResting, state.restTimer])

  useEffect(() => {
    loadWorkouts()
  }, [])

  const loadWorkouts = async () => {
    try {
      const [storedWorkouts, storedHistory, storedActiveWorkout, storedTimer, storedRunning] = await Promise.all([
        AsyncStorage.getItem("workouts"),
        AsyncStorage.getItem("workoutHistory"),
        AsyncStorage.getItem("activeWorkout"),
        AsyncStorage.getItem("workoutTimer"),
        AsyncStorage.getItem("isWorkoutRunning"),
      ])

      if (storedWorkouts) {
        const workouts = JSON.parse(storedWorkouts)
        dispatch({ type: "SET_WORKOUTS", payload: Array.isArray(workouts) ? workouts : [] })
      }

      if (storedHistory) {
        const history = JSON.parse(storedHistory)
        dispatch({ type: "SET_WORKOUT_HISTORY", payload: Array.isArray(history) ? history : [] })
      }

      if (storedActiveWorkout) {
        const activeWorkout = JSON.parse(storedActiveWorkout)
        if (activeWorkout && typeof activeWorkout === "object") {
          dispatch({ type: "SET_ACTIVE_WORKOUT", payload: activeWorkout })
        }
      }

      if (storedTimer) {
        const timer = Number.parseInt(storedTimer)
        if (!isNaN(timer)) {
          dispatch({ type: "SET_WORKOUT_TIMER", payload: timer })
        }
      }

      if (storedRunning) {
        const isRunning = JSON.parse(storedRunning)
        dispatch({ type: "SET_WORKOUT_RUNNING", payload: Boolean(isRunning) })
      }
    } catch (error) {
      console.error("Error loading workouts:", error)
    }
  }

  const saveWorkouts = async (workouts) => {
    try {
      if (Array.isArray(workouts)) {
        await AsyncStorage.setItem("workouts", JSON.stringify(workouts))
      }
    } catch (error) {
      console.error("Error saving workouts:", error)
    }
  }

  const saveWorkoutHistory = async (history) => {
    try {
      if (Array.isArray(history)) {
        await AsyncStorage.setItem("workoutHistory", JSON.stringify(history))
      }
    } catch (error) {
      console.error("Error saving workout history:", error)
    }
  }

  const saveActiveWorkout = async (workout) => {
    try {
      if (workout && typeof workout === "object") {
        await AsyncStorage.setItem("activeWorkout", JSON.stringify(workout))
      } else {
        await AsyncStorage.removeItem("activeWorkout")
      }
    } catch (error) {
      console.error("Error saving active workout:", error)
    }
  }

  const saveWorkoutTimer = async (timer) => {
    try {
      if (typeof timer === "number" && !isNaN(timer)) {
        await AsyncStorage.setItem("workoutTimer", timer.toString())
      }
    } catch (error) {
      console.error("Error saving workout timer:", error)
    }
  }

  const saveWorkoutRunning = async (isRunning) => {
    try {
      await AsyncStorage.setItem("isWorkoutRunning", JSON.stringify(Boolean(isRunning)))
    } catch (error) {
      console.error("Error saving workout running state:", error)
    }
  }

  const getLastWorkoutSession = async (workoutId) => {
    try {
      // Always get fresh data from storage
      const storedHistory = await AsyncStorage.getItem("workoutHistory")
      const history = storedHistory ? JSON.parse(storedHistory) : []
      
      if (!Array.isArray(history) || !workoutId) {
        return null
      }
      
      return history
        .filter((h) => h && h.originalId === workoutId)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
    } catch (error) {
      console.error("Error getting last workout session:", error)
      return null
    }
  }

  const addWorkout = (workout) => {
    if (!workout || typeof workout !== "object") return

    const newWorkout = { ...workout, id: Date.now().toString() }
    const updatedWorkouts = [...(state.workouts || []), newWorkout]
    dispatch({ type: "ADD_WORKOUT", payload: newWorkout })
    saveWorkouts(updatedWorkouts)
  }

  const updateWorkout = (workout) => {
    if (!workout || typeof workout !== "object" || !workout.id) return

    const updatedWorkouts = (state.workouts || []).map((w) => (w.id === workout.id ? workout : w))
    dispatch({ type: "UPDATE_WORKOUT", payload: workout })
    saveWorkouts(updatedWorkouts)
  }

  const deleteWorkout = (workoutId) => {
    if (!workoutId) return

    const updatedWorkouts = (state.workouts || []).filter((w) => w.id !== workoutId)
    dispatch({ type: "DELETE_WORKOUT", payload: workoutId })
    saveWorkouts(updatedWorkouts)
  }

  const setActiveWorkout = async (workout) => {
    if (!workout) {
      dispatch({ type: "SET_ACTIVE_WORKOUT", payload: null })
      saveActiveWorkout(null)
      return
    }

    // Get last session data to pre-populate reps
    const lastSession = await getLastWorkoutSession(workout.id)

    const workoutWithPrefill = {
      ...workout,
      exercises: Array.isArray(workout.exercises)
        ? workout.exercises.map((ex) => {
            if (!ex || typeof ex !== "object") return ex

            const lastExercise = lastSession?.exercises?.find((lastEx) => lastEx && lastEx.id === ex.id)
            const targetSets = typeof ex.sets === "number" ? ex.sets : 3
            const targetReps = typeof ex.reps === "number" ? ex.reps : 10

            return {
              ...ex,
              completed:
                lastExercise && Array.isArray(lastExercise.completed)
                  ? [...lastExercise.completed]
                  : new Array(targetSets).fill(targetReps),
              lastPerformance: lastExercise && Array.isArray(lastExercise.completed) ? lastExercise.completed : null,
              isCompleted: false,
              setsCompleted: new Array(targetSets).fill(false),
            }
          })
        : [],
    }

    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: workoutWithPrefill })
    saveActiveWorkout(workoutWithPrefill)
  }

  const startWorkout = () => {
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: true })
    saveWorkoutRunning(true)
  }

  const pauseWorkout = () => {
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: false })
    saveWorkoutRunning(false)
  }

  const finishWorkout = (completedWorkout) => {
    if (!completedWorkout || typeof completedWorkout !== "object") return

    const workoutToSave = {
      ...completedWorkout,
      completedAt: new Date().toISOString(),
      originalId: completedWorkout.id,
      duration: state.workoutTimer,
    }

    const updatedHistory = [...(state.workoutHistory || []), workoutToSave]
    dispatch({ type: "SET_WORKOUT_HISTORY", payload: updatedHistory })
    saveWorkoutHistory(updatedHistory)

    // Clear active workout and timer
    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: null })
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: false })
    dispatch({ type: "SET_WORKOUT_TIMER", payload: 0 })
    dispatch({ type: "SET_RESTING", payload: false })
    dispatch({ type: "SET_REST_TIMER", payload: 0 })
    dispatch({ type: "SET_REST_TYPE", payload: "" })

    saveActiveWorkout(null)
    saveWorkoutRunning(false)
    saveWorkoutTimer(0)
  }

  const updateActiveWorkout = (workout) => {
    if (!workout || typeof workout !== "object") return

    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: workout })
    saveActiveWorkout(workout)
  }

  const setWorkoutTimer = (time) => {
    if (typeof time === "number" && !isNaN(time)) {
      dispatch({ type: "SET_WORKOUT_TIMER", payload: time })
      saveWorkoutTimer(time)
    }
  }

  const startRest = (type, duration) => {
    if (typeof duration === "number" && !isNaN(duration) && duration > 0) {
      dispatch({ type: "SET_REST_TIMER", payload: duration })
      dispatch({ type: "SET_REST_TYPE", payload: type || "" })
      dispatch({ type: "SET_RESTING", payload: true })
    }
  }

  const skipRest = () => {
    dispatch({ type: "SET_RESTING", payload: false })
    dispatch({ type: "SET_REST_TIMER", payload: 0 })
    dispatch({ type: "SET_REST_TYPE", payload: "" })
  }

  return (
    <WorkoutContext.Provider
      value={{
        ...state,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        setActiveWorkout,
        startWorkout,
        pauseWorkout,
        finishWorkout,
        updateActiveWorkout,
        setWorkoutTimer,
        getLastWorkoutSession,
        startRest,
        skipRest,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  )
}

export const useWorkout = () => {
  const context = useContext(WorkoutContext)
  if (!context) {
    throw new Error("useWorkout must be used within a WorkoutProvider")
  }
  return context
}