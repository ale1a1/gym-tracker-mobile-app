import { useState, useLayoutEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWorkout } from '../context/WorkoutContext'
import WorkoutForm from '../components/WorkoutForm'
import KeyboardSafeView from '../components/KeyboardSafeView'
import VideoButton from '../components/VideoButton'
import { workoutToForm, formToWorkout, formatWeight } from '../lib/workoutForm'

export default function ViewWorkoutScreen({ route, navigation }) {
  const { workouts, updateWorkout, deleteWorkout, activeWorkout, updateActiveWorkout } = useWorkout()

  // Always show the saved workout, not the copy passed in (which may be the in-progress one)
  const workout = workouts.find((w) => w.id === route.params.workout.id) || route.params.workout

  const [isEditing, setIsEditing] = useState(route.params?.isEditing || false)
  const [form, setForm] = useState(() => workoutToForm(workout))

  const startEditing = () => {
    setForm(workoutToForm(workout))
    setIsEditing(true)
  }

  const handleSave = () => {
    const { workout: editedWorkout, error } = formToWorkout(form, {
      id: workout.id,
      createdAt: workout.createdAt,
    })
    if (error) {
      Alert.alert('Error', error)
      return
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

    setIsEditing(false)
    Alert.alert('Success', 'Workout updated successfully!')
  }

  const handleCancel = () => {
    setForm(workoutToForm(workout))
    setIsEditing(false)
  }

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
              <TouchableOpacity onPress={startEditing} style={styles.headerButton}>
                <Ionicons name="pencil" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Ionicons name="checkmark" size={22} color="#fff" />
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
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <WorkoutForm form={form} onChange={setForm} />
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
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.infoLabel}>Total Time:</Text>
            <Text style={styles.infoValue}>{formatTime(workout.totalTime)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="pause-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.infoLabel}>Set Rest:</Text>
            <Text style={styles.infoValue}>{workout.setRest}s</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="pause-circle" size={16} color="#6b7280" />
            <Text style={styles.infoLabel}>Exercise Rest:</Text>
            <Text style={styles.infoValue}>{workout.exerciseRest}s</Text>
          </View>
        </View>
      </View>

      <View style={styles.exercisesSection}>
        <Text style={styles.sectionTitle}>Exercises ({workout.exercises.length})</Text>

        {workout.exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>{index + 1}</Text>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
            </View>

            <Text style={styles.exerciseTarget}>
              {exercise.sets} × {exercise.reps}
              {exercise.weight !== null && exercise.weight !== undefined ? `  ·  ${formatWeight(exercise.weight)}` : ''}
            </Text>

            {!!exercise.settings && (
              <View style={styles.detailRow}>
                <Ionicons name="settings-outline" size={14} color="#6b7280" />
                <Text style={styles.detailText}>{exercise.settings}</Text>
              </View>
            )}
            {!!exercise.notes && (
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={14} color="#6b7280" />
                <Text style={styles.detailText}>{exercise.notes}</Text>
              </View>
            )}

            <VideoButton videos={exercise.videos} />
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  workoutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
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
    color: '#6b7280',
    marginLeft: 8,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  exercisesSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseNumber: {
    backgroundColor: '#2563eb',
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
    color: '#111827',
    flex: 1,
  },
  exerciseTarget: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 6,
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 48,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
