import { RepetitionsDrawer } from '@/components/RepetitionsDrawer';
import { Exercicio, ExercicioModelo, Serie } from '@/models/exercicio';
import { Log } from '@/models/log';
import { calculateLoadForSerie, calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler'; // Adicionado ScrollView
import { MenuProvider } from 'react-native-popup-menu';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SetOptionsMenu } from '../../components/SetOptionsMenu';
import { Treino } from '../../models/treino';
import { cacheActiveWorkoutLog, getCachedActiveWorkoutLog } from '../../services/offlineCacheService';
import { getTreinoById } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';
import { MultiSelectExerciseModal } from './modals/MultiSelectExerciseModal';
import { FinishingLoggingWorkout } from './modals/specifics/FinishingLoggingWorkout'; // Import the finishing workout modal

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SerieEdit extends Serie {
  id: string;
  type: 'normal' | 'dropset';
  concluido: boolean;
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
}: {
  item: LoggedExercise;
  onSeriesChange: (newSeries: SerieEdit[]) => void;
  onRemove: () => void;
  onRestTimeChange: (newRestTime: number) => void;
  onNotesChange: (notes: string) => void;
  userWeight: number;
  onPesoBarraChange: (newPesoBarra: number) => void; // New prop
}) => {
  const { VideoListItem } = require('./editarTreino');
  const [isRepDrawerVisible, setIsRepDrawerVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState(item.notes || '');
  const [isRestTimePickerVisible, setIsRestTimePickerVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdvancedOptionsVisible, setIsAdvancedOptionsVisible] = useState(false);

  const [series, setSeries] = useState<SerieEdit[]>(
    item.series.map((s, i) => ({
      ...s,
      id: s.id || `set-${Date.now()}-${i}`,
      type: s.type || 'normal',
      concluido: s.concluido || false,
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
    option: 'addDropset' | 'copy' | 'delete' | 'toggleTime',
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
      } else if (option === 'addDropset') {
        const parentSet = newSets[index];
        newSets.splice(index + 1, 0, {
          id: `set-${Date.now()}`,
          repeticoes: parentSet.repeticoes,
          peso: (parentSet.peso ?? 10) * 0.7,
          type: 'dropset',
          concluido: false,
        });
      }
      handleSeriesUpdate(newSets);
    }, 100);
  };

  const handleRepetitionsSave = (newReps: string) => {
    if (editingSetIndex === null) return;
    const newSets = [...series];
    newSets[editingSetIndex].repeticoes = newReps;
    handleSeriesUpdate(newSets);
    setIsRepDrawerVisible(false);
    setEditingSetIndex(null);
  };

  const getRepetitionsValue = useCallback(() => {
    if (editingSetIndex === null || !series[editingSetIndex]) {
      return '10';
    }
    return series[editingSetIndex].repeticoes;
  }, [editingSetIndex, series]);

  const handleToggleComplete = (index: number, startRestTimer: (duration: number) => void) => {
    const newSeries = [...series];
    const isCompleting = !newSeries[index].concluido;
    newSeries[index].concluido = isCompleting;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isCompleting && newSeries[index].type === 'normal') {
      const normalSets = newSeries.filter(s => s.type === 'normal');
      const currentNormalSetIndex = normalSets.findIndex(s => s.id === newSeries[index].id);
      const isLastNormalSet = currentNormalSetIndex === normalSets.length - 1;

      if (!isLastNormalSet) {
        const nextSet = newSeries[index + 1];
        if (!nextSet || nextSet.type !== 'dropset') {
          startRestTimer(item.restTime || 60);
        }
      }
    }
    handleSeriesUpdate(newSeries);
  };

  const REST_TIME_OPTIONS = [
    { label: '30 seg', value: 30 },
    { label: '1 min', value: 60 },
    { label: '1 min 30 seg', value: 90 },
    { label: '2 min', value: 120 },
    { label: '2 min 30 seg', value: 150 },
  ];

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
            { backgroundColor: '#1f1f1f' },
            setItem.concluido && styles.setRowCompleted,
            { flex: 1 },
          ]}
        >
          {setItem.type === 'dropset' ? (
            <View style={{ width: 30, marginRight: 10, alignItems: 'center' }}>
              <FontAwesome5 name="arrow-down" size={16} color="#888" />
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
              style={styles.repButton}
              onPress={() => {
                if (!setItem.isTimeBased) {
                  setEditingSetIndex(itemIndex);
                  setIsRepDrawerVisible(true);
                }
              }}
              disabled={!!setItem.isTimeBased}
            >
              <Text style={styles.repButtonText}>{String(setItem.repeticoes)}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.xText}>x</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Peso (kg)</Text>
            <TextInput
              style={styles.setInput}
              placeholder="kg"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              value={String(setItem.peso || '')}
              onChangeText={text => {
                const newSets = [...series];
                newSets[itemIndex].peso = parseFloat(text.replace(',', '.')) || 0;
                handleSeriesUpdate(newSets);
              }}
            />
          </View>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleToggleComplete(itemIndex, () => {})}
          >
            <FontAwesome name={setItem.concluido ? 'check-square' : 'square-o'} size={24} color={setItem.concluido ? '#1cb0f6' : '#aaa'} />
          </TouchableOpacity>
          <SetOptionsMenu
            isTimeBased={!!setItem.isTimeBased}
            isNormalSet={(setItem.type || 'normal') === 'normal'}
            onSelect={action => handleSetOption(action, itemIndex)}
          />
        </View>
      </View>
    );
  };

  const exerciseVolume = calculateTotalVolume([{ ...item, series }], userWeight, true);

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
            <TouchableOpacity onPress={() => setIsAdvancedOptionsVisible(!isAdvancedOptionsVisible)} style={[styles.avancadoButton, {backgroundColor: '#2c2c2e'}]}>
              <Text style={styles.avancadoButtonText}>Avançado +</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      <Modal
        animationType="slide"
        transparent={true}
        visible={isRestTimePickerVisible}
        onRequestClose={() => setIsRestTimePickerVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Tempo de Descanso</Text>
            {REST_TIME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOptionButton,
                  (item.restTime || 60) === option.value && styles.modalOptionButtonSelected,
                ]}
                onPress={() => {
                  onRestTimeChange(option.value);
                  setIsRestTimePickerVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalOptionButton, { marginTop: 15, backgroundColor: '#555' }]} 
              onPress={() => setIsRestTimePickerVisible(false)}
            >
              <Text style={styles.modalOptionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <RepetitionsDrawer
        visible={isRepDrawerVisible}
        onClose={() => {
          setIsRepDrawerVisible(false);
          setEditingSetIndex(null);
        }}
        onSave={handleRepetitionsSave}
        initialValue={getRepetitionsValue()}
      />
    </View>
  );
};

