import { useMemo, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import { useThemedStyles, useTheme } from "../lib/theme"
import { formatWeight } from "../lib/workoutForm"
import {
  HISTORY_PAGE,
  sessionsOf,
  historyEntries,
  startOfMonth,
  startOfWeek,
  shiftPeriod,
  inPeriod,
  periodLabel,
  formatHistoryDate,
} from "../lib/history"

// History of a workout (or of one exercise when `exercise` is given), as a modal.
// Shows the last 10; with more, "Filter" switches to browsing by month or by week.
export default function HistoryModal({ visible, onClose, workout, exercise = null }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const { workoutHistory } = useWorkout()

  const entries = useMemo(
    () => historyEntries(sessionsOf(workoutHistory, workout.id), exercise?.id),
    [workoutHistory, workout.id, exercise?.id],
  )

  const [mode, setMode] = useState(null) // null = last 10, "month" or "week"
  const [periodStart, setPeriodStart] = useState(null)

  const chooseMode = (next) => {
    if (next === mode) {
      setMode(null)
      return
    }
    const latest = entries[0]?.date || new Date()
    setMode(next)
    setPeriodStart(next === "week" ? startOfWeek(latest) : startOfMonth(latest))
  }

  const visibleEntries = mode ? entries.filter((e) => inPeriod(mode, periodStart, e.date)) : entries.slice(0, HISTORY_PAGE)
  const canFilter = entries.length > HISTORY_PAGE

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>History</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {exercise ? exercise.name : workout.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {canFilter && (
            <View style={styles.filterRow}>
              <Ionicons name="filter" size={16} color={theme.textMuted} />
              {["month", "week"].map((m) => (
                <TouchableOpacity key={m} style={[styles.chip, mode === m && styles.chipSelected]} onPress={() => chooseMode(m)}>
                  <Text style={[styles.chipText, mode === m && styles.chipTextSelected]}>{m === "month" ? "By month" : "By week"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {mode && (
            <View style={styles.periodRow}>
              <TouchableOpacity onPress={() => setPeriodStart(shiftPeriod(mode, periodStart, -1))} style={styles.periodButton}>
                <Ionicons name="chevron-back" size={20} color={theme.primary} />
              </TouchableOpacity>
              <Text style={styles.periodLabel}>{periodLabel(mode, periodStart)}</Text>
              <TouchableOpacity onPress={() => setPeriodStart(shiftPeriod(mode, periodStart, 1))} style={styles.periodButton}>
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {!mode && canFilter && <Text style={styles.hint}>Last {HISTORY_PAGE} of {entries.length}</Text>}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {entries.length === 0 && <Text style={styles.empty}>No finished sessions yet</Text>}
            {entries.length > 0 && visibleEntries.length === 0 && (
              <Text style={styles.empty}>Nothing in this {mode}</Text>
            )}
            {visibleEntries.map((entry) => (
              <View key={entry.key} style={styles.entry}>
                <Text style={styles.date}>{formatHistoryDate(entry.date)}</Text>
                {entry.exercises.map((ex, i) => (
                  <View key={ex.id || i} style={styles.exerciseRow}>
                    {!exercise && <Text style={styles.exerciseName}>{ex.name}</Text>}
                    <Text style={styles.result}>
                      {ex.reps.length} sets [{ex.reps.join("-")}]
                      {ex.weight !== null ? `  ·  ${formatWeight(ex.weight)}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "85%",
      paddingTop: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: c.text,
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
    },
    closeButton: {
      padding: 6,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.subtle,
    },
    chipSelected: {
      backgroundColor: "#2563eb",
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
    },
    chipTextSelected: {
      color: "#fff",
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    periodButton: {
      padding: 6,
    },
    periodLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
    },
    hint: {
      fontSize: 12,
      color: c.textFaint,
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    list: {
      paddingHorizontal: 16,
    },
    listContent: {
      paddingBottom: 32,
    },
    empty: {
      textAlign: "center",
      color: c.textMuted,
      marginVertical: 24,
    },
    entry: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 10,
      gap: 6,
    },
    date: {
      fontSize: 14,
      fontWeight: "700",
      color: c.text,
    },
    exerciseRow: {
      gap: 2,
    },
    exerciseName: {
      fontSize: 14,
      color: c.textSecondary,
    },
    result: {
      fontSize: 14,
      fontWeight: "600",
      color: c.primary,
    },
  })
