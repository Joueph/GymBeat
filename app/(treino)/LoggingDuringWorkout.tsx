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
  Alert, AppState, AppStateStatus, FlatList,
  Image,
  LayoutAnimation, Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native'; // Adicionado Platform
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler'; // Adicionado ScrollView
import { MenuProvider } from 'react-native-popup-menu';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeBasedSetDrawer } from '../../components/TimeBasedSetDrawer';
import { addLog } from '../../services/logService';
import { cancelNotification, scheduleNotification } from '../../services/notificationService';
import { cacheActiveWorkoutLog, getCachedActiveWorkoutLog } from '../../services/offlineCacheService';
import { addTreino, getTreinoById } from '../../services/treinoService';
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
  concluido: boolean;
  isWarmup?: boolean;
}

export interface LoggedExercise extends Exercicio { // Adicionei restTime aqui
  notes: string;
  restTime: number;

  // Futuramente, podemos adicionar mais propriedades específicas de log
}

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};



const LoggedExerciseCard = ({
  item,
  onSeriesChange,
  onRemove,
  onRestTimeChange,
  onNotesChange,
  userWeight,
  onPesoBarraChange,
  startRestTimer, // This prop is passed but its type needs to be updated
  onMenuStateChange,
}: {
  item: LoggedExercise;
  onSeriesChange: (newSeries: SerieEdit[]) => void;
  onRemove: () => void;
  onRestTimeChange: (newRestTime: number) => void;
  onNotesChange: (notes: string) => void;
  userWeight: number;
  onPesoBarraChange: (newPesoBarra: number) => void; // New prop
  startRestTimer: (duration: number, isExercise: boolean, timedSetInfo?: { exerciseIndex: number, setIndex: number }) => void;
  onMenuStateChange: (isOpen: boolean) => void;
}) => {
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState(item.notes || '');
  const [isExerciseTimeDrawerVisible, setIsExerciseTimeDrawerVisible] = useState(false);

  const [isRestTimePickerVisible, setIsRestTimePickerVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
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

  useEffect(() => {
    const allSetsCompleted = series.length > 0 && series.every(s => s.concluido);
    if (allSetsCompleted) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(false);
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
    const newSets = [...series];
    newSets[editingSetIndex].repeticoes = newReps;
    handleSeriesUpdate(newSets);
    setIsRepDrawerVisible(false);
    setEditingSetIndex(null);
  };

  const handleToggleComplete = (index: number, exerciseIndex: number) => {
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
            startRestTimer(item.restTime || 60, false);
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
            <View style={[styles.seriesNumberContainer, setItem.concluido && styles.seriesNumberCompleted]}>
              <Text style={styles.seriesNumberText}>
                {series.slice(0, itemIndex + 1).filter(s => s.type !== 'dropset').length}
              </Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{setItem.isTimeBased ? 'Tempo (s)' : 'Reps'}</Text>
            <TouchableOpacity
              style={[styles.repButton, setItem.isTimeBased && styles.timeBasedButton]}
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
                style={styles.setInput}
                placeholder="kg"
                placeholderTextColor="#888"
                keyboardType="decimal-pad"
                editable={!setItem.isTimeBased}
                value={String(setItem.peso || '')}
                onChangeText={(text) => {
                  const newSets = [...series];
                  newSets[itemIndex].peso = text as any;
                  handleSeriesUpdate(newSets);
                }}
                onEndEditing={(e) => {
                  const newSets = [...series];
                  newSets[itemIndex].peso = parseFloat(e.nativeEvent.text.replace(',', '.')) || 0;
                  handleSeriesUpdate(newSets);
                }}
              />
            </View>
          )}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleToggleComplete(itemIndex, 0)} // TODO: Pass correct exerciseIndex
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
    <View style={styles.exercicioCard}>
      <TouchableOpacity
        style={styles.exercicioHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsExpanded(!isExpanded);
        }}
      >
        <VideoListItem uri={item.modelo.imagemUrl} style={styles.exerciseVideo} />
        <View style={styles.exerciseInfo}>
          <Text style={styles.exercicioName}>{item.modelo.nome}</Text>
          <Text style={styles.muscleGroup}>{item.modelo.grupoMuscular}</Text>
        </View>
        <FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#fff" />
      </TouchableOpacity>

      {isExpanded ? (
        <>
          <View style={styles.notesContainer}>
            <FontAwesome name="pencil" size={12} color="#fff" />
            <TextInput
              style={styles.notesInput}
              placeholder="Anotações do exercício"
              placeholderTextColor="#888"
              value={exerciseNotes}
              onChangeText={setExerciseNotes}
              onBlur={() => onNotesChange(exerciseNotes)}
            />
          </View>

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

          <View style={styles.exerciseActionsRow}>
            <View style={styles.exerciseActionsLeft}>
              <TouchableOpacity style={styles.restTimerCard} onPress={() => setIsRestTimePickerVisible(true)}>
                <FontAwesome name="clock-o" size={18} color="#fff" />
                <Text style={styles.restTimerText}>{formatRestTime(item.restTime || 60)}</Text>
              </TouchableOpacity>
              <View style={styles.seriesCounterContainer}>
                <FontAwesome5 name="layer-group" size={16} color="#aaa" />
                <Text style={styles.seriesCounterText}>
                  {series.filter(s => s.concluido && s.type === 'normal').length}/{series.filter(s => s.type === 'normal').length}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setIsAdvancedOptionsVisible(!isAdvancedOptionsVisible)}
              style={styles.avancadoButton}
            >
              <Text style={styles.avancadoButtonText}>Avançado</Text>
              <FontAwesome name={isAdvancedOptionsVisible ? "chevron-up" : "chevron-down"} size={14} color="#fff" />
            </TouchableOpacity>
          </View>

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
      ) : (
        <View style={styles.collapsedInfoContainer}>
          <View style={styles.collapsedLeft}>
            <View style={styles.seriesCounterContainer}>
              <FontAwesome5 name="layer-group" size={16} color="#aaa" />
              <Text style={styles.seriesCounterText}>
                {series.filter(s => s.concluido && s.type === 'normal').length}/{series.filter(s => s.type === 'normal').length}
              </Text>
            </View>
            <View style={styles.seriesCounterContainer}>
              <FontAwesome5 name="weight-hanging" size={16} color="#aaa" />
              <Text style={styles.seriesCounterText}>{Math.round(exerciseVolume)} kg</Text>
            </View>
          </View>
          <View style={styles.collapsedRight}>
            <TouchableOpacity onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsExpanded(true);
            }} style={[styles.avancadoButton, {backgroundColor: '#2A2E37'}]}>
              <Text style={styles.avancadoButtonText}>
                {(() => {
                  const completedSets = series.filter(s => s.concluido).length;
                  const totalSets = series.length;
                  if (totalSets > 0 && completedSets === totalSets) {
                    return 'Finalizado';
                  }
                  if (completedSets > 0) {
                    return 'Em andamento';
                  }
                  return 'Pendente';
                })()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
            const newSets = [...series];
            newSets[editingSetIndex].repeticoes = String(newDuration);
            handleSeriesUpdate(newSets);
          }
        }}
        initialValue={editingSetIndex !== null ? parseInt(String(series[editingSetIndex]?.repeticoes), 10) || 60 : 60}
      />
    </View>
  );
};

