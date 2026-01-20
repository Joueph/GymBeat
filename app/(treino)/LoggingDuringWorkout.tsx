import { RepetitionsDrawer } from '@/components/RepetitionsDrawer';
import { RestTimeDrawer } from '@/components/RestTimeDrawer';
import { SetOptionsMenu } from '@/components/SetOptionsMenu';
import { VideoListItem } from '@/components/VideoListItem';
import { Exercicio, ExercicioModelo, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { Treino } from '@/models/treino';
import { calculateLoadForSerie, calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome, FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler'; // Adicionado ScrollView
import { MenuProvider } from 'react-native-popup-menu';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeBasedSetDrawer } from '../../components/TimeBasedSetDrawer';
import * as NotificationsLiveActivity from '../../modules/notifications-live-activity'; // Adjust path if needed
// addLog removed
import { MachineChooserDrawer } from '@/components/MachineChooserDrawer';
import { useTimer } from '@/contexts/TimerContext'; // Added import
import { useWorkoutOperations } from '@/hooks/useWorkoutOperations';
import { getLastLogForMachine } from '@/services/machineService';
import { ExerciseMenuAction, ExerciseOptionsMenu } from '../../components/menus/ExerciseOptionsMenu';
import { cancelNotification } from '../../services/notificationService';
import { cacheActiveWorkoutLog, getCachedActiveWorkoutLog, getCachedTreinoById } from '../../services/offlineCacheService';
import { getTreinoById } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';
import { ExerciseDetailModal } from './modals/ExerciseDetailModal';
import { ExerciseNotesModal } from './modals/ExerciseNotesModal'; // Added import
import { ExerciseReorderModal } from './modals/ExerciseReorderModal';
import { WorkoutOverviewModal } from './modals/modalOverview';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';
import { SelectExerciseModal } from './modals/SelectExerciseModal'; // Added import
import { WorkoutSettingsModal } from './modals/WorkoutSettingsModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
  concluido: boolean;
  isWarmup?: boolean;
}

export interface LoggedExercise extends Exercicio { // Adicionei restTime aqui
  notes: string;
  restTime: number;
  machineName?: string; // For display


  // Futuramente, podemos adicionar mais propriedades específicas de log
}

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const cascadeUpdate = (series: SerieEdit[], index: number, field: keyof SerieEdit, oldValue: any): SerieEdit[] => {
  const newSeries = [...series];
  const newValue = newSeries[index][field];

  for (let i = index + 1; i < newSeries.length; i++) {
    // Look for values that match the *old* value of the changed set
    // Using loose equality (==) for safety with number/string mix
    if (newSeries[i][field] == oldValue) {
      newSeries[i] = { ...newSeries[i], [field]: newValue };
    } else {
      break;
    }
  }
  return newSeries;
};

