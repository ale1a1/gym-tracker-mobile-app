"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"

export default function CreateWorkoutScreen({ navigation }) {
  const { addWorkout } = useWorkout()
  const [title, setTitle] = useState("")
  const [totalTime, setTotalTime] = useState("")
  const [exerciseRest, setExerciseRest] = useState("120")
  const [setRest, setSetRest] = useState("60")
  const [exercises, setExercises] = useState([])

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        id: Date.now().toString(),
        name: "",
        sets: "3",
        reps: "10",
        completed: [],
      },
    ])
  }

  const updateExercise = (id, field, value) => {
    setExercises(exercises.map((exercise) => (exercise.id === id ? { ...exercise, [field]: value } : exercise)))
  }

  const removeExercise = (id) => {
    setExercises(exercises.filter((exercise) => exercise.id !== id))
  }

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a workout title")
      return
    }

    if (!totalTime || isNaN(totalTime) || Number.parseInt(totalTime) <= 0) {
      Alert.alert("Error", "Please enter a valid total time in minutes")
      return
    }

    if (exercises.length === 0) {
      Alert.alert("Error", "Please add at least one exercise")
      return
    }

    const invalidExercise = exercises.find((ex) => !ex.name.trim() || !ex.sets || !ex.reps)
    if (invalidExercise) {
      Alert.alert("Error", "Please fill in all exercise details")
      return
    }

    const workout = {
      title: title.trim(),
      totalTime: Number.parseInt(totalTime),
      exerciseRest: Number.parseInt(exerciseRest),
      setRest: Number.parseInt(setRest),
      exercises: exercises.map((ex) => ({
        ...ex,
        sets: Number.parseInt(ex.sets),
        reps: Number.parseInt(ex.reps),
        completed: new Array(Number.parseInt(ex.sets)).fill(0),
      })),
      createdAt: new Date().toISOString(),
    }

    addWorkout(workout)
    navigation.goBack()
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Workout Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Enter workout name" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Total Time (minutes)</Text>
          <TextInput
            style={styles.input}
            value={totalTime}
            onChangeText={setTotalTime}
            placeholder="60"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Set Rest (seconds)</Text>
            <Text style={styles.sublabel}>Rest between individual sets</Text>
            <TextInput
              style={styles.input}
              value={setRest}
              onChangeText={setSetRest}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Exercise Rest (seconds)</Text>
            <Text style={styles.sublabel}>Rest between different exercises</Text>
            <TextInput
              style={styles.input}
              value={exerciseRest}
              onChangeText={setExerciseRest}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <TouchableOpacity style={styles.addExerciseButton} onPress={addExercise}>
            <Ionicons name="add" size={20} color="#2563eb" />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>

        {exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>Exercise {index + 1}</Text>
              <TouchableOpacity onPress={() => removeExercise(exercise.id)} style={styles.removeButton}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exercise Name</Text>
              <TextInput
                style={styles.input}
                value={exercise.name}
                onChangeText={(value) => updateExercise(exercise.id, "name", value)}
                placeholder="e.g., Push-ups, Squats"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Sets</Text>
                <TextInput
                  style={styles.input}
                  value={exercise.sets}
                  onChangeText={(value) => updateExercise(exercise.id, "sets", value)}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  style={styles.input}
                  value={exercise.reps}
                  onChangeText={(value) => updateExercise(exercise.id, "reps", value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Workout</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  sublabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addExerciseText: {
    color: "#2563eb",
    fontWeight: "500",
    marginLeft: 4,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  removeButton: {
    padding: 4,
  },
  saveButton: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})