import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useWorkout } from '../context/WorkoutContext'
import AsyncStorage from "@react-native-async-storage/async-storage"

export default function ViewWorkoutScreen({ route, navigation }) {
  const { workout } = route.params
  const { updateWorkout, deleteWorkout, activeWorkout, updateActiveWorkout } = useWorkout()
  
  const [isEditing, setIsEditing] = useState(route.params?.isEditing || false)
  const [editedWorkout, setEditedWorkout] = useState(workout)

  const handleSave = async () => {
    // Update the workout in storage AND state
    updateWorkout(editedWorkout)
    
    // CRITICAL FIX: Force save to AsyncStorage immediately
    const storedWorkouts = await AsyncStorage.getItem("workouts")
    const workouts = storedWorkouts ? JSON.parse(storedWorkouts) : []
    const updatedWorkouts = workouts.map(w => w.id === editedWorkout.id ? editedWorkout : w)
    await AsyncStorage.setItem("workouts", JSON.stringify(updatedWorkouts))
    
    // If this workout is currently active, update the active workout too
    if (activeWorkout && activeWorkout.id === editedWorkout.id) {
      const updatedActiveWorkout = {
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
              isCompleted: activeEx.isCompleted || false,
            }
          }
          return {
            ...ex,
            completed: new Array(ex.sets).fill(ex.reps),
            setsCompleted: new Array(ex.sets).fill(false),
            lastPerformance: null,
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
    setEditedWorkout(workout)
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

  const updateExercise = (exerciseId, field, value) => {
    setEditedWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, [field]: parseInt(value) || 0 } : ex
      )
    }))
  }

  const updateWorkoutField = (field, value) => {
    setEditedWorkout(prev => ({
      ...prev,
      [field]: field === 'title' ? value : parseInt(value) || 0
    }))
  }

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const currentWorkout = isEditing ? editedWorkout : workout

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workout Details</Text>
        
        <View style={styles.headerActions}>
          {!isEditing ? (
            <>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <Ionicons name="pencil" size={20} color="#2563eb" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                <Ionicons name="checkmark" size={20} color="#10b981" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.workoutCard}>
          <View style={styles.titleSection}>
            {isEditing ? (
              <TextInput
                style={styles.titleInput}
                value={currentWorkout.title}
                onChangeText={(value) => updateWorkoutField('title', value)}
                placeholder="Workout title"
              />
            ) : (
              <Text style={styles.workoutTitle}>{currentWorkout.title}</Text>
            )}
          </View>

          <View style={styles.workoutInfo}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={16} color="#6b7280" />
                <Text style={styles.infoLabel}>Total Time:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={currentWorkout.totalTime?.toString()}
                    onChangeText={(value) => updateWorkoutField('totalTime', value)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>{formatTime(currentWorkout.totalTime)}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="pause-circle-outline" size={16} color="#6b7280" />
                <Text style={styles.infoLabel}>Set Rest:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={currentWorkout.setRest?.toString()}
                    onChangeText={(value) => updateWorkoutField('setRest', value)}
                    placeholder="60"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>{currentWorkout.setRest}s</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="pause-circle" size={16} color="#6b7280" />
                <Text style={styles.infoLabel}>Exercise Rest:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.infoInput}
                    value={currentWorkout.exerciseRest?.toString()}
                    onChangeText={(value) => updateWorkoutField('exerciseRest', value)}
                    placeholder="120"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoValue}>{currentWorkout.exerciseRest}s</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Exercises ({currentWorkout.exercises.length})</Text>
          
          {currentWorkout.exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseNumber}>{index + 1}</Text>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
              </View>

              <View style={styles.exerciseDetails}>
                <View style={styles.exerciseDetailRow}>
                  <View style={styles.exerciseDetailItem}>
                    <Text style={styles.exerciseDetailLabel}>Sets:</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.exerciseDetailInput}
                        value={exercise.sets?.toString()}
                        onChangeText={(value) => updateExercise(exercise.id, 'sets', value)}
                        keyboardType="numeric"
                      />
                    ) : (
                      <Text style={styles.exerciseDetailValue}>{exercise.sets}</Text>
                    )}
                  </View>

                  <View style={styles.exerciseDetailItem}>
                    <Text style={styles.exerciseDetailLabel}>Reps:</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.exerciseDetailInput}
                        value={exercise.reps?.toString()}
                        onChangeText={(value) => updateExercise(exercise.id, 'reps', value)}
                        keyboardType="numeric"
                      />
                    ) : (
                      <Text style={styles.exerciseDetailValue}>{exercise.reps}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  cancelButton: {
    padding: 4,
  },
  saveButton: {
    padding: 4,
  },
  content: {
    flex: 1,
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
  titleSection: {
    marginBottom: 16,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
  },
  workoutInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  infoInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    minWidth: 60,
    textAlign: 'center',
  },
  exercisesSection: {
    marginBottom: 20,
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
    marginBottom: 12,
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
  exerciseDetails: {
    gap: 8,
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    gap: 20,
  },
  exerciseDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
    minWidth: 40,
  },
  exerciseDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  exerciseDetailInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    minWidth: 40,
    textAlign: 'center',
  },
})