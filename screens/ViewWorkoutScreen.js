import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWorkout } from '../context/WorkoutContext'
import WorkoutForm from '../components/WorkoutForm'
import KeyboardSafeView from '../components/KeyboardSafeView'
import VideoButton from '../components/VideoButton'
import AlternativesBox from '../components/AlternativesBox'
import HistoryModal from '../components/HistoryModal'
import { workoutToForm, formToWorkout, formatWeight } from '../lib/workoutForm'
import { brand, useThemedStyles, useTheme } from "../lib/theme"

export default function ViewWorkoutScreen({ route, navigation }) {
  const styles = useThemedStyles(makeStyles)
  const theme = useTheme().colors
  const { workouts, workoutHistory, updateWorkout, deleteWorkout, activeWorkout, updateActiveWorkout } = useWorkout()

  // Always show the saved workout, not the copy passed in (which may be the in-progress one)
  const workout = workouts.find((w) => w.id === route.params.workout.id) || route.params.workout

  const [isEditing, setIsEditing] = useState(route.params?.isEditing || false)
  const [form, setForm] = useState(() => workoutToForm(workout))
  const [focusExerciseId, setFocusExerciseId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef(null)

  // Reps done per exercise in the last finished session of this workout
  const sessionsOfWorkout = (workoutHistory || []).filter((h) => h && h.originalId === workout.id)
  const sessionCount = sessionsOfWorkout.length
  const lastSession = [...sessionsOfWorkout].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
  const lastRepsFor = (exerciseId) =>
    lastSession?.exercises?.find((ex) => ex && ex.id === exerciseId)?.completed || null

  // Tapping an exercise opens the whole workout in edit mode, scrolled to that exercise
  const startEditing = (exerciseId = null) => {
    setForm(workoutToForm(workout))
    setFocusExerciseId(exerciseId)
    setIsEditing(true)
  }

  const hasChanges = () => JSON.stringify(form) !== JSON.stringify(workoutToForm(workout))

  // Returns false when the form is invalid (the error is shown)
  const saveChanges = () => {
    if (!hasChanges()) return true
    const { workout: editedWorkout, error } = formToWorkout(form, {
      id: workout.id,
      createdAt: workout.createdAt,
    })
    if (error) {
      Alert.alert('Error', error)
      return false
    }

    updateWorkout(editedWorkout)

    // If this workout is in progress, apply the changes but keep the progress made so far
    if (activeWorkout && activeWorkout.id === editedWorkout.id) {
      const updatedActiveWorkout = {
        ...activeWorkout,
        ...editedWorkout,
        exercises: editedWorkout.exercises.map(ex => {
          const activeEx = activeWorkout.exercises?.find(activeEx => activeEx.id === ex.id)
          if (activeEx) {
            const newSetsCount = ex.sets
            const oldSetsCount = activeEx.completed?.length || 0

            let newCompleted = [...(activeEx.completed || [])]
            let newSetsCompleted = [...(activeEx.setsCompleted || [])]

            if (newSetsCount > oldSetsCount) {
              const additionalSets = newSetsCount - oldSetsCount
              newCompleted = [...newCompleted, ...new Array(additionalSets).fill(ex.reps)]
              newSetsCompleted = [...newSetsCompleted, ...new Array(additionalSets).fill(false)]
            } else if (newSetsCount < oldSetsCount) {
              newCompleted = newCompleted.slice(0, newSetsCount)
              newSetsCompleted = newSetsCompleted.slice(0, newSetsCount)
            }

            return {
              ...ex,
              completed: newCompleted,
              setsCompleted: newSetsCompleted,
              lastPerformance: activeEx.lastPerformance,
              lastWeight: activeEx.lastWeight ?? null,
              increaseSuggested: activeEx.increaseSuggested && !(ex.weight > (activeEx.lastWeight ?? 0)),
              isCompleted: activeEx.isCompleted || false,
            }
          }
          return {
            ...ex,
            completed: new Array(ex.sets).fill(ex.reps),
            setsCompleted: new Array(ex.sets).fill(false),
            lastPerformance: null,
            lastWeight: null,
            increaseSuggested: false,
            isCompleted: false,
          }
        })
      }
      updateActiveWorkout(updatedActiveWorkout)
    }
    return true
  }

  const handleSave = () => {
    if (saveChanges()) {
      setIsEditing(false)
      setFocusExerciseId(null)
    }
  }

  // X: throw away the changes
  const handleCancel = () => {
    setForm(workoutToForm(workout))
    setIsEditing(false)
    setFocusExerciseId(null)
  }

  // Going back while editing saves automatically (only X discards)
  useEffect(() => {
    if (!isEditing) return
    return navigation.addListener('beforeRemove', (e) => {
      if (!hasChanges()) return
      const { error } = formToWorkout(form, { id: workout.id, createdAt: workout.createdAt })
      if (!error) {
        saveChanges()
        return
      }
      e.preventDefault()
      Alert.alert("Can't save", error, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard changes', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ])
    })
  })

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWorkout(workout.id)
            navigation.goBack()
          },
        },
      ]
    )
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Workout' : 'Workout Details',
      headerRight: () => (
        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TouchableOpacity onPress={() => startEditing()} style={styles.headerButton}>
                <Ionicons name="pencil" size={20} color={theme.headerText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={20} color={brand.red} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
                <Ionicons name="close" size={22} color={theme.headerText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Ionicons name="checkmark" size={22} color={brand.green} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ),
    })
  })

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  if (isEditing) {
    return (
      <KeyboardSafeView>
      <ScrollView ref={scrollRef} style={styles.content} keyboardShouldPersistTaps="handled">
        <WorkoutForm
          form={form}
          onChange={setForm}
          focusExerciseId={focusExerciseId}
          onFocusLayout={(y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })}
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardSafeView>
    )
  }

  return (
    <ScrollView style={styles.content}>
      <View style={styles.workoutCard}>
        <Text style={styles.workoutTitle}>{workout.title}</Text>

        <View style={styles.workoutInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={theme.textMuted} />
            <Text style={styles.infoLabel}>Total Time:</Text>
            <Text style={styles.infoValue}>{formatTime(workout.totalTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="pause-circle-outline" size={16} color={theme.textMuted} />
            <Text style={styles.infoLabel}>Set Rest:</Text>
            <Text style={styles.infoValue}>{workout.setRest}s</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="pause-circle" size={16} color={theme.textMuted} />
            <Text style={styles.infoLabel}>Exercise Rest:</Text>
            <Text style={styles.infoValue}>{workout.exerciseRest}s</Text>
          </View>
        </View>
      </View>

      {/* Only the latest reps are shown on the exercises; everything older lives behind this */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => setShowHistory(true)}
      >
        <Ionicons name="time-outline" size={18} color={theme.primary} />
        <Text style={styles.historyButtonText}>History ({sessionCount})</Text>
        <Ionicons name="chevron-forward" size={18} color={theme.primary} />
      </TouchableOpacity>

      <HistoryModal visible={showHistory} onClose={() => setShowHistory(false)} workout={workout} />

      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Exercises ({workout.exercises.length})</Text>

        {workout.exercises.map((exercise, index) => {
          const lastReps = lastRepsFor(exercise.id)
          return (
          <TouchableOpacity key={exercise.id} style={styles.exerciseCard} onPress={() => startEditing(exercise.id)} activeOpacity={0.7}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>{index + 1}</Text>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Ionicons name="create-outline" size={18} color={theme.textFaint} />
            </View>

            <Text style={styles.exerciseTarget}>
              {exercise.sets} × {exercise.reps}
              {exercise.weight !== null && exercise.weight !== undefined ? `  ·  ${formatWeight(exercise.weight)}` : ''}
              {lastReps ? <Text style={styles.lastReps}>{`  [${lastReps.join('-')}]`}</Text> : null}
            </Text>

            {(exercise.setRest || exercise.exerciseRest) && (
              <View style={styles.detailRow}>
                <Ionicons name="timer-outline" size={14} color={theme.textMuted} />
                <Text style={styles.detailText}>
                  Rest {exercise.setRest || workout.setRest}s between sets
                  {exercise.exerciseRest ? `, ${exercise.exerciseRest}s after` : ''}
                </Text>
              </View>
            )}
            {!!exercise.settings && (
              <View style={styles.detailRow}>
                <Ionicons name="settings-outline" size={14} color={theme.textMuted} />
                <Text style={styles.detailText}>{exercise.settings}</Text>
              </View>
            )}
            {!!exercise.notes && (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
                <Text style={styles.detailText}>{exercise.notes}</Text>
              </View>
            )}

            <VideoButton videos={exercise.videos} />
            <AlternativesBox alternatives={exercise.alternatives} />
          </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 12,
  },
  headerButton: {
    padding: 6,
  },
  content: {
    flex: 1,
    backgroundColor: c.background,
    padding: 16,
  },
  workoutCard: {
    backgroundColor: c.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 0,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  workoutInfo: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: c.textMuted,
    marginLeft: 8,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.infoBg,
    borderColor: c.infoBorder,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  historyButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: c.primary,
  },
  exercisesSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: c.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 0,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseNumber: {
    backgroundColor: c.primary,
    color: '#fff',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    flex: 1,
  },
  lastReps: {
    color: c.textSecondary,
    fontWeight: '700',
  },
  exerciseTarget: {
    fontSize: 15,
    fontWeight: '600',
    color: c.primary,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: c.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  saveButton: {
    backgroundColor: c.primary,
    padding: 16,
    borderRadius: 22,
    alignItems: 'center',
    marginBottom: 48,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
