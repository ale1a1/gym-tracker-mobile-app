import { useLayoutEffect, useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import AccountBar from "../components/AccountBar"
import ThemeToggle from "../components/ThemeToggle"
import HistoryModal from "../components/HistoryModal"
import EndWorkoutDialog from "../components/EndWorkoutDialog"
import { brand, useTheme, useThemedStyles } from "../lib/theme"
import { formatClock } from "../lib/time"

// Home = your workouts, like the watch: tap a card (or ▶) to start it, history and edit beside it.
// The running workout is the green card.
export default function HomeScreen({ navigation }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const {
    workouts,
    workoutHistory,
    activeWorkout,
    workoutTimer,
    restTimer,
    isResting,
    isWorkoutRunning,
    finishWorkout,
    discardWorkout,
  } = useWorkout()

  const [historyFor, setHistoryFor] = useState(null)
  const [switchTo, setSwitchTo] = useState(null) // workout tapped while another one is running

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("CreateWorkout")}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    })
  })

  const lastDone = (workoutId) => {
    const last = (workoutHistory || [])
      .filter((h) => h && h.originalId === workoutId && h.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
    return last ? new Date(last.completedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null
  }

  const openWorkout = (workout) => {
    const running = activeWorkout && activeWorkout.id === workout.id
    if (running) navigation.navigate("ActiveWorkout", { workout: activeWorkout })
    else if (activeWorkout) setSwitchTo(workout)
    else navigation.navigate("ActiveWorkout", { workout })
  }

  const endAndStart = (finish) => {
    const next = switchTo
    setSwitchTo(null)
    if (finish) finishWorkout(activeWorkout)
    else discardWorkout()
    navigation.navigate("ActiveWorkout", { workout: next })
  }

  const renderWorkout = ({ item }) => {
    const running = activeWorkout && activeWorkout.id === item.id
    const last = lastDone(item.id)
    const status = running
      ? isResting
        ? `Resting ${formatClock(restTimer)}`
        : `${isWorkoutRunning ? "In progress" : "Paused"} · ${formatClock(workoutTimer)}`
      : `${item.exercises.length} exercises${last ? ` · ${last}` : ""}`

    return (
      <TouchableOpacity
        style={[styles.card, running && styles.runningCard]}
        onPress={() => openWorkout(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, running && styles.runningText]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.cardSubtitle, running && styles.runningText]} numberOfLines={1}>
            {status}
          </Text>
        </View>

        {/* ▶ start; the running workout has none (its green card already opens it) */}
        {!running && (
          <TouchableOpacity style={[styles.round, { backgroundColor: brand.green }]} onPress={() => openWorkout(item)}>
            <Ionicons name="play" size={22} color="#fff" style={styles.playIcon} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.round, { backgroundColor: brand.softBlue }, running && styles.whiteBorder]}
          onPress={() => setHistoryFor(item)}
        >
          <Ionicons name="time-outline" size={22} color={brand.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.round, styles.editRound, running && styles.runningEditRound]}
          onPress={() => navigation.navigate("ViewWorkout", { workout: item })}
        >
          <Ionicons name="create-outline" size={20} color={running ? "#fff" : theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={workouts}
        renderItem={renderWorkout}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💪</Text>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptyText}>Create your first one, it shows up on the watch too.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate("CreateWorkout")}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Create workout</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <AccountBar />
            <ThemeToggle />
          </View>
        }
      />

      {historyFor && <HistoryModal visible onClose={() => setHistoryFor(null)} workout={historyFor} />}

      <EndWorkoutDialog
        visible={!!switchTo && !!activeWorkout}
        title={`${activeWorkout?.title} is in progress`}
        subtitle={`End it to start ${switchTo?.title}`}
        onFinish={() => endAndStart(true)}
        onDiscard={() => endAndStart(false)}
        onContinue={() => {
          setSwitchTo(null)
          navigation.navigate("ActiveWorkout", { workout: activeWorkout })
        }}
      />
    </View>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    list: {
      padding: 16,
      paddingTop: 8,
      gap: 12,
      flexGrow: 1,
    },
    addButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: brand.green,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 28,
      paddingVertical: 14,
      paddingLeft: 22,
      paddingRight: 12,
      gap: 8,
    },
    runningCard: {
      backgroundColor: brand.green,
    },
    cardText: {
      flex: 1,
      marginRight: 4,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.text,
    },
    cardSubtitle: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 3,
      fontVariant: ["tabular-nums"],
    },
    runningText: {
      color: "#fff",
    },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    playIcon: {
      marginLeft: 3,
    },
    whiteBorder: {
      borderWidth: 2,
      borderColor: "#fff",
    },
    editRound: {
      backgroundColor: c.subtle,
    },
    runningEditRound: {
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    footer: {
      marginTop: 20,
      gap: 12,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 24,
    },
    emptyEmoji: {
      fontSize: 64,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      marginTop: 12,
    },
    emptyText: {
      fontSize: 15,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 6,
    },
    emptyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: brand.green,
      borderRadius: 24,
      paddingVertical: 12,
      paddingHorizontal: 22,
      marginTop: 20,
    },
    emptyButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  })