const LoggedExerciseCard = ({
  item,
  onSeriesChange,
  onRemove,
  onRestTimeChange,
  onNotesChange,
  userWeight,
  onPesoBarraChange,
  startRestTimer,
  onMenuStateChange,
  exerciseIndex,
  onOpenMachineDrawer,
  onReorder,
  onOpenNotes,
  onSubstitute,
  allUserLogs,
}: {
  item: LoggedExercise;
  onSeriesChange: (newSeries: SerieEdit[]) => void;
  onRemove: () => void;
  onRestTimeChange: (newRestTime: number) => void;
  onNotesChange: (notes: string) => void;
  userWeight: number;
  onPesoBarraChange: (newPesoBarra: number) => void;
  startRestTimer: (
    duration: number,
    isExercise: boolean,
    timedSetInfo?: { exerciseIndex: number, setIndex: number },
    completedSetInfo?: { exerciseIndex: number, setIndex: number }
  ) => void;
  onMenuStateChange: (isOpen: boolean) => void;
  exerciseIndex: number;
  onOpenMachineDrawer: () => void;
  onReorder: () => void;
  onOpenNotes: () => void;
  onSubstitute: () => void;
  allUserLogs: Log[];
}) => {
  const [isDetailModalVisible, setDetailModalVisible] = useState(false);
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [isExerciseTimeDrawerVisible, setIsExerciseTimeDrawerVisible] = useState(false);
  const [isRestTimePickerVisible, setIsRestTimePickerVisible] = useState(false);
  const [isAdvancedOptionsVisible, setIsAdvancedOptionsVisible] = useState(false);

  const [series, setSeries] = useState<SerieEdit[]>(
    item.series.map((s, i) => ({
      ...s,
      id: s.id || `set-${Date.now()}-${i}`,
      type: s.type || 'normal',
      concluido: s.concluido || false,
      isWarmup: s.isWarmup || false,
    }))
  );

  // Track the weight value on focus to enable cascade logic
  const focusedWeightRef = React.useRef<number | null>(null);

  // Sync state with props when machine changes or external updates occur
  useEffect(() => {
    setSeries(item.series.map((s, i) => ({
      ...s,
      id: s.id || `set-${Date.now()}-${i}`,
      type: s.type || 'normal',
      concluido: s.concluido || false,
      isWarmup: s.isWarmup || false,
    })));
  }, [item.series, item]);

  useEffect(() => {
    const allSetsCompleted = series.length > 0 && series.every(s => s.concluido);
    if (allSetsCompleted) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [series]);

  const handleSeriesUpdate = (newSeries: SerieEdit[]) => {
    setSeries(newSeries);
    onSeriesChange(newSeries);
    if (newSeries.length === 0) {
      onRemove();
    }
  };

  const handleSetOption = (
    option: 'toggleWarmup' | 'addDropset' | 'copy' | 'delete' | 'toggleTime',
    index: number
  ) => {
    setTimeout(() => {
      const newSets = [...series];
      if (option === 'delete') {
        newSets.splice(index, 1);
      } else if (option === 'copy') {
        newSets.splice(index + 1, 0, {
          ...newSets[index],
          id: `set-${Date.now()}`,
        });
      } else if (option === 'toggleTime') {
        const currentSet = newSets[index];
        currentSet.isTimeBased = !currentSet.isTimeBased;
        currentSet.repeticoes = currentSet.isTimeBased ? '60' : '10'; // Default to 60s or 10 reps
        if (currentSet.isTimeBased)
          currentSet.peso = 0; // Reset weight for time-based sets
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
      }
      handleSeriesUpdate(newSets);
    }, 100);
  };

  const getRepetitionsValue = useCallback(() => {
    if (editingSetIndex === null || !series[editingSetIndex]) {
      return '10';
    }
    return String(series[editingSetIndex].repeticoes);
  }, [editingSetIndex, series]);

  const handleRepetitionsSave = (newReps: string) => {
    if (editingSetIndex === null) return;
    let newSets = [...series];

    const oldValue = newSets[editingSetIndex].repeticoes;
    newSets[editingSetIndex].repeticoes = newReps;

    // Cascade
    newSets = cascadeUpdate(newSets, editingSetIndex, 'repeticoes', oldValue);

    handleSeriesUpdate(newSets);
    setIsRepDrawerVisible(false);
    setEditingSetIndex(null);
  };

  const handleToggleComplete = (index: number) => {
    const newSeries = [...series];
    const set = newSeries[index];
    const isCompleting = !set.concluido;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isCompleting && newSeries[index].type === 'normal') {
      const normalSets = newSeries.filter(s => s.type === 'normal');
      const currentNormalSetIndex = normalSets.findIndex(s => s.id === newSeries[index].id);
      const isLastNormalSet = currentNormalSetIndex === normalSets.length - 1;

      if (!isLastNormalSet) {
        const nextSet = newSeries[index + 1];
        if (set.isTimeBased) {
          const duration = parseInt(String(set.repeticoes), 10);
          if (!isNaN(duration) && duration > 0) {
            startRestTimer(duration, true, { exerciseIndex, setIndex: index });
            return; // Don't complete the set locally, parent will do it.
          }
        } else {
          if (!nextSet || nextSet.type !== 'dropset') {
            // Pass completedSetInfo so startTimer knows we just finished this set
            // even if parent state is stale
            startRestTimer(
              item.restTime || 60,
              false,
              undefined,
              { exerciseIndex, setIndex: index }
            );
          }
        }
      }
    }

    newSeries[index].concluido = isCompleting;
    handleSeriesUpdate(newSeries);
  };

  const formatRestTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    let result = '';
    if (minutes > 0) {
      result += `${minutes} min`;
    }
    if (remainingSeconds > 0) {
      if (minutes > 0) result += ' ';
      result += `${remainingSeconds} seg`;
    }
    return result.trim() || '0 seg';
  };

  const renderSetItem = ({ item: setItem, getIndex }: { item: SerieEdit, getIndex: () => number | undefined }) => {
    const itemIndex = getIndex();
    if (itemIndex === undefined) return null;

    return (
      <View
        key={setItem.id}
        style={{
          marginLeft: setItem.type === 'dropset' ? 30 : 0,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {setItem.concluido && <View style={styles.completedBar} />}
        <View
          style={[
            styles.setRow,
            setItem.concluido && styles.setRowCompleted,
            { flex: 1 },
          ]}
        >
          {setItem.type === 'dropset' ? (
            <View style={{ width: 30, marginRight: 10, alignItems: 'center' }}>
              <FontAwesome5 name="arrow-down" size={16} color="#888" />
            </View>
          ) : setItem.isWarmup ? (
            <View style={{ width: 30, marginRight: 10, alignItems: 'center' }}>
              <FontAwesome5 name="fire" size={16} color="#FFA500" />
            </View>
          ) : (
            <View style={[styles.seriesNumberContainer]}>
              <Text style={styles.seriesNumberText}>
                {series.slice(0, itemIndex + 1).filter(s => s.type !== 'dropset').length}
              </Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{setItem.isTimeBased ? 'Tempo (s)' : 'Reps'}</Text>
            <TouchableOpacity
              style={[
                styles.repButton,
                setItem.isTimeBased && styles.timeBasedButton,
                (itemIndex > 0 && series[itemIndex - 1].repeticoes == setItem.repeticoes) && { opacity: 0.7 }
              ]}
              onPress={() => {
                if (setItem.isTimeBased) {
                  setEditingSetIndex(itemIndex);
                  setIsExerciseTimeDrawerVisible(true);
                } else {
                  setEditingSetIndex(itemIndex);
                  setIsRepDrawerVisible(true);
                }
              }}
            >
              {setItem.isTimeBased && <FontAwesome name="clock-o" size={16} color="#fff" />}
              <Text style={[styles.repButtonText, setItem.isTimeBased && { marginLeft: 8 }]}>
                {setItem.isTimeBased
                  ? formatRestTime(parseInt(String(setItem.repeticoes), 10) || 0)
                  : String(setItem.repeticoes)}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.xText}>x</Text>
          {item.modelo.caracteristicas?.isPesoCorporal ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Peso</Text>
              <View style={[styles.setInput, styles.bodyWeightContainer]}>
                <Text style={styles.bodyWeightText}>Corporal</Text>
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Peso (kg)</Text>
              <TextInput
                style={[
                  styles.setInput,
                  (itemIndex > 0 && series[itemIndex - 1].peso == setItem.peso) && { opacity: 0.7 }
                ]}
                placeholder="kg"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                editable={!setItem.isTimeBased}
                value={String(setItem.peso || '')}
                onFocus={() => {
                  focusedWeightRef.current = typeof setItem.peso === 'number' ? setItem.peso : parseFloat(String(setItem.peso));
                }}
                onChangeText={(text) => {
                  const newSets = [...series];
                  newSets[itemIndex].peso = text as any;
                  // Don't update state here if validation is strictly numerical, 
                  // but we want to allow typing "1." so string is fine primarily.
                  // However, cascade only on end editing.
                  setSeries(newSets);
                  // Note: calling onSeriesChange here might trigger upstream updates which is fine but inefficient if done per char?
                  // Keeping original behavior: 
                  handleSeriesUpdate(newSets);
                }}
                onEndEditing={(e) => {
                  let newSets = [...series];
                  const val = parseFloat(e.nativeEvent.text.replace(',', '.')) || 0;
                  newSets[itemIndex] = { ...newSets[itemIndex], peso: val };

                  // Apply cascade
                  if (focusedWeightRef.current !== null) {
                    newSets = cascadeUpdate(newSets, itemIndex, 'peso', focusedWeightRef.current);
                  }

                  handleSeriesUpdate(newSets);
                }}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleToggleComplete(itemIndex)}
          >
            <FontAwesome name={setItem.concluido ? 'check-square' : 'square-o'} size={24} color={setItem.concluido ? '#3B82F6' : '#aaa'} />
          </TouchableOpacity>
          <SetOptionsMenu
            isTimeBased={!!setItem.isTimeBased}
            isNormalSet={(setItem.type || 'normal') === 'normal'}
            isWarmup={!!setItem.isWarmup}
            onSelect={action => handleSetOption(action, itemIndex)}
            isFirstSet={itemIndex === 0}
          />
        </View>
      </View>
    );
  };

  const exerciseVolume = calculateTotalVolume([{ ...item, series: series }], userWeight, true);

  return (
    <>
      <View style={styles.exercicioCard}>
        <View
          style={styles.exercicioHeader}
        ><TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setDetailModalVisible(true)}>
            <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
            <View style={styles.exerciseInfo}>
              <Text style={styles.exercicioName}>{item.modelo.nome}</Text>
              <Text style={styles.muscleGroup}>{item.modelo.grupoMuscular}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ExerciseOptionsMenu
              showAdvanced={true}
              onSelect={(action: ExerciseMenuAction) => {
                if (action === 'delete') {
                  onRemove();
                } else if (action === 'changeMachine') {
                  onOpenMachineDrawer();
                } else if (action === 'editRestTime') {
                  setIsRestTimePickerVisible(true);
                } else if (action === 'addNote') {
                  onOpenNotes();
                } else if (action === 'advanced') {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsAdvancedOptionsVisible(!isAdvancedOptionsVisible);
                } else if (action === 'reorder') {
                  onReorder();
                } else if (action === 'replace') {
                  onSubstitute();
                }
              }}
            />
          </View>
        </View>

        <>
          <View>
            {series.map((s, index) => renderSetItem({ item: s, getIndex: () => index }))}
          </View>

          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => {
              const lastNormalSet = series.slice().reverse().find(s => s.type !== 'dropset');
              const newSet = {
                id: `set-${Date.now()}`,
                repeticoes: lastNormalSet?.repeticoes || '10',
                peso: lastNormalSet?.peso || 10,
                type: 'normal' as const,
                isTimeBased: lastNormalSet?.isTimeBased || false,
                concluido: false,
              };
              handleSeriesUpdate([...series, newSet]);
            }}
          >
            <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
          </TouchableOpacity>

          {isAdvancedOptionsVisible && (
            <View style={styles.advancedOptionsContainer}>
              {item.modelo.caracteristicas?.usaBarra && (
                <View style={styles.barbellWeightCard}>
                  <Text style={styles.barbellWeightLabel}>Peso da Barra</Text>
                  <TextInput
                    style={styles.barbellWeightInput}
                    value={String(item.pesoBarra || 0)}
                    onChangeText={(text) => {
                      const newPeso = parseFloat(text.replace(',', '.')) || 0;
                      onPesoBarraChange(newPeso);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor="#888"
                  />
                </View>
              )}
              {item.modelo.caracteristicas?.isPesoBilateral &&
                !item.modelo.caracteristicas?.usaBarra &&
                series.length > 0 && (
                  <View style={styles.bilateralInfoCard}>
                    <View style={styles.dumbbellIconContainer}>
                      <View style={styles.dumbbellWithWeight}>
                        <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                        <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                      </View>
                      <View style={styles.dumbbellWithWeight}>
                        <FontAwesome5 name="dumbbell" size={24} color="#ccc" style={{ transform: [{ rotate: '-45deg' }] }} />
                        <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                      </View>
                    </View>
                  </View>
                )}
              {item.modelo.caracteristicas?.usaBarra && series.length > 0 && (
                <View style={styles.bilateralInfoCard}>
                  <View style={styles.barbellIconContainer}>
                    <Image
                      source={require('../../assets/images/Exercicios/ilustracaoBarra.png')}
                      style={styles.barbellImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.barbellWeightDistribution}>
                    <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                    <Text style={styles.barbellCenterWeightText}>{item.pesoBarra || 0} kg</Text>
                    <Text style={styles.dumbbellWeightText}>{series[0].peso || 0} kg</Text>
                  </View>
                </View>
              )}
              {/* Detalhes do Cálculo de Volume */}
              {isAdvancedOptionsVisible && (<View style={styles.volumeDetailsContainer}>
                <Text style={styles.volumeDetailsTitle}>Cálculo de Volume</Text>
                {series.filter(s => s.concluido).length > 0 ? (
                  series.map((serie, index) => {
                    if (!serie.concluido) return null;

                    const { calculationString } = calculateLoadForSerie(serie, item, userWeight);
                    const normalSeriesCount = series.slice(0, index + 1).filter(s => s.type === 'normal').length;

                    return (
                      <View
                        key={serie.id}
                        style={[
                          styles.volumeDetailRow,
                          serie.type === 'dropset' && styles.volumeDetailRowDropset,
                        ]}
                      >
                        <Text style={styles.volumeDetailLabel}>
                          {serie.type === 'dropset' ? 'Dropset:' : `Série ${normalSeriesCount}:`}
                        </Text>
                        <Text style={styles.volumeDetailCalculation}>{calculationString}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.volumeDetailEmptyText}>
                    Complete uma série para ver o cálculo do volume.
                  </Text>
                )}
              </View>)}
            </View>
          )}
        </>


        <RestTimeDrawer
          visible={isRestTimePickerVisible}
          onClose={() => setIsRestTimePickerVisible(false)}
          onSave={(newRestTime) => {
            onRestTimeChange(newRestTime);
            setIsRestTimePickerVisible(false);
          }}
          initialValue={item.restTime || 60}
        />
        <RepetitionsDrawer
          visible={isRepDrawerVisible}
          onClose={() => {
            setIsRepDrawerVisible(false);
            setEditingSetIndex(null);
          }}
          onSave={handleRepetitionsSave}
          initialValue={getRepetitionsValue()}
        />
        <TimeBasedSetDrawer
          visible={isExerciseTimeDrawerVisible}
          onClose={() => setIsExerciseTimeDrawerVisible(false)}
          onSave={(newDuration: number) => {
            if (editingSetIndex !== null) {
              let newSets = [...series];
              const oldValue = newSets[editingSetIndex].repeticoes;
              newSets[editingSetIndex].repeticoes = String(newDuration);

              // Cascade for time-based sets logic (if we treat time as 'reps' here)
              newSets = cascadeUpdate(newSets, editingSetIndex, 'repeticoes', oldValue);

              handleSeriesUpdate(newSets);
            }
          }}
          initialValue={editingSetIndex !== null ? parseInt(String(series[editingSetIndex]?.repeticoes), 10) || 60 : 60}
        />
      </View>
      <ExerciseDetailModal
        visible={isDetailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        exercise={item}
        allUserLogs={allUserLogs}
      />
    </>
  );
};

export default function LoggingDuringWorkoutScreen() {
  const router = useRouter();
  const { treinoId, fichaId, logId } = useLocalSearchParams<{ treinoId?: string; fichaId?: string, logId?: string }>();
  const { user } = useAuth();
  const { finishWorkout, cancelWorkout, isSaving: isFinishing } = useWorkoutOperations();

  // Core State
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null); // Moved up
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReorderModalVisible, setReorderModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);

  // Additional State (Preserved)
  const [isNameEdited, setIsNameEdited] = useState(false);
  const [isOverviewModalVisible, setOverviewModalVisible] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [totalLoad, setTotalLoad] = useState(0);
  const [userWeight, setUserWeight] = useState(70);

  // Inactivity State
  const [inactivitySettings, setInactivitySettings] = useState({
    nudgeEnabled: true,
    nudgeTime: 15,
    autoFinishEnabled: true,
    autoFinishTime: 60,
    autoCancelEnabled: true,
    autoCancelTime: 90
  });
  const lastInteraction = React.useRef(Date.now());
  const hasNudged = React.useRef(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        lastInteraction.current = Date.now();
        hasNudged.current = false;
        return false;
      },
    })
  ).current;

  // Fetch Inactivity Settings
  useEffect(() => {
    if (user) {
      getUserProfile(user.id).then(profile => {
        if (profile && profile.settings?.inactivity) {
          setInactivitySettings(profile.settings.inactivity);
        }
      });
    }
  }, [user]);

  // Inactivity Monitor Logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (!Platform.OS || Platform.OS === 'web') return;

      const now = Date.now();
      const inactiveDurationMins = (now - lastInteraction.current) / 1000 / 60;

      const anySetDone = loggedExercises.some(ex => ex.series.some(s => s.concluido));
      // allSetsDone logic: simply check if no set is incomplete
      const allSetsDone = loggedExercises.length > 0 && loggedExercises.every(ex => ex.series.every(s => s.concluido));

      // 1. Nudge
      if (inactivitySettings.nudgeEnabled && inactiveDurationMins >= inactivitySettings.nudgeTime && !hasNudged.current) {
        hasNudged.current = true;
        if (!allSetsDone && anySetDone) {
          Alert.alert("Inatividade", "Você está há algum tempo sem mexer no app. Não esqueça de contar suas séries!");
        } else if (allSetsDone) {
          Alert.alert("Treino Concluído?", "Já acabou o treino? Finalize o treino aqui no app!");
        } else {
          // Started but nothing done?
          Alert.alert("Vai treinar?", "O app está aberto mas você ainda não marcou nada.");
        }
      }

      // 2. Auto Finish
      if (inactivitySettings.autoFinishEnabled && inactiveDurationMins >= inactivitySettings.autoFinishTime && anySetDone) {
        Alert.alert("Inatividade", "Seu treino foi contado como finalizado devido à inatividade.");
        handleFinishWorkout();
        clearInterval(interval);
      }

      // 3. Auto Cancel
      if (inactivitySettings.autoCancelEnabled && inactiveDurationMins >= inactivitySettings.autoCancelTime && !anySetDone) {
        Alert.alert("Inatividade", "Seu treino foi cancelado devido à inatividade.");
        handleCancelWorkout(true);
        clearInterval(interval);
      }

    }, 10000);

    return () => clearInterval(interval);
  }, [inactivitySettings, loggedExercises, user, startTime, workoutName, currentActivityId]);

  // Reset timer on AppState change
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        lastInteraction.current = Date.now();
        hasNudged.current = false;
      }
    });
    return () => subscription.remove();
  }, []);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<Log[]>([]);
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');

  // CORE TIMER INTEGRATION
  const {
    startTimer: ctxStartTimer,
    stopTimer: ctxStopTimer,
    skipTimer: ctxSkipTimer,
    timerState,
    elapsedTime: timerElapsed,
    duration: timerDuration,
    type: timerType
  } = useTimer();

  // Derived state for UI compatibility
  const isResting = timerState === 'running' && timerType === 'rest';
  const isDoingExercise = timerState === 'running' && timerType === 'exercise';

  // UI needs countdowns
  // Context gives "elapsed", so remaining = duration - elapsed
  const restCountdown = isResting ? Math.max(0, timerDuration - timerElapsed) : 0;
  const exerciseCountdown = isDoingExercise ? Math.max(0, timerDuration - timerElapsed) : 0;

  // UI Progress
  const currentTimerProgress = timerDuration > 0 ? timerElapsed / timerDuration : 0;
  // Sync SharedValue for animation (if needed for bar)
  useEffect(() => {
    progress.value = withTiming(Math.min(1, currentTimerProgress), { duration: 300 });
  }, [currentTimerProgress]);


  const [setBeingTimed, setSetBeingTimed] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const progress = useSharedValue(0);

  const scrollY = useSharedValue(0); // Restaurado
  // Estado para armazenar o ID do dono do treino original
  const [workoutOwnerId, setWorkoutOwnerId] = useState<string | null>(null);

  // Machine Drawer State
  const [isMachineDrawerVisible, setIsMachineDrawerVisible] = useState(false);
  const [exerciseForMachine, setExerciseForMachine] = useState<{ index: number, exercise: LoggedExercise } | null>(null);
  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [exerciseForNotes, setExerciseForNotes] = useState<{ index: number, exercise: LoggedExercise } | null>(null);

  // Substitute Logic
  const [isSubstituteModalVisible, setSubstituteModalVisible] = useState(false);
  const [exerciseForSubstitution, setExerciseForSubstitution] = useState<{ index: number, exercise: LoggedExercise } | null>(null);

  const handleOpenSubstitute = (index: number) => {
    setExerciseForSubstitution({ index, exercise: loggedExercises[index] });
    setSubstituteModalVisible(true);
  };

  const handleConfirmSubstitute = (newModel: ExercicioModelo) => {
    if (!exerciseForSubstitution) return;
    const { index, exercise } = exerciseForSubstitution;

    const updatedExercise: LoggedExercise = {
      ...exercise,
      modeloId: newModel.id,
      modelo: newModel,
      // Reset machine info
      series: exercise.series,
      notes: exercise.notes,
      restTime: exercise.restTime
    };

    // Explicitly remove machine info to avoid 'undefined' issues
    delete updatedExercise.machineId;
    delete updatedExercise.machineName;

    const newLogged = [...loggedExercises];
    newLogged[index] = updatedExercise;
    setLoggedExercises(newLogged);

    setSubstituteModalVisible(false);
    setExerciseForSubstitution(null);
  }

  const handleMachineSelect = async (machineId: string | undefined, machineName: string | undefined, shouldClose: boolean = true) => {
    if (!exerciseForMachine) return;

    const { index, exercise } = exerciseForMachine;
    const newExercises = [...loggedExercises];

    // Update machine info
    const updatedExercise = {
      ...exercise,
      machineId: machineId,
      machineName: machineName
    };

    // If a machine is selected, try to fetch last log stats
    if (machineId && user) {
      try {
        const lastLog = await getLastLogForMachine(exercise.modeloId, machineId, user.id);
        if (lastLog && lastLog.exercicios) {
          const prevEx = lastLog.exercicios.find(e => e.modeloId === exercise.modeloId && e.machineId === machineId);
          if (prevEx && prevEx.series && prevEx.series.length > 0) {
            updatedExercise.series = updatedExercise.series.map((s, i) => {
              const prevSet = prevEx.series[i];
              if (prevSet) {
                return {
                  ...s,
                  repeticoes: prevSet.repeticoes,
                  peso: prevSet.peso,
                };
              }
              return s;
            });
          }
        }
      } catch (e) {
        console.log("Error fetching machine history:", e);
      }
    }

    (updatedExercise as any).machineName = machineName;

    newExercises[index] = updatedExercise;
    setLoggedExercises(newExercises);
    if (shouldClose) {
      setIsMachineDrawerVisible(false);
      setExerciseForMachine(null);
    }
  }

  const appState = React.useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      const current = appState.current;
      appState.current = nextAppState;

      if (current.match(/inactive|background/) && nextAppState === 'active') {
        // App voltou para o primeiro plano
        cancelNotification('rest-timer'); // Cancela a notificação de descanso
      }
    });

    return () => subscription.remove();
  }, []); // Remove dependencies to ensure this runs only once on mount

  // Effect to check for existing live activity on mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      NotificationsLiveActivity.listActivities().then(async activities => {
        if (activities && activities.length > 0) {
          console.log('[LiveActivity] Found existing activities:', activities);
          // Use the first one
          const activeId = activities[0];
          setCurrentActivityId(activeId);

          // Kill others if any
          if (activities.length > 1) {
            console.log('[LiveActivity] Killing duplicates...');
            for (let i = 1; i < activities.length; i++) {
              await NotificationsLiveActivity.endActivity(activities[i]);
            }
          }
        }
      }).catch(e => console.log('Error checking activities:', e));
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // NOVO: Função para atualizar o Widget com o estado atual
  const updateWidgetState = useCallback(async () => {
    if (!workoutName || loggedExercises.length === 0) return;

    const totalExercises = loggedExercises.length;
    const exercisesDone = loggedExercises.filter(ex =>
      ex.series.length > 0 && ex.series.every(s => s.concluido)
    ).length;

    const widgetData = {
      name: workoutName,
      muscleGroup: loggedExercises.map(ex => ex.modelo.grupoMuscular).join(', '), // Simplificação
      duration: formatDuration(elapsedTime), // Precisa da função formatDuration ou similar, ou enviar raw seconds
      isCompleted: false,
      dayLabel: "HOJE",
      status: 'in_progress',
      exercisesDone: exercisesDone,
      totalExercises: totalExercises,
      lastUpdate: Date.now()
    };

    if (Platform.OS === 'ios') {
      await NotificationsLiveActivity.setWidgetData(
        "widget_today_workout",
        JSON.stringify(widgetData)
      );
    }
  }, [workoutName, loggedExercises, elapsedTime]);

  // Atualiza o widget periodicamente ou quando houver mudanças relevantes
  useEffect(() => {
    if (isDoingExercise || isResting || elapsedTime % 60 === 0) { // Throttle updates slightly
      updateWidgetState();
    }
  }, [updateWidgetState, elapsedTime]);


  // Efeito para carregar do cache ou inicializar um novo treino
  useEffect(() => {
    const loadWorkout = async () => {
      if (!user) return;

      let capturedWorkoutName = 'Treino';

      const cachedLog = await getCachedActiveWorkoutLog();

      const isMatchingLogId = logId && cachedLog?.id === logId;
      // Use loose equality for safety and ensure IDs are strings for comparison
      const isMatchingTreinoId = treinoId && cachedLog?.treino?.id && String(cachedLog.treino.id) === String(treinoId);
      // Also check if we are just opening the "current" workout without specific ID (or if widget sent ID but it matches active)
      const isActiveIsTarget = cachedLog && (isMatchingLogId || isMatchingTreinoId);
      const isResumeFreeWorkout = !treinoId && !logId && cachedLog;

      if (isActiveIsTarget || isResumeFreeWorkout) {
        console.log('[LoggingDuringWorkout] Resuming from cache:', cachedLog.id);
        const name = String(cachedLog.nomeTreino || 'Treino');
        setLoggedExercises(cachedLog.exercicios || []);
        setWorkoutName(name);
        capturedWorkoutName = name;
        setStartTime(toDate(cachedLog.horarioInicio));
        setTotalLoad(cachedLog.cargaAcumulada || 0);
        setActiveLogId(cachedLog.id);
        setWorkoutOwnerId(cachedLog.treino?.usuarioId || user.id);
      } else if (logId) {
        // Fallback or specific log load attempt if not cached (unlikely for active but possible)
        console.log('[LoggingDuringWorkout] Log ID present but not in immediate active cache. Loading fresh/error.');
        // Current logic was empty here assuming cache hit. Could add remote fetch if needed, 
        // but context implies we are fixing the reset.
      } else if (treinoId) {
        // CACHE-FIRST Strategy for TEMPLATE: Tenta carregar do cache primeiro para instant start
        let fetchedTreino = await getCachedTreinoById(treinoId); // Usa a função de cache importada

        if (fetchedTreino) {
          console.log('[LoggingDuringWorkout] Template loaded from cache.');
          // Opcional: Atualizar em background se estiver online (silent refresh)
          getTreinoById(treinoId).then(fresh => {
            if (fresh) {
              console.log('[LoggingDuringWorkout] Template updated from network (deferred).');
            }
          }).catch(e => console.log('Silent refresh failed', e));

        } else {
          // Se não achou no cache, tenta online (blocking)
          console.log('[LoggingDuringWorkout] Template not in cache, fetching online...');
          fetchedTreino = await getTreinoById(treinoId);
        }

        if (fetchedTreino) {
          const exercisesWithState = fetchedTreino.exercicios.map(ex => ({
            ...ex,
            series: ex.series.map(s => ({ ...s, concluido: false })),
          }));
          setLoggedExercises(exercisesWithState);
          setWorkoutName(fetchedTreino.nome);
          capturedWorkoutName = fetchedTreino.nome;
          setStartTime(new Date());
          setActiveLogId(`structured-workout-${Date.now()}`);
          setWorkoutOwnerId(fetchedTreino.usuarioId); // Salva o dono do treino
        }
      } else {
        // Inicia um novo treino livre
        const newLogId = `free-workout-${Date.now()}`;
        setActiveLogId(newLogId);
        setStartTime(new Date());
        setLoggedExercises([]);
        setWorkoutName('Treino Livre');
        capturedWorkoutName = 'Treino Livre';
        setWorkoutOwnerId(user.id); // Treino livre pertence ao usuário atual
      }

      // Busca o peso do usuário independentemente do cache
      getUserProfile(user.id).then(profile => {
        const latestWeight = profile?.historicoPeso && profile.historicoPeso.length > 0 ? profile.historicoPeso[profile.historicoPeso.length - 1].valor : null;
        if (latestWeight) {
          setUserWeight(latestWeight);
        }
        if (profile?.workoutScreenType) {
          setWorkoutScreenType(profile.workoutScreenType);
        }
      });

      // Start Live Activity if not exists
      if (Platform.OS === 'ios') {
        const activities = await NotificationsLiveActivity.listActivities();
        if (activities.length === 0) {
          const timestamp = Date.now() + (60 * 60 * 1000); // 1 hour default deadline

          await NotificationsLiveActivity.startActivity(
            timestamp,
            capturedWorkoutName,
            1, // Set 1
            0, // Total sets unknown or 0 for now
            "-", // Weight
            "-", // Reps
            0 // Dropset
          );
        }
      }
    };

    if (user) {
      loadWorkout();
    }
  }, [user, treinoId, logId]);

  // Efeito para buscar o peso do usuário
  useEffect(() => {
    if (user?.id) {
      getUserProfile(user.id).then(profile => {
        const latestWeight = profile?.historicoPeso && profile.historicoPeso.length > 0 ? profile.historicoPeso[profile.historicoPeso.length - 1].valor : null;
        if (latestWeight) {
          setUserWeight(latestWeight);
        }
      });
    }
  }, [user]);

  // Efeito para o timer do treino
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (startTime) {
      const updateElapsedTime = () => {
        const now = new Date();
        const differenceInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(differenceInSeconds);
      };
      updateElapsedTime(); // Run once immediately
      interval = setInterval(updateElapsedTime, 1000);
    }
    return () => clearInterval(interval);
  }, [startTime]);

  // Efeito para calcular a carga total
  useEffect(() => {
    if (loggedExercises.length > 0) {
      const newTotalLoad = calculateTotalVolume(loggedExercises, userWeight, true);
      setTotalLoad(newTotalLoad);

      // Inicia o timer no primeiro exercício adicionado
      if (!startTime) {
        setStartTime(new Date());
      }
    } else {
      setTotalLoad(0);
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [loggedExercises, userWeight]);

  // Function to save state immediately
  const saveCurrentWorkoutState = useCallback(async () => {
    if (!activeLogId || !user || !startTime) return;

    const dummyTreino: Treino = {
      id: 'free-workout',
      usuarioId: user.id,
      nome: workoutName,
      diasSemana: [],
      intervalo: { min: 1, seg: 0 },
      exercicios: loggedExercises,
      ordem: 0,
      descricao: ''
    };

    const log: Log = {
      id: activeLogId,
      usuarioId: user.id,
      treino: dummyTreino,
      exercicios: loggedExercises,
      horarioInicio: startTime,
      status: 'em_andamento',
      cargaAcumulada: totalLoad,
      nomeTreino: workoutName,
      exerciciosFeitos: loggedExercises.filter(ex => ex.series.some(s => s.concluido)),
      observacoes: undefined,
    };

    await cacheActiveWorkoutLog(log);
  }, [activeLogId, user, startTime, workoutName, loggedExercises, totalLoad]);

  // Efeito para salvar o estado no cache
  useEffect(() => {
    const debounceSave = setTimeout(saveCurrentWorkoutState, 1000);
    return () => clearTimeout(debounceSave);
  }, [saveCurrentWorkoutState]);


  // R1: Função unificada para gerenciar a Live Activity (Singleton)


  const startTimer = async (
    duration: number,
    isExerciseTimer: boolean,
    timedSetInfo?: { exerciseIndex: number; setIndex: number },
    completedSetInfo?: { exerciseIndex: number; setIndex: number }
  ) => {
    // Prepare Metadata for Context
    let metadata: any = {};

    if (timedSetInfo) {
      const ex = loggedExercises[timedSetInfo.exerciseIndex];
      const s = ex.series[timedSetInfo.setIndex];
      metadata = {
        exerciseIndex: timedSetInfo.exerciseIndex,
        setIndex: timedSetInfo.setIndex,
        exerciseName: ex.modelo.nome,
        weight: `${s.peso}kg`,
        reps: `${s.repeticoes}`,
        totalSets: ex.series.length
      };
      setSetBeingTimed(timedSetInfo);
    } else if (completedSetInfo) {
      const ex = loggedExercises[completedSetInfo.exerciseIndex];
      const nextSetIndex = completedSetInfo.setIndex + 1;
      const totalSets = ex.series.length;

      // Check if there is a next set
      if (nextSetIndex < totalSets) {
        const nextSet = ex.series[nextSetIndex];
        metadata = {
          exerciseName: "Descanso",
          setIndex: nextSetIndex, // Context adds 1, so if next is index 1 (Set 2), context displays Set 2. 
          // Wait, if I pass index 1, context displays 2. Correct.
          // But context assumes setIndex matches "current active set". 
          // For rest, "current active" is "upcoming set".
          totalSets: totalSets,
          weight: `${nextSet.peso}kg`,
          reps: `${nextSet.repeticoes}`,
          nextExerciseName: ex.modelo.nome
        };
      } else {
        // No next set in this exercise. Maybe next exercise?
        // For now, just show "Descanso" or "Finished"
        metadata = {
          exerciseName: "Descanso",
          totalSets: totalSets,
          setIndex: completedSetInfo.setIndex // Keep previous set index? Or null?
        };
      }
      setSetBeingTimed(null);
    }

    ctxStartTimer(duration, isExerciseTimer ? 'exercise' : 'rest', metadata);
  };
  // Efeito unificado para ambos os timers
  // Timer Finished Logic Listener
  useEffect(() => {
    if (timerState === 'finished') {
      // If it was an exercise timer, mark set as complete
      if (timerType === 'exercise' && setBeingTimed) {
        const { exerciseIndex, setIndex } = setBeingTimed;
        const updatedExercises = [...loggedExercises];
        const exercise = updatedExercises[exerciseIndex];
        if (exercise && exercise.series[setIndex]) {
          (exercise.series as SerieEdit[])[setIndex].concluido = true;
          setLoggedExercises(updatedExercises);
          // Auto start rest?
          startTimer(exercise.restTime || 60, false);
        }
        setSetBeingTimed(null);
      }
    }
  }, [timerState, timerType]);


  const handleSkipRest = async () => {
    ctxSkipTimer();
  };

  const handleUpdateExerciseSeries = (exerciseIndex: number, newSeries: SerieEdit[]) => {
    const updatedExercises = [...loggedExercises];
    updatedExercises[exerciseIndex].series = newSeries;
    setLoggedExercises(updatedExercises);
  };

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const scrollHandler = useAnimatedStyle(() => {
    return {
      // Este handler será usado no onScroll da FlatList
    };
  }, []);

  const handleBack = async () => {
    await saveCurrentWorkoutState(); // Force save before leaving
    router.back();
  };

  const handleCancelWorkout = (force: boolean = false) => {
    const performCancel = async () => {
      await cacheActiveWorkoutLog(null); // Limpa o cache
      cancelNotification('rest-timer');
      if (currentActivityId && Platform.OS === 'ios') {
        await NotificationsLiveActivity.endActivity(currentActivityId);
        setCurrentActivityId(null);
      }
      ctxStopTimer(); // Stop timer on cancel
      router.back();
    };

    if (force) {
      performCancel();
      return;
    }

    Alert.alert(
      "Cancelar Treino?",
      "Seu progresso neste treino livre será perdido. Deseja continuar?",
      [
        { text: "Manter", style: "cancel" },
        {
          text: "Cancelar Treino",
          style: "destructive",
          onPress: performCancel
        },
      ]
    );
  };
  const handleFinishWorkout = async () => {
    const allSetsCompleted = loggedExercises.every(exercise =>
      (exercise.series as SerieEdit[]).every(set => set.concluido)
    );

    const proceedToFinish = async () => {
      if (!user || !startTime) {
        Alert.alert('Erro', 'Dados do usuário ou do treino incompletos para salvar o log.');
        return;
      }

      ctxStopTimer(); // Stop timer on finish
      await finishWorkout({
        user,
        workoutName,
        loggedExercises,
        startTime,
        treinoId: treinoId as string | undefined, // Type assertion as it comes from params
        fichaId: fichaId as string | undefined,
        workoutOwnerId,
        totalLoad,
        currentActivityId
      });
    };

    if (allSetsCompleted) {
      await proceedToFinish();
    } else {
      Alert.alert(
        "Finalizar Treino?",
        "Você não completou todas as séries. Deseja finalizar o treino mesmo assim?",
        [
          {
            text: "Finalizar",
            onPress: proceedToFinish,
            style: "destructive"
          },
          {
            text: "Cancelar",
            style: "cancel"
          },
        ]
      );
    }
  };

  useEffect(() => {
    if (!isNameEdited && loggedExercises.length > 0) {
      const muscleGroups = [...new Set(loggedExercises.map(e => e.modelo.grupoMuscular))];
      const name = `Treino ${muscleGroups.join(' & ')}`;
      setWorkoutName(name);
    } else if (loggedExercises.length === 0) {
      setWorkoutName('');
      setIsNameEdited(false);
    }
  }, [loggedExercises, isNameEdited]);

  const handleSelectExercises = (exercicios: ExercicioModelo[]) => {
    const newLoggedExercises: LoggedExercise[] = exercicios.map((modelo) => ({
      modelo: modelo,
      modeloId: modelo.id,
      series: [
        { id: `set-${Date.now()}`, repeticoes: '10', peso: 10, type: 'normal', concluido: false },
      ],
      isBiSet: false,
      notes: '', // Adiciona a propriedade 'notes' obrigatória
      restTime: 90, // Adiciona um tempo de descanso padrão
    }));
    setLoggedExercises((prev) => [...prev, ...newLoggedExercises]);
    setModalVisible(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEditExerciseFromOverview = (exerciseToEdit: Exercicio) => {
    setOverviewModalVisible(false);
    // Implementar a lógica para abrir o modal de edição de exercício aqui, se necessário.
  };


  const handleRemoveExercise = (exerciseIndex: number) => {
    setLoggedExercises(prev => prev.filter((_, index) => index !== exerciseIndex));
  };

  const handleNotesChange = (index: number, notes: string) => {
    const newExercises = [...loggedExercises];
    newExercises[index] = { ...newExercises[index], notes: notes };
    setLoggedExercises(newExercises);
  };

  const handleRestTimeChange = (index: number, newRestTime: number) => {
    setLoggedExercises(prevExercises => {
      const updatedExercises = [...prevExercises];
      updatedExercises[index] = {
        ...updatedExercises[index],
        restTime: newRestTime,
      };
      return updatedExercises;
    });
  };

  const handlePesoBarraChange = (exerciseIndex: number, newPesoBarra: number) => {
    setLoggedExercises(prevExercises => {
      const updatedExercises = [...prevExercises];
      updatedExercises[exerciseIndex] = {
        ...updatedExercises[exerciseIndex],
        pesoBarra: newPesoBarra,
      };
      return updatedExercises;
    });
  };

  const statsContainerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
    gap: 20,
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#0B0D10', // Cor de fundo do container
  };

  const statItemStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center' as const,
    flex: 1,
  };

  const allSeriesCompleted =
    loggedExercises.length > 0 &&
    loggedExercises.every(
      (exercise) =>
        exercise.series &&
        (exercise.series as SerieEdit[]).length > 0 &&
        (exercise.series as SerieEdit[]).every((set) => set.concluido)
    );

  const totalSets = loggedExercises.reduce((acc, exercise) => acc + (exercise.series?.length || 0), 0);
  const completedSets = loggedExercises.reduce((acc, exercise) =>
    acc + ((exercise.series as SerieEdit[])?.filter(set => set.concluido).length || 0), 0);

  const workoutProgress = totalSets > 0 ? (completedSets / totalSets) : 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MenuProvider>
        <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
          {/* Cabeçalho Customizado (agora fixo) */}
          <View style={styles.customHeader}>
            <View style={styles.headerLeftGroup}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOverviewModalVisible(true)} style={{ flex: 1 }}>
                <TextInput
                  style={styles.headerTitleInput}
                  value={workoutName}
                  placeholder="Nome do Treino"
                  placeholderTextColor="#888"
                  onChangeText={(text) => {
                    setWorkoutName(String(text));
                    if (!isNameEdited) {
                      setIsNameEdited(true);
                    }
                  }}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.headerRightContainer}>
              {isFinishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <TouchableOpacity
                  onPress={handleFinishWorkout}
                  style={[
                    styles.finishButton,
                    allSeriesCompleted && styles.finishButtonCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.finishButtonText,
                      allSeriesCompleted && styles.finishButtonTextCompleted,
                    ]}
                  >
                    Finalizar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, { width: `${workoutProgress * 100}%` }]} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {loggedExercises.length === 0 ? (
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
                data={loggedExercises}
                onScroll={(event) => { // Restaurado
                  scrollY.value = event.nativeEvent.contentOffset.y;
                }}
                keyExtractor={(item) => item.modeloId}
                ListHeaderComponent={
                  <View style={statsContainerStyle}><View style={statItemStyle}><FontAwesome name="clock-o" size={16} color="#aaa" /><Text style={styles.statValue}>{formatTime(elapsedTime)}</Text></View><View style={statItemStyle}><FontAwesome5 name="weight-hanging" size={16} color="#aaa" /><Text style={styles.statValue}>{Math.round(totalLoad).toLocaleString('pt-BR')} kg</Text></View></View>
                }
                renderItem={({ item, index }) => {
                  return (
                    <LoggedExerciseCard
                      item={item}
                      allUserLogs={userLogs}
                      userWeight={userWeight}
                      exerciseIndex={index} // Pass correct index
                      onSeriesChange={(newSeries) =>
                        handleUpdateExerciseSeries(index, newSeries)
                      }
                      onRemove={() => handleRemoveExercise(index)}
                      onRestTimeChange={(newRestTime) => {
                        const updatedExercises = [...loggedExercises];
                        updatedExercises[index].restTime = newRestTime;
                        setLoggedExercises(updatedExercises);
                      }}
                      onNotesChange={(newNotes) => {
                        const updatedExercises = [...loggedExercises];
                        updatedExercises[index].notes = newNotes;
                        setLoggedExercises(updatedExercises);
                      }}
                      onPesoBarraChange={(newPesoBarra) => handlePesoBarraChange(index, newPesoBarra)}
                      startRestTimer={(duration, isExercise, timedSetInfo, completedSetInfo) =>
                        startTimer(
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
                      style={[styles.cancelWorkoutButton]} // Removida a margem duplicada
                      onPress={() => handleCancelWorkout()}
                    >
                      <Text style={styles.cancelWorkoutButtonText}>Cancelar treino</Text>
                    </TouchableOpacity>
                  </>
                }
                contentContainerStyle={{
                  paddingBottom: 140,
                  paddingTop: 15, // Padding normal, já que os stats não são mais fixos
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

              onConfirm={handleSelectExercises}

              existingExerciseIds={loggedExercises.map(e => e.modeloId)}

            />

            <WorkoutSettingsModal
              isVisible={isSettingsModalVisible}
              onClose={() => setSettingsModalVisible(false)}
            />

            {treinoId && (
              <WorkoutOverviewModal
                visible={isOverviewModalVisible}
                onClose={() => setOverviewModalVisible(false)}
                treino={{
                  id: treinoId as string,
                  exercicios: loggedExercises,
                  nome: workoutName,
                } as Treino}
                currentExerciseIndex={loggedExercises.findIndex(ex => ex.series.some(s => !s.concluido))}
                cargaAcumuladaTotal={totalLoad}
                userLogs={userLogs}
                horarioInicio={startTime}
                userWeight={userWeight}
                onEditExercise={handleEditExerciseFromOverview} />
            )}

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
                  handleNotesChange(exerciseForNotes.index, note);
                }
              }}
            />

            <ExerciseReorderModal
              visible={isReorderModalVisible}
              onClose={() => setReorderModalVisible(false)}
              exercises={loggedExercises}
              onSave={(newOrder) => setLoggedExercises(newOrder as LoggedExercise[])}
            />

            <SelectExerciseModal
              visible={isSubstituteModalVisible}
              onClose={() => {
                setSubstituteModalVisible(false);
                setExerciseForSubstitution(null);
              }}
              onSelect={handleConfirmSubstitute}
              excludeIds={loggedExercises.map(e => e.modeloId)}
              initialGroup={exerciseForSubstitution?.exercise.modelo.grupoMuscular}
              sortByWordCount={true}
            />

          </KeyboardAvoidingView>
        </SafeAreaView>
        {(isResting || isDoingExercise) && (
          <View style={styles.restTimerOverlay}>
            <View style={styles.restTimerProgressContainer}>
              <Animated.View style={[styles.restTimerProgressBar, animatedProgressStyle]} />
            </View>
            <View style={styles.restTimerContent}>
              <View>
                <Text style={styles.restTimerLabel}>
                  {isDoingExercise ? 'Exercício' : 'Descanso'}
                </Text>
                <Text style={styles.restTimerValue}>
                  {formatTime(isDoingExercise ? exerciseCountdown : restCountdown)}
                </Text>
              </View>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkipRest}>
                <FontAwesome name="forward" size={20} color="#fff" />
                <Text style={styles.skipButtonText}>Pular</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </MenuProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  backButton: {
    gap: 10,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  headerTitleInput: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  progressBarContainer: {
    height: 1,
    backgroundColor: '#333',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  statValue: {
    color: '#fff',
    fontSize: 16, // Reduzido um pouco para caber melhor na horizontal
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  container: { flex: 1, backgroundColor: '#0B0D10' },
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
  exercicioCard: {
    backgroundColor: '#1A1D23',
    padding: 15,
    flex: 1,
    marginBottom: 15,
  },
  exercicioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  exerciseVideo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  exerciseInfo: {
    flex: 1,
  },
  exercicioName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  muscleGroup: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  setRowCompleted: {
    opacity: 0.75,
  },
  setRowWarmup: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)', // Fundo alaranjado para aquecimento
    borderBottomColor: 'rgba(255, 165, 0, 0.3)',
  },
  seriesNumberContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: 30,
    borderRadius: 5,
    marginRight: 10,
  },
  seriesNumberCompleted: {
    backgroundColor: '#3B82F6',
  },
  seriesNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  completedBar: {
    width: 5,
    backgroundColor: '#3B82F6',
    height: '100%',
    marginRight: 5,
    borderRadius: 2,
  },

  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    color: '#aaa', fontSize: 10, marginBottom: 4
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
    textAlign: 'center',
    fontSize: 16,
    minWidth: 80,
    height: 42, // Para alinhar com o TextInput
    justifyContent: 'center',
  },
  repButtonText: {
    color: '#fff', textAlign: 'center', fontSize: 16
  },
  timeBasedButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xText: { color: '#888', fontSize: 14, marginHorizontal: 10 },
  addSetButton: {
    padding: 15,
    marginTop: 10,
    backgroundColor: 'transparent',
    borderRadius: 8,
    alignItems: 'center',
  },
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
  deleteBox: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
  },
  completeBox: {
    backgroundColor: '#3B82F6', // Azul para "Completar"
    justifyContent: 'center',
    alignItems: 'center',
    width: 100, // Aumentado para caber o texto
    borderRadius: 8,
    marginBottom: 10,
  },
  uncompleteBox: {
    backgroundColor: '#555', // Cinza para "Desmarcar"
    justifyContent: 'center',
    alignItems: 'center',
    width: 100, // Aumentado para caber o texto
    borderRadius: 8,
    marginBottom: 10,
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyWeightContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 42, // Match the height of repButton
  },
  bodyWeightText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '500',
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
    backgroundColor: 'transparent', // Fundo transparente
  },
  checkIcon: {
    marginRight: 10,
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 10, // Espaçamento entre os botões
  },
  exerciseActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  restTimerCard: {
    flex: 0, // Não expande
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
  seriesCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2E37',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    gap: 8,
  },
  seriesCounterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: '#1f1f1f',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  modalOptionButton: {
    backgroundColor: '#2A2E37',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalOptionButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para o Timer de Descanso
  restTimerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B0D10',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingBottom: 30, // Espaço para safe area
  },
  restTimerProgressContainer: {
    height: 4,
    backgroundColor: '#333',
  },
  restTimerProgressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  restTimerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  restTimerLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  restTimerValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 10,
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finishButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  finishButtonCompleted: {
    backgroundColor: '#3B82F6',
  },
  finishButtonTextCompleted: {
    color: '#fff',
  },
  collapsedInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  collapsedLeft: {
    flexDirection: 'row',
    gap: 10,
  },
  collapsedRight: {},
  avancadoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  avancadoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  advancedOptionsContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  barbellWeightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  barbellWeightLabel: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '500',
  },
  barbellWeightInput: {
    backgroundColor: '#2A2E37',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
    textAlign: 'center',
    minWidth: 60,
  },
  bilateralInfoCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  dumbbellIconContainer: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 5,
  },
  dumbbellWithWeight: {
    alignItems: 'center',
    gap: 8,
  },
  dumbbellWeightText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  barbellIconContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  barbellImage: {
    width: '100%',
    height: 80,
  },
  barbellWeightDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  barbellCenterWeightText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  volumeDetailsContainer: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  volumeDetailsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  volumeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  volumeDetailRowDropset: {
    marginLeft: 15,
    borderLeftWidth: 2,
    borderLeftColor: '#444',
    paddingLeft: 10,
  },
  volumeDetailLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  volumeDetailCalculation: {
    color: '#fff',
    fontSize: 14,
  },
  volumeDetailEmptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 10,
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
    zIndex: 1, // Garante que o overlay fique sobre o conteúdo mas abaixo do menu
  },
  machineMarker: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#1c1c1e', // darker contrast
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  machineMarkerText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
});