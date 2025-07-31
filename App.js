import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { StatusBar } from "expo-status-bar"
import { WorkoutProvider } from "./context/WorkoutContext"
import HomeScreen from "./screens/HomeScreen"
import CreateWorkoutScreen from "./screens/CreateWorkoutScreen"
import ActiveWorkoutScreen from "./screens/ActiveWorkoutScreen"
import ViewWorkoutScreen from "./screens/ViewWorkoutScreen"

const Stack = createStackNavigator()

export default function App() {
return (
  <WorkoutProvider>
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: "#2563eb" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Gym Tracker" }} />
        <Stack.Screen name="CreateWorkout" component={CreateWorkoutScreen} options={{ title: "Create Workout" }} />
        <Stack.Screen name="ViewWorkout" component={ViewWorkoutScreen} options={{ title: "View Workout" }} />
        <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} options={{ title: "Active Workout" }} />
      </Stack.Navigator>
    </NavigationContainer>
  </WorkoutProvider>
)
}