export default function LoggingDuringWorkoutScreen() {
  const router = useRouter();
  const { treinoId, fichaId, logId } = useLocalSearchParams<{ treinoId?: string; fichaId?: string, logId?: string }>();
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [isNameEdited, setIsNameEdited] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [totalLoad, setTotalLoad] = useState(0);
  const [userWeight, setUserWeight] = useState(70); // default fallback
  const { user } = useAuth();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  // Estados para o timer de descanso
  const [isResting, setIsResting] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const [maxRestTime, setMaxRestTime] = useState(0);
  // Novos estados para o timer do exercício
  const [isDoingExercise, setIsDoingExercise] = useState(false);
  const [exerciseCountdown, setExerciseCountdown] = useState(0);
  const [maxExerciseTime, setMaxExerciseTime] = useState(0);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const [exerciseStartTime, setExerciseStartTime] = useState<number | null>(null);
  const [setBeingTimed, setSetBeingTimed] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const progress = useSharedValue(0);
  const scrollY = useSharedValue(0); // Restaurado

  const appState = React.useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App voltou para o primeiro plano, cancela a notificação de descanso
        cancelNotification('rest-timer');
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);
  
  // Efeito para carregar do cache ou inicializar um novo treino
  useEffect(() => {
    const loadWorkout = async () => {
      if (!user) return;

      // **NOVA LÓGICA**: Prioriza carregar um log ativo do cache se um logId for passado
      if (logId) {
        try {
          const cachedLog = await getCachedActiveWorkoutLog(); // CORRIGIDO: Função agora importada
          if (cachedLog && cachedLog.id === logId) {
            setLoggedExercises(cachedLog.exercicios || []);
            setWorkoutName(String(cachedLog.nomeTreino || 'Treino'));
            setStartTime(toDate(cachedLog.horarioInicio));
            setTotalLoad(cachedLog.cargaAcumulada || 0);
            setActiveLogId(cachedLog.id);
            // A busca de peso do usuário ocorrerá no final da função
          }
        } catch (error) {
          console.error("Erro ao carregar log do cache com logId:", error);
          // Se falhar, a lógica abaixo tentará carregar o treino do zero
        }
      }

      // Se um treinoId for passado, carrega um treino estruturado
      else if (treinoId) {
        const fetchedTreino = await getTreinoById(treinoId);
        if (fetchedTreino) {
          const exercisesWithState = fetchedTreino.exercicios.map(ex => ({
            ...ex,
            series: ex.series.map(s => ({ ...s, concluido: false })),
          }));
          setLoggedExercises(exercisesWithState);
          setWorkoutName(fetchedTreino.nome);
          setStartTime(new Date());
          setActiveLogId(`structured-workout-${Date.now()}`);
        }
      } else {
        // Lógica existente para treino livre (cache ou novo)
        try {
          const cachedLog = await getCachedActiveWorkoutLog(); // CORRIGIDO: Função agora importada
          if (cachedLog && cachedLog.id.startsWith('free-workout-')) {
            // Carrega do cache
            setLoggedExercises(cachedLog.exercicios || []);
            setWorkoutName(String(cachedLog.nomeTreino || ''));
            setStartTime(new Date(cachedLog.horarioInicio));
            setTotalLoad(cachedLog.cargaAcumulada || 0);
            setActiveLogId(cachedLog.id);
          } else {
            // Inicia um novo treino livre
            const newLogId = `free-workout-${Date.now()}`;
            setActiveLogId(newLogId);
            setStartTime(new Date());
            setLoggedExercises([]);
            setWorkoutName('Treino Livre');
          }
        } catch (error) {
          console.error("Failed to load workout from cache", error);
          // Inicia um novo treino em caso de erro
          const newLogId = `free-workout-${Date.now()}`;
          setActiveLogId(newLogId);
          setStartTime(new Date());
          setLoggedExercises([]);
          setWorkoutName('Treino Livre');
        }
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
    };

    loadWorkout();
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

  // Efeito para salvar o estado no cache
  useEffect(() => {
    if (!activeLogId || !user || !startTime) return;

    const saveWorkout = async () => {
      const dummyTreino: Treino = {
        id: 'free-workout',
        usuarioId: user.id,
        nome: workoutName,
        diasSemana: [],
        intervalo: { min: 1, seg: 0 }, // Default interval
        exercicios: loggedExercises,
        ordem: 0
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
        observacoes: undefined, // Propriedade 'observacoes' adicionada
      };

      await cacheActiveWorkoutLog(log); // CORRIGIDO: Função agora importada
    };

    const debounceSave = setTimeout(saveWorkout, 1000);
    return () => clearTimeout(debounceSave);

  }, [loggedExercises, workoutName, startTime, totalLoad, activeLogId, user]);


  const startTimer = (
    duration: number,
    isExerciseTimer: boolean,
    timedSetInfo?: { exerciseIndex: number; setIndex: number }
  ) => {
    // Cancela qualquer timer que esteja rodando
    cancelAnimation(progress);
    setIsResting(false);
    setIsDoingExercise(false);

    if (isExerciseTimer && timedSetInfo) {
      console.log('[Timer] Iniciando timer de exercício:', { duration, setIndex: timedSetInfo.setIndex });
      setExerciseCountdown(duration);
      setMaxExerciseTime(duration);
      setSetBeingTimed(timedSetInfo);
      setIsDoingExercise(true);
    } else {
      console.log('[Timer] Iniciando timer de descanso:', { duration, segundos: duration });
      setRestCountdown(duration);
      setMaxRestTime(duration);
      setIsResting(true);
      setRestStartTime(Date.now());

      // Agenda notificação para quando o intervalo terminar
      console.log('[Timer] Agendando notificação para daqui a', duration, 'segundos');
      scheduleNotification(
        'rest-timer', 
        'Intervalo finalizado!', 
        'Seu descanso acabou. Hora de voltar ao treino!', 
        { seconds: duration }
      ).catch(error => {
        console.warn('[Timer] ✗ Erro ao agendar notificação de descanso:', error);
      });
    }
    progress.value = 0; // Reseta a barra de progresso
  };

  // Efeito unificado para ambos os timers
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isResting || isDoingExercise) {
      // Lógica para restaurar o progresso da barra ao voltar para a tela
      const startTime = isResting ? restStartTime : exerciseStartTime;
      const maxTime = isResting ? maxRestTime : maxExerciseTime;

      if (startTime && maxTime > 0) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const remainingSeconds = Math.max(0, maxTime - elapsedSeconds);
        const elapsedPercentage = Math.min(1, elapsedSeconds / maxTime);

        // Inicia a animação do ponto em que parou
        progress.value = elapsedPercentage;
        progress.value = withTiming(1, { duration: remainingSeconds * 1000, easing: Easing.linear });
      }

      interval = setInterval(() => {
        if (isDoingExercise) {
          if (!exerciseStartTime) return;
          const elapsedSeconds = Math.floor((Date.now() - exerciseStartTime) / 1000);
          const remainingTime = Math.max(0, maxExerciseTime - elapsedSeconds); // Corrigido para usar maxExerciseTime
          setExerciseCountdown(remainingTime);

          if (remainingTime <= 0) {
            setIsDoingExercise(false);
            setExerciseStartTime(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (setBeingTimed) {
              const { exerciseIndex, setIndex } = setBeingTimed;
              const updatedExercises = [...loggedExercises];
              const exercise = updatedExercises[exerciseIndex];
              (exercise.series as SerieEdit[])[setIndex].concluido = true;
              setLoggedExercises(updatedExercises);
              startTimer(exercise.restTime || 60, false);
            }
          } else if (remainingTime <= 3) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } else { // isResting
          if (!restStartTime) return;
          const elapsedSeconds = Math.floor((Date.now() - restStartTime) / 1000);
          const remainingTime = Math.max(0, maxRestTime - elapsedSeconds);
          setRestCountdown(remainingTime);

          if (remainingTime <= 0) {
            setIsResting(false);
            setRestStartTime(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (remainingTime <= 3) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      }, 1000);
    } else {
      // Garante que tudo seja resetado quando nenhum timer estiver ativo
      cancelAnimation(progress);
      progress.value = 0;
      setRestStartTime(null);
      setExerciseStartTime(null);
      setRestCountdown(0);
      setExerciseCountdown(0);
      setSetBeingTimed(null);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isResting, isDoingExercise]);


  const handleSkipRest = () => {
    setIsResting(false);
    setIsDoingExercise(false); // Também para o timer de exercício
    cancelNotification('rest-timer');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleBack = () => {
    router.back();
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      "Cancelar Treino?",
      "Seu progresso neste treino livre será perdido. Deseja continuar?",
      [
        { text: "Manter", style: "cancel" },
        {
          text: "Cancelar Treino",
          style: "destructive",
          onPress: async () => {
            await cacheActiveWorkoutLog(null); // Limpa o cache
            cancelNotification('rest-timer');
            router.back(); // Volta para a tela anterior
          },
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
      
      setIsFinishing(true);
      const finalEndTime = new Date();

      // Adicionado log para depuração
      console.log('[handleFinishWorkout] Iniciando finalização do treino.');
      console.log('[handleFinishWorkout] treinoId:', treinoId, '| fichaId:', fichaId);

      let finalTreinoId = treinoId;

      // Se for um treino livre (sem treinoId), cria um novo documento de treino primeiro.
      if (!finalTreinoId) {
        console.log('[handleFinishWorkout] Detectado treino livre. Criando novo documento de treino...');
        const novoTreinoData: Omit<Treino, 'id'> = {
          nome: workoutName,
          usuarioId: user.id,
          exercicios: loggedExercises,
          diasSemana: [],
          fichaId: null, // Treinos livres não pertencem a uma ficha.
          intervalo: { min: 1, seg: 0 }, // Intervalo padrão
          ordem: 999, // Ordem alta para aparecer por último se não for associado
        };
        try {
          finalTreinoId = await addTreino(novoTreinoData);
          console.log('[handleFinishWorkout] Novo treino livre criado com ID:', finalTreinoId);
        } catch (treinoError) {
          console.error('[handleFinishWorkout] Erro ao criar documento do treino livre:', treinoError);
          Alert.alert('Erro', 'Não foi possível criar o registro do treino antes de salvar o log.');
          setIsFinishing(false);
          return;
        }
      }

      try {
        const newLog: Partial<Log> = {
          usuarioId: user.id,
          treino: {
            id: finalTreinoId,
            // CORREÇÃO: Usar `null` em vez de 'null' como string.
            // O `as any` é um truque para contornar o erro do TypeScript, permitindo que o valor `null`
            // seja enviado para o Firebase, que é o que a função `addLog` espera para campos vazios.
            fichaId: (fichaId || null) as any,
            nome: workoutName,
            usuarioId: user.id,
            exercicios: loggedExercises,
            diasSemana: [],
            intervalo: { min: 0, seg: 0 },
            ordem: 0,
          },
          exercicios: loggedExercises,
          horarioInicio: startTime,
          horarioFim: finalEndTime,
          status: 'conclido',
          cargaAcumulada: totalLoad,
          exerciciosFeitos: loggedExercises.filter(ex => ex.series.some(s => s.concluido)),
          nomeTreino: workoutName,
          observacoes: loggedExercises.map((ex) => ex.notes).filter(Boolean).join('; '),
        };

        // Adicionado log para inspecionar o objeto que será salvo
        console.log('[handleFinishWorkout] Objeto do log pronto para ser salvo:', JSON.stringify(newLog, null, 2));

        const newLogId = await addLog(newLog);
        
        console.log('[handleFinishWorkout] Log salvo com sucesso. ID:', newLogId);

        await cacheActiveWorkoutLog(null);

        router.replace({ pathname: '/(treino)/treinoCompleto', params: { logId: newLogId } });

      } catch (error) {
        console.error('[handleFinishWorkout] Erro ao salvar o log do treino:', error);
        Alert.alert('Erro', 'Não foi possível salvar o log do treino.');
        setIsFinishing(false);
      }
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


  const handleRemoveExercise = (exerciseIndex: number) => {
    setLoggedExercises(prev => prev.filter((_, index) => index !== exerciseIndex));
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
        <SafeAreaView style={styles.container}>
          {/* Cabeçalho Customizado (agora fixo) */}
          <View style={styles.customHeader}>
            <View style={styles.headerLeftGroup}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
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
                  userWeight={userWeight}
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
                  startRestTimer={(duration, isExercise, timedSetInfo) => startTimer(duration, isExercise, timedSetInfo ? { ...timedSetInfo, exerciseIndex: index } : undefined)}
                  onMenuStateChange={setIsMenuOpen}
                />
              );
            }}
            ListFooterComponent={
              <>
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={() => setModalVisible(true)}
                >
                  <Text style={styles.addSetButtonText}>+ Adicionar Mais Exercícios</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => setSettingsModalVisible(true)}
                >
                  <FontAwesome name="cog" size={16} color="#aaa" />
                  <Text style={styles.settingsButtonText}>Configurações</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelWorkoutButton]} // Removida a margem duplicada
                  onPress={handleCancelWorkout}
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
    marginTop:50,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom:130,
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
});