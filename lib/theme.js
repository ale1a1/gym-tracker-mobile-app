import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { Appearance, useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Brand colours (blue/green/amber/red buttons) are the same in both themes; only neutrals and
// tinted backgrounds change.
const light = {
  background: "#f9fafb",
  card: "#ffffff",
  subtle: "#f3f4f6",
  input: "#ffffff",
  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  border: "#e5e7eb",
  inputBorder: "#d1d5db",
  primary: "#2563eb",
  header: "#2563eb",
  successBg: "#f0fdf4",
  successText: "#047857",
  warningBg: "#fef3c7",
  warningText: "#92400e",
  infoBg: "#eff6ff",
  infoBorder: "#bfdbfe",
  dangerBg: "#fef2f2",
}

const dark = {
  background: "#0b1120",
  card: "#151e2e",
  subtle: "#1f2937",
  input: "#1f2937",
  text: "#f3f4f6",
  textSecondary: "#d1d5db",
  textMuted: "#9ca3af",
  textFaint: "#6b7280",
  border: "#273244",
  inputBorder: "#374151",
  primary: "#60a5fa",
  header: "#1e40af",
  successBg: "#052e1c",
  successText: "#6ee7b7",
  warningBg: "#3a2a07",
  warningText: "#fcd34d",
  infoBg: "#0f2347",
  infoBorder: "#1e3a8a",
  dangerBg: "#3b0d0d",
}

const STORAGE_KEY = "themeMode"
const ThemeContext = createContext({ mode: "auto", isDark: false, colors: light, setMode: () => {} })

// mode: "auto" follows the phone setting (default), "light" or "dark" override it
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState("auto")
  const systemScheme = useColorScheme()

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") setModeState(stored)
      })
      .catch(() => {})
  }, [])

  // Keep native parts (dialogs, keyboard, date pickers) in the same theme as the app
  useEffect(() => {
    Appearance.setColorScheme(mode)
  }, [mode])

  const setMode = (next) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }

  const isDark = mode === "dark" || (mode === "auto" && systemScheme === "dark")
  const value = useMemo(() => ({ mode, isDark, colors: isDark ? dark : light, setMode }), [mode, isDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

// Builds a component's StyleSheet from the current colours, rebuilt only when the theme changes
export function useThemedStyles(makeStyles) {
  const { colors } = useTheme()
  return useMemo(() => makeStyles(colors), [colors])
}
