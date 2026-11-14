import { KeyboardAvoidingView } from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"

// Shrinks the screen above the keyboard. With Android's edge-to-edge the window no longer resizes
// by itself, so without this the keyboard covers the field you're typing in. A ScrollView inside
// then keeps the focused field visible.
export default function KeyboardSafeView({ children, style }) {
  const headerHeight = useHeaderHeight()
  return (
    <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {children}
    </KeyboardAvoidingView>
  )
}
