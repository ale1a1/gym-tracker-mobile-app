import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import { AppState } from "react-native"

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null

// Refresh the session only while the app is in the foreground
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

// Signs in anonymously the first time; later this account can be linked to Google
export async function ensureSignedIn() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn("Supabase sign-in failed:", error.message)
    return null
  }
  return signInData.user
}
