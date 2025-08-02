import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"

export default function HomeScreen({ navigation }) {
  const {
    workouts,
    deleteWorkout,
    workoutHistory,
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

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatTimerTime = (seconds) => {
    if (typeof seconds !== "number" || isNaN(seconds)) return "00:00"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getLastWorkoutDate = (workoutId) => {
    if (!workoutHistory || !Array.isArray(workoutHistory)) {
      return null
    }

    const lastCompleted = workoutHistory
      .filter((h) => h.originalId === workoutId)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]

    if (lastCompleted) {
      return new Date(lastCompleted.completedAt).toLocaleDateString()
    }
    return null
  }

  const startWorkoutHandler = (workout) => {
    // Check if there's already an active workout AND it's a different workout
    if (activeWorkout && activeWorkout.id !== workout.id) {
      Alert.alert(
        "Workout in Progress",
        `"${activeWorkout.title}" is currently in progress. You need to finish it before starting a new one.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Go to ${activeWorkout.title}`,
            onPress: () => navigation.navigate("ActiveWorkout", { workout: activeWorkout }),
          },
        ],
      )
      return
    }

    navigation.navigate("ActiveWorkout", { workout })
  }

  const handlePauseWorkout = () => {
    pauseWorkout()
  }

  const handleResumeWorkout = () => {
    // Resume the workout and navigate to active workout screen
    startWorkout()
    navigation.navigate("ActiveWorkout", { workout: activeWorkout })
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

  const goToActiveWorkout = () => {
    if (activeWorkout) {
      navigation.navigate("ActiveWorkout", { workout: activeWorkout })
    }
  }

  const renderWorkoutItem = ({ item }) => {
    const lastDate = getLastWorkoutDate(item.id)
    const isActive = activeWorkout && activeWorkout.id === item.id

    return (
      <View style={[
        styles.workoutCard, 
        isActive && isWorkoutRunning && styles.activeWorkoutCard,
        isActive && !isWorkoutRunning && styles.pausedWorkoutCard
      ]}>
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutTitle}>{item.title}</Text>
          {isActive && (
            <View style={[
              styles.activeIndicator,
              !isWorkoutRunning && styles.pausedIndicator
            ]}>
              <TouchableOpacity style={styles.activeMainInfo} onPress={goToActiveWorkout}>
                <Ionicons 
                  name={isWorkoutRunning ? "play-circle" : "pause-circle"} 
                  size={16} 
                  color={isWorkoutRunning ? "#10b981" : "#f59e0b"} 
                />
                <Text style={[styles.activeText, !isWorkoutRunning && styles.pausedText]}>
                  {isWorkoutRunning ? "Active" : "Paused"}
                </Text>
                <Text style={[styles.activeTime, !isWorkoutRunning && styles.pausedTime]}>
                  {formatTimerTime(workoutTimer)}
                </Text>
              </TouchableOpacity>
              {isResting && (
                <View style={styles.restInfo}>
                  <Ionicons name="pause-circle" size={12} color="#f59e0b" />
                  <Text style={styles.restText}>
                    {restType === "set" ? "Set Rest" : "Exercise Rest"} {formatTimerTime(restTimer)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.workoutInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>Total: {formatTime(item.totalTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="barbell-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{item.exercises.length} exercises</Text>
          </View>
        </View>

        {lastDate && <Text style={styles.lastDateText}>Last: {lastDate}</Text>}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => navigation.navigate("ViewWorkout", { workout: item })}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>

          {isActive ? (
            <View style={styles.activeControls}>
              {isWorkoutRunning ? (
                <TouchableOpacity style={styles.pauseButton} onPress={handlePauseWorkout}>
                  <Ionicons name="pause" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resumeButton} onPress={handleResumeWorkout}>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.buttonText}>Resume</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelWorkout}>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.startButton} onPress={() => startWorkoutHandler(item)}>
              <Text style={styles.startButtonText}>Start</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("CreateWorkout")}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Create New Workout</Text>
      </TouchableOpacity>

      {workouts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateText}>No workouts yet</Text>
          <Text style={styles.emptyStateSubtext}>Create your first workout to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  addButton: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  workoutCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeWorkoutCard: {
    borderColor: "#10b981",
    borderWidth: 2,
    backgroundColor: "#f0fdf4",
  },
  pausedWorkoutCard: {
    borderColor: "#f59e0b",
    borderWidth: 2,
    backgroundColor: "#fef3c7",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  activeIndicator: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    minWidth: 120,
  },
  pausedIndicator: {
    backgroundColor: "#fed7aa",
  },
  activeMainInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  activeText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    marginLeft: 4,
    marginRight: 6,
  },
  pausedText: {
    color: "#f59e0b",
  },
  activeTime: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "700",
    fontFamily: "monospace",
  },
  pausedTime: {
    color: "#f59e0b",
  },
  restInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  restText: {
    fontSize: 10,
    color: "#f59e0b",
    fontWeight: "600",
    marginLeft: 2,
    fontFamily: "monospace",
  },
  workoutInfo: {
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 6,
  },
  lastDateText: {
    fontSize: 12,
    color: "#007AFF",
    marginBottom: 10,
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  viewButton: {
    flex: 1,
    backgroundColor: "#6c757d",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  viewButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  startButton: {
    flex: 1,
    backgroundColor: "#34C759",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  startButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  activeControls: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: "#f59e0b",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  resumeButton: {
    flex: 1,
    backgroundColor: "#10b981",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
  },
})