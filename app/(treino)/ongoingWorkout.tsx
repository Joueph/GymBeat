import { Exercicio, Serie } from '@/models/exercicio';
import { calculateLoadForSerie, calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av'; // Changed from expo-video
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from "lottie-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'; // Removido FlatList
import { ActivityIndicator, Alert, AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Log } from '@/models/log';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Treino } from '../../models/treino';
import { addLog } from '../../services/logService';
import { cancelNotification, scheduleNotification } from '../../services/notificationService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';
import { EditExerciseModal } from './modals/EditOngoingWorkoutExerciseModal';
import { OngoingWorkoutListModal } from './modals/listaOngoingWorkout';
import { WorkoutOverviewModal } from './modals/modalOverview';
import { WorkoutSettingsModal } from './modals/WorkoutSettingsModal';

// **INÍCIO DA CORREÇÃO**
import { cacheActiveWorkoutLog, getCachedActiveWorkoutLog } from '../../services/offlineCacheService';
import { getTreinoById } from '../../services/treinoService';
// Adiciona a propriedade 'concluido' à interface Serie localmente
interface SerieComStatus extends Omit<Serie, 'concluido'> {
  id: string; // Garante que toda série tenha um ID
  concluido?: boolean;
}
// A interface Serie agora inclui um tipo para diferenciar séries normais de dropsets e um status de conclusão.
interface SerieEdit extends Omit<Serie, 'id'> {
  peso: number;
  repeticoes: any;
  id: string;
  type: 'normal' | 'dropset';
  showMenu?: boolean;
  concluido: boolean;
}

