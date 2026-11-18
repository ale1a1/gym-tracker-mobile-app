import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import { brand, useTheme, useThemedStyles } from "../lib/theme"
import { formatHistoryDate } from "../lib/history"

// A finished workout opened from History: change the reps of each set, add or remove sets, change
// the weight, or delete the whole session (with a confirmation)
export default function SessionEditor({ session, onClose }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const { updateSession, deleteSession } = useWorkout()
  const [exercises, setExercises] = useState(() =>
    (session.exercises || []).map((ex) => ({
      ...ex,
      completed: [...(ex.completed || [])],
      setsCompleted: [...(ex.setsCompleted || [])],
      weightText: ex.weight === null || ex.weight === undefined ? "" : String(ex.weight),
    })),
  )
  const date = formatHistoryDate(new Date(session.completedAt))

  const change = (exerciseIndex, update) =>
    setExercises((list) => list.map((ex, i) => (i === exerciseIndex ? { ...ex, ...update(ex) } : ex)))

  const setReps = (exerciseIndex, setIndex, delta) =>
    change(exerciseIndex, (ex) => ({
      completed: ex.completed.map((reps, j) => (j === setIndex ? Math.max(0, (reps || 0) + delta) : reps)),
    }))

  const addSet = (exerciseIndex) =>
    change(exerciseIndex, (ex) => ({
      completed: [...ex.completed, ex.completed[ex.completed.length - 1] ?? ex.reps ?? 10],
      setsCompleted: [...ex.setsCompleted, true],
    }))

  const removeSet = (exerciseIndex, setIndex) =>
    change(exerciseIndex, (ex) => ({
      completed: ex.completed.filter((_, j) => j !== setIndex),
      setsCompleted: ex.setsCompleted.filter((_, j) => j !== setIndex),
    }))

  const save = () => {
    updateSession({
      ...session,
      exercises: exercises
        .filter((ex) => ex.completed.length > 0)
        .map(({ weightText, ...ex }) => {
          const weight = Number.parseFloat(weightText.trim().replace(",", "."))
          return {
            ...ex,
            weight: Number.isFinite(weight) && weight >= 0 ? Math.round(weight * 100) / 100 : null,
            sets: ex.completed.length,
          }
        }),
    })
    onClose()
  }

  const confirmDelete = () =>
    Alert.alert("Delete workout", `Do you want to delete ${session.title} from ${date}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes, delete",
        style: "destructive",
        onPress: () => {
          deleteSession(session.sessionId)
          onClose()
        },
      },
    ])

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {session.title}
              </Text>
              <Text style={styles.subtitle}>{date}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {exercises.map((ex, exerciseIndex) => (
              <View key={ex.id || exerciseIndex} style={styles.exercise}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName} numberOfLines={2}>
                    {ex.name}
                  </Text>
                  <View style={styles.weightBox}>
                    <TextInput
                      style={styles.weightInput}
                      value={ex.weightText}
                      onChangeText={(text) => change(exerciseIndex, () => ({ weightText: text }))}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={theme.textFaint}
                      selectTextOnFocus
                      maxLength={6}
                    />
                    <Text style={styles.unit}>kg</Text>
                  </View>
                </View>

                {ex.completed.map((reps, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <Text style={styles.setNumber}>{setIndex + 1}</Text>
                    <TouchableOpacity style={styles.stepper} onPress={() => setReps(exerciseIndex, setIndex, -1)}>
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.reps}>{reps}</Text>
                    <TouchableOpacity style={styles.stepper} onPress={() => setReps(exerciseIndex, setIndex, 1)}>
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeSet} onPress={() => removeSet(exerciseIndex, setIndex)}>
                      <Ionicons name="trash-outline" size={18} color={brand.red} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSet} onPress={() => addSet(exerciseIndex)}>
                  <Ionicons name="add" size={16} color={theme.primary} />
                  <Text style={styles.addSetText}>Add set</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={18} color={brand.red} />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "92%",
      paddingTop: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      marginTop: 2,
    },
    closeButton: {
      padding: 6,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 12,
    },
    exercise: {
      backgroundColor: c.card,
      borderRadius: 22,
      padding: 16,
      gap: 8,
    },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 4,
    },
    exerciseName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
    },
    weightBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.subtle,
      borderRadius: 16,
      paddingHorizontal: 10,
    },
    weightInput: {
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
      minWidth: 44,
      textAlign: "right",
      paddingVertical: 6,
    },
    unit: {
      fontSize: 13,
      color: c.textMuted,
      marginLeft: 4,
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    setNumber: {
      width: 20,
      fontSize: 13,
      color: c.textFaint,
      textAlign: "center",
    },
    stepper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.stepper,
      justifyContent: "center",
      alignItems: "center",
    },
    reps: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      minWidth: 36,
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
    removeSet: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 6,
    },
    addSet: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: c.subtle,
      marginTop: 2,
    },
    addSetText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.primary,
    },
    footer: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 2,
      borderColor: brand.red,
      borderRadius: 24,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    deleteText: {
      color: brand.red,
      fontSize: 16,
      fontWeight: "700",
    },
    saveButton: {
      flex: 1,
      backgroundColor: brand.green,
      borderRadius: 24,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
    },
  })
