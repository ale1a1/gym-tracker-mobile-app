import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Same palette as the watch: green for actions, orange for pause/rest, red for stop/discard,
// soft blue for history. Dark is near-black with soft grey cards; light mirrors it.
export const brand = {
  green: "#10B981",
  red: "#EF4444",
  orange: "#F59E0B",
  softBlue: "#93C5FD",
  navy: "#0B1F3A",
}

const light = {
  background: "#F2F2F5",
  card: "#FFFFFF",
  subtle: "#ECECF0",
  input: "#FFFFFF",
  text: "#0A0A0B",
  textSecondary: "#3F3F46",
  textMuted: "#71717A",
  textFaint: "#A1A1AA",
  border: "#E4E4E7",
  inputBorder: "#D4D4D8",
  primary: "#059669",
  header: "#F2F2F5",
  headerText: "#0A0A0B",
  stepper: "#E4E4E7",
  successBg: "#ECFDF5",
  successText: "#047857",
  warningBg: "#FEF3C7",
  warningText: "#92400E",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  dangerBg: "#FEF2F2",
}

const dark = {
  background: "#000000",
  card: "#1C1C1F",
  subtle: "#26262A",
  input: "#26262A",
  text: "#FFFFFF",
  textSecondary: "#D4D4D8",
  textMuted: "#A1A1AA",
  textFaint: "#71717A",
  border: "#2C2C31",
  inputBorder: "#3F3F46",
  primary: "#10B981",
  header: "#000000",
  headerText: "#FFFFFF",
  stepper: "#34343A",
  successBg: "#052E1C",
  successText: "#6EE7B7",
  warningBg: "#3A2A07",
  warningText: "#FCD34D",
  infoBg: "#0F2347",
  infoBorder: "#1E3A8A",
  dangerBg: "#3B0D0D",
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

  // Don't override the native theme (Appearance.setColorScheme): forcing "light" while the phone is
  // in dark mode makes Android's force-dark invert the app (white cards turn black). The app paints
  // its own colours, so native parts simply keep following the phone.

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
