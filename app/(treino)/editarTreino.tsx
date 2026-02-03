import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Animated, { useAnimatedRef, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseItem } from '@/components/treino/ExerciseItem';
import { SessionHistoryItem } from '@/components/treino/SessionHistoryItem';
import { useEditarTreinoLogic } from '@/hooks/treino/useEditarTreinoLogic';

import { Exercicio } from '@/models/exercicio';
import { Treino } from '@/models/treino';

import { HistoricoCargaTreinoChart } from '@/components/charts/HistoricoCargaTreinoChart';
import { InfoCard } from '@/components/InfoCard';
import { MachineChooserDrawer } from '@/components/MachineChooserDrawer';
import { RepetitionsDrawer } from '@/components/RepetitionsDrawer';
import { RestTimeDrawer } from '@/components/RestTimeDrawer';
import { TimeBasedSetDrawer } from '@/components/TimeBasedSetDrawer';
import { ExerciseNotesModal } from './modals/ExerciseNotesModal';
import { ExerciseReorderModal } from './modals/ExerciseReorderModal';
import { WorkoutReviewModal } from './modals/modalReviewTreinos';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';
import { SelectExerciseModal } from './modals/SelectExerciseModal';
import { WorkoutSettingsModal } from './modals/WorkoutSettingsModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function EditarTreinoScreen() {
  const router = useRouter();
  const carouselRef = useAnimatedRef<any>();

  const { state, actions } = useEditarTreinoLogic();

  const {
    treino,
    loading,
    isSaving,
    isModalVisible,
    isEditing,
    isRepDrawerVisible,
    isExerciseTimeDrawerVisible,
    isDefaultRestTimeDrawerVisible,
    isRestTimeModalVisible,
    isSettingsModalVisible,
    activeLog,
    allUserLogs,
    carouselIndex,
    isReorderModalVisible,
    isNotesModalVisible,
    exerciseForNotes,
    // isDetailModalVisible, // Not used in render currently but kept in state if needed
    // detailExerciseIndex,
    selectedLog,
    isReviewModalVisible,
    isPremium,
    isMachineDrawerVisible,
    exerciseForMachine,
    isSubstituteModalVisible,
    exerciseForSubstitution,
    editingProgress,
    treinoId,
    // user,
    hasRelevantLogs,
    fromConfig
  } = state;

  const {
    setTreino,
    setModalVisible,
    setIsEditing,
    setIsRepDrawerVisible,
    setIsExerciseTimeDrawerVisible,
    setDefaultRestTimeDrawerVisible,
    setIsRestTimeModalVisible,
    setEditingIndices,
    setSettingsModalVisible,
    setCarouselIndex,
    setReorderModalVisible,
    setIsNotesModalVisible,
    setExerciseForNotes,
    setDetailModalVisible,
    setDetailExerciseIndex,
    setSelectedLog,
    setIsReviewModalVisible,
    navigateToPaywall,
    setIsMachineDrawerVisible,
    setExerciseForMachine,
    setSubstituteModalVisible,
    setExerciseForSubstitution,
    handleUpdateExercise,
    handleRemoveExercise,
    handleOpenSubstitute,
    handleConfirmSubstitute,
    handleMachineSelect,
    handleStartWorkout,
    handleSave,
    handleDeleteTreino,
    handleAddExercises,
    handleRepetitionsSave,
    handleTimeBasedSetSave,
    handleRestTimeSave,
    handleDefaultRestTimeSave,
    getRepetitionsValue,
    getRestTimeValue
  } = actions;

  const handleClose = () => {
    router.back();
  };

  const handleShowDetail = (index: number) => {
    setDetailExerciseIndex(index);
    setDetailModalVisible(true);
  };

  const handleOpenReviewModal = (log: any) => { // Type check: log is Log
    setSelectedLog(log);
    setIsReviewModalVisible(true);
  };

  // Helper wrappers for actions to match signature if needed
  const handleOpenRepDrawer = (exerciseIndex: number, setIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex });
    setIsRepDrawerVisible(true);
  };

  const handleOpenTimeDrawer = (exerciseIndex: number, setIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex });
    setIsExerciseTimeDrawerVisible(true);
  };

  const handleOpenRestTimeModal = (exerciseIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex: -1 });
    setIsRestTimeModalVisible(true);
  };

  const renderItem = useCallback(({ item, drag, isActive, getIndex }: RenderItemParams<Exercicio>) => {
    const index = getIndex();
    if (typeof index !== 'number') {
      return null;
    }
    return (
      <ExerciseItem
        item={item}
        exerciseIndex={index}
        onOpenRepDrawer={handleOpenRepDrawer}
        onOpenTimeDrawer={handleOpenTimeDrawer}
        drag={drag}
        onOpenRestTimeModal={handleOpenRestTimeModal}
        isActive={isActive}
        onUpdateExercise={(ex) => handleUpdateExercise(ex, index)}
        onRemoveExercise={() => handleRemoveExercise(index)}
        setIsEditing={setIsEditing}
        onReorder={() => setReorderModalVisible(true)}
        onOpenMachineDrawer={() => {
          setExerciseForMachine({ index, exercise: item });
          setIsMachineDrawerVisible(true);
        }}
        onOpenNotes={() => {
          setExerciseForNotes({ index, exercise: item });
          setIsNotesModalVisible(true);
        }}
        onSubstitute={() => handleOpenSubstitute(index)}
        onShowDetail={() => handleShowDetail(index)}
        isPremium={isPremium}
        navigateToPaywall={navigateToPaywall}
      />
    );
  }, [treino, handleUpdateExercise, handleRemoveExercise, isEditing]);

  const viewingStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - editingProgress.value,
      transform: [{ translateY: editingProgress.value * -20 }],
    };
  });

  const editingStyle = useAnimatedStyle(() => {
    return {
      opacity: editingProgress.value,
      transform: [{ translateY: (1 - editingProgress.value) * 20 }],
    };
  });

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ height: 30, justifyContent: 'center' }}>
            <Animated.View style={[styles.headerTitleContainer, viewingStyle]}>
              <Text style={styles.headerTitle}>Visualizar Treino</Text>
            </Animated.View>
            <Animated.View style={[styles.headerTitleContainer, editingStyle]}>
              <Text style={styles.headerTitle}>{treinoId ? 'Editar Treino' : 'Novo Treino'}</Text>
            </Animated.View>
          </View>
        </View>
        <View style={styles.headerRight}>
          {isEditing ? (
            <Animated.View style={[styles.headerButtonWrapper, editingStyle]}>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#1cb0f6" /> : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.headerButtonWrapper, viewingStyle]}>
              <TouchableOpacity style={styles.configButton} onPress={() => setSettingsModalVisible(true)}>
                <FontAwesome name="cog" size={22} color="#ccc" />
              </TouchableOpacity>

              {!activeLog ? (
                <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Text style={styles.startButtonText}>Iniciar</Text>
                      <FontAwesome name="arrow-right" size={14} color="#000" />
                    </>
                  )}
                </TouchableOpacity>
              ) : activeLog.treino?.id === treino?.id ? (
                <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Text style={styles.startButtonText}>Continuar</Text>
                      <FontAwesome name="play" size={14} color="#000" />
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          )}
        </View>
      </View>

      {treino && (
        <DraggableFlatList
          data={treino.exercicios}
          onDragEnd={({ data }) => setTreino(prev => prev ? { ...prev, exercicios: data } : null)}
          keyExtractor={(item) => item.modeloId || `new-${Math.random()}`}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.listHeaderContainer}>
              <TextInput
                style={styles.titleInput}
                value={treino.nome}
                onChangeText={text => {
                  if (!isEditing) setIsEditing(true);
                  if (!isEditing) setIsEditing(true);
                  setTreino(prev => prev ? { ...prev, nome: text } : null);
                }}
                placeholder="Nome do Treino"
                placeholderTextColor="#888"
              />

              <View style={{ marginTop: 16 }}>
                <Animated.FlatList
                  ref={carouselRef}
                  data={[
                    { key: 'info', type: 'info' },
                    { key: 'chart', type: 'chart' }
                  ]}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    // Simple calculation for index based on offset
                    const offsetX = e.nativeEvent.contentOffset.x;
                    const width = Dimensions.get('window').width - 16;
                    const index = Math.round(offsetX / width);
                    if (index !== carouselIndex) {
                      setCarouselIndex(index);
                    }
                  }}
                  scrollEventThrottle={16}
                  keyExtractor={item => item.key}
                  renderItem={({ item }) => {
                    if (item.type === 'info') {
                      return (
                        <View style={{ width: Dimensions.get('window').width - 16, paddingHorizontal: 0 }}>
                          <InfoCard
                            treino={treino}
                            allUserLogs={allUserLogs}
                            onUpdateTreino={(updatedTreino: Treino) => setTreino(updatedTreino)}
                            isEditing={isEditing}
                            setIsEditing={setIsEditing}
                            onPressProgresso={() => {
                              carouselRef.current?.scrollToIndex({ index: 1, animated: true });
                            }}
                          />
                        </View>
                      );
                    } else {
                      return (
                        <View style={{ width: Dimensions.get('window').width - 16, alignItems: 'center' }}>
                          {treinoId && hasRelevantLogs ? (
                            <HistoricoCargaTreinoChart
                              treinoId={treinoId}
                              allUserLogs={allUserLogs}
                              style={{ marginTop: 0 }}
                            />
                          ) : (
                            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ color: '#888' }}>Sem dados históricos suficientes.</Text>
                            </View>
                          )}
                        </View>
                      );
                    }
                  }}
                  style={{ overflow: 'visible' }}
                />

                {/* Pagination Dots */}
                <View style={styles.paginationContainer}>
                  {[0, 1].map((index) => (
                    <FontAwesome
                      key={index}
                      name={carouselIndex === index ? "circle" : "circle-o"}
                      size={8}
                      color="#666"
                      style={{ marginHorizontal: 4 }}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.sectionTitle}>Exercícios</Text>
            </View>
          }
          ListFooterComponent={
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 15 }}>
                <TouchableOpacity style={[styles.addExerciseButton, { flex: 1, margin: 0 }]} onPress={() => setModalVisible(true)}>
                  <FontAwesome name="plus" size={16} color="#fff" />
                  <Text style={styles.addExerciseButtonText}>Adicionar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addExerciseButton, { flex: 1, margin: 0, backgroundColor: '#2A2E37', borderColor: '#333' }]} onPress={() => setReorderModalVisible(true)}>
                  <FontAwesome name="bars" size={16} color="#fff" />
                  <Text style={styles.addExerciseButtonText}>Reordenar</Text>
                </TouchableOpacity>
              </View>

              {treinoId && (
                <TouchableOpacity style={styles.deleteWorkoutButton} onPress={handleDeleteTreino}>
                  <FontAwesome name="trash" size={16} color="#ff3b30" />
                  <Text style={styles.deleteWorkoutButtonText}>Apagar Treino</Text>
                </TouchableOpacity>
              )}

              {treinoId && hasRelevantLogs && (
                <View style={styles.historySection}>
                  <Text style={styles.sectionTitle}>Histórico de Sessões</Text>
                  {allUserLogs
                    .filter(log => log.treino?.id === treinoId && (log.horarioFim || log.status === 'concluido'))
                    .sort((a, b) => {
                      const dateA = a.horarioFim?.toDate ? a.horarioFim.toDate() : new Date(a.horarioFim || 0);
                      const dateB = b.horarioFim?.toDate ? b.horarioFim.toDate() : new Date(b.horarioFim || 0);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .slice(0, 5)
                    .map(log => (
                      <SessionHistoryItem
                        key={log.id}
                        log={log}
                        onPress={() => handleOpenReviewModal(log)}
                      />
                    ))}
                  {allUserLogs.filter(log => log.treino?.id === treinoId).length === 0 && (
                    <Text style={styles.emptyHistoryText}>Nenhuma sessão realizada ainda.</Text>
                  )}
                </View>
              )}
            </>
          }
          contentContainerStyle={{ paddingBottom: 130 }}
        />
      )}

      <MultiSelectExerciseModal
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleAddExercises}
        existingExerciseIds={fromConfig === 'true' ? [] : (treino?.exercicios.map(e => e.modeloId) || [])}
      />

      <RepetitionsDrawer
        visible={isRepDrawerVisible}
        onClose={() => setIsRepDrawerVisible(false)}
        onSave={handleRepetitionsSave}
        initialValue={getRepetitionsValue()}
      />

      <TimeBasedSetDrawer
        visible={isExerciseTimeDrawerVisible}
        onClose={() => setIsExerciseTimeDrawerVisible(false)}
        onSave={handleTimeBasedSetSave}
        initialValue={parseInt(getRepetitionsValue(), 10) || 60}
      />

      <RestTimeDrawer
        visible={isRestTimeModalVisible}
        onClose={() => {
          setIsRestTimeModalVisible(false);
          setEditingIndices(null);
        }}
        onSave={handleRestTimeSave}
        initialValue={getRestTimeValue()}
      />

      <RestTimeDrawer
        visible={isDefaultRestTimeDrawerVisible}
        onClose={() => setDefaultRestTimeDrawerVisible(false)}
        onSave={handleDefaultRestTimeSave}
        initialValue={treino && treino.intervalo ? (treino.intervalo.min * 60) + treino.intervalo.seg : 90}
      />

      <WorkoutSettingsModal
        isVisible={isSettingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        treino={treino}
        onUpdateTreino={(novoTreino) => {
          if (!isEditing) setIsEditing(true);
          setTreino(novoTreino);
        }}
      />

      <WorkoutReviewModal
        visible={isReviewModalVisible}
        onClose={() => setIsReviewModalVisible(false)}
        initialLog={selectedLog}
        allUserLogs={allUserLogs}
        currentUserId={state.user?.id || ''}
      />

      <MachineChooserDrawer
        visible={isMachineDrawerVisible}
        onClose={() => setIsMachineDrawerVisible(false)}
        onSelectMachine={handleMachineSelect}
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
            const updatedExercise = { ...exerciseForNotes.exercise, notes: note };
            handleUpdateExercise(updatedExercise, exerciseForNotes.index);
          }
        }}
      />

      <ExerciseReorderModal
        visible={isReorderModalVisible}
        onClose={() => setReorderModalVisible(false)}
        exercises={treino?.exercicios || []}
        onSave={(newOrder) => {
          if (!isEditing) setIsEditing(true);
          setTreino(prev => prev ? { ...prev, exercicios: newOrder as Exercicio[] } : null);
        }}
      />

      <SelectExerciseModal
        visible={isSubstituteModalVisible}
        onClose={() => {
          setSubstituteModalVisible(false);
          setExerciseForSubstitution(null);
        }}
        onSelect={handleConfirmSubstitute}
        excludeIds={treino?.exercicios.map(e => e.modeloId) || []}
        initialGroup={exerciseForSubstitution?.exercise.modelo.grupoMuscular}
        sortByWordCount={true}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
    paddingHorizontal: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  headerButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    padding: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    position: 'absolute',
  },
  saveButtonText: {
    color: '#1cb0f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  startButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030405',
  },
  listHeaderContainer: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleInput: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderColor: '#222',
    paddingBottom: 5,
  },
  configButton: {
    padding: 10,
    marginLeft: 15,
  },
  addExerciseButton: {
    backgroundColor: '#1A1D23',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 15,
    margin: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addExerciseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteWorkoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deleteWorkoutButtonText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historySection: {
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyHistoryText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  }
});