import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native"
import { brand, useThemedStyles } from "../lib/theme"

// Same three choices as the watch, three identical buttons:
// ✓ Finish & save · ✕ Discard progress · Continue workout
// Used when stopping a workout, and when starting another while one is running (pass `subtitle`).
export default function EndWorkoutDialog({ visible, title, subtitle, onFinish, onDiscard, onContinue }) {
  const styles = useThemedStyles(makeStyles)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          <View style={styles.buttons}>
            <DialogButton label="✓ Finish & save" color={brand.green} onPress={onFinish} styles={styles} />
            <DialogButton label="✕ Discard progress" color={brand.red} onPress={onDiscard} styles={styles} />
            <DialogButton label="Continue workout" color="#34343A" onPress={onContinue} styles={styles} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function DialogButton({ label, color, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    box: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: c.card,
      borderRadius: 28,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 4,
    },
    buttons: {
      alignSelf: "stretch",
      gap: 12,
      marginTop: 22,
    },
    button: {
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: "center",
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  })
