import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"

export default function HomeScreen({ navigation }) {
  const { workouts, deleteWorkout, workoutHistory, activeWorkout, workoutTimer, restTimer, isResting, restType } =
    useWorkout()

  const handleDeleteWorkout = (workoutId, workoutTitle) => {
    Alert.alert("Delete Workout", `Are you sure you want to delete "${workoutTitle}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWorkout(workoutId) },
    ])
  }

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

  const startWorkout = (workout) => {
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

    // Get the latest workout data from state before navigating
    const latestWorkout = workouts.find(w => w.id === workout.id) || workout
    navigation.navigate("ActiveWorkout", { workout: latestWorkout })
  }

  const renderWorkoutItem = ({ item }) => {
    const lastDate = getLastWorkoutDate(item.id)
    const isActive = activeWorkout && activeWorkout.id === item.id

    return (
      <View style={[styles.workoutCard, isActive && styles.activeWorkoutCard]}>
        <View style={styles.workoutHeader}>
          <Text style={styles.workoutTitle}>{item.title}</Text>
          {isActive && (
            <View style={styles.activeIndicator}>
              <View style={styles.activeMainInfo}>
                <Ionicons name="play-circle" size={16} color="#10b981" />
                <Text style={styles.activeText}>Active</Text>
                <Text style={styles.activeTime}>{formatTimerTime(workoutTimer)}</Text>
              </View>
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
          <TouchableOpacity onPress={() => handleDeleteWorkout(item.id, item.title)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
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

          <TouchableOpacity
            style={[styles.startButton, isActive && styles.resumeButton]}
            onPress={() => startWorkout(item)}
          >
            <Text style={styles.startButtonText}>{isActive ? "Resume" : "Start"}</Text>
          </TouchableOpacity>
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
  activeTime: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "700",
    fontFamily: "monospace",
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
  deleteButton: {
    padding: 4,
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
  resumeButton: {
    backgroundColor: "#10b981",
  },
  startButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
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