import { Exercicio, ExercicioModelo, Serie } from '@/models/exercicio';
import { getLogsByUsuarioId } from '@/services/logService';
import { addTreino, deleteTreino, getTreinoById, updateTreino } from '@/services/treinoService';
import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoricoCargaTreinoChart } from '../../components/charts/HistoricoCargaTreinoChart';
import { OngoingWorkoutFooter } from '../../components/OngoingWorkoutFooter';
import { RepetitionsDrawer } from '../../components/RepetitionsDrawer';
import { RestTimeDrawer } from '../../components/RestTimeDrawer';
import { SetOptionsMenu } from '../../components/SetOptionsMenu';
import { VideoListItem } from '../../components/VideoListItem';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { getCachedActiveWorkoutLog, getCachedTreinoById } from '../../services/offlineCacheService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';
import { WorkoutSettingsModal } from './modals/WorkoutSettingsModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
  isWarmup?: boolean;
}

interface ExerciseItemProps {
  item: Exercicio;
  drag: () => void;
  isActive: boolean;
  onUpdateExercise: (ex: Exercicio) => void;
  onRemoveExercise: () => void;
  exerciseIndex: number;
  onOpenRepDrawer: (exerciseIndex: number, setIndex: number) => void;
  onOpenRestTimeModal: (exerciseIndex: number) => void;
  setIsEditing: (isEditing: boolean) => void;
}

const formatRestTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0 && remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return minutes > 0 ? `${minutes} min` : `${remainingSeconds} seg`;
};

