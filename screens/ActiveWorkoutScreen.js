"use client"

import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import WeightControl from "../components/WeightControl"
import KeyboardSafeView from "../components/KeyboardSafeView"
import VideoButton from "../components/VideoButton"
import AlternativesBox from "../components/AlternativesBox"
import HistoryModal from "../components/HistoryModal"
import { formatWeight, hitTarget } from "../lib/workoutForm"
import { useThemedStyles, useTheme } from "../lib/theme"

export default function ActiveWorkoutScreen({ route, navigation }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const { workout } = route.params || {}
  const {
    updateWorkout,
    finishWorkout,
    setActiveWorkout,
    startWorkout,
    pauseWorkout,
    isWorkoutRunning,
    workoutTimer,
    setWorkoutTimer,
    updateActiveWorkout,
    activeWorkout,
    restTimer,
    isResting,
    restType,
    startRest,
    skipRest,
    updateExerciseWeight,
  } = useWorkout()

  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [historyExercise, setHistoryExercise] = useState(null)
  const [hasShownModal, setHasShownModal] = useState(false)
  const isFinishing = useRef(false)
  const hasAutoStarted = useRef(false)

  // Initialize activeWorkout safely
  useEffect(() => {
    if (isFinishing.current) return

    // If no active workout in context but we have a workout param, set it
    if (!activeWorkout && workout) {
      setActiveWorkout(workout)
    }
  }, [activeWorkout, workout, setActiveWorkout])

  // Use activeWorkout directly from context
  const currentWorkout = activeWorkout

  // Auto-start the workout when the screen opens ONLY if it's a new workout (timer is 0)
  useEffect(() => {
    if (isFinishing.current || hasAutoStarted.current) return

    // Only auto-start if we have a workout, it's not already running, AND the timer is 0 (new workout)
    if (currentWorkout && !isWorkoutRunning && workoutTimer === 0) {
      startWorkout()
      hasAutoStarted.current = true
    }
  }, [currentWorkout, isWorkoutRunning, workoutTimer, startWorkout])

  // Check if all exercises are completed
  useEffect(() => {
    if (!currentWorkout || !currentWorkout.exercises || currentWorkout.exercises.length === 0) return
    if (showCompletionModal || isFinishing.current) return

    const allExercisesCompleted = currentWorkout.exercises.every((exercise) => {
      if (!exercise || !exercise.setsCompleted) {
        return false
      }

      const allSetsCompleted = exercise.setsCompleted.every((completed) => completed === true)

      return allSetsCompleted
    })

    // Reset hasShownModal if workout is no longer complete
    if (!allExercisesCompleted && hasShownModal) {
      setHasShownModal(false)
    }

    // Show modal if all complete and we haven't shown it yet
    if (allExercisesCompleted && !hasShownModal) {
      setShowCompletionModal(true)
      setHasShownModal(true)
    }
  }, [currentWorkout, showCompletionModal, hasShownModal])

  useLayoutEffect(() => {
    navigation.setOptions({
      title: currentWorkout?.title || "Workout",
      headerRight: () =>
        currentWorkout ? (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={finishWorkoutHandler}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={cancelWorkoutHandler}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={editWorkoutHandler}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null,
    })
  })

  if (!currentWorkout || !currentWorkout.exercises || !Array.isArray(currentWorkout.exercises)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Loading workout...</Text>
      </View>
    )
  }

  const formatTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "00:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const startWorkoutHandler = () => {
    startWorkout()
  }

  const pauseWorkoutHandler = () => pauseWorkout()

  function finishWorkoutHandler() {
    Alert.alert("Finish Workout", "Are you sure you want to finish this workout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finish",
        onPress: () => {
          isFinishing.current = true
          finishWorkout(currentWorkout)
          navigation.goBack()
        },
      },
    ])
  }

  function cancelWorkoutHandler() {
    setShowCancelModal(true)
  }

  function editWorkoutHandler() {
    navigation.navigate("ViewWorkout", { workout: currentWorkout, isEditing: true })
  }

  const handleCancelConfirm = () => {
    setShowCancelModal(false)
    isFinishing.current = true
    // Reset timer and workout state when cancelling
    pauseWorkout() // Stop the workout timer
    setWorkoutTimer(0) // Reset timer to 0
    setActiveWorkout(null) // Clear active workout
    navigation.goBack()
  }

  const handleCancelCancel = () => {
    setShowCancelModal(false)
  }

  const handleCompletionModalFinish = () => {
    setShowCompletionModal(false)
    isFinishing.current = true
    finishWorkout(currentWorkout)
    navigation.goBack()
  }

  const handleCompletionModalContinue = () => {
    setShowCompletionModal(false)
  }

  const updateReps = (exerciseId, setIndex, change) => {
    if (!currentWorkout || !Array.isArray(currentWorkout.exercises)) return

    const updatedWorkout = {
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((ex) => {
        if (!ex || ex.id !== exerciseId || !Array.isArray(ex.completed)) return ex

        return {
          ...ex,
          completed: ex.completed.map((reps, index) => (index === setIndex ? Math.max(0, (reps || 0) + change) : reps)),
        }
      }),
    }

    updateActiveWorkout(updatedWorkout)
  }

  const completeSetAndStartRest = (exerciseId, setIndex) => {
    const exercise = currentWorkout.exercises.find((ex) => ex && ex.id === exerciseId)
    if (!exercise || !Array.isArray(exercise.setsCompleted)) return

    const wasCompleted = exercise.setsCompleted[setIndex]

    const updatedWorkout = {
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((ex) => {
        if (!ex || ex.id !== exerciseId) return ex

        const newSetsCompleted = ex.setsCompleted.map((completed, index) =>
          index === setIndex ? !completed : completed,
        )

        return {
          ...ex,
          setsCompleted: newSetsCompleted,
        }
      }),
    }

    updateActiveWorkout(updatedWorkout)

    // If set was just marked as completed, start rest timer
    if (!wasCompleted) {
      const updatedExercise = updatedWorkout.exercises.find((ex) => ex.id === exerciseId)
      if (updatedExercise && Array.isArray(updatedExercise.setsCompleted)) {
        const allSetsCompleted = updatedExercise.setsCompleted.every((completed) => completed)

        if (allSetsCompleted) {
          const exerciseRestDuration = exercise.exerciseRest || currentWorkout.exerciseRest || 120
          startRest("exercise", exerciseRestDuration)
        } else {
          const setRestDuration = exercise.setRest || currentWorkout.setRest || 60
          startRest("set", setRestDuration)
        }
      }
    }
  }

  const markSetCompleted = (exerciseId, setIndex) => {
    if (!currentWorkout || !Array.isArray(currentWorkout.exercises)) return

    const exercise = currentWorkout.exercises.find((ex) => ex && ex.id === exerciseId)
    if (!exercise || !Array.isArray(exercise.setsCompleted)) return

    const wasCompleted = exercise.setsCompleted[setIndex]

    // If workout is paused and user is trying to complete a set, ask for confirmation
    if (!isWorkoutRunning && !wasCompleted) {
      Alert.alert(
        "Workout Paused",
        "The workout is currently paused. Completing this set will resume the workout and start the rest timer. Proceed?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes",
            onPress: () => {
              // Resume the workout first
              startWorkout()
              
              // Then mark the set as completed and handle rest timer
              completeSetAndStartRest(exerciseId, setIndex)
            },
          },
        ]
      )
      return
    }

    // If workout is running or user is unchecking a completed set, proceed normally
    completeSetAndStartRest(exerciseId, setIndex)
  }

  const renderSetsGrid = (exercise) => {
    const sets = []
    for (let i = 0; i < exercise.completed.length; i += 2) {
      const row = []
      for (let j = i; j < Math.min(i + 2, exercise.completed.length); j++) {
        const completedReps = exercise.completed[j]
        const isSetCompleted = exercise.setsCompleted && exercise.setsCompleted[j]

        row.push(
          <View key={j} style={[styles.setItem, isSetCompleted && styles.completedSetItem]}>
            <Text style={styles.setNumber}>Set {j + 1}</Text>

            <View style={styles.repsContainer}>
              <TouchableOpacity style={styles.repsButton} onPress={() => updateReps(exercise.id, j, -1)}>
                <Ionicons name="remove" size={16} color="#ef4444" />
              </TouchableOpacity>

              <Text style={styles.repsValue}>{completedReps}</Text>

              <TouchableOpacity style={styles.repsButton} onPress={() => updateReps(exercise.id, j, 1)}>
                <Ionicons name="add" size={16} color="#10b981" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.setCompleteButton, isSetCompleted && styles.setCompletedButton]}
              onPress={() => markSetCompleted(exercise.id, j)}
            >
              <Ionicons
                name={isSetCompleted ? "checkmark" : "checkmark-outline"}
                size={12}
                color={isSetCompleted ? "#fff" : "#10b981"}
              />
            </TouchableOpacity>
          </View>,
        )
      }

      sets.push(
        <View key={i} style={styles.setsRow}>
          {row}
        </View>,
      )
    }
    return sets
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerHeader}>
        <View style={styles.timerSection}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Workout Time</Text>
            <Text style={styles.timerValue}>{formatTime(workoutTimer)}</Text>
            <View style={styles.controlButtons}>
              {!isWorkoutRunning ? (
                <TouchableOpacity style={styles.resumeButton} onPress={startWorkoutHandler}>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.controlButtonText}>Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.pauseButton} onPress={pauseWorkoutHandler}>
                  <Ionicons name="pause" size={16} color="#fff" />
                  <Text style={styles.controlButtonText}>Pause</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.restSection}>
          {isResting ? (
            <View style={styles.restTimerActive}>
              <Text style={styles.restLabel}>{restType === "set" ? "Set Rest" : "Exercise Rest"}</Text>
              <Text style={styles.restValue}>{formatTime(restTimer)}</Text>
              <TouchableOpacity style={styles.skipRestButton} onPress={skipRest}>
                <Text style={styles.skipRestText}>SKIP REST</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.restTimerInactive}>
              <Text style={styles.restInactiveText}>No Rest Timer</Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardSafeView>
      <ScrollView style={styles.exercisesList} keyboardShouldPersistTaps="handled">
        {currentWorkout.exercises &&
          currentWorkout.exercises.map((exercise, exerciseIndex) => {
            const allSetsCompleted = exercise.setsCompleted && exercise.setsCompleted.every((completed) => completed)
            const hasWeight = exercise.weight !== null && exercise.weight !== undefined

            return (
              <View key={exercise.id} style={[styles.exerciseCard, allSetsCompleted && styles.completedCard]}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{exerciseIndex + 1}</Text>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {allSetsCompleted && <Ionicons name="checkmark-circle" size={40} color="#10b981" />}
                </View>

                <View style={styles.exerciseMeta}>
                  <TouchableOpacity style={styles.historyChip} onPress={() => setHistoryExercise(exercise)}>
                    <Ionicons name="time-outline" size={14} color={theme.primary} />
                    <Text style={styles.historyChipText}>History</Text>
                  </TouchableOpacity>
                </View>
                {(!!exercise.settings || (exercise.videos && exercise.videos.length > 0)) && (
                  <View style={styles.exerciseMeta}>
                    {!!exercise.settings && (
                      <View style={styles.settingsChip}>
                        <Ionicons name="settings-outline" size={14} color={theme.textSecondary} />
                        <Text style={styles.settingsText}>{exercise.settings}</Text>
                      </View>
                    )}
                    <VideoButton videos={exercise.videos} />
                  </View>
                )}
                {!!exercise.notes && <Text style={styles.notesText}>{exercise.notes}</Text>}
                <AlternativesBox alternatives={exercise.alternatives} />

                <WeightControl
                  weight={exercise.weight ?? null}
                  increaseSuggested={exercise.increaseSuggested}
                  onChange={(weight) => updateExerciseWeight(exercise.id, weight)}
                />

                <View style={styles.setsContainer}>
                  <Text style={styles.setsLabel}>
                    Target: {exercise.sets} sets × {exercise.reps} reps
                    {hasWeight ? ` @ ${formatWeight(exercise.weight)}` : ""}
                  </Text>
                  {(exercise.setRest || exercise.exerciseRest) && (
                    <Text style={styles.restOverrideText}>
                      Rest for this exercise: {exercise.setRest || currentWorkout.setRest || 60}s between sets
                      {exercise.exerciseRest ? `, ${exercise.exerciseRest}s after` : ""}
                    </Text>
                  )}

                  <View style={styles.setsGrid}>{exercise.completed && renderSetsGrid(exercise)}</View>

                  {exercise.lastPerformance && (
                    <View style={styles.lastPerformance}>
                      <Text style={styles.lastPerformanceText}>Previous: [{exercise.lastPerformance.join("-")}]</Text>
                    </View>
                  )}

                  {allSetsCompleted && hasWeight && hitTarget(exercise) && (
                    <View style={styles.targetHitBanner}>
                      <Ionicons name="trophy" size={18} color="#047857" />
                      <Text style={styles.targetHitText}>
                        Target hit! Increase the weight next time.
                      </Text>
                    </View>
                  )}

                  {allSetsCompleted && (
                    <View style={styles.completedSummary}>
                      <Text style={styles.completedText}>
                        Completed: [{exercise.completed ? exercise.completed.join("-") : ""}]
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
      </ScrollView>
      </KeyboardSafeView>

      {historyExercise && (
        <HistoryModal
          visible
          onClose={() => setHistoryExercise(null)}
          workout={currentWorkout}
          exercise={historyExercise}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color="#f59e0b" />
              <Text style={styles.modalTitle}>Cancel Workout?</Text>
              <Text style={styles.modalSubtitle}>This action cannot be undone</Text>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalText}>Are you sure you want to cancel this workout?</Text>
              <Text style={styles.modalText}>All progress will be lost and won't be saved to your history.</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalContinueButton} onPress={handleCancelCancel}>
                <Text style={styles.modalContinueText}>Keep Going</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancelButton} onPress={handleCancelConfirm}>
                <Text style={styles.modalCancelText}>Cancel Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Completion Modal */}
      <Modal
        visible={showCompletionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCompletionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="trophy" size={48} color="#10b981" />
              <Text style={styles.modalTitle}>Workout Complete!</Text>
              <Text style={styles.modalSubtitle}>All exercises done</Text>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalText}>Congratulations! You've completed all exercises in this workout.</Text>
              <Text style={styles.modalText}>Would you like to terminate the workout now?</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalContinueButton} onPress={handleCompletionModalContinue}>
                <Text style={styles.modalContinueText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalFinishButton} onPress={handleCompletionModalFinish}>
                <Text style={styles.modalFinishText}>Finish Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 2,
    marginRight: 8,
  },
  headerButton: {
    padding: 6,
  },
  exerciseMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  historyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.infoBg,
    borderColor: c.infoBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  historyChipText: {
    fontSize: 13,
    color: c.primary,
    fontWeight: "600",
  },
  settingsChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.subtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  settingsText: {
    fontSize: 13,
    color: c.textSecondary,
    marginLeft: 4,
    fontWeight: "500",
  },
  notesText: {
    fontSize: 13,
    color: c.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  targetHitBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.successBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  targetHitText: {
    flex: 1,
    fontSize: 13,
    color: c.successText,
    fontWeight: "600",
  },
  timerHeader: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    gap: 14,
    padding: 20,
  },
  timerSection: {
    flex: 0,
    alignItems: "center",
  },
  timerContainer: {
    alignItems: "center",
  },
  timerLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    marginBottom: 4,
  },
  timerValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: "row",
    gap: 12,
  },
  resumeButton: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseButton: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  restSection: {
    flex: 1,
    marginLeft: 20,
  },
  restTimerActive: {
    backgroundColor: "#f59e0b",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  restTimerInactive: {
    backgroundColor: "#374151",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  restLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  restValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  skipRestButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skipRestText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  restInactiveText: {
    color: c.textFaint,
    fontSize: 14,
    fontWeight: "500",
  },
  exercisesList: {
    flex: 1,
    padding: 16,
  },
  exerciseCard: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedCard: {
    backgroundColor: c.infoBg,
    borderColor: "#10b981",
    borderWidth: 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseNumber: {
    backgroundColor: "#2563eb",
    color: "#fff",
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 28,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: c.text,
    flex: 1,
  },
  setsContainer: {
    marginTop: 8,
  },
  restOverrideText: {
    fontSize: 13,
    color: c.primary,
    fontWeight: "600",
    marginTop: -6,
    marginBottom: 12,
  },
  setsLabel: {
    fontSize: 14,
    color: c.textMuted,
    marginBottom: 12,
  },
  setsGrid: {
    marginBottom: 12,
  },
  setsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  setItem: {
    backgroundColor: c.background,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
    minHeight: 120,
  },
  completedSetItem: {
    backgroundColor: c.successBg,
    borderColor: "#10b981",
    borderWidth: 2,
  },
  setNumber: {
    fontSize: 14,
    color: c.textMuted,
    marginBottom: 12,
    fontWeight: "600",
  },
  repsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  repsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  repsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: c.text,
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: "center",
  },
  setCompleteButton: {
    backgroundColor: c.successBg,
    padding: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#10b981",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  setCompletedButton: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  lastPerformance: {
    marginTop: 12,
    padding: 8,
    backgroundColor: c.infoBg,
    borderRadius: 6,
  },
  lastPerformanceText: {
    fontSize: 12,
    color: c.primary,
    fontWeight: "500",
    textAlign: "center",
  },
  completedSummary: {
    marginTop: 12,
    padding: 8,
    backgroundColor: c.successBg,
    borderRadius: 6,
  },
  completedText: {
    fontSize: 14,
    color: c.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: c.text,
    marginTop: 12,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#10b981",
    fontWeight: "600",
  },
  modalContent: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalContinueButton: {
    flex: 1,
    backgroundColor: c.subtle,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalContinueText: {
    fontSize: 16,
    fontWeight: "600",
    color: c.textSecondary,
  },
  modalFinishButton: {
    flex: 1,
    backgroundColor: "#10b981",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalFinishText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
})