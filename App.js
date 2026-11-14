import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { WorkoutProvider } from "./context/WorkoutContext"
import { ThemeProvider, useTheme } from "./lib/theme"
import HomeScreen from "./screens/HomeScreen"
import WorkoutListScreen from "./screens/WorkoutListScreen"
import CreateWorkoutScreen from "./screens/CreateWorkoutScreen"
import ActiveWorkoutScreen from "./screens/ActiveWorkoutScreen"
import ViewWorkoutScreen from "./screens/ViewWorkoutScreen"

const Stack = createNativeStackNavigator()

function AppNavigator() {
  const { isDark, colors } = useTheme()
  const baseTheme = isDark ? DarkTheme : DefaultTheme
  const navigationTheme = {
    ...baseTheme,
    colors: { ...baseTheme.colors, background: colors.background, card: colors.header, primary: colors.primary },
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" />
      {/* One header for every screen: centered title, single back arrow */}
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: "center",
          headerBackButtonDisplayMode: "minimal",
          headerStyle: {
            backgroundColor: colors.header,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Gym Tracker" }} />
        <Stack.Screen name="Workouts" component={WorkoutListScreen} options={{ title: "Do Workout" }} />
        <Stack.Screen name="ViewWorkout" component={ViewWorkoutScreen} options={{ title: "Workout Details" }} />
        <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ title: "Workout" }} />
        <Stack.Screen name="CreateWorkout" component={CreateWorkoutScreen} options={{ title: "Create Workout" }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <WorkoutProvider>
        <AppNavigator />
      </WorkoutProvider>
    </ThemeProvider>
  )
}
