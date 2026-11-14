"use client"

import { createContext, useContext, useReducer, useEffect, useRef } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState, Vibration } from "react-native"
import { setupNotifications, scheduleRestEndNotification, cancelRestNotification } from "../lib/notifications"
import { hitTarget, newId } from "../lib/workoutForm"
import {
  flushQueue,
  pullFromCloud,
  migrateLocalDataOnce,
  queueWorkoutUpsert,
  queueWorkoutDelete,
  queueSession,
  queueSessionDelete,
} from "../lib/sync"
import { showStopwatch, showCountdown, showStatic, hideLiveTimer } from "../modules/live-timer"

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
  workoutStartTime: null,
  restStartTime: null,
  restDuration: null,
  // When a rest ran out by itself (not skipped): the workout screen flashes "Rest is over"
  restOverAt: null,
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
    case "SET_WORKOUT_START_TIME":
      return { ...state, workoutStartTime: action.payload }
    case "SET_REST_START_TIME":
      return { ...state, restStartTime: action.payload }
    case "SET_REST_DURATION":
      return { ...state, restDuration: action.payload }
    case "SET_REST_OVER":
      return { ...state, restOverAt: action.payload }
    default:
      return state
  }
}

export function WorkoutProvider({ children }) {
  const [state, dispatch] = useReducer(workoutReducer, initialState)
  // Id of the scheduled "rest is over" notification, so it can be cancelled on skip/finish
  const restNotificationId = useRef(null)

  useEffect(() => {
    setupNotifications()
  }, [])

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === "active") {
        // App came to foreground - recalculate timers and catch up with the cloud
        recalculateTimers()
        syncWithCloud()
      } else if (nextAppState === "background" || nextAppState === "inactive") {
        // App going to background - save current state
        saveTimerStates()
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription?.remove()
  }, [])

  // Recalculate timers when app comes back to foreground
  const recalculateTimers = async () => {
    try {
      const now = Date.now()

      // Recalculate workout timer - THIS IS THE FIX
      const workoutData = await AsyncStorage.getItem("workoutTimerData")
      if (workoutData) {
        const { isRunning, startTime } = JSON.parse(workoutData)
        if (isRunning && startTime) {
          const elapsedSeconds = Math.floor((now - startTime) / 1000)

          // CRITICAL: Set the start time FIRST, then the timer and running state
          dispatch({ type: "SET_WORKOUT_START_TIME", payload: startTime })
          dispatch({ type: "SET_WORKOUT_TIMER", payload: elapsedSeconds })
          dispatch({ type: "SET_WORKOUT_RUNNING", payload: true })

          // Save to storage
          await AsyncStorage.setItem("workoutTimer", elapsedSeconds.toString())
          await AsyncStorage.setItem("isWorkoutRunning", "true")
        }
      }

      // Recalculate rest timer
      const restData = await AsyncStorage.getItem("restTimerData")
      if (restData) {
        const { isResting, startTime, duration, type, notificationId } = JSON.parse(restData)
        restNotificationId.current = notificationId || null
        if (isResting && startTime && duration) {
          const elapsedSeconds = Math.floor((now - startTime) / 1000)
          const remainingSeconds = Math.max(0, duration - elapsedSeconds)

          if (remainingSeconds <= 0) {
            // Rest finished while app was closed
            dispatch({ type: "SET_RESTING", payload: false })
            dispatch({ type: "SET_REST_TIMER", payload: 0 })
            dispatch({ type: "SET_REST_TYPE", payload: "" })
            dispatch({ type: "SET_REST_START_TIME", payload: null })
            dispatch({ type: "SET_REST_DURATION", payload: null })
            await AsyncStorage.multiRemove(["restTimerData", "restTimer", "isResting", "restType"])
          } else {
            // Rest still active
            dispatch({ type: "SET_REST_START_TIME", payload: startTime })
            dispatch({ type: "SET_REST_DURATION", payload: duration })
            dispatch({ type: "SET_RESTING", payload: true })
            dispatch({ type: "SET_REST_TIMER", payload: remainingSeconds })
            dispatch({ type: "SET_REST_TYPE", payload: type })
            await AsyncStorage.multiSet([
              ["restTimer", remainingSeconds.toString()],
              ["isResting", "true"],
              ["restType", type || ""],
            ])
          }
        }
      }
    } catch (error) {
      console.error("Error recalculating timers:", error)
    }
  }

  // Save timer states when app goes to background
  const saveTimerStates = async () => {
    try {
      // Save workout timer state
      if (state.isWorkoutRunning && state.workoutStartTime) {
        await AsyncStorage.setItem(
          "workoutTimerData",
          JSON.stringify({
            isRunning: true,
            startTime: state.workoutStartTime,
          }),
        )
      }

      // Save rest timer state
      if (state.isResting && state.restStartTime && state.restDuration) {
        await AsyncStorage.setItem(
          "restTimerData",
          JSON.stringify({
            isResting: true,
            startTime: state.restStartTime,
            duration: state.restDuration,
            type: state.restType,
          }),
        )
      }
    } catch (error) {
      console.error("Error saving timer states:", error)
    }
  }

  // Global timer that runs continuously when workout is active
  useEffect(() => {
    let interval
    if (state.activeWorkout && state.isWorkoutRunning && state.workoutStartTime) {
      interval = setInterval(() => {
        // Always use timestamp for accuracy
        const elapsedSeconds = Math.floor((Date.now() - state.workoutStartTime) / 1000)
        dispatch({ type: "SET_WORKOUT_TIMER", payload: elapsedSeconds })
        saveWorkoutTimer(elapsedSeconds)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [state.activeWorkout, state.isWorkoutRunning, state.workoutStartTime])

  // Rest timer that runs when resting
  useEffect(() => {
    let interval
    if (state.isResting && state.restTimer > 0) {
      interval = setInterval(() => {
        if (state.restStartTime && state.restDuration) {
          // Use timestamp for accuracy
          const elapsedSeconds = Math.floor((Date.now() - state.restStartTime) / 1000)
          const remainingSeconds = Math.max(0, state.restDuration - elapsedSeconds)

          if (remainingSeconds <= 0) {
            dispatch({ type: "SET_RESTING", payload: false })
            dispatch({ type: "SET_REST_TIMER", payload: 0 })
            dispatch({ type: "SET_REST_TYPE", payload: "" })
            dispatch({ type: "SET_REST_START_TIME", payload: null })
            dispatch({ type: "SET_REST_DURATION", payload: null })
            restNotificationId.current = null
            dispatch({ type: "SET_REST_OVER", payload: Date.now() })
            Vibration.vibrate([0, 500, 250, 500, 250, 500])
            clearRestTimerData()
          } else {
            dispatch({ type: "SET_REST_TIMER", payload: remainingSeconds })
          }
        } else {
          dispatch({ type: "DECREMENT_REST_TIMER" })
          if (state.restTimer <= 1) {
            dispatch({ type: "SET_RESTING", payload: false })
            dispatch({ type: "SET_REST_TIMER", payload: 0 })
            dispatch({ type: "SET_REST_TYPE", payload: "" })
            clearRestTimerData()
          }
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [state.isResting, state.restTimer, state.restStartTime, state.restDuration])

  // Live timer on the lock screen / status bar (APK only): rest countdown, workout stopwatch, or paused
  useEffect(() => {
    const workout = state.activeWorkout
    if (!workout) {
      hideLiveTimer()
      return
    }
    if (!state.isWorkoutRunning) {
      const mins = Math.floor(state.workoutTimer / 60)
      const secs = state.workoutTimer % 60
      showStatic(workout.title, `Paused at ${mins}:${secs.toString().padStart(2, "0")}`)
      return
    }
    if (state.isResting && state.restStartTime && state.restDuration) {
      showCountdown(
        workout.title,
        state.restType === "set" ? "Set rest" : "Exercise rest",
        state.restStartTime + state.restDuration * 1000,
      )
    } else if (state.workoutStartTime) {
      showStopwatch(workout.title, "Workout in progress", state.workoutStartTime)
    }
  }, [
    state.activeWorkout?.id,
    state.activeWorkout?.title,
    state.isWorkoutRunning,
    state.workoutStartTime,
    state.isResting,
    state.restStartTime,
    state.restDuration,
    state.restType,
  ])

  useEffect(() => {
    loadWorkouts()
  }, [])

  const loadWorkouts = async () => {
    try {
      const [storedWorkouts, storedHistory, storedActiveWorkout] = await Promise.all([
        AsyncStorage.getItem("workouts"),
        AsyncStorage.getItem("workoutHistory"),
        AsyncStorage.getItem("activeWorkout"),
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

      // Recalculate timers after loading basic data
      setTimeout(() => recalculateTimers(), 200)

      // Local data is on screen; now upload pending changes and refresh from the cloud
      const workouts = storedWorkouts ? JSON.parse(storedWorkouts) : []
      const history = storedHistory ? JSON.parse(storedHistory) : []
      await migrateLocalDataOnce(
        Array.isArray(workouts) ? workouts : [],
        Array.isArray(history) ? history : [],
      )
      syncWithCloud()
    } catch (error) {
      console.error("Error loading workouts:", error)
    }
  }

  // Push queued changes, then pull the latest. Pull only when nothing is pending, so offline
  // edits are never overwritten by older cloud data.
  const syncWithCloud = async () => {
    try {
      const queueEmpty = await flushQueue()
      if (!queueEmpty) return
      const cloud = await pullFromCloud()
      if (!cloud) return
      dispatch({ type: "SET_WORKOUTS", payload: cloud.workouts })
      dispatch({ type: "SET_WORKOUT_HISTORY", payload: cloud.history })
      saveWorkouts(cloud.workouts)
      saveWorkoutHistory(cloud.history)
    } catch (error) {
      console.warn("Cloud sync failed:", error)
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

  const clearRestTimerData = async () => {
    try {
      await AsyncStorage.multiRemove(["restTimerData", "restTimer", "isResting", "restType"])
    } catch (error) {
      console.error("Error clearing rest timer data:", error)
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
    const newWorkout = { ...workout, id: newId() }
    const updatedWorkouts = [...(state.workouts || []), newWorkout]
    dispatch({ type: "ADD_WORKOUT", payload: newWorkout })
    saveWorkouts(updatedWorkouts)
    queueWorkoutUpsert(newWorkout).then(flushQueue)
  }

  const updateWorkout = (workout) => {
    if (!workout || typeof workout !== "object" || !workout.id) return
    const updatedWorkouts = (state.workouts || []).map((w) => (w.id === workout.id ? workout : w))
    dispatch({ type: "UPDATE_WORKOUT", payload: workout })
    saveWorkouts(updatedWorkouts)
    queueWorkoutUpsert(workout).then(flushQueue)
  }

  const deleteWorkout = (workoutId) => {
    if (!workoutId) return
    const updatedWorkouts = (state.workouts || []).filter((w) => w.id !== workoutId)
    dispatch({ type: "DELETE_WORKOUT", payload: workoutId })
    saveWorkouts(updatedWorkouts)
    queueWorkoutDelete(workoutId).then(flushQueue)
  }

  const setActiveWorkout = async (workout) => {
    if (!workout) {
      skipRest()
      // Cancelled: remove the live session from the cloud too
      if (state.activeWorkout?.sessionId) queueSessionDelete(state.activeWorkout.sessionId).then(flushQueue)
      dispatch({ type: "SET_ACTIVE_WORKOUT", payload: null })
      saveActiveWorkout(null)
      return
    }

    // First, try to get the latest workout data from current state
    let latestWorkout = (state.workouts || []).find(w => w.id === workout.id)
    
    // If not found in state, try to get from storage
    if (!latestWorkout) {
      try {
        const storedWorkouts = await AsyncStorage.getItem("workouts")
        const workouts = storedWorkouts ? JSON.parse(storedWorkouts) : []
        latestWorkout = workouts.find(w => w.id === workout.id)
      } catch (error) {
        console.error("Error getting latest workout:", error)
      }
    }

    // Use the latest workout data if found, otherwise use the passed workout
    const workoutToUse = latestWorkout || workout

    // Get last session data to pre-populate reps
    const lastSession = await getLastWorkoutSession(workoutToUse.id)
    const workoutWithPrefill = {
      ...workoutToUse,
      exercises: Array.isArray(workoutToUse.exercises)
        ? workoutToUse.exercises.map((ex) => {
            if (!ex || typeof ex !== "object") return ex
            const lastExercise = lastSession?.exercises?.find((lastEx) => lastEx && lastEx.id === ex.id)
            
            // Use the current exercise's sets count, not the old one
            const targetSets = typeof ex.sets === "number" ? ex.sets : 3
            const targetReps = typeof ex.reps === "number" ? ex.reps : 10

            const lastWeight = lastExercise ? (lastExercise.weight ?? null) : null
            const currentWeight = ex.weight ?? null

            return {
              ...ex,
              weight: currentWeight,
              lastWeight,
              // Last time every set hit the target at this same weight: time to go heavier
              increaseSuggested:
                currentWeight !== null && hitTarget(lastExercise) && lastWeight !== null && currentWeight <= lastWeight,
              completed:
                lastExercise && Array.isArray(lastExercise.completed)
                  ? [...lastExercise.completed].slice(0, targetSets).concat(new Array(Math.max(0, targetSets - lastExercise.completed.length)).fill(0))
                  : new Array(targetSets).fill(targetReps),
              lastPerformance: lastExercise && Array.isArray(lastExercise.completed) ? lastExercise.completed : null,
              isCompleted: false,
              setsCompleted: new Array(targetSets).fill(false),
            }
          })
        : [],
    }

    // The live session exists in the cloud from the start, and is updated on every change
    workoutWithPrefill.sessionId = newId()
    workoutWithPrefill.startedAt = new Date().toISOString()

    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: workoutWithPrefill })
    saveActiveWorkout(workoutWithPrefill)
    pushLiveSession(workoutWithPrefill)
  }

  const pushLiveSession = (workout) => {
    queueSession({ ...workout, originalId: workout.id, status: "in_progress" }).then(flushQueue)
  }

  const startWorkout = () => {
    // Calculate new start time based on current timer value
    // This ensures the timer continues from where it was paused
    const newStartTime = Date.now() - (state.workoutTimer * 1000)
    
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: true })
    dispatch({ type: "SET_WORKOUT_START_TIME", payload: newStartTime })
    saveWorkoutRunning(true)
    AsyncStorage.setItem("workoutTimerData", JSON.stringify({ 
      isRunning: true, 
      startTime: newStartTime 
    }))
  }

  const pauseWorkout = () => {
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: false })
    saveWorkoutRunning(false)
    AsyncStorage.removeItem("workoutTimerData")
    // Keep workoutStartTime so we know it's a paused workout, not a new one
  }

  const finishWorkout = (completedWorkout) => {
    if (!completedWorkout || typeof completedWorkout !== "object") return

    const workoutToSave = {
      ...completedWorkout,
      sessionId: completedWorkout.sessionId || newId(),
      status: "completed",
      completedAt: new Date().toISOString(),
      originalId: completedWorkout.id,
      duration: state.workoutTimer,
    }
    queueSession(workoutToSave).then(flushQueue)

    cancelRestNotification(restNotificationId.current)
    restNotificationId.current = null

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
    dispatch({ type: "SET_WORKOUT_START_TIME", payload: null })
    dispatch({ type: "SET_REST_START_TIME", payload: null })
    dispatch({ type: "SET_REST_DURATION", payload: null })
    dispatch({ type: "SET_REST_OVER", payload: null })

    saveActiveWorkout(null)
    saveWorkoutRunning(false)
    saveWorkoutTimer(0)
    AsyncStorage.multiRemove(["workoutTimerData", "restTimerData"])
  }

  // Every tick, reps change or weight change lands here and is pushed to the cloud right away
  const updateActiveWorkout = (workout) => {
    if (!workout || typeof workout !== "object") return
    // Workouts started before live sessions existed get one now
    const live = workout.sessionId
      ? workout
      : { ...workout, sessionId: newId(), startedAt: new Date().toISOString() }
    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: live })
    saveActiveWorkout(live)
    pushLiveSession(live)
  }

  // Throws the running workout away (nothing goes to history; the live session is deleted)
  const discardWorkout = () => {
    pauseWorkout()
    setWorkoutTimer(0)
    setActiveWorkout(null)
    dispatch({ type: "SET_REST_OVER", payload: null })
  }

  const clearRestOver = () => dispatch({ type: "SET_REST_OVER", payload: null })

  const setWorkoutTimer = (time) => {
    if (typeof time === "number" && !isNaN(time)) {
      dispatch({ type: "SET_WORKOUT_TIMER", payload: time })
      saveWorkoutTimer(time)

      if (time === 0) {
        dispatch({ type: "SET_WORKOUT_START_TIME", payload: null })
        AsyncStorage.removeItem("workoutTimerData")
      }
    }
  }

  const startRest = async (type, duration) => {
    if (typeof duration === "number" && !isNaN(duration) && duration > 0) {
      const startTime = Date.now()
      cancelRestNotification(restNotificationId.current)
      restNotificationId.current = null
      dispatch({ type: "SET_REST_TIMER", payload: duration })
      dispatch({ type: "SET_REST_TYPE", payload: type || "" })
      dispatch({ type: "SET_RESTING", payload: true })
      dispatch({ type: "SET_REST_START_TIME", payload: startTime })
      dispatch({ type: "SET_REST_DURATION", payload: duration })
      dispatch({ type: "SET_REST_OVER", payload: null })

      // Save rest state
      AsyncStorage.multiSet([
        ["restTimerData", JSON.stringify({ isResting: true, startTime, duration, type })],
        ["restTimer", duration.toString()],
        ["isResting", "true"],
        ["restType", type || ""],
      ])

      // Alert with sound + vibration when the rest ends, even with the app closed or the phone locked
      const notificationId = await scheduleRestEndNotification(duration, type)
      restNotificationId.current = notificationId
      if (notificationId) {
        AsyncStorage.setItem(
          "restTimerData",
          JSON.stringify({ isResting: true, startTime, duration, type, notificationId }),
        )
      }
    }
  }

  const skipRest = () => {
    cancelRestNotification(restNotificationId.current)
    restNotificationId.current = null
    dispatch({ type: "SET_RESTING", payload: false })
    dispatch({ type: "SET_REST_TIMER", payload: 0 })
    dispatch({ type: "SET_REST_TYPE", payload: "" })
    dispatch({ type: "SET_REST_START_TIME", payload: null })
    dispatch({ type: "SET_REST_DURATION", payload: null })
    clearRestTimerData()
  }

  // Changing the weight during a workout also updates the saved workout, so next time starts from it
  const updateExerciseWeight = (exerciseId, weight) => {
    if (state.activeWorkout) {
      updateActiveWorkout({
        ...state.activeWorkout,
        exercises: state.activeWorkout.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                weight,
                increaseSuggested: ex.increaseSuggested && !(weight > (ex.lastWeight ?? 0)),
              }
            : ex,
        ),
      })
    }

    const template = (state.workouts || []).find((w) => w.id === state.activeWorkout?.id)
    if (template) {
      updateWorkout({
        ...template,
        exercises: template.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, weight } : ex)),
      })
    }
  }

  // After signing out: drop the local copy and the sync queue (they belong to the old account)
  const clearLocalData = async () => {
    skipRest()
    dispatch({ type: "SET_ACTIVE_WORKOUT", payload: null })
    dispatch({ type: "SET_WORKOUTS", payload: [] })
    dispatch({ type: "SET_WORKOUT_HISTORY", payload: [] })
    dispatch({ type: "SET_WORKOUT_RUNNING", payload: false })
    dispatch({ type: "SET_WORKOUT_TIMER", payload: 0 })
    dispatch({ type: "SET_WORKOUT_START_TIME", payload: null })
    await AsyncStorage.multiRemove([
      "workouts",
      "workoutHistory",
      "activeWorkout",
      "workoutTimerData",
      "workoutTimer",
      "isWorkoutRunning",
      "syncQueue",
    ])
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
        discardWorkout,
        clearRestOver,
        updateActiveWorkout,
        setWorkoutTimer,
        getLastWorkoutSession,
        startRest,
        skipRest,
        updateExerciseWeight,
        syncWithCloud,
        clearLocalData,
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