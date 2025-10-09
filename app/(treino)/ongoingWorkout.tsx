import { Exercicio, Serie } from '@/models/exercicio';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView as Video, useVideoPlayer } from 'expo-video';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import DraggableFlatList, { RenderItemParams as DraggableRenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Treino } from '../../models/treino';
import { addLog, getLogsByUsuarioId } from '../../services/logService';
import { getTreinoById } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

// A interface Serie agora inclui um tipo para diferenciar séries normais de dropsets.
interface SerieEdit extends Omit<Serie, 'id'> {
  peso: number;
  repeticoes: any;
  id: string;
  type: 'normal' | 'dropset';
  showMenu?: boolean;
}

// A new component to manage each video player instance
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // useEffect for player cleanup.
  useEffect(() => {
    // The pre-flight network request and diagnostic logs have been removed
    // to prepare the component for production.

    // Cleanup the player when the component unmounts or the URI changes.
    return () => {
      player.release();
    };
  }, [uri, player]);
  return <Video style={style} player={player} nativeControls={false} contentFit="cover" />;
}

// Helper Components
const ProgressBar = memo(({ progress }: { progress: number }) => (
  <View style={styles.progressBarBackground}>
    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
  </View>
));

const WorkoutCompleteModal = memo(({
  isVisible, onClose, duration, exercisesCompleted, weeklyProgress, weekStreak,
  volumeData
}: {
  isVisible: boolean; onClose: () => void; duration: number; exercisesCompleted: number; weeklyProgress: { completed: number; total: number }; weekStreak: number; volumeData: { current: number; previous: number[]; percentageChange: number | null; } | null;
}) => {
  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.completeModalContainer}>
            <View style={styles.completeModalHeader}>
              <Text style={styles.completeModalTitle}>Mandou Bem!</Text>
              <Text style={styles.completeModalSubtitle}>Você completou o treino de hoje!</Text>
            </View>
            
            <ScrollView style={styles.bottomContentContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.allStatsContainer}>
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Seu Progresso</Text>
                  <View style={styles.progressItem}>
                    <Text style={styles.progressLabel}>Treinos da Semana</Text>
                    <ProgressBar progress={weeklyProgress.total > 0 ? weeklyProgress.completed / weeklyProgress.total : 0} />
                    <Text style={styles.progressText}>{weeklyProgress.completed} de {weeklyProgress.total} treinos</Text>
                  </View>
                  <View style={styles.progressItem}>
                    <Text style={styles.progressLabel}>Sequência de Semanas</Text>
                    <View style={styles.streakContainer}>
                      <FontAwesome name="fire" size={16} color="#FFA500" />
                      <Text style={styles.streakText}>{weekStreak} {weekStreak === 1 ? 'semana' : 'semanas'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Seu Desempenho</Text>
                  <View style={styles.performanceContainer}>
                    <View style={styles.performanceCard}>
                      <FontAwesome name="clock-o" size={24} color="#1cb0f6" />
                      <Text style={styles.performanceValue}>{formatDuration(duration)}</Text>
                      <Text style={styles.performanceLabel}>Tempo de Treino</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <FontAwesome name="trophy" size={24} color="#1cb0f6" />
                      <Text style={styles.performanceValue}>{exercisesCompleted}</Text>
                      <Text style={styles.performanceLabel}>Exercícios Feitos</Text>
                    </View>
                  </View>
                </View>

                {volumeData && volumeData.current > 0 && (
                  <View style={styles.statsSection}>
                    <Text style={styles.statsSectionTitle}>Evolução de Carga</Text>
                    <View style={styles.volumeCard}>
                      <Text style={styles.volumeValue}>{volumeData.current.toLocaleString('pt-BR')} kg</Text>
                      <Text style={styles.volumeLabel}>Carga total neste treino</Text>
                      {volumeData.percentageChange !== null && (
                        <View style={[styles.percentageBadge, volumeData.percentageChange >= 0 ? styles.percentagePositive : styles.percentageNegative]}>
                          <FontAwesome name={volumeData.percentageChange >= 0 ? 'caret-up' : 'caret-down'} size={14} color="#fff" />
                          <Text style={styles.percentageText}>
                            {volumeData.percentageChange.toFixed(1)}% vs. último treino
                          </Text>
                        </View>
                      )}
                      {volumeData.previous.length > 0 && (
                        <View style={styles.historyContainer}>
                          <Text style={styles.historyTitle}>Histórico:</Text>
                          <View style={styles.historyItems}>
                            {volumeData.previous.map((vol, index) => (
                              <Text key={index} style={styles.historyValue}>{vol.toLocaleString('pt-BR')} kg</Text>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.continueButton} onPress={onClose}>
              <Text style={styles.continueButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
});

// Componente para exibir os detalhes de uma série normal.
const NormalSetDetails = ({ currentSet }: { currentSet: Serie }) => (
  <>
    <View style={styles.detailItem}><FontAwesome name="repeat" size={20} color="#ccc" /><Text style={styles.detailValue}>{currentSet.repeticoes}</Text><Text style={styles.detailLabel}>Repetições</Text></View>
    <View style={styles.detailItem}><FontAwesome name="dashboard" size={20} color="#ccc" /><Text style={styles.detailValue}>{currentSet.peso || 0} kg</Text><Text style={styles.detailLabel}>Peso</Text></View>
  </>
);

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); // Semana começa na Segunda
    d.setHours(0, 0, 0, 0);
    return d;
};

export default function OngoingWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // We'll get the treinoId and fichaId from the navigation parameters
  const { treinoId, fichaId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Treino | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [horarioInicio, setHorarioInicio] = useState<Date | null>(null);

  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);

  // State for the exercise edit modal
  const [isEditExerciseModalVisible, setEditExerciseModalVisible] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SerieEdit[]>([]);
  const [isWorkoutCompleteModalVisible, setWorkoutCompleteModalVisible] = useState(false);

  const [isExerciseListVisible, setExerciseListVisible] = useState(false);
  const [isExerciseDetailModalVisible, setExerciseDetailModalVisible] = useState(false);

  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  // State for completion modal stats
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState({ completed: 0, total: 0 });
  const [weekStreak, setWeekStreak] = useState(0);
  const [volumeData, setVolumeData] = useState<{ current: number; previous: number[]; percentageChange: number | null; } | null>(null);

  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const appState = useRef(AppState.currentState);

  // Memoize the max rest time to avoid recalculation
  const maxRestTime = useMemo(() => {
    if (!treino) return 0;
    const intervalo = treino.intervalo ?? { min: 1, seg: 0 };
    return intervalo.min * 60 + intervalo.seg;
  }, [treino]);

  // Open modal to edit current exercise's sets, reps, and weight
  const handleEdit = useCallback(() => {
    if (!treino) return;
    const currentExercise = treino.exercicios[currentExerciseIndex];
    // Deep copy to avoid direct state mutation
    const seriesCopy = JSON.parse(JSON.stringify(currentExercise.series)).map((s: Serie, index: number) => ({
      ...s,
      id: s.id || `set-${Date.now()}-${index}`,
    }));
    setEditingSeries(seriesCopy);
    setEditExerciseModalVisible(true);
  }, [treino, currentExerciseIndex]);

  const handleShowList = useCallback(() => {
    setExerciseListVisible(true);
  }, []);

  // Fetch workout data when the component mounts
  useEffect(() => {
    const startTime = new Date();
    const fetchTreino = async () => {
      if (typeof treinoId !== 'string') {
        Alert.alert("Erro", "ID do treino inválido.");
        router.back();
        return;
      }
      try {
        const [treinoData, userLogs] = await Promise.all([
          getTreinoById(treinoId),
          user ? getLogsByUsuarioId(user.uid) : Promise.resolve([])
        ]);

        if (!treinoData) {
          throw new Error("Treino não encontrado.");
        }
        if (!treinoData.exercicios || treinoData.exercicios.length === 0 || !treinoData.exercicios[0].series || treinoData.exercicios[0].series.length === 0) {
          Alert.alert("Treino Vazio", "Este treino não possui exercícios. Adicione exercícios para poder iniciá-lo.", [{ text: "OK", onPress: () => router.back() }]);
          return;
        }

        setTreino(treinoData);
        const intervalo = treinoData.intervalo ?? { min: 1, seg: 0 };
        setRestTime(intervalo.min * 60 + intervalo.seg);

        // Verifica se já existe um log ativo para este treino
        const existingLog = userLogs.find(log => log.treino.id === treinoId && !log.horarioFim);
        if (existingLog) {
          setActiveLogId(existingLog.id);
          const inicio = toDate(existingLog.horarioInicio);
          setHorarioInicio(inicio);
          // Se havia um descanso em andamento, recupera o estado
          if (existingLog.lastInterval) {
            setRestStartTime(existingLog.lastInterval);
            setIsResting(true);
          }
        } else if (user) {
          // Cria um novo log ativo
          setHorarioInicio(startTime);
          const newLogId = await addLog({ usuarioId: user.uid, treino: { ...treinoData, id: treinoId, fichaId: fichaId as string }, exercicios: treinoData.exercicios, exerciciosFeitos: [], horarioInicio: startTime }) ?? null;
          setActiveLogId(newLogId);
        }

      } catch (error) {
        console.error("Failed to fetch workout:", error);
        Alert.alert("Erro", "Não foi possível carregar o treino.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchTreino();
  }, [treinoId, user]);

  // AppState listener to handle timer in background
  useEffect(() => {
    // A lógica de escuta do AppState foi removida.
    // A nova abordagem do timer é inerentemente resiliente a pausas e
    // reaberturas do app, tornando o AppState listener desnecessário para este caso.
  }, []);

  // Handles the countdown timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isResting) {
      interval = setInterval(() => {
        if (restStartTime) {
          const elapsedSeconds = Math.floor((Date.now() - restStartTime) / 1000);
          const remainingTime = maxRestTime - elapsedSeconds;
          const newRestTime = Math.max(0, remainingTime);
          setRestTime(newRestTime);

          if (newRestTime <= 0) {
            setIsResting(false);
            setRestStartTime(null);
            setRestTime(maxRestTime);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restStartTime, maxRestTime]);
  

  // Handles completing a set and moving to the next exercise or finishing the workout
  const handleCompleteSet = async () => {
    if (!treino || !user) return;

    const currentExercise = treino.exercicios[currentExerciseIndex];
    const newCompletedSets = completedSets + 1;

    // Check if the current exercise is finished
    // @ts-ignore
    if (newCompletedSets >= currentExercise.series.length) {
      // Check if it's the last exercise of the workout
      if (currentExerciseIndex < treino.exercicios.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCompletedSets(0);
      } else {
        // Workout finished!
        const horarioFim = new Date();
        const durationInSeconds = (horarioFim.getTime() - horarioInicio!.getTime()) / 1000;
        setWorkoutDuration(durationInSeconds);
        
        try {
          if (activeLogId) {
            // Atualiza o log existente com o horário de fim
            const logUpdateData = {
              horarioFim: horarioFim,
              exerciciosFeitos: treino.exercicios, // Assume que todos foram feitos
            };
            await addLog(logUpdateData, activeLogId);
            await calculateCompletionData();
            setWorkoutCompleteModalVisible(true);
          }
        } catch (error) {
          console.error("Failed to save workout log:", error);
          Alert.alert("Erro", "Não foi possível salvar seu progresso, mas parabéns por concluir!", [{ text: "OK", onPress: () => router.back() }]);
        }
        return;
      }
    } else {
      setCompletedSets(newCompletedSets);
    }

    // Start resting after a set is completed
    const restStartTimestamp = Date.now();
    setRestStartTime(restStartTimestamp); // Record when rest officially starts
    setIsResting(true);
    // Salva o início do descanso no log ativo
    if (activeLogId) {
      await addLog({ lastInterval: restStartTimestamp }, activeLogId);
    }
  };

  const handleSkipRest = async () => {
    if (isResting) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsResting(false);
      setRestStartTime(null); // Clear rest start time when rest is skipped
      // Reseta o timer para o próximo período de descanso
      setRestTime(maxRestTime);
      if (activeLogId) {
        await addLog({ lastInterval: null }, activeLogId);
      }
    }
  };

  const parseReps = (reps: any): number => {
    if (typeof reps === 'number') return reps;
    if (typeof reps === 'string') {
      // Extrai todos os números da string (ex: "8-12" -> ["8", "12"])
      const numbers = reps.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        if (numbers.length >= 2) {
          // Se houver dois ou mais números (como em "10-12"), calcula a média dos dois primeiros
          const num1 = Number(numbers[0]);
          const num2 = Number(numbers[1]);
          return Math.round((num1 + num2) / 2);
        }
        // Se houver apenas um número, retorna esse número
        return Number(numbers[0]);
      }
    }
    return 0; // Retorna 0 se não conseguir parsear
  };

  const calculateVolume = (exercicios: Exercicio[]): number => {
    return exercicios.reduce((totalVolume, exercicio) => {
      const exercicioVolume = exercicio.series.reduce((serieVolume, serie) => {
        const reps = parseReps(serie.repeticoes);
        const peso = serie.peso || 0;
        return serieVolume + (reps * peso);
      }, 0);
      return totalVolume + exercicioVolume;
    }, 0);
  };

  const calculateCompletionData = async () => {
    if (!user || !treino) return;
    try {
      const [userProfile, userLogs] = await Promise.all([
        getUserProfile(user.uid),
        getLogsByUsuarioId(user.uid)
      ]);

      const streakGoal = userProfile?.streakGoal || 2;
      const today = new Date();
      const startOfThisWeek = getStartOfWeek(today);

      // Incluindo o treino atual que acabou de ser logado
      const workoutsThisWeekCount = userLogs.filter(log => {
        const logDate = toDate(log.horarioFim);
        return logDate && logDate >= startOfThisWeek;
      }).length;

      setWeeklyProgress({ completed: workoutsThisWeekCount, total: streakGoal });

      const workoutsByWeek: { [weekStart: string]: number } = {};
      userLogs.forEach(log => {
        const logDate = toDate(log.horarioFim);
        if (logDate) {
          const weekStartDate = getStartOfWeek(logDate);
          const weekStartString = weekStartDate.toISOString().split('T')[0];
          workoutsByWeek[weekStartString] = (workoutsByWeek[weekStartString] || 0) + 1;
        }
      });

      let currentStreak = 0;
      let weekToCheck = startOfThisWeek;
      while (true) {
        const weekString = weekToCheck.toISOString().split('T')[0];
        if ((workoutsByWeek[weekString] || 0) >= streakGoal) {
          currentStreak++;
          weekToCheck.setDate(weekToCheck.getDate() - 7);
        } else { break; }
      }
      setWeekStreak(currentStreak);

      // Preparar dados de comparação de volume
      const relevantLogs = userLogs
        .filter(log => log.horarioFim && log.treino.id === treino.id)
        .sort((a, b) => toDate(a.horarioFim)!.getTime() - toDate(b.horarioFim)!.getTime());

      if (relevantLogs.length > 0) {
        // Calcula o volume do treino atual usando os dados do estado, que podem ter sido editados.
        const currentVolume = calculateVolume(treino.exercicios);
        // Calcula os volumes dos treinos anteriores a partir dos logs.
        const previousLogs = relevantLogs.slice(0, -1);
        const volumes = [...previousLogs.map(log => calculateVolume(log.exerciciosFeitos)), currentVolume];
        const previousLogsVolumes = volumes.slice(Math.max(0, volumes.length - 4), volumes.length - 1).reverse();

        let percentageChange: number | null = null;
        if (volumes.length > 1) {
          const previousVolume = volumes[volumes.length - 2];
          if (previousVolume > 0) {
            percentageChange = ((currentVolume - previousVolume) / previousVolume) * 100;
          }
        }
        setVolumeData({
          current: currentVolume,
          previous: previousLogsVolumes,
          percentageChange: percentageChange,
        });
      }
    } catch (error) { console.error("Error calculating completion data:", error); }
  };

  const handleCloseCompleteModal = () => {
    setWorkoutCompleteModalVisible(false);
    router.back();
  }

  const handleSaveExerciseChanges = () => {
    if (!treino) return;

    // Basic validation
    if (editingSeries.some(s => !s.repeticoes || s.repeticoes.trim() === '')) {
      Alert.alert("Erro", "Todas as séries devem ter repetições definidas.");
      return;
    }

    const updatedExercicios = [...treino.exercicios];
    const exerciseToUpdate = { ...updatedExercicios[currentExerciseIndex] };

    // Replace the series with the edited ones
    exerciseToUpdate.series = editingSeries;
    updatedExercicios[currentExerciseIndex] = exerciseToUpdate;

    setTreino(prevTreino => prevTreino ? { ...prevTreino, exercicios: updatedExercicios } : null);
    setEditExerciseModalVisible(false);
    setEditingSeries([]); // Clear editing state
  };

  const handleSetOption = (option: 'addDropset' | 'copy' | 'delete', index: number) => {
    const newSets = [...editingSeries];
    // Fecha todos os outros menus
    newSets.forEach((set, i) => { if (i !== index) set.showMenu = false; });

    if (option === 'delete') {
      newSets.splice(index, 1);
    } else if (option === 'copy') {
      const originalSet = newSets[index];
      const newSet: SerieEdit = {
        ...originalSet,
        id: `set-${Date.now()}`,
        showMenu: false,
      };
      newSets.splice(index + 1, 0, newSet);
    } else if (option === 'addDropset') {
      const parentSet = newSets[index];
      const newDropset: SerieEdit = {
        id: `set-${Date.now()}`,
        repeticoes: parentSet.repeticoes,
        peso: (parentSet.peso ?? 10) * 0.7, // Sugestão de peso para o dropset
        type: 'dropset',
        showMenu: false,
      };
      newSets.splice(index + 1, 0, newDropset);
    }

    // Fecha o menu que foi clicado
    if (newSets[index]) {
      newSets[index].showMenu = false;
    }

    setEditingSeries(newSets);
  };

  // Formats seconds into a MM:SS string
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Asks for confirmation before leaving the workout
  const handleBack = () => {
    const exitWorkout = async () => {
      if (activeLogId) {
        // Exclui o log que foi criado no início do treino
        await addLog(null, activeLogId, true); // Passa 'true' para deletar
      }
      router.back();
    };
    Alert.alert(
      "Sair do Treino?",
      "Seu progresso não será salvo. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: exitWorkout },
      ]
    );
  };

  // Hook para determinar se o set atual faz parte de uma sequência de dropset
  const { isDropsetSequence, dropsetGroup } = useMemo(() => {
    if (!treino || !treino.exercicios[currentExerciseIndex]) return { isDropsetSequence: false, dropsetGroup: [] };

    const series = treino.exercicios[currentExerciseIndex].series;
    const currentSetIndex = completedSets;

    // Verifica se o próximo set é um dropset
    const isFollowedByDropset = (series[currentSetIndex + 1]?.type || 'normal') === 'dropset';
    // Verifica se o set atual é um dropset
    const isCurrentSetADropset = (series[currentSetIndex]?.type || 'normal') === 'dropset';

    if (!isFollowedByDropset && !isCurrentSetADropset) {
      return { isDropsetSequence: false, dropsetGroup: [] };
    }

    // Encontra o início da sequência (a série 'normal' pai)
    let startIndex = currentSetIndex;
    while (startIndex > 0 && (series[startIndex]?.type || 'normal') === 'dropset') {
      startIndex--;
    }

    // Encontra o fim da sequência
    let endIndex = startIndex;
    while (endIndex + 1 < series.length && (series[endIndex + 1]?.type || 'normal') === 'dropset') {
      endIndex++;
    }

    const group = series.slice(startIndex, endIndex + 1);
    return { isDropsetSequence: true, dropsetGroup: group };
  }, [treino, currentExerciseIndex, completedSets]);

  const { totalNormalSeries, completedNormalSeriesCount } = useMemo(() => {
    if (!treino) return { totalNormalSeries: 0, completedNormalSeriesCount: 0 };
    const currentSeries = treino.exercicios[currentExerciseIndex].series;
    const total = currentSeries.filter(s => (s.type || 'normal') === 'normal').length;
    // Conta quantas séries normais existem até o índice da série atual (inclusive)
    const completedCount = currentSeries.slice(0, completedSets + 1).filter(s => (s.type || 'normal') === 'normal').length;
    return { totalNormalSeries: total, completedNormalSeriesCount: completedCount };
  }, [treino, currentExerciseIndex, completedSets]);


  if (loading || !treino) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  const currentExercise = treino.exercicios[currentExerciseIndex];
  const currentSet = currentExercise.series[completedSets];
  // REMOVED: All constants for the circular progress bar animation
  
  const renderExerciseProgressItem = ({ item, index }: { item: Exercicio, index: number }) => {
    const isCompleted = index < currentExerciseIndex;
    const isCurrent = index === currentExerciseIndex;
    const totalExercises = treino.exercicios.length;

    // The track is composed of two halves to allow for different colors
    const TopTrack = () => (
        <View style={{
            position: 'absolute',
            top: 0,
            bottom: '50%',
            width: 2,
            backgroundColor: (isCompleted || isCurrent) ? '#1cb0f6' : '#333',
            opacity: index === 0 ? 0 : 1,
        }} />
    );

    const BottomTrack = () => (
        <View style={{
            position: 'absolute',
            top: '50%',
            bottom: 0,
            width: 2,
            backgroundColor: isCompleted ? '#1cb0f6' : '#333',
            opacity: index === totalExercises - 1 ? 0 : 1,
        }} />
    );

    return (
        <View style={styles.progressListItem}>
            <View style={styles.timelineContainer}>
                <TopTrack /> 
                <BottomTrack /> 
                <View style={[
                    styles.timelineDot,
                    isCompleted && styles.completedDot,
                    isCurrent && styles.currentDot,
                ]} />
            </View>
            <View style={styles.exerciseContent}>
                <Text style={[styles.modalExerciseName, isCompleted && { textDecorationLine: 'line-through', opacity: 0.7 }]}>{item.modelo.nome}</Text>
                <Text style={styles.modalExerciseDetails}>
                  {item.series.filter(s => (s.type || 'normal') === 'normal').length} séries
                  {item.series.filter(s => s.type === 'dropset').length > 0 && 
                    ` + ${item.series.filter(s => s.type === 'dropset').length} dropsets`}
                </Text>
            </View>
        </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <FontAwesome name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Treino Rolando</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* MODIFIED: Removed the entire progress circle structure, leaving only the timer label and text */}
          <TouchableOpacity style={styles.timerContainer} onPress={handleSkipRest} disabled={!isResting}>
            <View>
              <Text style={styles.timerLabel}>Tempo de Intervalo</Text>
              <Text style={styles.timerText}>
                {isResting ? formatTime(restTime) : formatTime(maxRestTime)}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.bottomSectionContainer}>
            <View style={styles.exerciseSectionContainer}>
              <TouchableOpacity style={styles.exerciseCard} onPress={() => setExerciseDetailModalVisible(true)}>
                  {currentExercise.modelo.imagemUrl && (
                      <VideoListItem uri={currentExercise.modelo.imagemUrl} style={styles.exerciseVideo} />
                  )}
                  <View style={styles.exerciseInfoContainer}>
                      <Text style={styles.exerciseName}>{currentExercise.modelo.nome}</Text>
                      <Text style={styles.exerciseMuscleGroup}>{currentExercise.modelo.grupoMuscular}</Text>
                  </View>
              </TouchableOpacity>

              <View style={styles.detailsContainer}>
                  <View style={styles.detailItem}>
                      <FontAwesome name="clone" size={20} color="#ccc" /><Text style={styles.detailValue}>{completedNormalSeriesCount}/{totalNormalSeries}</Text>
                      <Text style={styles.detailLabel}>Séries</Text>
                  </View>
                  <NormalSetDetails currentSet={currentSet} />
              </View>
              {isDropsetSequence && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropsetScrollContainer}>
                  {dropsetGroup.map((set, index) => {
                    const isCurrent = set.id === currentSet.id;
                    return (
                      <View key={set.id} style={[styles.dropsetItem, isCurrent && styles.currentDropsetItem]}>
                        <Text style={styles.dropsetItemLabel}>{index === 0 ? 'Série' : 'Drop'}</Text>
                        <Text style={styles.dropsetItemValue}>{set.repeticoes}</Text>
                        <Text style={styles.dropsetItemValue}>{set.peso || 0}kg</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
                <FontAwesome name="pencil" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mainActionButton} onPress={handleCompleteSet}>
                <FontAwesome name="check" size={40} color="#0d181c" />
                <Text style={styles.mainActionButtonText}>Concluir Série</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleShowList}>
                <FontAwesome name="list-ul" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Lista</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Modal
          visible={isExerciseListVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setExerciseListVisible(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lista de Exercícios</Text>
              <TouchableOpacity onPress={() => setExerciseListVisible(false)}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={treino.exercicios}
              keyExtractor={(item, index) => `exercicio-lista-${index}`}
              renderItem={renderExerciseProgressItem}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
            />
          </SafeAreaView>
        </Modal>

        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={isEditExerciseModalVisible}
          onRequestClose={() => setEditExerciseModalVisible(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Exercício</Text>
              <TouchableOpacity onPress={() => setEditExerciseModalVisible(false)}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <DraggableFlatList
              data={editingSeries}
              style={{ width: '100%' }}
              contentContainerStyle={styles.modalScrollViewContent}
              keyExtractor={(item) => item.id!}
              onDragEnd={({ data }) => setEditingSeries(data)}
              renderItem={({ item, drag, isActive, getIndex }: DraggableRenderItemParams<SerieEdit>) => {
                const itemIndex = getIndex();
                if (itemIndex === undefined) return null;

                const normalSeriesCount = editingSeries.slice(0, itemIndex + 1).filter(s => (s.type || 'normal') === 'normal').length;

                return (
                  <View style={{ marginLeft: item.type === 'dropset' ? 30 : 0, marginBottom: 10 }}>
                    <View style={[styles.setRow, { backgroundColor: isActive ? '#3a3a3a' : '#1f1f1f'}]}>
                      <TouchableOpacity onLongPress={drag} style={{ paddingHorizontal: 10 }} disabled={isActive}>
                         <FontAwesome5 name={(item.type || 'normal') === 'normal' ? "dumbbell" : "arrow-down"} size={16} color="#888" /> 
                      </TouchableOpacity>
                      <Text style={styles.setText}>{(item.type || 'normal') === 'normal' ? `Série ${normalSeriesCount}` : 'Dropset'}</Text>
                      <TextInput
                        style={styles.setInput}
                        placeholder="Reps"
                        placeholderTextColor="#888"
                        value={item.repeticoes}
                        onChangeText={(text) => {
                          const newSets = [...editingSeries];
                          newSets[itemIndex].repeticoes = text;
                          setEditingSeries(newSets);
                        }}
                      />
                      <TextInput
                        style={styles.setInput}
                        placeholder="kg"
                        placeholderTextColor="#888"
                        keyboardType="numeric"
                        value={String(item.peso || '')}
                        onChangeText={(text) => {
                          const newSets = [...editingSeries];
                          newSets[itemIndex].peso = parseFloat(text) || 0;
                          setEditingSeries(newSets);
                        }}
                      />
                      <TouchableOpacity style={{ padding: 10 }} onPress={() => {
                        const newSets = [...editingSeries];
                        newSets.forEach((s, i) => s.showMenu = i === itemIndex ? !s.showMenu : false);
                        setEditingSeries(newSets);
                      }}>
                          <FontAwesome name="ellipsis-v" size={20} color="#ccc" />
                      </TouchableOpacity>
                    </View>
                    {item.showMenu && (
                      <Animated.View entering={SlideInUp.duration(200)} exiting={SlideOutDown.duration(200)}>
                        <View style={styles.setMenu}>
                          {(item.type || 'normal') === 'normal' && (
                            <TouchableOpacity style={styles.setMenuButton} onPress={() => handleSetOption('addDropset', itemIndex)}>
                              <Text style={styles.setMenuText}>Adicionar Dropset</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.setMenuButton} onPress={() => handleSetOption('copy', itemIndex)}>
                            <Text style={styles.setMenuText}>Copiar Série</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.setMenuButton, { borderBottomWidth: 0 }]} onPress={() => handleSetOption('delete', itemIndex)}>
                            <Text style={[styles.setMenuText, { color: '#ff3b30' }]}>Deletar</Text>
                          </TouchableOpacity>
                        </View>
                      </Animated.View>
                    )}
                  </View>
                )
              }}
              ListFooterComponent={
                <>
                  <TouchableOpacity style={styles.addSetButton} onPress={() => setEditingSeries([...editingSeries, { id: `set-${Date.now()}`, repeticoes: '8-12', peso: 10, type: 'normal' }])}>
                    <Text style={styles.addSetButtonText}>+ Adicionar Série</Text>
                  </TouchableOpacity>

                  <View style={styles.modalButtons}>
                      <TouchableOpacity style={[styles.button, styles.buttonClose]} onPress={() => setEditExerciseModalVisible(false)}>
                          <Text style={[styles.textStyle, {color: '#ff3b30'}]}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.button, styles.buttonAdd]} onPress={handleSaveExerciseChanges}>
                          <Text style={styles.textStyle}>Salvar</Text>
                      </TouchableOpacity>
                  </View>
                </>
              }
            />
          </SafeAreaView>
        </Modal>

        {/* Exercise Detail Modal */}
        <Modal
          visible={isExerciseDetailModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setExerciseDetailModalVisible(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Exercício</Text>
              <TouchableOpacity onPress={() => setExerciseDetailModalVisible(false)}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.detailModalContentWrapper}>
              <ScrollView>
                <View>
                  {currentExercise.modelo.imagemUrl && (
                    <VideoListItem uri={currentExercise.modelo.imagemUrl} style={styles.detailModalVideo} />
                  )}
                  <Text style={styles.detailModalExerciseName}>{currentExercise.modelo.nome}</Text>
                </View>

                <View style={styles.detailModalSeriesContainer}>
                  {(() => {
                    let normalSeriesCounter = 0;
                    return currentExercise.series.map((item, index) => {
                      const isDropset = item.type === 'dropset';
                      if (!isDropset) {
                        normalSeriesCounter++;
                      }
                      return (
                        <View key={item.id || `serie-detail-${index}`} style={[styles.detailModalSetRow, isDropset && { marginLeft: 20 }]}>
                          <View style={styles.detailModalSetTitleContainer}>
                            {isDropset && (
                              <FontAwesome5 name="arrow-down" size={14} color="#ccc" style={{ marginRight: 8 }} />
                            )}
                            <Text style={styles.detailModalSetText}>
                              {isDropset ? 'Dropset' : `Série ${normalSeriesCounter}`}
                            </Text>
                          </View>
                          {isDropset && <Text style={styles.dropsetTag}>DROPSET</Text>}
                          <View style={styles.detailModalSetInfoContainer}>
                            <Text style={styles.detailModalSetInfo}>{item.repeticoes}</Text>
                            <Text style={styles.detailModalSetInfo}>{item.peso || 0} kg</Text>
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Modal de Conclusão de Treino */}
        <WorkoutCompleteModal
          isVisible={isWorkoutCompleteModalVisible}
          onClose={handleCloseCompleteModal}
          duration={workoutDuration}
          exercisesCompleted={treino.exercicios.length}
          weeklyProgress={weeklyProgress}
          weekStreak={weekStreak}
          volumeData={volumeData}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030405' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030405' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 },
  backButton: {},
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 40 },
  exerciseCard: {
    backgroundColor: '#141414',
    borderRadius: 15,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  exerciseVideo: {
    width: 80,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 10,
    marginRight: 15,
  },
  exerciseInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  exerciseName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  exerciseMuscleGroup: { color: '#fff', fontWeight: '300', opacity: 0.65, marginTop: 4 },
  exerciseSectionContainer: {
    width: '100%',
    gap: 10,
  },
  bottomSectionContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 15,
  },
  timerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // REMOVED: All styles related to the progress circle
  // (progressCircleContainer, progressBackground, leftHalfWrapper, rightHalfWrapper, rightProgressLoader, leftProgressLoader, innerCircle)
  timerLabel: { color: '#aaa', fontSize: 18, marginBottom: 10 },
  timerText: { color: '#fff', fontSize: 60, fontWeight: 'bold', letterSpacing: 2 },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 15,
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  detailLabel: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  dropsetScrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dropsetItem: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  currentDropsetItem: {
    borderColor: '#1cb0f6',
    backgroundColor: '#142634',
  },
  dropsetItemLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  dropsetItemValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%' },
  actionButton: { alignItems: 'center', padding: 10, minWidth: 60 },
  actionButtonText: { color: '#fff', marginTop: 8, fontSize: 12 },
  mainActionButton: { backgroundColor: '#1cb0f6', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1cb0f6', shadowOpacity: 0.4, shadowRadius: 8 },
  mainActionButtonText: { color: '#0d181c', fontWeight: 'bold', marginTop: 5, fontSize: 12 },
  modalSafeArea: { flex: 1, backgroundColor: '#0d181c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  progressListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 80,
  },
  timelineContainer: {
    width: 30,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    position: 'absolute',
    top: 24,
  },
  exerciseContent: {
    flex: 1,
    paddingLeft: 10,
    paddingTop: 20,
    paddingBottom: 20,
  },
  completedDot: {
    backgroundColor: '#1cb0f6',
  },
  currentDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0d181c',
    borderWidth: 3,
    borderColor: '#1cb0f6',
    top: 21,
  },
  modalExerciseName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalExerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
  // Edit Exercise Modal Styles
  modalScrollViewContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  button: {
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
  },
  buttonClose: { backgroundColor: "transparent" },
  buttonAdd: { backgroundColor: "#1cb0f6" },
  textStyle: { color: "white", fontWeight: "bold", textAlign: "center" },
  // Styles for set editing in modal
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2f2f2f',
    height: 65,
  },
  setText: {
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
  },
  setInput: {
    backgroundColor: '#2c2c2e',
    flex: 1,
    color: '#fff',
    padding: 8,
    borderRadius: 5,
    textAlign: 'center',
    marginHorizontal: 5,
  },
  addSetButton: {
    padding: 10,
    marginTop: 10,
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center'
  },
  addSetButtonText: { color: '#1cb0f6', fontWeight: 'bold' },
  setMenu: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    marginTop: -5,
    marginBottom: 5,
    zIndex: -1,
    paddingTop: 5,
  },
  setMenuButton: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#444' },
  setMenuText: {
    color: '#fff',
    fontSize: 14,
  },
  // Styles for Exercise Detail Modal
  detailModalContentWrapper: {
    flex: 1,
    padding: 5,
  },
  detailModalVideo: {
    width: '100%',
    aspectRatio: 1, // Proporção 1:1 (quadrado)
    borderRadius: 15,
    backgroundColor: '#000',
    marginBottom: 10,
  },
  detailModalExerciseName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 10,
  },
  detailModalSeriesContainer: {
    backgroundColor: 'transparent',
    marginTop: 15,
  },
  detailModalSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a2a33',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  detailModalSetTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailModalSetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropsetTag: {
    color: '#fff',
    backgroundColor: '#1cb0f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
  },
  detailModalSetInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailModalSetInfo: {
    color: '#ccc',
    fontSize: 16,
    marginLeft: 20,
  },
  // Estilos para o WorkoutCompleteModal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#141414ff', // Fundo sólido para tela cheia
  },
  completeModalContainer: {
    flex: 1,
    backgroundColor: '#141414ff',
    padding: 30,
    flexDirection: 'column',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
  },
  completeModalHeader: {
    alignItems: "center",
    width: '100%',
    paddingBottom: 30,
  },
  completeModalTitle: {
    color: '#fff',
    fontSize: 32, // Aumentado
    fontWeight: 'bold',
    marginBottom: 15, // Alterado para 15
  },
  completeModalSubtitle: {
    color: '#aaa',
    fontSize: 18, // Aumentado
    textAlign: 'center',
  },
  statsSection: {
    width: '100%',
    // marginBottom: 15, // Removido para ser controlado pelo 'gap' do container pai
  },
  allStatsContainer: {
    width: '100%',
    gap: 25,
  },
  bottomContentContainer: {
    flex: 1,
    width: '100%',
  },
  statsSectionTitle: {
    color: '#fff',
    fontSize: 20, // Aumentado
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'left',
  },
  progressItem: {
    marginBottom: 15,
  },
  progressLabel: {
    color: '#ccc',
    fontSize: 18, // Aumentado
    marginBottom: 8,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1cb0f6',
  },
  progressText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'right',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 8,
  },
  streakText: {
    color: '#FFA500',
    fontSize: 16, // Aumentado
    marginLeft: 8,
    fontWeight: 'bold',
  },
  performanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceValue: {
    color: '#fff',
    fontSize: 28, // Aumentado
    fontWeight: 'bold',
    marginTop: 8,
  },
  performanceLabel: {
    color: '#aaa',
    fontSize: 14, // Aumentado
    marginTop: 4,
  },
  continueButton: {
    backgroundColor: '#1cb0f6',
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18, // Aumentado
    fontWeight: 'bold',
  },
  // Volume Card Styles
  volumeCard: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  volumeValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  volumeLabel: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  percentageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 15,
  },
  percentagePositive: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)', // green-700 com 20% de opacidade
  },
  percentageNegative: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)', // red-600 com 20% de opacidade
  },
  percentageText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  historyContainer: {
    marginTop: 20,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
  },
  historyTitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  historyItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  historyValue: {
    color: '#ccc',
    fontSize: 14,
  },
});