const ExerciseItem = ({
  item,
  drag,
  isActive,
  onUpdateExercise,
  onRemoveExercise,
  exerciseIndex,
  onOpenRepDrawer,
  onOpenRestTimeModal,
  setIsEditing,
}: ExerciseItemProps) => {
  const [series, setSeries] = useState<SerieEdit[]>(
    item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' }))
  );

  useEffect(() => {
    setSeries(item.series.map((s, i) => ({ ...s, id: s.id || `set-${Date.now()}-${i}`, type: s.type || 'normal' })));
  }, [item.series, item]);

  const handleSeriesUpdate = (newSeries: SerieEdit[]) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSeries(newSeries);
    onUpdateExercise({ ...item, series: newSeries });
    setIsEditing(true);
  };

  const handleSetOption = (option: 'toggleWarmup' | 'addDropset' | 'copy' | 'delete' | 'toggleTime', index: number) => {
    setTimeout(() => {
      const newSets = [...series];
      if (option === 'delete') {
        newSets.splice(index, 1);
      } else if (option === 'copy') {
        newSets.splice(index + 1, 0, { ...newSets[index], id: `set-${Date.now()}` });
      } else if (option === 'addDropset') {
        const parentSet = newSets[index];
        newSets.splice(index + 1, 0, {
          id: `set-${Date.now()}`,
          repeticoes: parentSet.repeticoes,
          peso: (parentSet.peso ?? 10) * 0.7,
          type: 'dropset',
          concluido: false,
        });
      } else if (option === 'toggleWarmup') {
        const currentSet = newSets[index];
        currentSet.isWarmup = !currentSet.isWarmup;
      } else if (option === 'toggleTime') {
        newSets[index].isTimeBased = !newSets[index].isTimeBased;
      }
      handleSeriesUpdate(newSets);
    }, 100);
  };

  const renderSetItem = (setItem: SerieEdit, index: number) => {
    const normalSeriesCount = series
      .slice(0, index + 1)
      .filter(s => s.type === 'normal' && !s.isWarmup).length;

    return (
      <View key={setItem.id} style={[styles.setRow, setItem.type === 'dropset' && styles.dropsetRow]}>
        {setItem.type === 'dropset' ? (
          <FontAwesome5 name="arrow-down" size={16} color="#888" style={styles.setIndicator} />
        ) : setItem.isWarmup ? (
          <FontAwesome5 name="fire" size={16} color="#FFA500" style={styles.setIndicator} />
        ) : (
          <Text style={styles.setIndicator}>{normalSeriesCount}</Text>
        )}
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.repButton}
            onPress={() => {
              if (!setItem.isTimeBased) onOpenRepDrawer(exerciseIndex, index);
            }}
          >
            <Text style={styles.repButtonText}>{String(setItem.repeticoes)}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.xText}>x</Text>
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.setInput}
            value={String(setItem.peso || '')}
            onChangeText={(text) => {
              const newSets = [...series];
              newSets[index] = { ...newSets[index], peso: text as any };
              handleSeriesUpdate(newSets);
            }}
            onEndEditing={(e) => {
              const newSets = [...series];
              newSets[index] = { ...newSets[index], peso: parseFloat(e.nativeEvent.text.replace(',', '.')) || 0 };
              handleSeriesUpdate(newSets);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <SetOptionsMenu
          isTimeBased={!!setItem.isTimeBased}
          isNormalSet={setItem.type === 'normal'}
          isWarmup={!!setItem.isWarmup}
          isFirstSet={index === 0}
          onSelect={action => handleSetOption(action, index)}
        />
      </View>
    );
  };

  const renderSeriesHeader = () => (
    <View style={styles.seriesHeader}>
      <View style={styles.setIndicator} />
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Reps</Text>
      </View>
      <View style={styles.xText} />
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Peso (kg)</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );

  return (
    <ScaleDecorator>
      <View style={[styles.exercicioCard, isActive && styles.activeCard]}>
        <View style={styles.exercicioHeader}>
          {item.modelo?.imagemUrl ? (
            <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
          ) : (
            <View style={[styles.exerciseVideo, { backgroundColor: '#333' }]} />
          )}
          <View style={styles.exerciseInfo}>
            <Text style={styles.exercicioName}>{item.modelo?.nome}</Text>
            <Text style={styles.muscleGroup}>{item.modelo?.grupoMuscular}</Text>
          </View>
          <TouchableOpacity onLongPress={drag} disabled={isActive} style={styles.dragHandle}>
            <FontAwesome name="bars" size={20} color="#888" />
          </TouchableOpacity>
        </View>
        {item && (
          <View style={styles.notesContainer}>
            <FontAwesome name="pencil" size={12} color="#fff" />
            <TextInput
              style={styles.notesInput}
              placeholder="Anotações do exercício..."
              placeholderTextColor="#888"
              value={item.notes || ''}
              onChangeText={(text) => onUpdateExercise({ ...item, notes: text })}
              multiline
            />
          </View>
        )}
        <View style={styles.seriesContainer}>
          {series.length > 0 && renderSeriesHeader()}
          {series.map(renderSetItem)}
        </View>
        <TouchableOpacity
          style={styles.addSetButton}
          onPress={() => {
            const lastSet = series[series.length - 1];
            handleSeriesUpdate([
              ...series,
              {
                id: `set-${Date.now()}`,
                repeticoes: lastSet?.repeticoes || '10',
                peso: lastSet?.peso || 10,
                type: 'normal',
                isWarmup: false,
                concluido: false,
              },
            ]);
          }}
        >
          <FontAwesome name="plus" size={14} color="#3B82F6" />
          <Text style={styles.addSetButtonText}>Adicionar Série</Text>
        </TouchableOpacity>
        <View style={styles.exerciseActions}>
          <TouchableOpacity style={styles.restTimerCard} onPress={() => onOpenRestTimeModal(exerciseIndex)}>
            <FontAwesome name="clock-o" size={18} color="#fff" />
            <Text style={styles.restTimerText}>{formatRestTime(item.restTime || 90)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeExerciseButton} onPress={onRemoveExercise}>
            <FontAwesome name="trash" size={16} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>
    </ScaleDecorator>
  );
};

