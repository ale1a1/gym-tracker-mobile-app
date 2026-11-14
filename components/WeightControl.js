import { useState } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from "react-native"
import { formatWeight } from "../lib/workoutForm"
import { brand, useThemedStyles, useTheme } from "../lib/theme"

// Weight pill: tap it to type a new weight. Like the watch keypad, the first key replaces the old
// number (the text starts selected). Decimals ok, blank = no weight.
export default function WeightControl({ weight, onChange, editing, onEditingChange }) {
  const styles = useThemedStyles(makeStyles)
  const [ownOpen, setOwnOpen] = useState(false)
  // The screen can open the editor too (e.g. from the "increase weight" pill)
  const open = editing ?? ownOpen
  const setOpen = onEditingChange ?? setOwnOpen

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.pillText}>{formatWeight(weight) || "+ kg"}</Text>
      </TouchableOpacity>
      {open && <WeightEditor weight={weight} onSave={(w) => { onChange(w); setOpen(false) }} onClose={() => setOpen(false)} />}
    </>
  )
}

function WeightEditor({ weight, onSave, onClose }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const [text, setText] = useState(weight === null || weight === undefined ? "" : String(weight))

  const save = () => {
    const trimmed = text.trim().replace(",", ".")
    if (trimmed === "") return onSave(null)
    const value = Number.parseFloat(trimmed)
    if (Number.isFinite(value) && value >= 0) onSave(Math.round(value * 100) / 100)
    else onClose()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.box} activeOpacity={1}>
          <Text style={styles.title}>Weight</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              onSubmitEditing={save}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.textFaint}
              autoFocus
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={styles.unit}>kg</Text>
          </View>
          <TouchableOpacity style={styles.save} onPress={save}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    pill: {
      backgroundColor: c.subtle,
      borderRadius: 18,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    pillText: {
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
      fontVariant: ["tabular-nums"],
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    box: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: c.card,
      borderRadius: 28,
      padding: 24,
      alignItems: "center",
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: c.textMuted,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: 8,
      gap: 6,
    },
    input: {
      fontSize: 48,
      fontWeight: "800",
      color: c.text,
      minWidth: 120,
      textAlign: "center",
      paddingVertical: 4,
      borderBottomWidth: 2,
      borderBottomColor: brand.green,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      fontSize: 20,
      fontWeight: "700",
      color: c.textMuted,
    },
    save: {
      marginTop: 22,
      backgroundColor: brand.green,
      borderRadius: 22,
      paddingVertical: 11,
      paddingHorizontal: 40,
    },
    saveText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  })
