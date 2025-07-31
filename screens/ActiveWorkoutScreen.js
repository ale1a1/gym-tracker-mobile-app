"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"

export default function ActiveWorkoutScreen({ route, navigation }) {
  const { workout } = route.params || {}
  const {
    updateWorkout,
    finishWorkout,
    setActiveWorkout,
    startWorkout,
    pauseWorkout,
    isWorkoutRunning,
    workoutTimer,
    updateActiveWorkout,
    activeWorkout: contextActiveWorkout,
    restTimer,
    isResting,
    restType,
    startRest,
    skipRest,
    setWorkoutTimer,
  } = useWorkout()

  const [activeWorkout, setActiveWorkoutLocal] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [hasShownModal, setHasShownModal] = useState(false)
  const isFinishing = useRef(false)

  // Initialize activeWorkout safely
  useEffect(() => {
    if (isFinishing.current) return
    
    if (contextActiveWorkout) {
      setActiveWorkoutLocal(contextActiveWorkout)
    } else if (workout) {
      setActiveWorkout(workout)
      setActiveWorkoutLocal(workout)
    }
  }, [contextActiveWorkout, workout])

  const currentWorkout = contextActiveWorkout || activeWorkout

  // Auto-start the workout when the screen opens
  useEffect(() => {
    if (isFinishing.current) return
    
    if (currentWorkout && !isWorkoutRunning) {
      startWorkout()
    }
  }, [currentWorkout])

  // Check if all exercises are completed
  useEffect(() => {
    if (!currentWorkout || !currentWorkout.exercises || currentWorkout.exercises.length === 0) return
    if (showCompletionModal || isFinishing.current) return
    
    const allExercisesCompleted = currentWorkout.exercises.every(exercise => {
      if (!exercise || !exercise.setsCompleted) {
        return false
      }
      
      const allSetsCompleted = exercise.setsCompleted.every(completed => completed === true)
      
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
  }, [currentWorkout?.exercises, showCompletionModal, hasShownModal])

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

  const finishWorkoutHandler = () => {
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

  const cancelWorkoutHandler = () => {
    setShowCancelModal(true)
  }

  const handleCancelConfirm = () => {
    setShowCancelModal(false)
    isFinishing.current = true
    // Reset timer and clear active workout without saving to history
    setWorkoutTimer(0)
    setActiveWorkout(null)
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

    setActiveWorkoutLocal(updatedWorkout)
    updateActiveWorkout(updatedWorkout)
  }

  const markSetCompleted = (exerciseId, setIndex) => {
    if (!currentWorkout || !Array.isArray(currentWorkout.exercises)) return

    const exercise = currentWorkout.exercises.find((ex) => ex && ex.id === exerciseId)
    if (!exercise || !Array.isArray(exercise.setsCompleted)) return

    const wasCompleted = exercise.setsCompleted[setIndex]

    const updatedWorkout = {
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((ex) => {
        if (!ex || ex.id !== exerciseId) return ex

        const newSetsCompleted = ex.setsCompleted.map((completed, index) => 
          index === setIndex ? !completed : completed
        )

        return {
          ...ex,
          setsCompleted: newSetsCompleted,
        }
      }),
    }

    setActiveWorkoutLocal(updatedWorkout)
    updateActiveWorkout(updatedWorkout)

    // If set was just marked as completed, start rest timer
    if (!wasCompleted) {
      const updatedExercise = updatedWorkout.exercises.find((ex) => ex.id === exerciseId)
      if (updatedExercise && Array.isArray(updatedExercise.setsCompleted)) {
        const allSetsCompleted = updatedExercise.setsCompleted.every((completed) => completed)

        if (allSetsCompleted) {
          const exerciseRestDuration = currentWorkout.exerciseRest || 120
          startRest("exercise", exerciseRestDuration)
        } else {
          const setRestDuration = currentWorkout.setRest || 60
          startRest("set", setRestDuration)
        }
      }
    }
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
              <TouchableOpacity
                style={styles.repsButton}
                onPress={() => updateReps(exercise.id, j, -1)}
              >
                <Ionicons name="remove" size={16} color="#ef4444" />
              </TouchableOpacity>

              <Text style={styles.repsValue}>{completedReps}</Text>

              <TouchableOpacity
                style={styles.repsButton}
                onPress={() => updateReps(exercise.id, j, 1)}
              >
                <Ionicons name="add" size={16} color="#10b981" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[
                styles.setCompleteButton, 
                isSetCompleted && styles.setCompletedButton
              ]} 
              onPress={() => markSetCompleted(exercise.id, j)}
            >
              <Ionicons 
                name={isSetCompleted ? "checkmark" : "checkmark-outline"} 
                size={12} 
                color={isSetCompleted ? "#fff" : "#10b981"} 
              />
            </TouchableOpacity>
          </View>
        )
      }
      
      sets.push(
        <View key={i} style={styles.setsRow}>
          {row}
        </View>
      )
    }
    return sets
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.title}>{currentWorkout.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.timerHeader}>
        <View style={styles.timerSection}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Workout Time</Text>
            <Text style={styles.timerValue}>{formatTime(workoutTimer)}</Text>
            <View style={styles.controlButtons}>
              {!isWorkoutRunning ? (
                <TouchableOpacity style={styles.startButton} onPress={startWorkoutHandler}>
                  <Ionicons name="play" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.pauseButton} onPress={pauseWorkoutHandler}>
                  <Ionicons name="pause" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.finishButton} onPress={finishWorkoutHandler}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={cancelWorkoutHandler}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.restSection}>
          {isResting ? (
            <View style={styles.restTimerActive}>
              <Text style={styles.restLabel}>
                {restType === "set" ? "Set Rest" : "Exercise Rest"}
              </Text>
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

      <ScrollView style={styles.exercisesList}>
        {currentWorkout.exercises &&
          currentWorkout.exercises.map((exercise, exerciseIndex) => {
            const allSetsCompleted = exercise.setsCompleted && exercise.setsCompleted.every(completed => completed)
            
            return (
              <View key={exercise.id} style={[styles.exerciseCard, allSetsCompleted && styles.completedCard]}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{exerciseIndex + 1}</Text>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {allSetsCompleted && (
                    <Ionicons name="checkmark-circle" size={40} color="#10b981" />
                  )}
                </View>

                <View style={styles.setsContainer}>
                  <Text style={styles.setsLabel}>
                    Target: {exercise.sets} sets × {exercise.reps} reps
                  </Text>

                  <View style={styles.setsGrid}>
                    {exercise.completed && renderSetsGrid(exercise)}
                  </View>

                  {exercise.lastPerformance && (
                    <View style={styles.lastPerformance}>
                      <Text style={styles.lastPerformanceText}>
                        Previous: [{exercise.lastPerformance.join("-")}]
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
              <Text style={styles.modalText}>
                Are you sure you want to cancel this workout?
              </Text>
              <Text style={styles.modalText}>
                All progress will be lost and won't be saved to your history.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalContinueButton} 
                onPress={handleCancelCancel}
              >
                <Text style={styles.modalContinueText}>Keep Going</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={handleCancelConfirm}
              >
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
              <Text style={styles.modalText}>
                Congratulations! You've completed all exercises in this workout.
              </Text>
              <Text style={styles.modalText}>
                Would you like to terminate the workout now?
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalContinueButton} 
                onPress={handleCompletionModalContinue}
              >
                <Text style={styles.modalContinueText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalFinishButton} 
                onPress={handleCompletionModalFinish}
              >
                <Text style={styles.modalFinishText}>Finish Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 24,
  },
  timerHeader: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    padding: 20,
  },
  timerSection: {
    flex: 1,
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
  startButton: {
    backgroundColor: "#10b981",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButton: {
    backgroundColor: "#f59e0b",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  finishButton: {
    backgroundColor: "#10b981",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ef4444",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  restSection: {
    flex: 1,
    marginLeft: 20,
  },
  restTimerActive: {
    backgroundColor: "#f59e0b",
    padding: 16,
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
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  exercisesList: {
    flex: 1,
    padding: 16,
  },
  exerciseCard: {
    backgroundColor: "#fff",
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
    backgroundColor: "#f0f9ff",
    borderColor: "#10b981",
    borderWidth: 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
    color: "#111827",
    flex: 1,
  },
  setsContainer: {
    marginTop: 8,
  },
  setsLabel: {
    fontSize: 14,
    color: "#6b7280",
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
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
    minHeight: 120,
  },
  completedSetItem: {
    backgroundColor: "#f0fdf4",
    borderColor: "#10b981",
    borderWidth: 2,
  },
  setNumber: {
    fontSize: 14,
    color: "#6b7280",
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
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  repsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginHorizontal: 16,
    minWidth: 30,
    textAlign: "center",
  },
  setCompleteButton: {
    backgroundColor: "#f0fdf4",
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
    backgroundColor: "#f0f8ff",
    borderRadius: 6,
  },
  lastPerformanceText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
    textAlign: "center",
  },
  completedSummary: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
  },
  completedText: {
    fontSize: 14,
    color: "#374151",
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
    backgroundColor: "#fff",
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
    color: "#111827",
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
    color: "#374151",
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
    backgroundColor: "#f3f4f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalContinueText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
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