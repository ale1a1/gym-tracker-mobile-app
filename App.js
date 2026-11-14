import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { WorkoutProvider } from "./context/WorkoutContext"
import HomeScreen from "./screens/HomeScreen"
import WorkoutListScreen from "./screens/WorkoutListScreen"
import CreateWorkoutScreen from "./screens/CreateWorkoutScreen"
import ActiveWorkoutScreen from "./screens/ActiveWorkoutScreen"
import ViewWorkoutScreen from "./screens/ViewWorkoutScreen"

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <WorkoutProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        {/* One header for every screen: centered title, single back arrow */}
        <Stack.Navigator
          screenOptions={{
            headerTitleAlign: "center",
            headerBackButtonDisplayMode: "minimal",
            headerStyle: {
              backgroundColor: "#2563eb",
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
    </WorkoutProvider>
  )
}