// A new component to manage each video player instance, now with WebP support
export function VideoListItem({ uri, style }: { uri: string; style: any }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const isWebP = uri?.toLowerCase().includes('.webp');

  useEffect(() => {
    const manageMedia = async () => {
      if (!uri) return;
      const fileName = uri.split('/').pop()?.split('?')[0]; // Ensure filename is clean
      if (!fileName) return;

      const localFileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const fileInfo = await FileSystem.getInfoAsync(localFileUri);

      if (fileInfo.exists) {
        setLocalUri(localFileUri);
      } else {
        try {
          await FileSystem.downloadAsync(uri, localFileUri);
          setLocalUri(localFileUri);
        } catch (e) {
          console.error("Erro ao baixar a mídia:", e);
          setLocalUri(uri); // Fallback para a URL remota em caso de erro
        }
      }
    };

    manageMedia();
  }, [uri]);

  if (!localUri) {
    return <View style={[style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color="#fff" /></View>;
  }

  if (isWebP) {
    const { Image } = require('react-native');
    return <Image source={{ uri: localUri || uri }} style={style} />;
  }
  return (
    <Video
      source={{ uri: localUri || uri }}
      isMuted={true}
      isLooping={true}
      shouldPlay={true}
      resizeMode={ResizeMode.COVER}
      style={style}
    />
  );
}

// Componente para exibir os detalhes de uma série normal.
const NormalSetDetails = ({ currentSet, isBodyweight }: { currentSet: Serie, isBodyweight?: boolean }) => (
  <>
    <View style={styles.detailItem}>
      <FontAwesome name={currentSet.isTimeBased ? "clock-o" : "repeat"} size={20} color="#ccc" />
      <Text style={styles.detailValue}>{currentSet.repeticoes}{currentSet.isTimeBased ? 's' : ''}</Text>
      <Text style={styles.detailLabel}>{currentSet.isTimeBased ? "Tempo" : "Repetições"}</Text>
    </View>
    <View style={styles.detailItem}>
      <FontAwesome name="dashboard" size={20} color="#ccc" />
      {isBodyweight ? 
        <Text style={styles.detailValue}>Corporal</Text> : 
        <Text style={styles.detailValue}>{currentSet.peso || 0} kg</Text>}
      <Text style={styles.detailLabel}>Peso</Text>
    </View>
  </>
);

// Componente para exibir um card de exercício individual, agora com os detalhes dentro dele.
const ExerciseDisplayCard = memo(({
  exercise,
  isCurrent,
  completedSets,
  totalNormalSeries,
  completedNormalSeriesCount,
  onPress,
  showDetailsInside, // Nova prop para controlar a exibição dos detalhes
  isPulsing // Nova prop para o efeito de pulsar
}: {
  exercise: Exercicio;
  isCurrent: boolean;
  completedSets: number;
  totalNormalSeries: number;
  completedNormalSeriesCount: number;
  onPress: () => void;
  showDetailsInside: boolean;
  isPulsing: boolean;
}) => {
  const currentSet = isCurrent ? exercise.series[completedSets] : null;

  return (
    <View style={styles.exerciseCardWrapper}>
      <TouchableOpacity style={[styles.exerciseCard, isPulsing && styles.pulsingBorder]} onPress={onPress}>
        {/* ADICIONADO: Verificação para evitar erro se o modelo ou a imagem não existirem */}
        {exercise.modelo?.imagemUrl && (
          <VideoListItem uri={exercise.modelo.imagemUrl} style={styles.exerciseVideo} />
        )}
        <View style={styles.exerciseInfoContainer}>
          <Text style={styles.exerciseName}>{exercise.modelo.nome}</Text>
          <Text style={styles.exerciseMuscleGroup}>{exercise.modelo.grupoMuscular}</Text>
          
          {/* Detalhes agora são condicionais */}
          {showDetailsInside && (
            <View style={styles.inlineDetailsContainer}>
              <View style={styles.detailItem}>
                <FontAwesome name="clone" size={16} color="#ccc" />
                <Text style={styles.detailValue}>{isCurrent ? `${completedNormalSeriesCount}/${totalNormalSeries}` : totalNormalSeries}</Text>
                <Text style={styles.detailLabel}>Séries</Text>
              </View>
              {currentSet && <NormalSetDetails currentSet={currentSet} isBodyweight={exercise.modelo.caracteristicas?.isPesoCorporal} />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

export default function OngoingWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { treinoId, fichaId, logId } = useLocalSearchParams();

  const [treino, setTreino] = useState<Treino | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [horarioInicio, setHorarioInicio] = useState<Date | null>(null);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [isEditExerciseModalVisible, setEditExerciseModalVisible] = useState(false);
  const [isExerciseListVisible, setExerciseListVisible] = useState(false);
  const [isExerciseDetailModalVisible, setExerciseDetailModalVisible] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [biSetToggle, setBiSetToggle] = useState(false);
  const [isBiSetEditing, setIsBiSetEditing] = useState(false);
  const [exercicioSendoEditado, setExercicioSendoEditado] = useState<Exercicio | null>(null);
  const [restStartTime, setRestStartTime] = useState<number | null>(null);
  const [cargaAcumuladaTotal, setCargaAcumuladaTotal] = useState(0);
  const [cargaSerieAnimacao, setCargaSerieAnimacao] = useState<{ key: number; carga: number } | null>(null);
  const [userLogs, setUserLogs] = useState<Log[]>([]);
  const [isOverviewModalVisible, setOverviewModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [workoutScreenType, setWorkoutScreenType] = useState<'simplified' | 'complete'>('complete');
  // Novos estados para o timer do exercício
  const [isDoingExercise, setIsDoingExercise] = useState(false);
  const [exerciseTime, setExerciseTime] = useState(0);
  const [exerciseStartTime, setExerciseStartTime] = useState<number | null>(null);
  const [userWeight, setUserWeight] = useState<number>(0);
  const animationRef = useRef<LottieView>(null);
  
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App voltou para o primeiro plano, cancela a notificação de descanso
        cancelNotification('rest-timer');
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Novo estado para a animação da carga total no header
  const [animatedLoadValue, setAnimatedLoadValue] = useState<number | null>(null);

  useEffect(() => {
    if (cargaSerieAnimacao) {
      const timer = setTimeout(() => { // A animação de fade out começa após 1 segundo
        setCargaSerieAnimacao(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cargaSerieAnimacao]);

  const maxRestTime = useMemo(() => {
    if (!treino) return 0;
    const intervalo = treino.intervalo ?? { min: 1, seg: 0 };
    return intervalo.min * 60 + intervalo.seg;
  }, [treino]);

  const { displayExercise, isBiSet, biSetPartnerExercise } = useMemo(() => {
    if (!treino) return { displayExercise: null, isBiSet: false, biSetPartnerExercise: null };
    const primaryExercise = treino.exercicios[currentExerciseIndex];
    const nextExercise = treino.exercicios[currentExerciseIndex + 1];
    const isPartOfBiSet = nextExercise?.isBiSet ?? false;
    if (isPartOfBiSet) {
      const primary = primaryExercise;
      const secondary = nextExercise;
      return { displayExercise: biSetToggle ? secondary : primary, isBiSet: true, biSetPartnerExercise: biSetToggle ? primary : secondary };
    }
    return { displayExercise: primaryExercise, isBiSet: false, biSetPartnerExercise: null };
  }, [treino, currentExerciseIndex, biSetToggle]);

  const currentExercise = useMemo(() => displayExercise, [displayExercise]);
  const currentSet = useMemo(() => {
    if (!currentExercise || !currentExercise.series) return null;
    return currentExercise.series[completedSets];
  }, [currentExercise, completedSets]);

  const handleEdit = useCallback(() => {
    if (!treino) return;
    if (isBiSetEditing) {
      setIsBiSetEditing(false);
      return;
    }
    if (isBiSet) {
      setIsBiSetEditing(true);
      return;
    }
    openEditModalForExercise(treino.exercicios[currentExerciseIndex]);
  }, [treino, currentExerciseIndex, isBiSet, isBiSetEditing]);

  const openEditModalForExercise = (exercise: Exercicio) => {
    setExercicioSendoEditado(exercise);
    setEditExerciseModalVisible(true);
    setIsBiSetEditing(false);
  };

  const handleShowList = useCallback(() => {
    setExerciseListVisible(true);
  }, []);

useEffect(() => {
  const fetchTreino = async () => {
    if (typeof treinoId !== 'string') {
      Alert.alert("Erro", "ID do treino inválido.");
      router.back();
      return;
    }

    try {
      console.log('[OngoingWorkout] 🔄 Iniciando carregamento do treino...');
      
      // 1. Tenta carregar o log do cache local primeiro
      const cachedLog = await getCachedActiveWorkoutLog();
      
      if (cachedLog && (cachedLog.treino.id === treinoId || logId === cachedLog.id)) {
        console.log('[OngoingWorkout] ✅ Log encontrado no cache');
        
        // --- LOG ADICIONADO ---
        cachedLog.treino.exercicios.forEach((ex: Exercicio, index: number) => {
          if (!ex.modelo) {
            console.error(`[OngoingWorkout - Cache] ERRO: Exercício no índice ${index} (ID: ${ex.modeloId}) está sem 'modelo'.`);
          }
        });
        // --- FIM DO LOG ---
        setTreino(cachedLog.treino);
        setHorarioInicio(toDate(cachedLog.horarioInicio));
        setActiveLogId(cachedLog.id);
        setCargaAcumuladaTotal(cachedLog.cargaAcumulada || 0);

        // Encontra o próximo exercício/série não concluído
        let proximoExercicioIndex = 0;
        let proximaSerieIndex = 0;
        let foundNext = false;
        
        cachedLog.treino.exercicios.forEach((ex: Exercicio, exIndex: number) => {
          if (!foundNext) {
            const nextSetIndex = (ex.series as SerieComStatus[]).findIndex(
              (s: SerieComStatus) => !s.concluido
            );
            if (nextSetIndex !== -1) {
              proximoExercicioIndex = exIndex;
              proximaSerieIndex = nextSetIndex;
              foundNext = true;
            }
          }
        });
        
        setCurrentExerciseIndex(proximoExercicioIndex);
        setCompletedSets(proximaSerieIndex);

        // Tenta buscar dados adicionais (logs e perfil) com fallback para offline
        if (user) {
          try {
            console.log('[OngoingWorkout] 📊 Buscando logs do usuário...');
            const { getLogsByUsuarioId } = require('../../services/logService');
            const logs = await getLogsByUsuarioId(user.id);
            setUserLogs(logs);
            console.log('[OngoingWorkout] ✅ Logs carregados:', logs.length);
          } catch (logsError) {
            console.warn('[OngoingWorkout] ⚠️ Erro ao buscar logs (pode estar offline):', logsError);
            // Define array vazio se falhar - modo offline
            setUserLogs([]);
          }

          try {
            console.log('[OngoingWorkout] 👤 Buscando perfil do usuário...');
            const userProfile = await getUserProfile(user.id);
            if (userProfile) {
              const latestWeight = userProfile.historicoPeso && userProfile.historicoPeso.length > 0
                ? [...userProfile.historicoPeso].sort((a, b) => (b.data as any).toDate().getTime() - (a.data as any).toDate().getTime())[0].valor
                : userProfile.peso;
              if (latestWeight) {
                setUserWeight(latestWeight as number);
                console.log('[OngoingWorkout] ✅ Peso do usuário:', userProfile.peso);
              }
              if (userProfile.workoutScreenType) {
                setWorkoutScreenType(userProfile.workoutScreenType);
              }
            }
          } catch (profileError) {
            console.warn('[OngoingWorkout] ⚠️ Erro ao buscar perfil (pode estar offline):', profileError);
            // Define peso padrão se falhar - modo offline
            setUserWeight(70); // Peso padrão como fallback
          }
        }
        
        setLoading(false);
        console.log('[OngoingWorkout] ✅ Treino carregado do cache com sucesso');
        return; // Retorna aqui para evitar tentar buscar do Firestore
      }

      // 2. Se não há cache, busca do Firestore (requer conexão)
      console.log('[OngoingWorkout] 🔥 Nenhum cache encontrado, buscando do Firestore...');
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const treinoData = await getTreinoById(treinoId);
      
      if (!treinoData || !treinoData.exercicios || treinoData.exercicios.length === 0) {
        Alert.alert(
          "Treino Vazio", 
          "Adicione exercícios para poder iniciá-lo.", 
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      console.log('[OngoingWorkout] ✅ Treino buscado do Firestore');

      // --- LOG ADICIONADO ---
      treinoData.exercicios.forEach((ex: Exercicio, index: number) => {
        if (!ex.modelo) {
          console.error(`[OngoingWorkout - Firestore] ERRO: Exercício no índice ${index} (ID: ${ex.modeloId}) está sem 'modelo'.`);
        }
      });
      // --- FIM DO LOG ---

      // Inicializa o treino
      const startTime = new Date();
      const exerciciosInicializados = treinoData.exercicios.map(ex => ({
        ...ex,
        series: ex.series.map(s => ({ ...s, concluido: false }))
      }));
      
      const treinoComExercicios = { 
        ...treinoData, 
        exercicios: exerciciosInicializados 
      };
      
      setTreino(treinoComExercicios);
      setHorarioInicio(startTime);

      const localLogId = `local_${Date.now()}`;
      setActiveLogId(localLogId);

      // Cria log local
      const localLog: Log = {
        id: localLogId,
        usuarioId: user.id,
        treino: { 
          ...treinoComExercicios, 
          id: treinoId, 
          fichaId: fichaId as string 
        },
        exercicios: exerciciosInicializados,
        horarioInicio: startTime,
        status: 'em_andamento',
        cargaAcumulada: 0,
        exerciciosFeitos: [],
        horarioFim: undefined,
        observacoes: undefined,
        nomeTreino: treinoData.nome,
      };
      
      await cacheActiveWorkoutLog(localLog);
      console.log('[OngoingWorkout] ✅ Log local criado e salvo no cache');

      // Busca dados adicionais com fallback
      try {
        const { getLogsByUsuarioId } = require('../../services/logService');
        const logs = await getLogsByUsuarioId(user.id);
        setUserLogs(logs);
      } catch (logsError) {
        console.warn('[OngoingWorkout] ⚠️ Erro ao buscar logs:', logsError);
        setUserLogs([]);
      }

      try {
        const userProfile = await getUserProfile(user.id);
        if (userProfile) {
          const latestWeight = userProfile.historicoPeso && userProfile.historicoPeso.length > 0
            ? [...userProfile.historicoPeso].sort((a, b) => (b.data as any).toDate().getTime() - (a.data as any).toDate().getTime())[0].valor
            : userProfile.peso;
          if (latestWeight) {
            setUserWeight(latestWeight as number);
          }
          if (userProfile.workoutScreenType) {
            setWorkoutScreenType(userProfile.workoutScreenType);
          }
        }
      } catch (profileError) {
        console.warn('[OngoingWorkout] ⚠️ Erro ao buscar perfil:', profileError);
        setUserWeight(70); // Peso padrão
      }

    } catch (error) {
      console.error("[OngoingWorkout] ❌ ERRO CRÍTICO ao carregar treino:", error);
      
      // Mensagem de erro mais clara para o usuário
      if (error instanceof Error) {
        console.error("[OngoingWorkout] Detalhes:", error.message);
      }
      
      Alert.alert(
        "Erro ao Carregar Treino", 
        "Não foi possível carregar o treino. Verifique sua conexão com a internet e tente novamente.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
      console.log('[OngoingWorkout] 🏁 Carregamento finalizado');
    }
  };
  
  fetchTreino();
}, [treinoId, fichaId, logId, user]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isResting) {
      interval = setInterval(() => {
        if (restStartTime) {
          const elapsedSeconds = Math.floor((Date.now() - restStartTime) / 1000);
          const remainingTime = maxRestTime - elapsedSeconds;
          const newRestTime = Math.max(0, remainingTime);

          // Adiciona feedback tátil para a contagem regressiva
          if (newRestTime === 3 || newRestTime === 2) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else if (newRestTime === 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }

          setRestTime(newRestTime);

          if (newRestTime <= 0) {
            // Vibração mais forte ao final do descanso
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setIsResting(false);
            setRestStartTime(null);
            setRestTime(maxRestTime);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restStartTime, maxRestTime]);

  // Efeito para o timer do exercício (quando isDoingExercise é true)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isDoingExercise && exerciseStartTime) {
      interval = setInterval(() => {
        const initialTime = parseInt(String(currentSet?.repeticoes || '0'), 10);
        const elapsedSeconds = Math.floor((Date.now() - exerciseStartTime) / 1000);
        const remainingTime = Math.max(0, initialTime - elapsedSeconds);
        setExerciseTime(remainingTime);

        if (remainingTime <= 0) {
          setIsDoingExercise(false);
          setExerciseStartTime(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          completeTheSet(); // Chama a lógica de conclusão da série
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isDoingExercise, exerciseStartTime, currentSet]);

const completeTheSet = async () => {
  if (!treino || !user || !currentSet || !currentExercise) return;

  const oldTotalLoad = cargaAcumuladaTotal;
  const { totalLoad: cargaDaSerie } = calculateLoadForSerie(currentSet, currentExercise, userWeight);
  const newTotalLoad = oldTotalLoad + cargaDaSerie;

  if (cargaDaSerie > 0) {
    // Animação da carga da série no centro
    setCargaSerieAnimacao({ key: Date.now(), carga: cargaDaSerie });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animação da carga total no header
    setAnimatedLoadValue(oldTotalLoad);
    setTimeout(() => {
      setAnimatedLoadValue(newTotalLoad);
    }, 1000);
    setTimeout(() => {
      setAnimatedLoadValue(null);
    }, 2000);
  }
  
  // Atualiza o estado da carga total
  setCargaAcumuladaTotal(newTotalLoad);

  // Marca a série como concluída no estado do treino
  const updatedExercicios = [...treino.exercicios];
  const exercicioParaAtualizarIndex = updatedExercicios.findIndex((ex: Exercicio) => ex.modeloId === currentExercise.modeloId);
  if (exercicioParaAtualizarIndex !== -1) {
    const serieAtualIndex = completedSets;
    if ((updatedExercicios[exercicioParaAtualizarIndex].series as SerieComStatus[])[serieAtualIndex]) {
      (updatedExercicios[exercicioParaAtualizarIndex].series as SerieComStatus[])[serieAtualIndex].concluido = true;
    }
    // Se for um bi-set, marca a série do parceiro também
    if (isBiSet && (updatedExercicios[exercicioParaAtualizarIndex + 1]?.series as SerieComStatus[])[serieAtualIndex]) {
      (updatedExercicios[exercicioParaAtualizarIndex + 1].series as SerieComStatus[])[serieAtualIndex].concluido = true;
    }
    setTreino({ ...treino, exercicios: updatedExercicios });
  }

  const newCompletedSets = completedSets + 1;
  
  // Salva no cache local
  const updatedLogForCache: Log = {
    id: activeLogId!,
    usuarioId: user.id,
    treino: { ...treino, exercicios: updatedExercicios },
    horarioInicio: horarioInicio!,
    status: 'em_andamento',
    cargaAcumulada: newTotalLoad,
    exercicios: updatedExercicios,
    exerciciosFeitos: [],
    observacoes: undefined,
    nomeTreino: treino.nome
  };
  await cacheActiveWorkoutLog(updatedLogForCache);

  if (newCompletedSets >= currentExercise.series.length) {
    const jump = isBiSet ? 2 : 1;
    const nextIndex = currentExerciseIndex + jump;
    if (nextIndex < treino.exercicios.length) {
      setCurrentExerciseIndex(nextIndex);
      setCompletedSets(0);
    } else {
      // FIM DO TREINO
      console.log('[OngoingWorkout] 🎉 Treino finalizado!');
      const horarioFim = new Date();
      const isLocalLog = activeLogId?.startsWith('local_');

      try {
        if (activeLogId && user) {
          console.log('[OngoingWorkout] 💾 Salvando log final...');
          
          // ✅ CORREÇÃO: Criar objeto completo do log final
          const finalTreinoId = treino.id || (treinoId as string);
          const finalFichaId = treino.fichaId || (fichaId as string);

          if (!finalTreinoId || !finalFichaId) {
            console.error('[OngoingWorkout] ERRO CRÍTICO: Treino ID ou Ficha ID estão faltando ao finalizar o log.', { finalTreinoId, finalFichaId });
            throw new Error('Não foi possível salvar o log: IDs de treino ou ficha ausentes.');
          }

          const finalLogData: Partial<Log> = {
            usuarioId: user.id, // ✅ SEMPRE incluir usuarioId
            treino: {
              ...treino,
              id: finalTreinoId,
              fichaId: finalFichaId,
              exercicios: updatedExercicios
            },
            exercicios: updatedExercicios,
            horarioInicio: horarioInicio!,
            horarioFim: horarioFim,
            status: 'concluido',
            cargaAcumulada: newTotalLoad,
            exerciciosFeitos: updatedExercicios
              .filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido)),
            nomeTreino: treino.nome
          };

          console.log('[OngoingWorkout] 📤 Dados do log final:', {
            hasUsuarioId: !!finalLogData.usuarioId,
            hasTreino: !!finalLogData.treino,
            treinoId: finalLogData.treino?.id,
            fichaId: finalLogData.treino?.fichaId,
            isLocalLog
          });

          const finalLogId = await addLog(
            finalLogData, 
            isLocalLog ? undefined : activeLogId
          );

          console.log('[OngoingWorkout] ✅ Log salvo com sucesso:', finalLogId);

          // Limpa o cache local
          await cacheActiveWorkoutLog(null);
          console.log('[OngoingWorkout] 🗑️ Cache limpo');

          router.replace({ 
            pathname: './treinoCompleto', 
            params: { logId: finalLogId } 
          });
        }
      } catch (error) {
        console.error('[OngoingWorkout] ❌ Erro ao salvar log final:', error);
        
        // Log mais detalhado do erro
        if (error instanceof Error) {
          console.error('[OngoingWorkout] Mensagem:', error.message);
          console.error('[OngoingWorkout] Stack:', error.stack);
        }
        
        Alert.alert(
          "Erro ao Salvar", 
          "Não foi possível salvar seu progresso. Verifique sua conexão e tente novamente.", 
          [
            { 
              text: "Tentar Novamente", 
              onPress: () => {
                // Tenta salvar novamente
                completeTheSet();
              }
            },
            { 
              text: "Sair Mesmo Assim", 
              style: "destructive",
              onPress: () => router.back() 
            }
          ]
        );
      }
      return;
    }
  } else {
    setCompletedSets(newCompletedSets);
  }

  const restStartTimestamp = Date.now();
  setRestStartTime(restStartTimestamp);
  setIsResting(true);

  // Agenda notificação se o app estiver em background
  if (appState.current !== 'active') {
    scheduleNotification('rest-timer', 'Intervalo finalizado!', 'Seu descanso acabou. Hora de voltar ao treino!', { seconds: maxRestTime });
  }
  };

  const handleMainAction = () => {
    if (!currentSet) return;

    // Se a série for baseada em tempo, inicia o timer do exercício
    if (currentSet.isTimeBased) {
      const duration = parseInt(String(currentSet.repeticoes), 10);
      if (!isNaN(duration) && duration > 0) {
        setExerciseTime(duration);
        setExerciseStartTime(Date.now());
        setIsDoingExercise(true);
      }
    } else { // Caso contrário, completa a série normalmente
      completeTheSet();
    }
  };

  const handleSkipRest = async () => {
    if (isResting) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsResting(false);
      setRestStartTime(null);
      cancelNotification('rest-timer');
      setRestTime(maxRestTime);
    }
  };

  const handleSaveExerciseChanges = async (newSeries: SerieEdit[], pesoBarra?: number) => {
    if (!treino || !exercicioSendoEditado) return;

    const seriesComConcluido = newSeries.map(s => ({...s, concluido: s.concluido || false}));
    
    // Cria uma cópia atualizada dos exercícios com as novas séries
    const updatedExercicios = [...treino.exercicios];
    const editedExerciseIndex = updatedExercicios.findIndex(ex => ex.modeloId === exercicioSendoEditado.modeloId);

    if (editedExerciseIndex === -1) {
      console.error("Não foi possível encontrar o exercício para atualizar.");
      setEditExerciseModalVisible(false);
      return;
    }

    // Atualiza o exercício específico
    const updatedExercise = {
      ...exercicioSendoEditado,
      series: seriesComConcluido,
      pesoBarra: pesoBarra, // Salva o peso da barra
    };
    updatedExercicios[editedExerciseIndex] = updatedExercise;
    const isLeaderOfBiSet = !updatedExercise.isBiSet && updatedExercicios[editedExerciseIndex + 1]?.isBiSet;

    // Se for um bi-set, sincroniza as séries do exercício parceiro
    if (isLeaderOfBiSet) {
      const partnerExercise = { ...updatedExercicios[editedExerciseIndex + 1] };
      const oldPartnerSeries = partnerExercise.series;
      const newPartnerSeries = updatedExercise.series.map((leaderSerie, index) => {
        const oldPartnerSet = oldPartnerSeries[index];
        return { ...leaderSerie, repeticoes: oldPartnerSet?.repeticoes || leaderSerie.repeticoes, peso: oldPartnerSet?.peso ?? leaderSerie.peso };
      });
      partnerExercise.series = newPartnerSeries;
      updatedExercicios[editedExerciseIndex + 1] = partnerExercise;
    }

    // Atualiza o estado do treino com os exercícios modificados
    setTreino(prevTreino => prevTreino ? { ...prevTreino, exercicios: updatedExercicios } : null);

    // **INÍCIO DA CORREÇÃO**
    // Recalcula a carga total acumulada com base em TODAS as séries concluídas
    const novaCargaTotal = calculateTotalVolume(updatedExercicios, userWeight, true);
    setCargaAcumuladaTotal(novaCargaTotal);

    // Salva o log atualizado no cache local com a nova carga
    const updatedLogForCache: Partial<Log> = {
      id: activeLogId!,
      usuarioId: user!.id,
      treino: { ...treino, exercicios: updatedExercicios }, // Garante que o treino dentro do log também está atualizado
      horarioInicio: horarioInicio!,
      exercicios: updatedExercicios,
      cargaAcumulada: novaCargaTotal, // Salva a nova carga recalculada
    };
    await cacheActiveWorkoutLog(updatedLogForCache as Log);
    // **FIM DA CORREÇÃO**

    setEditExerciseModalVisible(false);
    setExercicioSendoEditado(null);
  };
  
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleBack = () => {
    const exitWorkout = async () => {
      // Limpa o cache do treino ativo sem salvar no Firestore.
      await cacheActiveWorkoutLog(null);
      cancelNotification('rest-timer');
      router.back();
    };
    
    Alert.alert(
      "Sair do Treino?", 
      "Seu progresso será perdido. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: exitWorkout }
      ]
    );
  };
  const { isDropsetSequence, dropsetGroup } = useMemo(() => {
    if (!treino || !treino.exercicios[currentExerciseIndex]) return { isDropsetSequence: false, dropsetGroup: [] };
    const series = treino.exercicios[currentExerciseIndex].series;
    const currentSetIndex = completedSets;
    const isFollowedByDropset = (series[currentSetIndex + 1]?.type || 'normal') === 'dropset';
    const isCurrentSetADropset = (series[currentSetIndex]?.type || 'normal') === 'dropset';
    if (!isFollowedByDropset && !isCurrentSetADropset) return { isDropsetSequence: false, dropsetGroup: [] };
    let startIndex = currentSetIndex;
    while (startIndex > 0 && (series[startIndex]?.type || 'normal') === 'dropset') startIndex--;
    let endIndex = startIndex;
    while (endIndex + 1 < series.length && (series[endIndex + 1]?.type || 'normal') === 'dropset') endIndex++;
    return { isDropsetSequence: true, dropsetGroup: series.slice(startIndex, endIndex + 1) };
  }, [treino, currentExerciseIndex, completedSets]);

  const { totalNormalSeries, completedNormalSeriesCount } = useMemo(() => {
    if (!treino) return { totalNormalSeries: 0, completedNormalSeriesCount: 0 };
    const currentSeries = treino.exercicios[currentExerciseIndex].series;
    const total = currentSeries.filter(s => (s.type || 'normal') === 'normal').length;
    const completedCount = currentSeries.slice(0, completedSets + 1).filter(s => (s.type || 'normal') === 'normal').length;
    return { totalNormalSeries: total, completedNormalSeriesCount: completedCount };
  }, [treino, currentExerciseIndex, completedSets]);

  const lottieSource = useMemo(() => {
    if (!currentExercise) return null;

    const totalSeriesCount = currentExercise.series.filter(s => (s.type || 'normal') === 'normal').length;
    const currentSetNumber = completedNormalSeriesCount; // Usa a contagem de séries normais

    if (totalSeriesCount === 1) {
        return require('../../assets/images/ongoingWorkout/Ultima-serie.json');
    }

    if (totalSeriesCount === 2) {
        if (currentSetNumber === 1) {
            return require('../../assets/images/ongoingWorkout/Apenas-duas-series.json');
        } else { // currentSetNumber === 2
            return require('../../assets/images/ongoingWorkout/Ultima-serie.json');
        }
    }

    if (currentSetNumber === 1) {
        return require('../../assets/images/ongoingWorkout/Primeira-serie.json');
    } else if (currentSetNumber < totalSeriesCount - 1) {
        return require('../../assets/images/ongoingWorkout/Serie-intermediaria.json');
    } else { // currentSetNumber === totalSeriesCount
        return require('../../assets/images/ongoingWorkout/Ultima-serie.json');
    }
  }, [currentExercise, completedNormalSeriesCount]);

  const handleLottiePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animationRef.current?.play();
  };

  const handleEditFromList = (exercise: Exercicio) => {
    setExerciseListVisible(false); // Fecha o modal da lista
    // Um pequeno atraso para garantir que a transição entre modais seja suave
    setTimeout(() => {
      openEditModalForExercise(exercise);
    }, 300);
  };

  const { totalNormalSeries: partnerTotalNormalSeries } = useMemo(() => {
    if (!treino || !treino.exercicios[currentExerciseIndex + 1]) return { totalNormalSeries: 0 };
    return { totalNormalSeries: treino.exercicios[currentExerciseIndex + 1].series.filter(s => (s.type || 'normal') === 'normal').length };
  }, [treino, currentExerciseIndex]);

  if (loading || !treino) {
    return <ActivityIndicator style={styles.container} size="large" color="#fff" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {cargaSerieAnimacao && (
          <Animated.View key={cargaSerieAnimacao.key} style={styles.cargaAnimacaoContainer} entering={FadeIn.duration(300)} exiting={FadeOutUp.duration(800)}>
            <Text style={styles.cargaAnimacaoText}>+{Math.round(cargaSerieAnimacao.carga)} kg</Text>
          </Animated.View>
        )}
        <View style={styles.header}>
            <View style={[styles.backButton, {flexDirection: 'row', alignItems: 'center', gap: 20}]}>
              <TouchableOpacity onPress={handleBack}>
                  <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSettingsModalVisible(true)}>
                  <FontAwesome name="cog" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerTitle}>Treino Rolando</Text>
            {/* O botão de overview foi movido para o container de ações principal */}
            <View style={styles.headerIconContainer} />
        </View>
        <View style={styles.content}>
          <View style={styles.timerContainer}>
            {isDoingExercise && (
              <Animated.View style={styles.exerciseTimerContainer} entering={FadeIn.duration(300)}>
                <Text style={styles.exerciseTimerLabel}>Exercício</Text>
                <Text style={styles.exerciseTimerText}>{formatTime(exerciseTime)}</Text>
              </Animated.View>
            )}
            <TouchableOpacity 
              style={[styles.restTimerContainer, isDoingExercise && styles.restTimerContainerFaded]} 
              onPress={handleSkipRest} 
              disabled={!isResting}
            >
              <Text style={[styles.timerLabel, isDoingExercise && styles.timerLabelFaded]}>Intervalo</Text>
              <Text style={[styles.timerText, isDoingExercise && styles.timerTextFaded]}>{isResting ? formatTime(restTime) : formatTime(maxRestTime)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSectionContainer}>
            <View style={styles.exerciseSectionContainer}>
              {isBiSet && biSetPartnerExercise ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
                    <ExerciseDisplayCard exercise={treino.exercicios[currentExerciseIndex]} isCurrent={true} completedSets={completedSets} totalNormalSeries={totalNormalSeries} completedNormalSeriesCount={completedNormalSeriesCount} onPress={() => { isBiSetEditing ? openEditModalForExercise(treino.exercicios[currentExerciseIndex]) : setExerciseDetailModalVisible(true); }} showDetailsInside={true} isPulsing={isBiSetEditing} />
                    <FontAwesome name="link" size={20} color="#1cb0f6" />
                    <ExerciseDisplayCard exercise={biSetPartnerExercise} isCurrent={true} completedSets={completedSets} totalNormalSeries={partnerTotalNormalSeries} completedNormalSeriesCount={completedNormalSeriesCount} onPress={() => { isBiSetEditing ? openEditModalForExercise(biSetPartnerExercise) : setExerciseDetailModalVisible(true); }} showDetailsInside={true} isPulsing={isBiSetEditing} />
                  </View>
                  {isDropsetSequence && (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropsetScrollContainer}>{currentSet && dropsetGroup.map((set, index) => { if (!treino.exercicios[currentExerciseIndex].series.some(s => s.type === 'dropset')) return null; const isCurrent = set.id === currentSet.id; return (<View key={set.id} style={[styles.dropsetItem, isCurrent && styles.currentDropsetItem]}><Text style={styles.dropsetItemLabel}>{index === 0 ? 'Série' : 'Drop'}</Text><Text style={styles.dropsetItemValue}>{set.repeticoes}</Text><Text style={styles.dropsetItemValue}>{set.peso || 0}kg</Text></View>); })}</ScrollView>)}
                </>
              ) : currentExercise && (
                <><ExerciseDisplayCard exercise={currentExercise} isCurrent={true} completedSets={completedSets} totalNormalSeries={totalNormalSeries} completedNormalSeriesCount={completedNormalSeriesCount} onPress={() => { setExerciseDetailModalVisible(true); }} showDetailsInside={false} isPulsing={false} />
                  <View style={styles.detailsContainer}><View style={styles.detailItem}><FontAwesome name="clone" size={20} color="#ccc" /><Text style={styles.detailValue}>{completedNormalSeriesCount}/{totalNormalSeries}</Text><Text style={styles.detailLabel}>Séries</Text></View>{currentSet && <NormalSetDetails currentSet={currentSet} isBodyweight={currentExercise.modelo.caracteristicas?.isPesoCorporal} />}</View>
                  {isDropsetSequence && (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropsetScrollContainer}>{currentSet && dropsetGroup.map((set, index) => { const isCurrent = set.id === currentSet.id; return (<View key={set.id} style={[styles.dropsetItem, isCurrent && styles.currentDropsetItem]}><Text style={styles.dropsetItemLabel}>{index === 0 ? 'Série' : 'Drop'}</Text><Text style={styles.dropsetItemValue}>{set.repeticoes}</Text><Text style={styles.dropsetItemValue}>{set.peso || 0}kg</Text></View>); })}</ScrollView>)}</>
              )}
            </View>
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleEdit}><FontAwesome name={isBiSetEditing ? "check" : "pencil"} size={24} color={isBiSetEditing ? "#1cb0f6" : "#fff"} /><Text style={[styles.actionButtonText, isBiSetEditing && { color: '#1cb0f6' }]}>Editar</Text></TouchableOpacity>
              
              {currentSet?.isTimeBased ? (
                <TouchableOpacity style={styles.mainActionButton} onPress={handleMainAction}>
                  <FontAwesome name="play" size={40} color="#0d181c" />
                  <Text style={styles.mainActionButtonText}>Iniciar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleLottiePress} style={styles.lottieButtonContainer}>
                  <LottieView
                    ref={animationRef}
                    style={styles.lottieAnimation}
                    source={lottieSource}
                    autoPlay={false}
                    loop={false}
                    onAnimationFinish={completeTheSet}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={() => setOverviewModalVisible(true)}>
                <FontAwesome name="bar-chart" size={24} color="#fff" /><Text style={styles.actionButtonText}>Resumo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <OngoingWorkoutListModal
          visible={isExerciseListVisible}
          onClose={() => setExerciseListVisible(false)}
          treino={treino} currentExerciseIndex={0} onEditExercise={function (exercise: Exercicio): void {
            throw new Error('Function not implemented.');
          } }        />

        <EditExerciseModal
          visible={isEditExerciseModalVisible}
          onClose={() => setEditExerciseModalVisible(false)}
          exercise={exercicioSendoEditado}
          onSave={handleSaveExerciseChanges}
          />
        <Modal visible={isExerciseDetailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExerciseDetailModalVisible(false)}>
          <SafeAreaView style={styles.modalSafeArea}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Detalhes do Exercício</Text><TouchableOpacity onPress={() => setExerciseDetailModalVisible(false)}><FontAwesome name="close" size={24} color="#fff" /></TouchableOpacity></View><View style={styles.detailModalContentWrapper}><ScrollView><View>{currentExercise?.modelo.imagemUrl && <VideoListItem uri={currentExercise.modelo.imagemUrl} style={styles.detailModalVideo} />}<Text style={styles.detailModalExerciseName}>{currentExercise?.modelo.nome}</Text></View><View style={styles.detailModalSeriesContainer}>{(() => { let normalSeriesCounter = 0; return currentExercise?.series.map((item, index) => { const isDropset = item.type === 'dropset'; if (!isDropset) normalSeriesCounter++; return (<View key={item.id || `serie-detail-${index}`} style={[styles.detailModalSetRow, isDropset && { marginLeft: 20 }]}><View style={styles.detailModalSetTitleContainer}>{isDropset && <FontAwesome5 name="arrow-down" size={14} color="#ccc" style={{ marginRight: 8 }} />}<Text style={styles.detailModalSetText}>{isDropset ? 'Dropset' : `Série ${normalSeriesCounter}`}</Text></View>{isDropset && <Text style={styles.dropsetTag}>DROPSET</Text>}<View style={styles.detailModalSetInfoContainer}><Text style={styles.detailModalSetInfo}>{item.repeticoes}</Text><Text style={styles.detailModalSetInfo}>{item.peso || 0} kg</Text></View></View>); }); })()}</View></ScrollView></View></SafeAreaView>
        </Modal>
        
        {treino && <WorkoutOverviewModal
          visible={isOverviewModalVisible}
          onClose={() => setOverviewModalVisible(false)}
          treino={treino}
          currentExerciseIndex={currentExerciseIndex}
          cargaAcumuladaTotal={cargaAcumuladaTotal}
          userLogs={userLogs}
          horarioInicio={horarioInicio}
          userWeight={userWeight}
          onEditExercise={(exerciseToEdit: Exercicio) => {
            setOverviewModalVisible(false); // Fecha o modal de resumo
            // Adiciona um pequeno atraso para a transição ser mais suave
            setTimeout(() => openEditModalForExercise(exerciseToEdit), 300);
          }}
        />}

        <WorkoutSettingsModal
          isVisible={isSettingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
          currentWorkoutScreenType={workoutScreenType}
          onWorkoutScreenTypeChange={setWorkoutScreenType}
        />

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#030405' },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030405' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, height: 60 },
    backButton: { flex: 1, alignItems: 'flex-start' },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    headerIconContainer: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
    accumulatedLoadContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1f1f1f', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    accumulatedLoadText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cargaAnimacaoContainer: { position: 'absolute', top: 110, right: 20, zIndex: 10, padding: 5 },
    cargaAnimacaoText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    content: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 40 },
    exerciseCard: { backgroundColor: '#141414', borderRadius: 15, width: '100%', flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#ffffff1a' },
    exerciseVideo: { width: 80, height: 80, backgroundColor: '#000', borderRadius: 10, marginRight: 15 },
    pulsingBorder: { borderWidth: 2, borderColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10 },
    exerciseInfoContainer: { flex: 1, justifyContent: 'center' },
    exerciseName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    exerciseMuscleGroup: { color: '#fff', fontWeight: '300', opacity: 0.65, marginTop: 4 },
    exerciseSectionContainer: { width: '100%', gap: 0 },
    exerciseCardWrapper: { flex: 1, gap: 10 },
    biSetLinker: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginVertical: -5, zIndex: -1 },
    biSetToggleText: { color: '#1cb0f6', fontWeight: 'bold', fontSize: 12 },
    bottomSectionContainer: { width: '100%', alignItems: 'center', gap: 15 },
    timerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', gap: 20 },
    exerciseTimerContainer: {
      alignItems: 'center',
    },
    exerciseTimerLabel: {
      color: '#1cb0f6',
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    exerciseTimerText: {
      color: '#fff',
      fontSize: 80,
      fontWeight: 'bold',
      fontVariant: ['tabular-nums'],
    },
    restTimerContainer: {
      alignItems: 'center',
    },
    restTimerContainerFaded: {
      opacity: 0.4,
    },
    timerLabel: { color: '#aaa', fontSize: 18, marginBottom: 10 },
    timerLabelFaded: { fontSize: 14, marginBottom: 5 },
    timerText: { color: '#fff', fontSize: 60, fontWeight: 'bold', letterSpacing: 2 },
    timerTextFaded: { fontSize: 40 },
    inlineDetailsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ffffff1a' },
    detailsContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingVertical: 15, borderRadius: 15 },
    detailItem: { alignItems: 'center', flex: 1 },
    detailValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
    detailLabel: { color: '#aaa', fontSize: 14, marginTop: 5 },
    dropsetScrollContainer: { flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
    dropsetItem: { alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 4, borderRadius: 10, backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: 'transparent' },
    currentDropsetItem: { borderColor: '#1cb0f6', backgroundColor: '#142634' },
    dropsetItemLabel: { color: '#aaa', fontSize: 12, marginBottom: 4 },
    dropsetItemValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    actionsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%' },
    actionButton: { alignItems: 'center', padding: 10, minWidth: 60 },
    actionButtonText: { color: '#fff', marginTop: 8, fontSize: 12 },
    mainActionButton: { backgroundColor: '#1cb0f6', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#1cb0f6', shadowOpacity: 0.4, shadowRadius: 8,  },
    lottieButtonContainer: {
      width: 120, 
      height: 120, 
      alignItems: 'center', 
      justifyContent: 'center'
    },
    lottieAnimation: {
    width: 120,
    height: 120,
    },
    mainActionButtonText: { color: '#0d181c', fontWeight: 'bold', marginTop: 5, fontSize: 12 },
    modalSafeArea: { flex: 1, backgroundColor: '#141414' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' , marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    progressListItem: { flexDirection: 'row', alignItems: 'center', minHeight: 80 },
    timelineContainer: { width: 30, alignItems: 'center', alignSelf: 'stretch' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', position: 'absolute', top: 24 },
    exerciseContent: { flex: 1, paddingLeft: 10, paddingTop: 20, paddingBottom: 20 },
    completedDot: { backgroundColor: '#1cb0f6' },
    currentDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0d181c', borderWidth: 3, borderColor: '#1cb0f6', top: 21 },
    modalExerciseName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    modalExerciseDetails: { color: '#aaa', fontSize: 14, marginTop: 4 },
    editListButton: {
      padding: 15,
      alignSelf: 'center',
    },
    modalScrollViewContent: { padding: 20, paddingBottom: 40 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    button: { borderRadius: 10, padding: 10, elevation: 2, flex: 1, marginHorizontal: 5 },
    buttonClose: { backgroundColor: "transparent" },
    buttonAdd: { backgroundColor: "#1cb0f6" },
    textStyle: { color: "white", fontWeight: "bold", textAlign: "center" },
    detailModalContentWrapper: { flex: 1, padding: 5 },
    detailModalVideo: { width: '100%', aspectRatio: 1, borderRadius: 15, backgroundColor: '#000', marginBottom: 10 },
    detailModalExerciseName: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', paddingVertical: 10 },
    detailModalSeriesContainer: { backgroundColor: 'transparent', marginTop: 15 },
    detailModalSetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a2a33', padding: 15, borderRadius: 10, marginBottom: 10, },
    detailModalSetTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    detailModalSetText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    dropsetTag: { color: '#fff', backgroundColor: '#1cb0f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10 },
    detailModalSetInfoContainer: { flexDirection: 'row', alignItems: 'center' },
    detailModalSetInfo: { color: '#ccc', fontSize: 16, marginLeft: 20 },
});
