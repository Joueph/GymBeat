import { calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'; // Adicionado ThemedText
import * as StoreReview from 'expo-store-review';
// import { VideoView as Video, useVideoPlayer } from 'expo-video'; // Removido
import { doc, getDoc } from 'firebase/firestore';
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Adicionado Svg, Circle
// import { BarChart, LineChart } from 'react-native-chart-kit'; // Removido
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { SvgUri } from 'react-native-svg'; // Removido
import { db } from '../../firebaseconfig';
import { Serie } from '../../models/exercicio';
import { Log } from '../../models/log';
import { getLogsByUsuarioId } from '../../services/logService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';
// --- Imports dos novos componentes ---
import { Ficha } from '@/models/ficha';
import { Treino } from '@/models/treino';
import { getTreinosByIds } from '@/services/treinoService';
import { widgetService } from '@/services/widgetService';
import Svg, { Circle } from 'react-native-svg';
import { HistoricoCargaTreinoChart } from '../../components/charts/HistoricoCargaTreinoChart';
import { ExpandableExerciseItem } from '../../components/exercicios/ExpandableExerciseItem';

const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => (
  <View style={styles.stepIndicatorContainer}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <View
        key={index}
        style={[styles.stepDot, index <= currentStep && styles.stepDotActive]}
      />
    ))}
  </View>
);

const ProgressCircle = ({ progress, size = 32, strokeWidth = 2.5 }: { progress: number, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Círculo de fundo */}
        <Circle
          stroke="#888"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        {/* Arco de progresso */}
        <Circle
          stroke="#3B82F6"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
};
const ProgressBar = memo(({ progress }: { progress: number }) => (
  // ... (código existente da ProgressBar)
  <View style={styles.progressBarBackground}>
    <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
  </View>
));

interface SerieComStatus extends Omit<Serie, 'concluido'> {
  concluido?: boolean;
}

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};


const toDate = (date: any): Date | null => {
  // ... (código existente de toDate)
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const getStartOfWeek = (date: Date): Date => {
  // ... (código existente de getStartOfWeek)
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); // Semana começa na Segunda
  d.setHours(0, 0, 0, 0);
  return d;
};

// --- Funções movidas para os componentes ---
// parseReps (não está sendo usado, pode ser removido se não for)
// calculateLoadForExercise (movido)
// calculateVolume (movido)
// MediaDisplay (movido)
// ExerciseHistoryChart (movido)
// ExpandableExerciseItem (movido)
// --- Fim das funções movidas ---

