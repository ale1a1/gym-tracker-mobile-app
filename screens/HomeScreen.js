import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import AccountBar from "../components/AccountBar"

export default function HomeScreen({ navigation }) {
  const {
    workouts,
    activeWorkout,
    workoutTimer,
    restTimer,
    isResting,
    restType,
    isWorkoutRunning,
    pauseWorkout,
    startWorkout,
    setActiveWorkout,
    setWorkoutTimer,
  } = useWorkout()

  const formatTimerTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "00:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const goToActiveWorkout = () => navigation.navigate("ActiveWorkout", { workout: activeWorkout })

  const handleResumeWorkout = () => {
    startWorkout()
    goToActiveWorkout()
  }

  const handleCancelWorkout = () => {
    Alert.alert("Cancel Workout", "Are you sure you want to cancel the current workout? All progress will be lost.", [
      { text: "Keep Going", style: "cancel" },
      {
        text: "Cancel Workout",
        style: "destructive",
        onPress: () => {
          pauseWorkout()
          setWorkoutTimer(0)
          setActiveWorkout(null)
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <AccountBar />

      {activeWorkout && (
        <TouchableOpacity
          style={[styles.activeBanner, !isWorkoutRunning && styles.pausedBanner]}
          onPress={goToActiveWorkout}
          activeOpacity={0.8}
        >
          <View style={styles.activeBannerTop}>
            <Ionicons
              name={isWorkoutRunning ? "play-circle" : "pause-circle"}
              size={22}
              color={isWorkoutRunning ? "#10b981" : "#f59e0b"}
            />
            <Text style={styles.activeBannerTitle} numberOfLines={1}>
              {activeWorkout.title}
            </Text>
            <Text style={[styles.activeBannerTime, !isWorkoutRunning && styles.pausedText]}>
              {formatTimerTime(workoutTimer)}
            </Text>
          </View>
          {isResting && (
            <Text style={styles.restText}>
              {restType === "set" ? "Set Rest" : "Exercise Rest"} {formatTimerTime(restTimer)}
            </Text>
          )}
          <View style={styles.activeBannerButtons}>
            {isWorkoutRunning ? (
              <TouchableOpacity style={[styles.smallButton, styles.pauseButton]} onPress={pauseWorkout}>
                <Ionicons name="pause" size={16} color="#fff" />
                <Text style={styles.smallButtonText}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.smallButton, styles.resumeButton]} onPress={handleResumeWorkout}>
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.smallButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.smallButton, styles.cancelButton]} onPress={handleCancelWorkout}>
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.smallButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.tile, styles.doTile]} onPress={() => navigation.navigate("Workouts")}>
        <Ionicons name="barbell" size={48} color="#fff" />
        <Text style={styles.tileTitle}>Do Workout</Text>
        <Text style={styles.tileSubtitle}>
          {workouts.length === 1 ? "1 workout" : `${workouts.length} workouts`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.tile, styles.createTile]} onPress={() => navigation.navigate("CreateWorkout")}>
        <Ionicons name="add-circle" size={48} color="#2563eb" />
        <Text style={[styles.tileTitle, styles.createTileTitle]}>Create Workout</Text>
        <Text style={[styles.tileSubtitle, styles.createTileSubtitle]}>Exercises, weights, machine settings, videos</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
    gap: 16,
  },
  tile: {
    flex: 1,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doTile: {
    backgroundColor: "#2563eb",
  },
  createTile: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#bfdbfe",
  },
  tileTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
  },
  createTileTitle: {
    color: "#111827",
  },
  tileSubtitle: {
    fontSize: 14,
    color: "#bfdbfe",
    marginTop: 6,
    textAlign: "center",
  },
  createTileSubtitle: {
    color: "#6b7280",
  },
  activeBanner: {
    backgroundColor: "#f0fdf4",
    borderColor: "#10b981",
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
  },
  pausedBanner: {
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
  },
  activeBannerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeBannerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 8,
  },
  activeBannerTime: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
    fontFamily: "monospace",
  },
  pausedText: {
    color: "#f59e0b",
  },
  restText: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "600",
    marginTop: 6,
    fontFamily: "monospace",
  },
  activeBannerButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  smallButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
  },
  pauseButton: {
    backgroundColor: "#f59e0b",
  },
  resumeButton: {
    backgroundColor: "#10b981",
  },
  cancelButton: {
    backgroundColor: "#ef4444",
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
})
