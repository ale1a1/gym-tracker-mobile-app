import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme, useThemedStyles } from "../lib/theme"

const OPTIONS = [
  { mode: "auto", label: "Auto", icon: "phone-portrait-outline" },
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
]

// Auto follows the phone's setting; Light / Dark override it
export default function ThemeToggle() {
  const styles = useThemedStyles(makeStyles)
  const { mode, setMode, colors } = useTheme()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Appearance</Text>
      <View style={styles.segments}>
        {OPTIONS.map((option) => {
          const selected = mode === option.mode
          return (
            <TouchableOpacity
              key={option.mode}
              style={[styles.segment, selected && styles.selectedSegment]}
              onPress={() => setMode(option.mode)}
            >
              <Ionicons name={option.icon} size={16} color={selected ? "#fff" : colors.textMuted} />
              <Text style={[styles.segmentText, selected && styles.selectedText]}>{option.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 8,
    },
    label: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: c.textSecondary,
    },
    segments: {
      flexDirection: "row",
      backgroundColor: c.subtle,
      borderRadius: 10,
      padding: 3,
    },
    segment: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    selectedSegment: {
      backgroundColor: "#2563eb",
    },
    segmentText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
    },
    selectedText: {
      color: "#fff",
    },
  })