const formatDuration = (totalSeconds: number) => {
  // ... (código existente de formatDuration)
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


export default function TreinoCompletoScreen() {
  const router = useRouter();
  // ... (código existente de hooks)
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const { logId } = useLocalSearchParams<{ logId: string }>();

  const [loading, setLoading] = useState(true);
  // ... (código existente do state)
  const [log, setLog] = useState<Log | null>(null);
  const [duration, setDuration] = useState(0);
  const [weeklyProgress, setWeeklyProgress] = useState({ completed: 0, total: 2 });
  const [scheduledTreinos, setScheduledTreinos] = useState<Treino[]>([]); // Novo estado para treinos da ficha
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [weekStreak, setWeekStreak] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [allUserLogs, setAllUserLogs] = useState<Log[]>([]);
  const [userWeight, setUserWeight] = useState(70); // Fallback

  // Animação para o gráfico de barras
  const chartHeight = useSharedValue(0);
  const animatedChartStyle = useAnimatedStyle(() => {
    // ... (código existente de animatedChartStyle)
    return {
      height: chartHeight.value,
    };
  });

  // Função para disparar a animação
  const handleChartDataReady = (hasData: boolean) => {
    if (hasData) {
      chartHeight.value = withTiming(220, {
        duration: 800,
        easing: Easing.out(Easing.exp),
      });
    }
  };


  useEffect(() => {
    // ... (código existente de useEffect fetch)
    if (!logId || !user) {
      Alert.alert("Erro", "Não foi possível carregar os dados do treino.");
      router.back();
      return;
    }

    const fetchData = async () => {
      try {
        const logRef = doc(db, 'logs', logId);
        // ... (código existente de getDoc)
        const logSnap = await getDoc(logRef);
        if (!logSnap.exists()) throw new Error("Log não encontrado.");

        // DEBUG: Log para verificar a estrutura do log concluído
        console.log('[TreinoCompleto] Log data from Firestore:', logSnap.data());

        const completedLog = { id: logSnap.id, ...logSnap.data() } as Log;

        // DEBUG: Log para verificar o objeto 'treino' dentro do log
        if (!completedLog.treino) {
          console.error('[TreinoCompleto] ERRO: O log recuperado não possui a propriedade "treino".', completedLog);
        }

        setLog(completedLog);

        const inicio = toDate(completedLog.horarioInicio);
        const fim = toDate(completedLog.horarioFim);
        let durationSecs = 0;
        if (inicio && fim) {
          durationSecs = Math.round((fim.getTime() - inicio.getTime()) / 1000);
          setDuration(durationSecs);
        }

        // NOVO: Atualiza o Widget para estado 'completed'
        const exercisesDone = completedLog.exercicios.filter(ex =>
          ex.series.length > 0 && ex.series.every(s => (s as any).concluido !== false)
        ).length;

        const widgetData = {
          name: completedLog.treino?.nome || "Treino",
          muscleGroup: completedLog.treino?.nome || "",
          duration: formatDuration(durationSecs),
          isCompleted: true,
          dayLabel: "HOJE",
          status: 'completed',
          exercisesDone: exercisesDone,
          totalExercises: completedLog.exercicios.length,
          lastUpdate: Date.now()
        };

        // Import dinâmico ou uso do módulo global se disponível
        // Como notifications-live-activity é um módulo, precisamos importá-lo.
        // Vou assumir que posso importá-lo no topo do arquivo.

        await calculateCompletionData(completedLog);

        // Chamada do widget
        const { setWidgetData } = require('../../modules/notifications-live-activity');
        setWidgetData("widget_today_workout", JSON.stringify(widgetData));

      } catch (error) {
        // ... (código existente de catch)
        console.error("Failed to fetch workout data:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados do treino.");
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [logId, user]);

  const calculateCompletionData = async (completedLog: Log) => {
    // ... (código existente de calculateCompletionData)
    if (!user) return;
    const { getFichaAtiva } = require('../../services/fichaService');
    try {
      const [userProfile, userLogs, fichaAtiva] = await Promise.all([
        // ... (código existente de promise.all)
        getUserProfile(user.id),
        getLogsByUsuarioId(user.id),
        getFichaAtiva(user.id)
      ]);
      setAllUserLogs(userLogs); // Guarda todos os logs para os componentes filhos

      // CORREÇÃO: Obter o peso mais recente do histórico de peso.
      const latestWeight = userProfile?.historicoPeso && userProfile.historicoPeso.length > 0
        ? userProfile.historicoPeso[userProfile.historicoPeso.length - 1].valor : null;
      if (latestWeight) {
        setUserWeight(latestWeight);
      }

      setActiveFicha(fichaAtiva);
      const streakGoal = userProfile?.streakGoal || 2;
      // ... (código existente de streak)
      const today = new Date();
      const startOfThisWeek = getStartOfWeek(today);

      const workoutsThisWeekCount = userLogs.filter(log => {
        const logDate = toDate(log.horarioFim);
        return logDate && logDate >= startOfThisWeek;
      }).length;

      setWeeklyProgress({ completed: workoutsThisWeekCount, total: streakGoal });

      const workoutsByWeek: { [weekStart: string]: number } = {};
      // ... (código existente de workoutsByWeek)
      userLogs.forEach(log => {
        const logDate = toDate(log.horarioFim);
        if (logDate) {
          const weekStartDate = getStartOfWeek(logDate);
          const weekStartString = weekStartDate.toISOString().split('T')[0];
          workoutsByWeek[weekStartString] = (workoutsByWeek[weekStartString] || 0) + 1;
        }
      });

      let currentStreak = 0;
      // ... (código existente de currentStreak)
      let weekToCheck = startOfThisWeek;
      while (true) {
        const weekString = weekToCheck.toISOString().split('T')[0];
        if ((workoutsByWeek[weekString] || 0) >= streakGoal) {
          currentStreak++;
          weekToCheck.setDate(weekToCheck.getDate() - 7);
        } else { break; }
      }
      setWeekStreak(currentStreak);

      const volAtual = completedLog.cargaAcumulada || calculateTotalVolume(completedLog.exercicios, latestWeight || 70, true);
      setCurrentVolume(volAtual);

      if (fichaAtiva && fichaAtiva.treinos.length > 0) {
        const treinosFicha = await getTreinosByIds(fichaAtiva.treinos);

        // Garante que o log atual (completedLog) esteja na lista passada para o widget
        // caso o fetch do banco ainda não o tenha trazido.
        const logsAtualizados = [...userLogs];
        const logJaExiste = logsAtualizados.some(l => l.id === completedLog.id);
        if (!logJaExiste) {
          logsAtualizados.push(completedLog);
        }

        // Atualiza widgets com a lista garantida
        widgetService.updateAll(treinosFicha, logsAtualizados);
      }

    } catch (error) { console.error("Error calculating completion data:", error); }
  };

  const handleCloseAndReview = async () => {
    // Verifica se o pop-up de avaliação está disponível no dispositivo
    if (await StoreReview.isAvailableAsync()) {
      // Solicita a avaliação. O sistema operacional decide se deve ou não mostrar o pop-up.
      StoreReview.requestReview();
    }
    // Navega para a tela de treinos independentemente do resultado da avaliação
    router.replace('/(tabs)/treinoHoje');
  };

  if (loading) {
    // ... (código existente de loading)
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  if (!log) {
    // ... (código existente de !log)
    return <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar o treino.</Text></View>;
  }

  // Config do gráfico movida para o componente

  const renderWeeklyCalendar = () => {
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const today = new Date();
    const currentDayIndex = today.getDay();

    const startOfWeek = getStartOfWeek(today);

    const logsThisWeek = allUserLogs.filter(log => {
      const logDate = toDate(log.horarioFim);
      return logDate && logDate >= startOfWeek;
    });

    const trainedDays = new Set(logsThisWeek.map(log => toDate(log.horarioFim)?.getDay()));

    return (
      <View style={styles.weeklyCalendarContainer}>
        {weekDays.map((day, index) => {
          const isToday = index === currentDayIndex;
          const isTrained = trainedDays.has(index);
          return (
            <View key={index} style={[styles.dayContainer, isToday && styles.todayContainer]}>
              <Text style={styles.dayText}>{day}</Text>
              <View style={[styles.dayDot, isTrained && styles.dayDotFilled]} />
            </View>
          );
        })}
      </View>
    );
  };

  const StepProgress = () => (
    <View style={styles.stepContainer}>
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Seu Progresso</Text>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>Treinos da Semana ({weeklyProgress.completed}/{weeklyProgress.total})</Text>
          {renderWeeklyCalendar()}
        </View>
        <View style={styles.progressItem}>
          <Text style={styles.progressLabel}>Sequência de Semanas</Text>
          <View style={styles.streakContainer}>
            <FontAwesome name="fire" size={16} color="#FFA500" />
            <Text style={styles.streakText}>{weekStreak} {weekStreak === 1 ? 'semana' : 'semanas'}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const StepPerformance = () => (
    <View style={styles.stepContainer}>
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Seu Desempenho</Text>
        <View style={styles.performanceContainer}><View style={styles.performanceCard}><FontAwesome name="clock-o" size={24} color="#3B82F6" /><Text style={styles.performanceValue}>{formatDuration(duration)}</Text><Text style={styles.performanceLabel}>Tempo de Treino</Text></View><View style={styles.performanceCard}><FontAwesome name="trophy" size={24} color="#3B82F6" /><Text style={styles.performanceValue}>{log.exercicios.filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido)).length}</Text><Text style={styles.performanceLabel}>Exercícios Feitos</Text></View>
        </View>
      </View>
      {currentVolume > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Evolução de Carga</Text>
          <View style={styles.volumeCard}>
            <Text style={styles.volumeValue}>{currentVolume.toLocaleString('pt-BR')} kg</Text>
            <Text style={styles.volumeLabel}>Carga total neste treino</Text>
            {allUserLogs.length > 0 && (
              <HistoricoCargaTreinoChart
                currentLog={log}
                allUserLogs={allUserLogs}
                style={[styles.historyContainer, animatedChartStyle]}
                onDataReady={handleChartDataReady}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );

  const StepExerciseSummary = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.statsSectionTitle, { marginTop: 0, marginBottom: 15 }]}>Resumo dos Exercícios</Text>
      <FlatList
        data={log.exercicios.filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido))}
        keyExtractor={(item) => item.modeloId}
        renderItem={({ item }) => (
          <ExpandableExerciseItem
            item={item}
            allUserLogs={allUserLogs}
            log={log}
            userWeight={userWeight}
          />
        )}
        scrollEnabled={false} // A rolagem principal cuida disso
      />
    </View>
  );

  const steps = [
    <StepProgress key="progress" />,
    <StepPerformance key="performance" />,
    <StepExerciseSummary key="summary" />,
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.completeModalHeader}>
        <Text style={styles.completeModalTitle}>Mandou Bem!</Text>
        <Text style={styles.completeModalSubtitle}>Você completou o treino de hoje!</Text>
        <StepIndicator currentStep={step} totalSteps={steps.length} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }} // Space for the button
      >
        {steps[step]}
      </ScrollView>
      <View style={styles.navigationButtonsContainer}>
        {step > 0 && (
          <TouchableOpacity style={[styles.navButton, styles.prevButton]} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.navButtonText}>Voltar</Text>
          </TouchableOpacity>
        )}
        {step < steps.length - 1 ? (
          <TouchableOpacity style={[styles.navButton, styles.nextButton]} onPress={() => setStep(s => s + 1)}>
            <Text style={styles.navButtonText}>Próximo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.navButton, styles.nextButton]} onPress={handleCloseAndReview}>
            <Text style={styles.navButtonText}>Fechar</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (Estilos existentes)
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
    paddingHorizontal: 0,
    justifyContent: 'space-between',
  },
  completeModalHeader: {
    alignItems: "center",
    width: '100%',
    paddingBottom: 30,
    paddingTop: 30,
    paddingHorizontal: 15,
  },
  completeModalTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  completeModalSubtitle: {
    color: '#aaa',
    fontSize: 18,
    textAlign: 'center',
  },
  statsSection: {
    width: '100%',
    marginBottom: 25,
  },
  allStatsContainer: {
    flex: 1,
    width: '100%',

  },
  statsSectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingHorizontal: 15,
    textAlign: 'left',
  },
  progressItem: {
    marginBottom: 15,
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    padding: 20,
  },
  progressLabel: {
    color: '#ccc',
    fontSize: 18,
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
    alignItems: 'flex-start',
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 8,
  },
  streakText: {
    color: '#FFA500',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  performanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  performanceLabel: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  volumeCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    padding: 20,
    alignItems: 'flex-start',
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
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
  },
  percentageNegative: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
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
    overflow: 'hidden',
  },
  weeklyCalendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    padding: 10,
    borderRadius: 8,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
  },
  todayContainer: {
    backgroundColor: '#1A1D23',
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
  },
  dayDotFilled: {
    backgroundColor: '#3B82F6',
  },
  dayText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepContainer: {
    paddingHorizontal: 15,
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#2A2E37',
    backgroundColor: '#141414',
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  prevButton: {
    backgroundColor: '#1A1D23',
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    marginRight: 10,
  },
  nextButton: {
    backgroundColor: '#3B82F6',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#444',
  },
  stepDotActive: {
    backgroundColor: '#3B82F6',
  },
  // Estilos de exerciseItem removidos (agora estão no componente)
});
