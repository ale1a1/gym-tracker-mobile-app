import { useState } from "react"
import { Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import WorkoutForm from "../components/WorkoutForm"
import KeyboardSafeView from "../components/KeyboardSafeView"
import { emptyWorkoutForm, emptyExercise, formToWorkout } from "../lib/workoutForm"

export default function CreateWorkoutScreen({ navigation }) {
  const { addWorkout } = useWorkout()
  const [form, setForm] = useState(() => ({ ...emptyWorkoutForm(), exercises: [emptyExercise()] }))

  const handleSave = () => {
    const { workout, error } = formToWorkout(form)
    if (error) {
      Alert.alert("Error", error)
      return
    }
    addWorkout(workout)
    navigation.goBack()
  }

  return (
    <KeyboardSafeView>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <WorkoutForm form={form} onChange={setForm} />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Workout</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardSafeView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  saveButton: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 48,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})