export default function EditarTreinoScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { treinoId, fichaId, fromConfig } = params as { treinoId?: string; fichaId: string, fromConfig?: string };

  const [treino, setTreino] = useState<Treino | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [isDefaultRestTimeDrawerVisible, setDefaultRestTimeDrawerVisible] = useState(false);
  const [isRestTimeModalVisible, setIsRestTimeModalVisible] = useState(false);
  const [editingIndices, setEditingIndices] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  const [activeLog, setActiveLog] = useState<Log | null>(null);
  const [allUserLogs, setAllUserLogs] = useState<Log[]>([]);

  const hasRelevantLogs = useMemo(() => {
    if (!treinoId || !allUserLogs || allUserLogs.length === 0) {
      return false;
    }
    return allUserLogs.some(log => log.treino?.id === treinoId);
  }, [allUserLogs, treinoId]);

  const editingProgress = useSharedValue(0);

  useEffect(() => {
    editingProgress.value = withTiming(isEditing ? 1 : 0, { duration: 300 });
  }, [isEditing]);

  useFocusEffect(
    useCallback(() => {
      const checkActiveWorkout = async () => {
        const log = await getCachedActiveWorkoutLog();
        setActiveLog(log);
      };
      checkActiveWorkout();
    }, [])
  );

  useEffect(() => {
    if (!treinoId) {
      setIsEditing(true);
    }
  }, [treinoId]);

  useEffect(() => {
    if (user?.id) {
      getLogsByUsuarioId(user.id).then(setAllUserLogs);
      getUserProfile(user.id).then(profile => {
        if (profile?.workoutScreenType) {
          setWorkoutScreenType(profile.workoutScreenType);
        }
      });
    }
  }, [user]);

  // ... imports

  useEffect(() => {
    const loadTreino = async () => {
      let cachedLoaded = false;

      // 1. Initial Cache Load (Offline First)
      if (treinoId) {
        try {
          const cachedTreino = await getCachedTreinoById(treinoId as string);
          if (cachedTreino) {
            console.log('[editarTreino] Loaded from cache first');
            setTreino(cachedTreino);
            setLoading(false);
            cachedLoaded = true;
          }
        } catch (e) {
          console.warn('[editarTreino] Failed to load cache:', e);
        }
      }

      // If we didn't load from cache (or it's a new treino), we act normally.
      // If we did load from cache, we still run the network fetch for a silent update.

      if (treinoId) {
        try {
          const fetchedTreino = await getTreinoById(treinoId as string);

          if (fetchedTreino && fetchedTreino.exercicios) {
            fetchedTreino.exercicios.forEach((ex, index) => {
              if (!ex.modelo) {
                console.error(`[editarTreino] ERRO: Exercício no índice ${index} (ID: ${ex.modeloId}) veio sem 'modelo'.`);
              }
            });
          }

          // If we already showed cache, only update if there are changes (not implemented deep compare here, just overwrite for now)
          // Ideally we check if data changed effectively to avoid re-renders or overwriting user edits if they started editing instantly.
          // But since this is a "view/edit" screen, if they started editing, we should be careful.
          // For now, consistent with "stale-while-revalidate", we update.
          // TODO: Handle "user started editing before sync finished" conflict? 
          // Current simplistic approach: Just update.

          if (fetchedTreino) {
            setTreino({ ...fetchedTreino, id: treinoId as string });
          }
        } catch (error) {
          console.error('[editarTreino] Network fetch failed (silent):', error);
        }
      } else {
        // New Treino
        setTreino({
          id: '',
          nome: 'Novo Treino',
          usuarioId: user?.id || '',
          fichaId: fichaId || undefined,
          exercicios: [],
          diasSemana: [],
          intervalo: { min: 1, seg: 30 },
          ordem: 0,
          descricao: '',
        });
      }
      setLoading(false); // Ensure loading is false at the end
    };
    loadTreino();
  }, [treinoId, fichaId, user]);

  const handleClose = () => {
    router.back();
  };

  const handleStartWorkout = () => {
    if (!treino || !treino.id) return;
    const targetPath = user?.workoutScreenType === 'simplified'
      ? '/(treino)/ongoingWorkout'
      : '/(treino)/LoggingDuringWorkout';

    router.push({
      pathname: targetPath,
      params: { treinoId: treino.id, fichaId: treino.fichaId }
    });
  };

  const handleOpenRepDrawer = (exerciseIndex: number, setIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex });
    setIsRepDrawerVisible(true);
  };

  const handleRepetitionsSave = (newReps: string) => {
    if (!editingIndices || !treino) return;

    const { exerciseIndex, setIndex } = editingIndices;
    const updatedExercicios = [...treino.exercicios];
    const seriesToUpdate = [...updatedExercicios[exerciseIndex].series];

    seriesToUpdate[setIndex] = { ...seriesToUpdate[setIndex], repeticoes: newReps };
    updatedExercicios[exerciseIndex] = { ...updatedExercicios[exerciseIndex], series: seriesToUpdate };

    if (!isEditing) setIsEditing(true);
    setTreino({ ...treino, exercicios: updatedExercicios });

    setIsRepDrawerVisible(false);
    setEditingIndices(null);
  };

  const handleOpenRestTimeModal = (exerciseIndex: number) => {
    setEditingIndices({ exerciseIndex, setIndex: -1 });
    setIsRestTimeModalVisible(true);
  };

  const handleRestTimeSave = (newRestTime: number) => {
    if (!editingIndices || !treino) return;
    const { exerciseIndex } = editingIndices;
    const updatedExercise = { ...treino.exercicios[exerciseIndex], restTime: newRestTime };
    handleUpdateExercise(updatedExercise, exerciseIndex);
    setIsRestTimeModalVisible(false);
  };

  const handleDefaultRestTimeSave = (newSeconds: number) => {
    if (!treino) return;

    const oldDefaultSeconds = (treino.intervalo?.min ?? 1) * 60 + (treino.intervalo?.seg ?? 30);

    const updatedExercicios = treino.exercicios.map(ex => {
      if (ex.restTime === oldDefaultSeconds) {
        return { ...ex, restTime: newSeconds };
      }
      return ex;
    });

    const newMin = Math.floor(newSeconds / 60);
    const newSeg = newSeconds % 60;

    setTreino({ ...treino, exercicios: updatedExercicios, intervalo: { min: newMin, seg: newSeg } });
    setDefaultRestTimeDrawerVisible(false);
  };

  const getRepetitionsValue = () => {
    if (!editingIndices || !treino) return '10';
    const { exerciseIndex, setIndex } = editingIndices;
    const exercise = treino.exercicios[exerciseIndex];
    return exercise?.series[setIndex]?.repeticoes || '10';
  };

  const getRestTimeValue = () => {
    if (!editingIndices || !treino) return 90;
    const { exerciseIndex } = editingIndices;
    const exercise = treino.exercicios[exerciseIndex];
    return exercise?.restTime || 90;
  };

  const handleSave = async () => {
    if (!treino) return;
    setIsSaving(true);
    try {
      if (treino.id && treino.id !== '') {
        await updateTreino(treino.id, treino);
      } else {
        const newTreinoId = await addTreino(treino);
        setTreino(prev => prev ? { ...prev, id: newTreinoId } : null);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao salvar treino:", error);
      Alert.alert('Erro', 'Não foi possível salvar o treino.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExercises = (exerciciosSelecionados: ExercicioModelo[]) => {
    if (!treino) return;

    const novosExercicios: Exercicio[] = exerciciosSelecionados.map(modelo => ({
      modeloId: modelo.id,
      modelo: modelo,
      series: [{ id: `set-${Date.now()}`, repeticoes: '10', peso: 10, type: 'normal', concluido: false }],
      isBiSet: false,
      notes: '',
      restTime: 90,
    }));

    if (!isEditing) setIsEditing(true);
    setTreino(prev => prev ? { ...prev, exercicios: [...prev.exercicios, ...novosExercicios] } : null);
    setModalVisible(false);
  };

  const handleUpdateExercise = (updatedExercise: Exercicio, index: number) => {
    if (!treino) return;
    const newExercicios = [...treino.exercicios];
    if (!isEditing) setIsEditing(true);
    newExercicios[index] = updatedExercise;
    setTreino({ ...treino, exercicios: newExercicios });
  };

  const handleRemoveExercise = (index: number) => {
    if (!treino) return;
    const exerciseName = treino.exercicios[index]?.modelo?.nome || 'este exercício';
    Alert.alert(
      "Apagar Exercício",
      `Tem certeza que deseja apagar "${exerciseName}" do seu treino?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: () => {
            if (!isEditing) setIsEditing(true);
            const newExercicios = [...treino.exercicios];
            newExercicios.splice(index, 1);
            setTreino({ ...treino, exercicios: newExercicios });
          }
        }
      ]
    );
  };

  const handleDeleteTreino = async () => {
    if (!treino || !treino.id) {
      Alert.alert("Erro", "Este treino ainda não foi salvo e não pode ser deletado.");
      router.back();
      return;
    }

    Alert.alert(
      "Apagar Treino",
      `Tem certeza que deseja apagar permanentemente o treino "${treino.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar", style: "destructive", onPress: async () => {
            try {
              await deleteTreino(treino.id, treino.fichaId ?? undefined);
              Alert.alert("Sucesso", "O treino foi apagado.");
              router.back();
            } catch (error) { console.error("Erro ao apagar treino:", error); Alert.alert('Erro', 'Não foi possível apagar o treino.'); }
          }
        }
      ]
    );
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
        drag={drag}
        onOpenRestTimeModal={handleOpenRestTimeModal}
        isActive={isActive}
        onUpdateExercise={(ex) => handleUpdateExercise(ex, index)}
        onRemoveExercise={() => handleRemoveExercise(index)} setIsEditing={setIsEditing} />
    );
  }, [treino]);

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
              {treinoId && hasRelevantLogs && (
                <View style={{ marginTop: 20, alignItems: 'center' }}>
                  <HistoricoCargaTreinoChart
                    treinoId={treinoId}
                    allUserLogs={allUserLogs}
                  />
                </View>
              )}
              {/* Seletor de dias removido daqui */}
            </View>
          }
          ListFooterComponent={
            <>
              <TouchableOpacity style={styles.addExerciseButton} onPress={() => setModalVisible(true)}>
                <FontAwesome name="plus" size={16} color="#fff" />
                <Text style={styles.addExerciseButtonText}>Adicionar Exercício</Text>
              </TouchableOpacity>

              {treinoId && (
                <TouchableOpacity style={styles.deleteWorkoutButton} onPress={handleDeleteTreino}>
                  <FontAwesome name="trash" size={16} color="#ff3b30" />
                  <Text style={styles.deleteWorkoutButtonText}>Apagar Treino</Text>
                </TouchableOpacity>
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

      {/* Modal de Dias removido daqui e passado para dentro do WorkoutSettingsModal */}

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

      {/* Passando props adicionais para o modal */}
      <WorkoutSettingsModal
        isVisible={isSettingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        treino={treino}
        onUpdateTreino={(novoTreino) => {
          if (!isEditing) setIsEditing(true);
          setTreino(novoTreino);
        }}
      />

      <OngoingWorkoutFooter />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
    paddingHorizontal: 8,
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
  exercicioCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#222',
  },
  activeCard: {
    borderColor: '#1cb0f6',
    shadowColor: '#1cb0f6',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10,
  },
  exercicioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  exerciseVideo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#333',
  },
  exerciseInfo: {
    flex: 1,
  },
  exercicioName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  muscleGroup: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  dragHandle: {
    padding: 10,
  },
  seriesContainer: {
    marginTop: 10,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropsetRow: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#444',
  },
  setIndicator: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    width: 40,
    textAlign: 'center',
  },
  inputGroup: {
    alignItems: 'center',
    flex: 1,
  },
  inputLabel: {
    color: '#aaa',
    fontSize: 10,
    marginBottom: 4,
  },
  setInput: {
    backgroundColor: '#262A32',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 16,
    minWidth: 80,
  },
  repButton: {
    backgroundColor: '#262A32',
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  xText: {
    color: '#888',
    fontSize: 14,
    alignSelf: 'flex-end',
    paddingBottom: 10,
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 15,
    marginTop: 15,
    backgroundColor: 'transparent',
    borderRadius: 8,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  addSetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  configButton: {
    padding: 10,
    marginLeft: 15,
  },
  removeExerciseButton: {
    padding: 10,
  },
  restTimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2E37',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    gap: 8,
  },
  restTimerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  notesInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  restTimeOptionsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  restTimeOptionButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  restTimeOptionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  customRestTimeButton: { backgroundColor: '#555' },
});