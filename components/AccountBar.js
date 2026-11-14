import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { signInWithGoogle, signOut, useAuthUser } from "../lib/auth"
import { useWorkout } from "../context/WorkoutContext"
import { useThemedStyles } from "../lib/theme"

// Shows who is signed in, or a Google sign-in button while the account is still anonymous
export default function AccountBar() {
  const styles = useThemedStyles(makeStyles)
  const user = useAuthUser()
  const { syncWithCloud, clearLocalData } = useWorkout()
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const handleSignIn = async () => {
    setBusy(true)
    try {
      const signedIn = await signInWithGoogle()
      if (signedIn) await syncWithCloud()
    } catch (error) {
      Alert.alert("Google sign-in failed", error.message || String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert("Sign out", "Your workouts stay saved in your Google account. Sign in again to get them back.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setBusy(true)
          try {
            await signOut()
            await clearLocalData()
            await syncWithCloud()
          } catch (error) {
            Alert.alert("Sign out failed", error.message || String(error))
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  if (!user.is_anonymous) {
    return (
      <View style={styles.bar}>
        <Ionicons name="cloud-done" size={18} color="#10b981" />
        <Text style={styles.text} numberOfLines={1}>
          Synced as {user.email}
        </Text>
        <TouchableOpacity onPress={handleSignOut} disabled={busy} style={styles.signOutButton}>
          {busy ? <ActivityIndicator size="small" /> : <Text style={styles.signOutText}>Sign out</Text>}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <TouchableOpacity style={[styles.bar, styles.signInBar]} onPress={handleSignIn} disabled={busy}>
      {busy ? <ActivityIndicator color="#2563eb" /> : <Ionicons name="logo-google" size={18} color="#2563eb" />}
      <Text style={[styles.text, styles.signInText]}>Sign in with Google to sync with the watch</Text>
    </TouchableOpacity>
  )
}

const makeStyles = (c) => StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  signInBar: {
    borderColor: c.infoBorder,
    backgroundColor: c.infoBg,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: c.textSecondary,
  },
  signOutButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signOutText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 13,
  },
  signInText: {
    color: c.primary,
    fontWeight: "600",
  },
})
