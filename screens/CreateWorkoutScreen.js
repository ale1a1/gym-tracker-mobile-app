import { useState } from "react"
import { Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native"
import { useWorkout } from "../context/WorkoutContext"
import WorkoutForm from "../components/WorkoutForm"
import KeyboardSafeView from "../components/KeyboardSafeView"
import { emptyWorkoutForm, emptyExercise, formToWorkout } from "../lib/workoutForm"
import { useThemedStyles } from "../lib/theme"

export default function CreateWorkoutScreen({ navigation }) {
  const styles = useThemedStyles(makeStyles)
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

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
    padding: 16,
  },
  saveButton: {
    backgroundColor: c.primary,
    padding: 16,
    borderRadius: 22,
    alignItems: "center",
    marginBottom: 48,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})
