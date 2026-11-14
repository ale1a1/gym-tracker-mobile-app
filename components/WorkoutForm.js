import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { emptyExercise } from "../lib/workoutForm"

// Shared by Create Workout and the edit mode of View Workout
export default function WorkoutForm({ form, onChange }) {
  const setField = (field, value) => onChange({ ...form, [field]: value })

  const updateExercise = (id, field, value) =>
    onChange({
      ...form,
      exercises: form.exercises.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
    })

  const addExercise = () => onChange({ ...form, exercises: [...form.exercises, emptyExercise()] })

  const removeExercise = (id) => onChange({ ...form, exercises: form.exercises.filter((ex) => ex.id !== id) })

  const moveExercise = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= form.exercises.length) return
    const exercises = [...form.exercises]
    ;[exercises[index], exercises[target]] = [exercises[target], exercises[index]]
    onChange({ ...form, exercises })
  }

  const updateVideo = (exercise, videoIndex, value) =>
    updateExercise(
      exercise.id,
      "videos",
      exercise.videos.map((url, i) => (i === videoIndex ? value : url)),
    )

  return (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Workout Title</Text>
          <TextInput
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={form.title}
            onChangeText={(value) => setField("title", value)}
            placeholder="e.g., Chest, Legs, Shoulders + Calves"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Total Time (minutes)</Text>
          <TextInput
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={form.totalTime}
            onChangeText={(value) => setField("totalTime", value)}
            placeholder="60"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Set Rest (seconds)</Text>
            <Text style={styles.sublabel}>Rest between individual sets</Text>
            <TextInput
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={form.setRest}
              onChangeText={(value) => setField("setRest", value)}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Exercise Rest (seconds)</Text>
            <Text style={styles.sublabel}>Rest between different exercises</Text>
            <TextInput
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={form.exerciseRest}
              onChangeText={(value) => setField("exerciseRest", value)}
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

        {form.exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>Exercise {index + 1}</Text>
              <View style={styles.exerciseActions}>
                <TouchableOpacity onPress={() => moveExercise(index, -1)} style={styles.iconButton}>
                  <Ionicons name="arrow-up" size={18} color={index === 0 ? "#d1d5db" : "#6b7280"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveExercise(index, 1)} style={styles.iconButton}>
                  <Ionicons
                    name="arrow-down"
                    size={18}
                    color={index === form.exercises.length - 1 ? "#d1d5db" : "#6b7280"}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeExercise(exercise.id)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exercise Name</Text>
              <TextInput
                placeholderTextColor="#9ca3af"
                style={styles.input}
                value={exercise.name}
                onChangeText={(value) => updateExercise(exercise.id, "name", value)}
                placeholder="e.g., Barbell bench press"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.thirdWidth]}>
                <Text style={styles.label}>Sets</Text>
                <TextInput
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  value={exercise.sets}
                  onChangeText={(value) => updateExercise(exercise.id, "sets", value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.thirdWidth]}>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  value={exercise.reps}
                  onChangeText={(value) => updateExercise(exercise.id, "reps", value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.thirdWidth]}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  placeholderTextColor="#9ca3af"
                  style={styles.input}
                  value={exercise.weight}
                  onChangeText={(value) => updateExercise(exercise.id, "weight", value)}
                  placeholder="optional"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Machine settings</Text>
              <TextInput
                placeholderTextColor="#9ca3af"
                style={styles.input}
                value={exercise.settings}
                onChangeText={(value) => updateExercise(exercise.id, "settings", value)}
                placeholder="e.g., seat 5, angle 1"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                placeholderTextColor="#9ca3af"
                style={[styles.input, styles.multiline]}
                value={exercise.notes}
                onChangeText={(value) => updateExercise(exercise.id, "notes", value)}
                placeholder="e.g., 4x15 6kg 30'' as alternative"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Videos</Text>
              {exercise.videos.map((url, videoIndex) => (
                <View key={videoIndex} style={styles.videoRow}>
                  <TextInput
                    placeholderTextColor="#9ca3af"
                    style={[styles.input, styles.videoInput]}
                    value={url}
                    onChangeText={(value) => updateVideo(exercise, videoIndex, value)}
                    placeholder="https://youtube.com/shorts/…"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                      updateExercise(
                        exercise.id,
                        "videos",
                        exercise.videos.filter((_, i) => i !== videoIndex),
                      )
                    }
                  >
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addVideoButton}
                onPress={() => updateExercise(exercise.id, "videos", [...exercise.videos, ""])}
              >
                <Ionicons name="logo-youtube" size={18} color="#ef4444" />
                <Text style={styles.addVideoText}>Add video link</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
    color: "#111827",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  thirdWidth: {
    width: "31%",
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
  exerciseActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    padding: 4,
  },
  videoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  videoInput: {
    flex: 1,
    marginRight: 4,
  },
  addVideoButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addVideoText: {
    color: "#ef4444",
    fontWeight: "500",
    marginLeft: 6,
  },
})
