import { useEffect, useState } from "react"
import { supabase } from "./supabase"

// The native Google module only exists in the APK; in Expo Go this returns null
function loadGoogleSignin() {
  try {
    return require("@react-native-google-signin/google-signin")
  } catch {
    return null
  }
}

let configured = false

// Signs in with Google. If the current account is the automatic anonymous one, Google is linked
// to it so every workout stays. If that Google account is already used (e.g. by the watch or
// another phone), we switch to it instead.
export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase is not configured")
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  if (!webClientId) throw new Error("Google sign-in is not set up yet (missing web client id)")

  const google = loadGoogleSignin()
  if (!google) throw new Error("Google sign-in only works in the installed app, not in Expo Go")
  const { GoogleSignin, isSuccessResponse } = google

  if (!configured) {
    GoogleSignin.configure({ webClientId })
    configured = true
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const response = await GoogleSignin.signIn()
  if (!isSuccessResponse(response)) return null // cancelled

  const idToken = response.data?.idToken
  if (!idToken) throw new Error("Google didn't return an ID token")

  const { data: current } = await supabase.auth.getUser()
  if (current?.user?.is_anonymous) {
    const { data, error } = await supabase.auth.linkIdentity({ provider: "google", token: idToken })
    if (!error) return data.user
    if (error.code !== "identity_already_exists") throw error
  }

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken })
  if (error) throw error
  return data.user
}

// Current Supabase user, kept up to date
export function useAuthUser() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  return user
}