export default function LoggingDuringWorkoutScreen() {
  const router = useRouter();
  const { treinoId, fichaId, logId } = useLocalSearchParams<{ treinoId?: string; fichaId?: string, logId?: string }>();
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinishingModalVisible, setIsFinishingModalVisible] = useState(false); // State for the finishing modal
  const [workoutName, setWorkoutName] = useState('');
  const [isNameEdited, setIsNameEdited] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null); // Added for FinishingLoggingWorkout
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [totalLoad, setTotalLoad] = useState(0);
  const [userWeight, setUserWeight] = useState(70); // default fallback
  const { user } = useAuth();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  // Estados para o timer de descanso
  const [isResting, setIsResting] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const [maxRestTime, setMaxRestTime] = useState(0);
  const progress = useSharedValue(0);
  const scrollY = useSharedValue(0); // Restaurado

  // Efeito para carregar do cache ou inicializar um novo treino
  useEffect(() => {
    const loadWorkout = async () => {
      if (!user) return;

      // **NOVA LÓGICA**: Prioriza carregar um log ativo do cache se um logId for passado
      if (logId) {
        try {
          const cachedLog = await getCachedActiveWorkoutLog();
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
          const cachedLog = await getCachedActiveWorkoutLog();
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
        if (profile?.peso) {
          setUserWeight(profile.peso);
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
        if (profile?.peso) {
          setUserWeight(profile.peso);
        }
      });
    }
  }, [user]);

  // Efeito para o timer do treino
  useEffect(() => {
    if (startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
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

  // Efeito para o timer de descanso
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isResting) {
      // Inicia a animação da barra de progresso
      progress.value = withTiming(1, { duration: restCountdown * 1000 });

      // Inicia o contador regressivo
      interval = setInterval(() => {
        setRestCountdown((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(interval);
            setIsResting(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          // Feedback tátil para os últimos segundos
          if (newTime <= 3 && newTime >= 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          return newTime;
        });
      }, 1000);
    } else {
      // Garante que tudo seja resetado quando não estiver descansando
      cancelAnimation(progress);
      progress.value = 0;
      setRestCountdown(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isResting]);

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

      await cacheActiveWorkoutLog(log);
    };

    const debounceSave = setTimeout(saveWorkout, 1000);
    return () => clearTimeout(debounceSave);

  }, [loggedExercises, workoutName, startTime, totalLoad, activeLogId, user]);


  const startRestTimer = (duration: number) => {
    // Se um timer já estiver rodando, cancela a animação anterior
    if (isResting) {
      cancelAnimation(progress);
    }
    setRestCountdown(duration);
    setMaxRestTime(duration);
    setIsResting(true);
    progress.value = 0; // Reseta a barra de progresso para o início
  };

  const handleSkipRest = () => {
    setIsResting(false);
    setRestCountdown(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleToggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    // Esta função agora centraliza a lógica de completar a série e iniciar o timer
    const exercise = loggedExercises[exerciseIndex];
    const series = exercise.series as SerieEdit[];
    const isCompleting = !series[setIndex].concluido;
    series[setIndex].concluido = isCompleting;

    // Atualiza o estado
    const updatedExercises = [...loggedExercises];
    updatedExercises[exerciseIndex].series = series;
    setLoggedExercises(updatedExercises);

    // Lógica para iniciar o timer
    if (isCompleting && series[setIndex].type === 'normal') {
      const nextSet = series[setIndex + 1];
      if (!nextSet || nextSet.type !== 'dropset') {
        startRestTimer(exercise.restTime || 60);
      }
    }
  };

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
            router.back(); // Volta para a tela anterior
          },
        },
      ]
    );
  };
  const handleFinishWorkout = () => {
    const allSetsCompleted = loggedExercises.every(exercise =>
      (exercise.series as SerieEdit[]).every(set => set.concluido)
    );

    const proceedToFinish = () => {
      setIsFinishing(true);
      setEndTime(new Date()); // Define a hora de término
      setIsFinishingModalVisible(true); // Abre o modal de finalização
      setIsFinishing(false); // Reseta o estado de "finalizando"
    };

    if (allSetsCompleted) {
      proceedToFinish();
    } else {
      Alert.alert(
        "Finalizar Treino?",
        "Você não completou todas as séries. Deseja finalizar o treino mesmo assim?",
        [
          {
            text: "Cancelar",
            style: "cancel"
          },
          {
            text: "Finalizar",
            onPress: proceedToFinish,
            style: "destructive"
          }
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
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleUpdateExerciseSeries = (exerciseIndex: number, newSeries: SerieEdit[]) => {
    const updatedExercises = [...loggedExercises];
    const oldSeries = updatedExercises[exerciseIndex].series as SerieEdit[];

    // If a set was added or removed, just update the series and skip the diff logic
    if (newSeries.length !== oldSeries.length) {
      updatedExercises[exerciseIndex].series = newSeries.map(s => ({ ...s, concluido: s.concluido || false }));
      setLoggedExercises(updatedExercises);
      return;
    }

    // Detecta qual série foi alterada (completada/descompletada)
    for (let i = 0; i < newSeries.length; i++) {
      if (i < oldSeries.length && newSeries[i].concluido !== oldSeries[i].concluido) {
        // A série na posição 'i' foi alterada.
        handleToggleSetComplete(exerciseIndex, i);
        return; // Sai para evitar re-renderizações múltiplas
      }
    }

    // Se não foi uma mudança de 'concluido', apenas atualiza as séries (ex: reordenar)
    updatedExercises[exerciseIndex].series = newSeries.map(s => ({ ...s, concluido: s.concluido || false }));
    setLoggedExercises(updatedExercises);
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
    backgroundColor: '#030405', // Cor de fundo do container
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
                <FontAwesome name="arrow-left" size={20} color="#fff" />
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
                <FontAwesome name="plus" size={50} color="#1cb0f6" />
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
                <View style={statsContainerStyle}>
                  <View style={statItemStyle}>
                    <FontAwesome name="clock-o" size={16} color="#aaa" />
                    <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
                  </View>
                  <View style={statItemStyle}>
                    <FontAwesome5 name="weight-hanging" size={16} color="#aaa" />
                    <Text style={styles.statValue}>{Math.round(totalLoad).toLocaleString('pt-BR')} kg</Text>
                  </View>
                </View>
              }
              renderItem={({ item, index }) => (
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
                                  />
                                )}
                                ListFooterComponent={
                                  <>
                                    <TouchableOpacity
                                      style={styles.addMoreButton}
                                      onPress={() => setModalVisible(true)}
                                    >
                                      <Text style={styles.addSetButtonText}>+ Adicionar Mais Exercícios</Text>
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
                  
                                                      <MultiSelectExerciseModal
                                                        visible={isModalVisible}
                                                        onClose={() => setModalVisible(false)}
                                                        onConfirm={handleSelectExercises}
                                                        existingExerciseIds={loggedExercises.map(e => e.modeloId)}
                                                      />
                            
                                                                                <FinishingLoggingWorkout
                                                                                  visible={isFinishingModalVisible}
                                                                                  onClose={async () => {
                                                                                    await cacheActiveWorkoutLog(null); // Discard the cache
                                                                                    setIsFinishingModalVisible(false);
                                                                                  }}
                                                                                  loggedExercises={loggedExercises}                                                        totalLoad={totalLoad}
                                                        elapsedTime={elapsedTime}
                                                        startTime={startTime}
                                                        endTime={endTime}
                                                        initialWorkoutName={workoutName}
                                                        userWeight={userWeight}
                                                      />
                                                    </SafeAreaView>                  
                          {isResting && (
                            <View style={styles.restTimerOverlay}>
                              <View style={styles.restTimerProgressContainer}>
                                <Animated.View style={[styles.restTimerProgressBar, animatedProgressStyle]} />
                              </View>
                              <View style={styles.restTimerContent}>
                                <View>
                                  <Text style={styles.restTimerLabel}>Descanso</Text>
                                  <Text style={styles.restTimerValue}>{formatTime(restCountdown)}</Text>
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
    backgroundColor: '#1cb0f6',
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
  container: { flex: 1, backgroundColor: '#030405' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addButtonCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1cb0f6',
    borderStyle: 'dashed',
  },
  emptyText: { color: '#888', marginTop: 20, fontSize: 16 },
  exercicioCard: {
    backgroundColor: '#141414',
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
    borderRadius: 8,
  },
  setRowCompleted: {
    opacity: 0.75,
  },
  seriesNumberContainer: {
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: 30,
    borderRadius: 5,
    marginRight: 10,
  },
  seriesNumberCompleted: {
    backgroundColor: '#1cb0f6',
  },
  seriesNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  completedBar: {
    width: 5,
    backgroundColor: '#1cb0f6',
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
    backgroundColor: '#2c2c2e',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 16,
    minWidth: 80,
  },
  repButton: {
    backgroundColor: '#2c2c2e',
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
  deleteBox: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
  },
  completeBox: {
    backgroundColor: '#1cb0f6', // Azul para "Completar"
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
    backgroundColor: '#2c2c2e',
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
    backgroundColor: '#2c2c2e',
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
    backgroundColor: '#2c2c2e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalOptionButtonSelected: {
    backgroundColor: '#1cb0f6',
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
    backgroundColor: '#1f1f1f',
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
    backgroundColor: '#1cb0f6',
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
    backgroundColor: '#333',
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
    borderColor: '#1cb0f6',
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  finishButtonCompleted: {
    backgroundColor: '#1cb0f6',
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
    backgroundColor: '#2c2c2e',
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
    color: '#1cb0f6',
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
});