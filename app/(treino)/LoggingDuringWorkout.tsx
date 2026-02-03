import { MachineChooserDrawer } from '@/components/MachineChooserDrawer';
import { LoggedExerciseCard } from '@/components/treino/logging/LoggedExerciseCard';
import { RestTimerOverlay } from '@/components/treino/logging/RestTimerOverlay';
import { WorkoutHeader } from '@/components/treino/logging/WorkoutHeader';
import { WorkoutStats } from '@/components/treino/logging/WorkoutStats';
import { useTimer } from '@/contexts/TimerContext';
import { useWorkoutLogic } from '@/hooks/treino/useWorkoutLogic';
import { useWorkoutTimer } from '@/hooks/treino/useWorkoutTimer';
import { Treino } from '@/models/treino';
import { LoggedExercise } from '@/types/logging';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { ExerciseNotesModal } from './modals/ExerciseNotesModal';
import { ExerciseReorderModal } from './modals/ExerciseReorderModal';
import { WorkoutOverviewModal } from './modals/modalOverview';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';
import { SelectExerciseModal } from './modals/SelectExerciseModal';
import { WorkoutSettingsModal } from './modals/WorkoutSettingsModal';
// Imports necessary for types but logic moved to hooks

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoggingDuringWorkoutScreen() {
  // Timer Hook
  // We need to pass setLoggedExercises to useWorkoutTimer so it can update state on timer end.
  // But setLoggedExercises comes from useWorkoutLogic.
  // We can pass a "proxy" setter or just pass the logic hook's setter.
  // But useWorkoutLogic is initialized inside component.
  // We need a way to connect them.

  // To solve circular dependency or ordering:
  // 1. Initialize `useTimer` related stuff in `useWorkoutLogic`? No, logic should be separate.
  // 2. Initialize `useWorkoutLogic` first, get `setLoggedExercises`.
  // 3. Initialize `useWorkoutTimer` with `setLoggedExercises`.
  // 4. Pass `stopTimer` from `useWorkoutTimer` to `useWorkoutLogic` (for finish/cancel).

  // Wait, `useWorkoutLogic` takes `stopTimer` as argument in my design.
  // So:
  // const timer = useWorkoutTimer(...);
  // const logic = useWorkoutLogic(timer.stopTimer, timer.timerState === 'running');

  // BUT `useWorkoutTimer` needs `loggedExercises` from `logic`.
  // Cycle!

  // Solution: `useWorkoutTimer` shouldn't manage state updates directly? 
  // Or `useWorkoutLogic` should expose a "handleTimerFinish" that `useWorkoutTimer` calls?
  // Let's modify `useWorkoutTimer` to accept a callback `onTimerFinished` instead of setting state directly.

  // Actually, I can pass `loggedExercises` and `setLoggedExercises` to `useWorkoutTimer` *after* getting them from logic.
  // But hooks order must be constant.
  // `useWorkoutLogic` returns `loggedExercises`.
  // `useWorkoutTimer` needs `loggedExercises`.

  // The issue is `useWorkoutLogic` needs `stopTimer` from `useWorkoutTimer`.
  // And `useWorkoutTimer` needs `loggedExercises` from `useWorkoutLogic`.

  // This is a classic hook coupling.
  // I can split `useWorkoutLogic` into `useWorkoutData` and `useWorkoutActions`? 
  // Or just rely on the fact that `stopTimer` is stable?

  // I'll instantiate `useWorkoutTimer` first with minimal args, or just `useTimer` wrapper.
  // Actually `useWorkoutTimer` logic (startTimer wrapper) mainly needs `loggedExercises` to read metadata.

  // I will refactor `useWorkoutTimer` slightly to NOT depend on `loggedExercises` for `stopTimer`.
  // Oh wait, `startTimer` needs `loggedExercises`. `stopTimer` does not.
  // So I can get `stopTimer` from `useTimer` context directly in `useWorkoutLogic`?
  // The `useWorkoutLogic` passed `stopTimer` prop is just to stop the timer when finishing.
  // I can import `useTimer` inside `useWorkoutLogic`?
  // `architecture.md` says "Hooks ... Coordenam chamadas aos services". Context is like a service here.
  // Yes, `useWorkoutLogic` should probably just use `useTimer` context itself for stopping.
  // But I designed it to take `stopTimer` as prop.

  // Let's assume I can't change `useWorkoutLogic` significantly right now (I just wrote it).
  // But I can change it if needed.
  // Wait, I can pass `stopTimer` from `useTimer` directly to `useWorkoutLogic`.
  // `const { stopTimer } = useTimer();`
  // `const logic = useWorkoutLogic(stopTimer, ...);`
  // `const workoutTimer = useWorkoutTimer(logic.loggedExercises, logic.setLoggedExercises);`

  // This works!
  // `useWorkoutTimer` exports `startTimer` which we use in UI.
  // `useWorkoutLogic` uses `stopTimer` internally.

  const { stopTimer, timerState } = useTimer();
  const isTimerRunning = timerState === 'running';

  const logic = useWorkoutLogic(stopTimer, isTimerRunning);
  const workoutTimer = useWorkoutTimer(logic.loggedExercises, logic.setLoggedExercises);

  // UI State for Modals
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReorderModalVisible, setReorderModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [isOverviewModalVisible, setOverviewModalVisible] = useState(false);
  const [isMachineDrawerVisible, setIsMachineDrawerVisible] = useState(false);
  const [exerciseForMachine, setExerciseForMachine] = useState<{ index: number, exercise: LoggedExercise } | null>(null);
  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [exerciseForNotes, setExerciseForNotes] = useState<{ index: number, exercise: LoggedExercise } | null>(null);
  const [isSubstituteModalVisible, setSubstituteModalVisible] = useState(false);
  const [exerciseForSubstitution, setExerciseForSubstitution] = useState<{ index: number, exercise: LoggedExercise } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Animation values
  const scrollY = useSharedValue(0);

  // Handlers for Modals
  const handleOpenSubstitute = (index: number) => {
    setExerciseForSubstitution({ index, exercise: logic.loggedExercises[index] });
    setSubstituteModalVisible(true);
  };

  const onConfirmSubstitute = (newModel: any) => {
    if (exerciseForSubstitution) {
      logic.handleConfirmSubstitute(exerciseForSubstitution.index, newModel);
      setSubstituteModalVisible(false);
      setExerciseForSubstitution(null);
    }
  }

  const handleEditExerciseFromOverview = (exerciseToEdit: any) => {
    setOverviewModalVisible(false);
    // Logic to scroll to exercise or open its details could go here
  };

  const allSeriesCompleted =
    logic.loggedExercises.length > 0 &&
    logic.loggedExercises.every(
      (exercise) =>
        exercise.series &&
        exercise.series.length > 0 &&
        exercise.series.every((set) => set.concluido)
    );

  const totalSets = logic.loggedExercises.reduce((acc, exercise) => acc + (exercise.series?.length || 0), 0);
  const completedSets = logic.loggedExercises.reduce((acc, exercise) =>
    acc + ((exercise.series)?.filter(set => set.concluido).length || 0), 0);
  const workoutProgress = totalSets > 0 ? (completedSets / totalSets) : 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MenuProvider>
        <SafeAreaView style={styles.container} onTouchStart={logic.recordInteraction}>
          <WorkoutHeader
            workoutName={logic.workoutName}
            setWorkoutName={logic.setWorkoutName}
            setIsNameEdited={logic.setIsNameEdited}
            handleBack={logic.handleCancelWorkout} // Use cancel as back with check
            handleFinishWorkout={logic.handleFinishWorkout}
            isFinishing={logic.isFinishing}
            allSeriesCompleted={allSeriesCompleted}
            onTitlePress={() => setOverviewModalVisible(true)}
            isNameEdited={logic.isNameEdited}
          />

          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, { width: `${workoutProgress * 100}%` }]} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {logic.loggedExercises.length === 0 ? (
              <View style={styles.emptyContainer}>
                <TouchableOpacity
                  style={styles.addButtonCircle}
                  onPress={() => setModalVisible(true)}
                >
                  <FontAwesome name="plus" size={50} color="#3B82F6" />
                </TouchableOpacity>
                <Text style={styles.emptyText}>Adicione o primeiro exercício</Text>
              </View>
            ) : (
              <FlatList
                data={logic.loggedExercises}
                onScroll={(event) => {
                  scrollY.value = event.nativeEvent.contentOffset.y;
                }}
                keyExtractor={(item) => item.modeloId} // Potentially unsafe if duplicates allowed? Use index or unique ID if available. Using modelId for now as in original.
                ListHeaderComponent={
                  <WorkoutStats elapsedTime={logic.elapsedTime} totalLoad={logic.totalLoad} />
                }
                renderItem={({ item, index }) => {
                  return (
                    <LoggedExerciseCard
                      item={item}
                      allUserLogs={logic.userLogs}
                      userWeight={logic.userWeight}
                      exerciseIndex={index}
                      onSeriesChange={(newSeries) =>
                        logic.handleUpdateExerciseSeries(index, newSeries)
                      }
                      onRemove={() => logic.handleRemoveExercise(index)}
                      onRestTimeChange={(newRestTime) => logic.handleRestTimeChange(index, newRestTime)}
                      onNotesChange={(newNotes) => logic.handleNotesChange(index, newNotes)}
                      onPesoBarraChange={(newPesoBarra) => logic.handlePesoBarraChange(index, newPesoBarra)}
                      startRestTimer={(duration, isExercise, timedSetInfo, completedSetInfo) =>
                        workoutTimer.startTimer(
                          duration,
                          isExercise,
                          timedSetInfo ? { ...timedSetInfo, exerciseIndex: index } : undefined,
                          completedSetInfo
                        )
                      }
                      onMenuStateChange={setIsMenuOpen}
                      onOpenMachineDrawer={() => {
                        setExerciseForMachine({ index, exercise: item });
                        setIsMachineDrawerVisible(true);
                      }}
                      onReorder={() => setReorderModalVisible(true)}
                      onOpenNotes={() => {
                        setExerciseForNotes({ index, exercise: item });
                        setIsNotesModalVisible(true);
                      }}
                      onSubstitute={() => handleOpenSubstitute(index)}
                    />
                  );
                }}
                ListFooterComponent={
                  <>
                    <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 15, marginTop: 10 }}>
                      <TouchableOpacity
                        style={[styles.addMoreButton, { flex: 1, margin: 0, marginTop: 0, marginHorizontal: 0 }]}
                        onPress={() => setModalVisible(true)}
                      >
                        <Text style={styles.addSetButtonText}>+ Adicionar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addMoreButton, { flex: 1, margin: 0, marginTop: 0, marginHorizontal: 0, backgroundColor: '#2A2E37', borderColor: '#333' }]}
                        onPress={() => setReorderModalVisible(true)}
                      >
                        <Text style={styles.addSetButtonText}>Reordenar</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.settingsButton}
                      onPress={() => setSettingsModalVisible(true)}
                    >
                      <FontAwesome name="cog" size={16} color="#aaa" />
                      <Text style={styles.settingsButtonText}>Configurações</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelWorkoutButton]}
                      onPress={() => logic.handleCancelWorkout()}
                    >
                      <Text style={styles.cancelWorkoutButtonText}>Cancelar treino</Text>
                    </TouchableOpacity>
                  </>
                }
                contentContainerStyle={{
                  paddingBottom: 140,
                  paddingTop: 15,
                }}
              />
            )}

            {isMenuOpen && (
              <Animated.View style={styles.overlay} entering={FadeIn} exiting={FadeOut}>
                <View style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}

            <MultiSelectExerciseModal
              visible={isModalVisible}
              onClose={() => setModalVisible(false)}
              onConfirm={logic.handleSelectExercises}
              existingExerciseIds={logic.loggedExercises.map(e => e.modeloId)}
            />

            <WorkoutSettingsModal
              isVisible={isSettingsModalVisible}
              onClose={() => setSettingsModalVisible(false)}
            />

            {logic.treinoId && (
              <WorkoutOverviewModal
                visible={isOverviewModalVisible}
                onClose={() => setOverviewModalVisible(false)}
                treino={{
                  id: logic.treinoId as string,
                  exercicios: logic.loggedExercises,
                  nome: logic.workoutName,
                } as Treino}
                currentExerciseIndex={logic.loggedExercises.findIndex(ex => ex.series.some(s => !s.concluido))}
                cargaAcumuladaTotal={logic.totalLoad}
                userLogs={logic.userLogs}
                horarioInicio={logic.startTime}
                userWeight={logic.userWeight}
                onEditExercise={handleEditExerciseFromOverview} />
            )}

            <MachineChooserDrawer
              visible={isMachineDrawerVisible}
              onClose={() => setIsMachineDrawerVisible(false)}
              onSelectMachine={(machineId, machineName, shouldClose) => {
                if (exerciseForMachine) {
                  logic.handleMachineSelect(exerciseForMachine.index, machineId, machineName);
                  if (shouldClose) {
                    setIsMachineDrawerVisible(false);
                    setExerciseForMachine(null);
                  }
                }
              }}
              exerciseId={exerciseForMachine?.exercise.modeloId || ''}
              currentMachineId={exerciseForMachine?.exercise.machineId}
            />

            <ExerciseNotesModal
              visible={isNotesModalVisible}
              onClose={() => {
                setIsNotesModalVisible(false);
                setExerciseForNotes(null);
              }}
              exerciseId={exerciseForNotes?.exercise.modeloId || ''}
              exerciseName={exerciseForNotes?.exercise.modelo.nome || ''}
              currentNote={exerciseForNotes?.exercise.notes || ''}
              onSaveNote={(note) => {
                if (exerciseForNotes) {
                  logic.handleNotesChange(exerciseForNotes.index, note);
                }
              }}
            />

            <ExerciseReorderModal
              visible={isReorderModalVisible}
              onClose={() => setReorderModalVisible(false)}
              exercises={logic.loggedExercises}
              onSave={(newOrder) => logic.handleReorder(newOrder as LoggedExercise[])}
            />

            <SelectExerciseModal
              visible={isSubstituteModalVisible}
              onClose={() => {
                setSubstituteModalVisible(false);
                setExerciseForSubstitution(null);
              }}
              onSelect={onConfirmSubstitute}
              excludeIds={logic.loggedExercises.map(e => e.modeloId)}
              initialGroup={exerciseForSubstitution?.exercise.modelo.grupoMuscular}
              sortByWordCount={true}
            />

          </KeyboardAvoidingView>
        </SafeAreaView>
        <RestTimerOverlay
          isResting={workoutTimer.isResting}
          isDoingExercise={workoutTimer.isDoingExercise}
          restCountdown={workoutTimer.restCountdown}
          exerciseCountdown={workoutTimer.exerciseCountdown}
          progress={workoutTimer.progress}
          handleSkipRest={workoutTimer.handleSkipRest}
          formatTime={workoutTimer.formatTime}
        />
      </MenuProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  progressBarContainer: {
    height: 1,
    backgroundColor: '#333',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addButtonCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1D23',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
  },
  emptyText: { color: '#888', marginTop: 20, fontSize: 16 },
  addSetButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  addMoreButton: {
    borderWidth: 1,
    borderColor: '#ffffffee',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#121212',
    marginHorizontal: 15,
  },
  settingsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: 'transparent',
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333'
  },
  settingsButtonText: {
    color: '#aaa',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8
  },
  cancelWorkoutButton: {
    marginTop: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 130,
    marginHorizontal: 15,
  },
  cancelWorkoutButtonText: {
    color: 'rgba(255, 59, 48, 0.8)',
    fontWeight: 'bold',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
});