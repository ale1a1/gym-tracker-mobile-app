"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"

export default function ViewWorkoutScreen({ route, navigation }) {
  const { workout } = route.params
  const { workoutHistory, updateWorkout, updateActiveWorkout, activeWorkout } = useWorkout()
  const [isEditing, setIsEditing] = useState(false)
  const [editedWorkout, setEditedWorkout] = useState(workout)

  const getLastSession = () => {
    if (!workoutHistory || !Array.isArray(workoutHistory)) {
      return null
    }
    return workoutHistory
      .filter((h) => h.originalId === workout.id)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
  }

  const lastSession = getLastSession()

  const addExercise = () => {
    const newExercise = {
      id: Date.now().toString(),
      name: "",
      sets: 3,
      reps: 10,
      completed: new Array(3).fill(0),
    }
    setEditedWorkout({
      ...editedWorkout,
      exercises: [...editedWorkout.exercises, newExercise],
    })
  }

  const updateExercise = (exerciseId, field, value) => {
    setEditedWorkout({
      ...editedWorkout,
      exercises: editedWorkout.exercises.map((ex) => {
        if (ex.id === exerciseId) {
          const updatedEx = { ...ex, [field]: value }
          // If changing sets, update completed array
          if (field === "sets") {
            const newSets = parseInt(value) || 0
            updatedEx.completed = new Array(newSets).fill(0)
          }
          return updatedEx
        }
        return ex
      }),
    })
  }

  const removeExercise = (exerciseId) => {
    setEditedWorkout({
      ...editedWorkout,
      exercises: editedWorkout.exercises.filter((ex) => ex.id !== exerciseId),
    })
  }

  const saveChanges = () => {
    if (editedWorkout.exercises.some((ex) => !ex.name.trim())) {
      Alert.alert("Error", "Please fill in all exercise names")
      return
    }

    // Update the main workout
    updateWorkout(editedWorkout)
    
    // If this workout is currently active, update the active workout too
    if (activeWorkout && activeWorkout.id === editedWorkout.id) {
      const updatedActiveWorkout = {
        ...activeWorkout,
        ...editedWorkout,
        exercises: editedWorkout.exercises.map((ex) => {
          // Find existing exercise in active workout to preserve completed reps
          const existingEx = activeWorkout.exercises.find(activeEx => activeEx.id === ex.id)
          if (existingEx) {
            // Preserve completed reps but adjust array size if sets changed
            let completed = existingEx.completed || []
            if (completed.length !== ex.sets) {
              // Resize completed array
              if (completed.length < ex.sets) {
                // Add zeros for new sets
                completed = [...completed, ...new Array(ex.sets - completed.length).fill(0)]
              } else {
                // Trim excess sets
                completed = completed.slice(0, ex.sets)
              }
            }
            return { ...ex, completed }
          } else {
            // New exercise
            return { ...ex, completed: new Array(ex.sets).fill(0) }
          }
        })
      }
      updateActiveWorkout(updatedActiveWorkout)
    }
    
    setIsEditing(false)
    
    // Update the route params so the view reflects changes immediately
    navigation.setParams({ workout: editedWorkout })
    
    Alert.alert("Success", "Workout updated!")
  }

  const cancelEdit = () => {
    setEditedWorkout(workout)
    setIsEditing(false)
  }

  // Use editedWorkout for display when editing, otherwise use the current workout
  const displayWorkout = isEditing ? editedWorkout : editedWorkout

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.title}>{displayWorkout.title}</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editButton}>{isEditing ? "Cancel" : "Edit"}</Text>
        </TouchableOpacity>
      </View>

      {isEditing ? (
        <View>
          <TouchableOpacity style={styles.addButton} onPress={addExercise}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Exercise</Text>
          </TouchableOpacity>

          {editedWorkout.exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.editCard}>
              <View style={styles.editHeader}>
                <Text style={styles.exerciseNumber}>Exercise {index + 1}</Text>
                <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={exercise.name}
                onChangeText={(value) => updateExercise(exercise.id, "name", value)}
                placeholder="Exercise name"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Sets</Text>
                  <TextInput
                    style={styles.input}
                    value={exercise.sets.toString()}
                    onChangeText={(value) => updateExercise(exercise.id, "sets", parseInt(value) || 0)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    value={exercise.reps.toString()}
                    onChangeText={(value) => updateExercise(exercise.id, "reps", parseInt(value) || 0)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          ))}

          <View style={styles.saveButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveChanges}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Total Time: {displayWorkout.totalTime} minutes</Text>
            <Text style={styles.infoText}>Exercises: {displayWorkout.exercises.length}</Text>
            {lastSession && (
              <Text style={styles.infoText}>
                Last completed: {new Date(lastSession.completedAt).toLocaleDateString()}
              </Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>Exercises</Text>
          {displayWorkout.exercises.map((exercise, index) => {
            const lastExercise = lastSession?.exercises.find((ex) => ex.id === exercise.id)
            return (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseTitle}>
                  {index + 1}. {exercise.name}
                </Text>
                <Text style={styles.exerciseTarget}>
                  Target: {exercise.sets} sets × {exercise.reps} reps
                </Text>

                {lastExercise && (
                  <View style={styles.lastPerformance}>
                    <Text style={styles.lastPerformanceText}>
                      Last performance: [{lastExercise.completed.join("-")}]
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  editButton: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "bold",
  },
  infoCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  exerciseTarget: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  lastPerformance: {
    backgroundColor: "#f0f8ff",
    padding: 8,
    borderRadius: 6,
  },
  lastPerformanceText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: "#34C759",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 5,
  },
  editCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  exerciseNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2563eb",
  },
  input: {
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  saveButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#6c757d",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
})