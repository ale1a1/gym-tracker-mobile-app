import { useRef } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { emptyExercise, emptyAlternative } from "../lib/workoutForm"
import { useThemedStyles, useTheme } from "../lib/theme"

// Shared by Create Workout and the edit mode of View Workout
// focusExerciseId highlights one exercise; onFocusLayout(y) reports where it sits so the
// screen can scroll to it
export default function WorkoutForm({ form, onChange, focusExerciseId, onFocusLayout }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const sectionY = useRef(null)
  const focusY = useRef(null)
  const reportFocus = () => {
    if (onFocusLayout && sectionY.current !== null && focusY.current !== null) {
      onFocusLayout(sectionY.current + focusY.current)
    }
  }

  const setField = (field, value) => onChange({ ...form, [field]: value })

  const updateExercise = (id, field, value) =>
    onChange({
      ...form,
      exercises: form.exercises.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)),
    })

  const updateAlternative = (exercise, altIndex, field, value) =>
    updateExercise(
      exercise.id,
      "alternatives",
      exercise.alternatives.map((alt, i) => (i === altIndex ? { ...alt, [field]: value } : alt)),
    )

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
            placeholderTextColor={theme.textFaint}
            style={styles.input}
            value={form.title}
            onChangeText={(value) => setField("title", value)}
            placeholder="e.g., Chest, Legs, Shoulders + Calves"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Total Time (minutes)</Text>
          <TextInput
            placeholderTextColor={theme.textFaint}
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
              placeholderTextColor={theme.textFaint}
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
              placeholderTextColor={theme.textFaint}
              style={styles.input}
              value={form.exerciseRest}
              onChangeText={(value) => setField("exerciseRest", value)}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View
        style={styles.section}
        onLayout={(e) => {
          sectionY.current = e.nativeEvent.layout.y
          reportFocus()
        }}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <TouchableOpacity style={styles.addExerciseButton} onPress={addExercise}>
            <Ionicons name="add" size={20} color={theme.primary} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>

        {form.exercises.map((exercise, index) => (
          <View
            key={exercise.id}
            style={[styles.exerciseCard, exercise.id === focusExerciseId && styles.focusedCard]}
            onLayout={
              exercise.id === focusExerciseId
                ? (e) => {
                    focusY.current = e.nativeEvent.layout.y
                    reportFocus()
                  }
                : undefined
            }
          >
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>Exercise {index + 1}</Text>
              <View style={styles.exerciseActions}>
                <TouchableOpacity onPress={() => moveExercise(index, -1)} style={styles.iconButton}>
                  <Ionicons name="arrow-up" size={18} color={index === 0 ? theme.inputBorder : theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveExercise(index, 1)} style={styles.iconButton}>
                  <Ionicons
                    name="arrow-down"
                    size={18}
                    color={index === form.exercises.length - 1 ? theme.inputBorder : theme.textMuted}
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
                placeholderTextColor={theme.textFaint}
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
                  placeholderTextColor={theme.textFaint}
                  style={styles.input}
                  value={exercise.sets}
                  onChangeText={(value) => updateExercise(exercise.id, "sets", value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.thirdWidth]}>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  placeholderTextColor={theme.textFaint}
                  style={styles.input}
                  value={exercise.reps}
                  onChangeText={(value) => updateExercise(exercise.id, "reps", value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.thirdWidth]}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  placeholderTextColor={theme.textFaint}
                  style={styles.input}
                  value={exercise.weight}
                  onChangeText={(value) => updateExercise(exercise.id, "weight", value)}
                  placeholder="optional"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Own rest for this exercise; blank = the workout's general rule */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Rest between sets (s)</Text>
                <TextInput
                  placeholderTextColor={theme.textFaint}
                  style={styles.input}
                  value={exercise.setRest}
                  onChangeText={(value) => updateExercise(exercise.id, "setRest", value)}
                  placeholder={`default ${form.setRest || 60}`}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Rest after exercise (s)</Text>
                <TextInput
                  placeholderTextColor={theme.textFaint}
                  style={styles.input}
                  value={exercise.exerciseRest}
                  onChangeText={(value) => updateExercise(exercise.id, "exerciseRest", value)}
                  placeholder={`default ${form.exerciseRest || 120}`}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Machine settings</Text>
              <TextInput
                placeholderTextColor={theme.textFaint}
                style={styles.input}
                value={exercise.settings}
                onChangeText={(value) => updateExercise(exercise.id, "settings", value)}
                placeholder="e.g., seat 5, angle 1"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                placeholderTextColor={theme.textFaint}
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
                    placeholderTextColor={theme.textFaint}
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

            {/* Alternatives ("oppure"): other exercises to do instead, e.g. when the machine is busy */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alternatives</Text>
              {(exercise.alternatives || []).map((alt, altIndex) => (
                <View key={alt.id} style={styles.alternativeCard}>
                  <View style={styles.alternativeHeader}>
                    <Text style={styles.alternativeTitle}>Alternative {altIndex + 1}</Text>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() =>
                        updateExercise(
                          exercise.id,
                          "alternatives",
                          exercise.alternatives.filter((_, i) => i !== altIndex),
                        )
                      }
                    >
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    placeholderTextColor={theme.textFaint}
                    style={[styles.input, styles.alternativeInput]}
                    value={alt.name}
                    onChangeText={(value) => updateAlternative(exercise, altIndex, "name", value)}
                    placeholder="e.g., Diverging seated row"
                  />
                  <View style={styles.row}>
                    <TextInput
                      placeholderTextColor={theme.textFaint}
                      style={[styles.input, styles.alternativeInput, styles.thirdWidth]}
                      value={alt.sets}
                      onChangeText={(value) => updateAlternative(exercise, altIndex, "sets", value)}
                      placeholder="sets"
                      keyboardType="numeric"
                    />
                    <TextInput
                      placeholderTextColor={theme.textFaint}
                      style={[styles.input, styles.alternativeInput, styles.thirdWidth]}
                      value={alt.reps}
                      onChangeText={(value) => updateAlternative(exercise, altIndex, "reps", value)}
                      placeholder="reps"
                      keyboardType="numeric"
                    />
                    <TextInput
                      placeholderTextColor={theme.textFaint}
                      style={[styles.input, styles.alternativeInput, styles.thirdWidth]}
                      value={alt.weight}
                      onChangeText={(value) => updateAlternative(exercise, altIndex, "weight", value)}
                      placeholder="kg"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <TextInput
                    placeholderTextColor={theme.textFaint}
                    style={[styles.input, styles.alternativeInput]}
                    value={alt.settings}
                    onChangeText={(value) => updateAlternative(exercise, altIndex, "settings", value)}
                    placeholder="Machine settings (optional)"
                  />
                  <TextInput
                    placeholderTextColor={theme.textFaint}
                    style={[styles.input, styles.alternativeInput]}
                    value={alt.notes}
                    onChangeText={(value) => updateAlternative(exercise, altIndex, "notes", value)}
                    placeholder="Notes (optional)"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={styles.addAlternativeButton}
                onPress={() => updateExercise(exercise.id, "alternatives", [...(exercise.alternatives || []), emptyAlternative()])}
              >
                <Ionicons name="swap-horizontal" size={18} color={theme.primary} />
                <Text style={styles.addAlternativeText}>Add alternative</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const makeStyles = (c) => StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: c.text,
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
    color: c.textSecondary,
    marginBottom: 6,
  },
  sublabel: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: 6,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: c.input,
    color: c.text,
    borderWidth: 1,
    borderColor: c.inputBorder,
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
    backgroundColor: c.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addExerciseText: {
    color: c.primary,
    fontWeight: "500",
    marginLeft: 4,
  },
  alternativeCard: {
    borderWidth: 1,
    borderColor: c.infoBorder,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  alternativeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alternativeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: c.primary,
  },
  alternativeInput: {
    padding: 10,
    fontSize: 15,
  },
  addAlternativeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: c.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addAlternativeText: {
    color: c.primary,
    fontWeight: "500",
  },
  focusedCard: {
    borderWidth: 2,
    borderColor: c.primary,
  },
  exerciseCard: {
    backgroundColor: c.card,
    borderRadius: 22,
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
    color: c.primary,
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
    backgroundColor: c.dangerBg,
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
