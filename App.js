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
  screenOptions={{
    title: 'Gym Tracker',
    headerLeft: () => null, // This removes the back button
    headerStyle: {
      backgroundColor: '#2563eb',
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  }}
>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen name="ViewWorkout" component={ViewWorkoutScreen} />
  <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
  <Stack.Screen name="CreateWorkout" component={CreateWorkoutScreen} />
</Stack.Navigator>
    </NavigationContainer>
  </WorkoutProvider>
)
}