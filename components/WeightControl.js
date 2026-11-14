import { useState } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { formatWeight } from "../lib/workoutForm"
import { useThemedStyles, useTheme } from "../lib/theme"

// Weight with an edit button: tap, type the new number (decimals ok, blank = no weight), confirm.
// When `increaseSuggested` is set, a reminder to go heavier is shown; tapping it opens the editor too.
export default function WeightControl({ weight, increaseSuggested, onChange }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")

  const startEditing = () => {
    setText(weight === null || weight === undefined ? "" : String(weight))
    setEditing(true)
  }

  const save = () => {
    const trimmed = text.trim().replace(",", ".")
    if (trimmed === "") {
      onChange(null)
    } else {
      const value = Number.parseFloat(trimmed)
      if (Number.isFinite(value) && value >= 0) onChange(Math.round(value * 100) / 100)
    }
    setEditing(false)
  }

  return (
    <View style={styles.wrapper}>
      {increaseSuggested && !editing && (
        <TouchableOpacity style={styles.increaseBanner} onPress={startEditing}>
          <Ionicons name="trending-up" size={20} color="#b45309" />
          <Text style={styles.increaseText}>Last time you hit every set. Increase the weight today.</Text>
          <Ionicons name="create-outline" size={18} color="#b45309" />
        </TouchableOpacity>
      )}

      <View style={styles.container}>
        <Text style={styles.label}>Weight</Text>
        {editing ? (
          <>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              onSubmitEditing={save}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor={theme.textFaint}
              autoFocus
              selectTextOnFocus
            />
            <Text style={styles.unit}>kg</Text>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={save}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setEditing(false)}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.value}>{formatWeight(weight) || "—"}</Text>
            <TouchableOpacity style={styles.button} onPress={startEditing}>
              <Ionicons name="create-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const makeStyles = (c) => StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  increaseBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.warningBg,
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  increaseText: {
    flex: 1,
    fontSize: 13,
    color: c.warningText,
    fontWeight: "600",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: c.text,
  },
  input: {
    fontSize: 20,
    fontWeight: "700",
    color: c.text,
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    minWidth: 80,
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  unit: {
    fontSize: 14,
    color: c.textMuted,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
})
