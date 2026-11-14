import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useThemedStyles, useTheme } from "../lib/theme"
import { formatWeight } from "../lib/workoutForm"
import VideoButton from "./VideoButton"

// "Alternatives (n)" button that expands into a box with one card per alternative exercise
export default function AlternativesBox({ alternatives }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const [open, setOpen] = useState(false)

  if (!alternatives || alternatives.length === 0) return null

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.toggle} onPress={() => setOpen(!open)}>
        <Ionicons name="swap-horizontal" size={16} color={theme.primary} />
        <Text style={styles.toggleText}>Alternatives ({alternatives.length})</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.primary} />
      </TouchableOpacity>

      {open && (
        <View style={styles.box}>
          {alternatives.map((alt, index) => (
            <View key={alt.id || index} style={styles.card}>
              <Text style={styles.name}>{alt.name}</Text>
              <Text style={styles.target}>
                {alt.sets} × {alt.reps}
                {alt.weight !== null && alt.weight !== undefined ? `  ·  ${formatWeight(alt.weight)}` : ""}
              </Text>
              {!!alt.settings && (
                <View style={styles.detailRow}>
                  <Ionicons name="settings-outline" size={13} color={theme.textMuted} />
                  <Text style={styles.detailText}>{alt.settings}</Text>
                </View>
              )}
              {!!alt.notes && <Text style={styles.notes}>{alt.notes}</Text>}
              <VideoButton videos={alt.videos} />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    wrapper: {
      marginTop: 8,
    },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      backgroundColor: c.infoBg,
      borderColor: c.infoBorder,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
    },
    toggleText: {
      color: c.primary,
      fontWeight: "600",
      fontSize: 13,
    },
    box: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.infoBorder,
      borderStyle: "dashed",
      borderRadius: 22,
      padding: 8,
      gap: 8,
    },
    card: {
      backgroundColor: c.subtle,
      borderRadius: 10,
      padding: 10,
      gap: 4,
    },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    target: {
      fontSize: 14,
      fontWeight: "600",
      color: c.primary,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    detailText: {
      fontSize: 13,
      color: c.textSecondary,
    },
    notes: {
      fontSize: 12,
      color: c.textMuted,
      fontStyle: "italic",
    },
  })
