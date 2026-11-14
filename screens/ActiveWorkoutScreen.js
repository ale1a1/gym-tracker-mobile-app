import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useWorkout } from "../context/WorkoutContext"
import WeightControl from "../components/WeightControl"
import VideoButton from "../components/VideoButton"
import HistoryModal from "../components/HistoryModal"
import EndWorkoutDialog from "../components/EndWorkoutDialog"
import { formatClock } from "../lib/time"
import { brand, useThemedStyles, useTheme } from "../lib/theme"

// The workout, laid out like the watch: a sticky bar (time, pause, stop; the rest countdown while
// resting), then each exercise with its target, weight, history and one row per set.
export default function ActiveWorkoutScreen({ route, navigation }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const { workout } = route.params || {}
  const {
    finishWorkout,
    discardWorkout,
    setActiveWorkout,
    startWorkout,
    pauseWorkout,
    isWorkoutRunning,
    workoutTimer,
    updateActiveWorkout,
    activeWorkout,
    restTimer,
    isResting,
    restType,
    restOverAt,
    clearRestOver,
    startRest,
    skipRest,
    updateExerciseWeight,
    swapExercise,
  } = useWorkout()

  const [showEnd, setShowEnd] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [historyExercise, setHistoryExercise] = useState(null)
  const [weightEditing, setWeightEditing] = useState(null) // exercise id whose weight editor is open
  const [altsOpen, setAltsOpen] = useState(null) // exercise index whose alternatives dropdown is open
  const isFinishing = useRef(false)
  const hasAutoStarted = useRef(false)

  // Opening a workout that isn't running yet makes it the active one
  useEffect(() => {
    if (isFinishing.current) return
    if (!activeWorkout && workout) setActiveWorkout(workout)
  }, [activeWorkout, workout, setActiveWorkout])

  const currentWorkout = activeWorkout

  // A new workout (timer at 0) starts by itself
  useEffect(() => {
    if (isFinishing.current || hasAutoStarted.current) return
    if (currentWorkout && !isWorkoutRunning && workoutTimer === 0) {
      startWorkout()
      hasAutoStarted.current = true
    }
  }, [currentWorkout, isWorkoutRunning, workoutTimer, startWorkout])

  // "Rest is over" goes away by itself after a few seconds
  useEffect(() => {
    if (!restOverAt) return
    const timeout = setTimeout(clearRestOver, 5000)
    return () => clearTimeout(timeout)
  }, [restOverAt])

  useLayoutEffect(() => {
    navigation.setOptions({
      title: currentWorkout?.title || "Workout",
      headerRight: () =>
        currentWorkout ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("ViewWorkout", { workout: currentWorkout, isEditing: true })}
          >
            <Ionicons name="create-outline" size={22} color={theme.headerText} />
          </TouchableOpacity>
        ) : null,
    })
  })

  if (!currentWorkout || !Array.isArray(currentWorkout.exercises)) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading workout…</Text>
      </View>
    )
  }

  const leave = (end) => {
    isFinishing.current = true
    setShowEnd(false)
    setShowComplete(false)
    end()
    navigation.goBack()
  }
  const handleFinish = () => leave(() => finishWorkout(currentWorkout))
  const handleDiscard = () => leave(discardWorkout)

  const updateReps = (exerciseId, setIndex, change) => {
    updateActiveWorkout({
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((ex) =>
        ex.id !== exerciseId || !Array.isArray(ex.completed)
          ? ex
          : { ...ex, completed: ex.completed.map((reps, i) => (i === setIndex ? Math.max(0, (reps || 0) + change) : reps)) },
      ),
    })
  }

  // Ticking a set starts the rest. The last set of the last exercise ends the workout instead.
  const toggleSet = (exerciseIndex, setIndex) => {
    const exercise = currentWorkout.exercises[exerciseIndex]
    if (!exercise || !Array.isArray(exercise.setsCompleted)) return
    const nowDone = !exercise.setsCompleted[setIndex]

    const updated = {
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((ex, i) =>
        i !== exerciseIndex ? ex : { ...ex, setsCompleted: ex.setsCompleted.map((done, j) => (j === setIndex ? nowDone : done)) },
      ),
    }
    updateActiveWorkout(updated)
    if (!nowDone) return

    if (!isWorkoutRunning) startWorkout()

    const isLastSetOfLastExercise =
      exerciseIndex === currentWorkout.exercises.length - 1 && setIndex === exercise.setsCompleted.length - 1
    if (isLastSetOfLastExercise) {
      skipRest()
      setShowComplete(true)
      return
    }

    const exerciseDone = updated.exercises[exerciseIndex].setsCompleted.every(Boolean)
    if (exerciseDone) startRest("exercise", exercise.exerciseRest || currentWorkout.exerciseRest || 120)
    else startRest("set", exercise.setRest || currentWorkout.setRest || 60)
  }

  const unticked = currentWorkout.exercises.reduce(
    (sum, ex) => sum + (ex.setsCompleted || []).filter((done) => !done).length,
    0,
  )

  return (
    <View style={styles.container}>
      {/* Sticky bar: rest countdown while resting, otherwise time + pause/play + stop */}
      {isResting ? (
        <View style={[styles.bar, styles.restBar]}>
          <View style={styles.barText}>
            <Text style={styles.restLabel}>{restType === "set" ? "Rest" : "Next exercise in"}</Text>
            <Text style={styles.restTime}>{formatClock(restTimer)}</Text>
          </View>
          <TouchableOpacity style={styles.skipButton} onPress={skipRest}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="play-skip-forward" size={16} color={brand.orange} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bar}>
          <View style={styles.barText}>
            <Text style={styles.barLabel}>{isWorkoutRunning ? "Workout time" : "Paused"}</Text>
            <Text style={[styles.barTime, !isWorkoutRunning && { color: brand.orange }]}>{formatClock(workoutTimer)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.round, { backgroundColor: isWorkoutRunning ? brand.orange : brand.green }]}
            onPress={isWorkoutRunning ? pauseWorkout : startWorkout}
          >
            <Ionicons name={isWorkoutRunning ? "pause" : "play"} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.round, { backgroundColor: brand.red }]} onPress={() => setShowEnd(true)}>
            <Ionicons name="stop" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {currentWorkout.exercises.map((exercise, exerciseIndex) => {
          const done = Array.isArray(exercise.setsCompleted) && exercise.setsCompleted.every(Boolean)
          const hasVideo = exercise.videos && exercise.videos.filter(Boolean).length > 0
          const alternatives = (exercise.alternatives || []).filter((alt) => alt && alt.name)
          const open = altsOpen === exerciseIndex

          return (
            <View key={exercise.id} style={[styles.exercise, done && styles.exerciseDone]}>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exercise.name}
              </Text>
              {!!exercise.settings && (
                <Text style={styles.settings} numberOfLines={2}>
                  {exercise.settings}
                </Text>
              )}

              {/* Video and alternatives, centred under the name */}
              {(hasVideo || alternatives.length > 0) && (
                <View style={styles.chips}>
                  <VideoButton videos={exercise.videos} />
                  {alternatives.length > 0 && (
                    <TouchableOpacity style={[styles.altChip, open && styles.altChipOpen]} onPress={() => setAltsOpen(open ? null : exerciseIndex)}>
                      <Ionicons name="swap-horizontal" size={16} color={theme.text} />
                      <Text style={styles.altChipText}>Alternatives</Text>
                      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.text} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {/* Tap a name: it takes this exercise's place for today */}
              {open && (
                <View style={styles.altList}>
                  {alternatives.map((alt, altIndex) => (
                    <TouchableOpacity
                      key={alt.id || altIndex}
                      style={styles.altRow}
                      onPress={() => {
                        setAltsOpen(null)
                        swapExercise(exerciseIndex, exercise.alternatives.indexOf(alt))
                      }}
                    >
                      <Text style={styles.altName} numberOfLines={1}>
                        {alt.name}
                      </Text>
                      <Text style={styles.altTarget}>
                        {alt.sets || exercise.sets} × {alt.reps || exercise.reps}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 4 × 10 · weight · history */}
              <View style={styles.targetRow}>
                <Text style={styles.target}>
                  {exercise.sets} × {exercise.reps}
                </Text>
                <WeightControl
                  weight={exercise.weight ?? null}
                  onChange={(weight) => updateExerciseWeight(exercise.id, weight)}
                  editing={weightEditing === exercise.id}
                  onEditingChange={(open) => setWeightEditing(open ? exercise.id : null)}
                />
                <TouchableOpacity style={styles.historyButton} onPress={() => setHistoryExercise(exercise)}>
                  <Ionicons name="time-outline" size={20} color={brand.navy} />
                </TouchableOpacity>
              </View>

              {exercise.increaseSuggested && (
                <TouchableOpacity style={styles.increasePill} onPress={() => setWeightEditing(exercise.id)}>
                  <Ionicons name="arrow-up" size={15} color="#1A1203" />
                  <Text style={styles.increaseText}>Increase weight</Text>
                </TouchableOpacity>
              )}

              {(exercise.setRest || exercise.exerciseRest) && (
                <Text style={styles.restNote}>
                  Rest {exercise.setRest || currentWorkout.setRest || 60}s between sets
                  {exercise.exerciseRest ? ` · ${exercise.exerciseRest}s after` : ""}
                </Text>
              )}

              {!!exercise.notes && <Text style={styles.notes}>{exercise.notes}</Text>}

              {/* One row per set: − reps + ✓ */}
              <View style={styles.sets}>
                {(exercise.completed || []).map((reps, setIndex) => {
                  const setDone = exercise.setsCompleted?.[setIndex]
                  return (
                    <View key={setIndex} style={styles.setRow}>
                      <TouchableOpacity style={styles.stepper} onPress={() => updateReps(exercise.id, setIndex, -1)}>
                        <Ionicons name="remove" size={22} color={theme.text} />
                      </TouchableOpacity>
                      <Text style={styles.reps}>{reps}</Text>
                      <TouchableOpacity style={styles.stepper} onPress={() => updateReps(exercise.id, setIndex, 1)}>
                        <Ionicons name="add" size={22} color={theme.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tick, setDone && styles.tickDone]}
                        onPress={() => toggleSet(exerciseIndex, setIndex)}
                      >
                        <Ionicons name="checkmark" size={24} color={setDone ? "#fff" : brand.green} />
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}
      </ScrollView>

      {historyExercise && (
        <HistoryModal visible onClose={() => setHistoryExercise(null)} workout={currentWorkout} exercise={historyExercise} />
      )}

      <EndWorkoutDialog
        visible={showEnd}
        title={`End ${currentWorkout.title}?`}
        onFinish={handleFinish}
        onDiscard={handleDiscard}
        onContinue={() => setShowEnd(false)}
      />

      {/* Last set of the last exercise ticked */}
      <Modal visible={showComplete} transparent animationType="fade" onRequestClose={() => setShowComplete(false)}>
        <View style={styles.overlay}>
          <View style={styles.completeBox}>
            <Text style={styles.completeEmoji}>💪</Text>
            <Text style={styles.completeTitle}>Congratulations!</Text>
            <Text style={styles.completeText}>{currentWorkout.title} finished</Text>
            {unticked > 0 && (
              <Text style={styles.completeWarning}>
                {unticked} {unticked === 1 ? "set" : "sets"} not ticked
              </Text>
            )}
            <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishText}>✓ Finish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notYetButton} onPress={() => setShowComplete(false)}>
              <Text style={styles.notYetText}>Not yet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rest ran out: back to work (tap to close, or it goes away by itself) */}
      <Modal visible={!!restOverAt && !showComplete} transparent animationType="fade" onRequestClose={clearRestOver}>
        <TouchableOpacity style={styles.restOver} activeOpacity={1} onPress={clearRestOver}>
          <View style={styles.restOverIcon}>
            <Ionicons name="play" size={56} color="#fff" style={{ marginLeft: 6 }} />
          </View>
          <Text style={styles.restOverTitle}>Rest is over</Text>
          <Text style={styles.restOverText}>Back to work</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const makeStyles = (c) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
    },
    loadingText: {
      fontSize: 16,
      color: c.textMuted,
    },
    headerButton: {
      padding: 6,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      borderRadius: 28,
      paddingVertical: 10,
      paddingLeft: 22,
      paddingRight: 10,
      gap: 10,
    },
    restBar: {
      backgroundColor: brand.orange,
    },
    barText: {
      flex: 1,
    },
    barLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textMuted,
    },
    barTime: {
      fontSize: 30,
      fontWeight: "800",
      color: c.text,
      fontVariant: ["tabular-nums"],
    },
    restLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: "#1A1203",
    },
    restTime: {
      fontSize: 30,
      fontWeight: "800",
      color: "#1A1203",
      fontVariant: ["tabular-nums"],
    },
    skipButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#1A1203",
      borderRadius: 22,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },
    skipText: {
      color: brand.orange,
      fontSize: 15,
      fontWeight: "800",
    },
    round: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 14,
    },
    exercise: {
      backgroundColor: c.card,
      borderRadius: 28,
      padding: 20,
      borderWidth: 2,
      borderColor: "transparent",
    },
    exerciseDone: {
      borderColor: brand.green,
    },
    exerciseName: {
      fontSize: 19,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    settings: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 2,
    },
    targetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 12,
    },
    target: {
      fontSize: 18,
      fontWeight: "700",
      color: c.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    historyButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: brand.softBlue,
      justifyContent: "center",
      alignItems: "center",
    },
    increasePill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      gap: 4,
      backgroundColor: brand.orange,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginTop: 10,
    },
    increaseText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#1A1203",
    },
    restNote: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: "center",
      marginTop: 8,
    },
    chips: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    altChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: c.subtle,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    altChipOpen: {
      backgroundColor: c.stepper,
    },
    altChipText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.text,
    },
    altList: {
      marginTop: 8,
      backgroundColor: c.subtle,
      borderRadius: 18,
      overflow: "hidden",
    },
    altRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    altName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
    },
    altTarget: {
      fontSize: 13,
      color: c.textMuted,
      marginLeft: 8,
    },
    notes: {
      fontSize: 13,
      color: c.textMuted,
      fontStyle: "italic",
      textAlign: "center",
      marginTop: 8,
    },
    sets: {
      marginTop: 14,
      gap: 10,
      alignItems: "center",
    },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    stepper: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.stepper,
      justifyContent: "center",
      alignItems: "center",
    },
    reps: {
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      minWidth: 40,
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
    tick: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 2,
      borderColor: brand.green,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
    },
    tickDone: {
      backgroundColor: brand.green,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    completeBox: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: c.card,
      borderRadius: 28,
      padding: 28,
      alignItems: "center",
    },
    completeEmoji: {
      fontSize: 84,
    },
    completeTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      marginTop: 6,
    },
    completeText: {
      fontSize: 16,
      color: c.textSecondary,
      marginTop: 4,
      textAlign: "center",
    },
    completeWarning: {
      fontSize: 14,
      fontWeight: "700",
      color: brand.orange,
      marginTop: 6,
    },
    finishButton: {
      alignSelf: "stretch",
      backgroundColor: brand.green,
      borderRadius: 26,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 24,
    },
    finishText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "800",
    },
    notYetButton: {
      alignSelf: "stretch",
      borderWidth: 2,
      borderColor: c.inputBorder,
      borderRadius: 26,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 12,
    },
    notYetText: {
      color: c.text,
      fontSize: 16,
      fontWeight: "700",
    },
    restOver: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    restOverIcon: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: brand.green,
      justifyContent: "center",
      alignItems: "center",
    },
    restOverTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: "#fff",
      marginTop: 22,
    },
    restOverText: {
      fontSize: 18,
      color: "#D4D4D8",
      marginTop: 4,
    },
  })
