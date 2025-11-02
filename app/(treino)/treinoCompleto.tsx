import { calculateTotalVolume } from '@/utils/volumeUtils';
import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'; // Adicionado ThemedText
// import { VideoView as Video, useVideoPlayer } from 'expo-video'; // Removido
import { doc, getDoc } from 'firebase/firestore';
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { ThemedText } from '@/components/themed-text';
import { Ficha } from '@/models/ficha';
import { HistoricoCargaTreinoChart } from '../../components/charts/HistoricoCargaTreinoChart';
import { ExpandableExerciseItem } from '../../components/exercicios/ExpandableExerciseItem';

const ProgressBar = memo(({ progress }: { progress: number }) => (
// ... (código existente da ProgressBar)
    <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
    </View>
));

interface SerieComStatus extends Serie {
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
    const { logId } = useLocalSearchParams<{ logId: string }>();

    const [loading, setLoading] = useState(true);
// ... (código existente do state)
    const [log, setLog] = useState<Log | null>(null);
    const [duration, setDuration] = useState(0);
    const [weeklyProgress, setWeeklyProgress] = useState({ completed: 0, total: 2 });
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
// ... (código existente de setDuration)
                const fim = toDate(completedLog.horarioFim);
                if (inicio && fim) {
                    setDuration(Math.round((fim.getTime() - inicio.getTime()) / 1000));
                }

                await calculateCompletionData(completedLog);

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
                getUserProfile(user.uid),
                getLogsByUsuarioId(user.uid),
                getFichaAtiva(user.uid)
            ]);
            setAllUserLogs(userLogs); // Guarda todos os logs para os componentes filhos
            
            if (userProfile?.peso) {
                setUserWeight(userProfile.peso);
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

            // --- Lógica de cálculo de volume ---
            const volAtual = completedLog.cargaAcumulada || calculateTotalVolume(completedLog.exercicios, userProfile?.peso || 70, true);
            setCurrentVolume(volAtual);
            // --- Fim da lógica ---

        } catch (error) { console.error("Error calculating completion data:", error); }
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
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      const today = new Date();
      const currentDay = today.getDay();
  
      const loggedDays = new Set(
        allUserLogs.map(log => {
          const logDate = toDate(log.horarioFim);
          return logDate ? logDate.toDateString() : null;
        })
        .filter((d): d is string => d !== null)
      );
  
      const scheduledDays = activeFicha ? new Set(activeFicha.treinos.flatMap((t: any) => t.diasSemana)) : new Set();
      
      return (
        <View style={styles.calendarContainer}>
          {weekDays.map((day, index) => {
            const date = new Date();
            date.setDate(today.getDate() - (currentDay - index));
            const isToday = index === currentDay;
            const isPast = index < currentDay;
            
            const isLogged = loggedDays.has(date.toDateString());
            const dayString = DIAS_SEMANA_MAP[index] as any;
            const isScheduled = scheduledDays.has(dayString);
  
            const isMissed = isPast && isScheduled && !isLogged;
  
            const dayStyles = [
              styles.dayContainer,
              (isPast || isToday) && styles.progressionOverlay,
              isScheduled && !isLogged && !isMissed && styles.scheduledDay,
              isLogged && styles.loggedDay,
              isMissed && styles.missedDay,
            ];
            
            return (
              <View key={day} style={dayStyles}>
                <ThemedText style={styles.dayText}>{day}</ThemedText>
                <ThemedText style={styles.dateText}>{date.getDate()}</ThemedText>
              </View>
            );
          })}
        </View>
      );
    };

    const ListHeader = () => (
// ... (código existente de ListHeader)
        <>
            <View style={styles.completeModalHeader}>
              <Text style={styles.completeModalTitle}>Mandou Bem!</Text>
// ... (código existente de ...Subtitle)
              <Text style={styles.completeModalSubtitle}>Você completou o treino de hoje!</Text>
            </View>
            <View style={styles.allStatsContainer}>
// ... (código existente de ...statsSection Progresso)
              <View style={styles.statsSection}>
                <Text style={styles.statsSectionTitle}>Seu Progresso</Text>
                <View style={styles.progressItem}><Text style={styles.progressLabel}>Treinos da Semana</Text>{renderWeeklyCalendar()}</View>
                <View style={styles.progressItem}><Text style={styles.progressLabel}>Sequência de Semanas</Text><View style={styles.streakContainer}><FontAwesome name="fire" size={16} color="#FFA500" /><Text style={styles.streakText}>{weekStreak} {weekStreak === 1 ? 'semana' : 'semanas'}</Text></View></View>
              </View>
              <View style={styles.statsSection}>
// ... (código existente de ...statsSection Desempenho)
                <Text style={styles.statsSectionTitle}>Seu Desempenho</Text>
                <View style={styles.performanceContainer}>
                  <View style={styles.performanceCard}><FontAwesome name="clock-o" size={24} color="#1cb0f6" /><Text style={styles.performanceValue}>{formatDuration(duration)}</Text><Text style={styles.performanceLabel}>Tempo de Treino</Text></View>
                  <View style={styles.performanceCard}><FontAwesome name="trophy" size={24} color="#1cb0f6" /><Text style={styles.performanceValue}>{log.exercicios.filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido)).length}</Text><Text style={styles.performanceLabel}>Exercícios Feitos</Text></View>
                </View>
              </View>
              {currentVolume > 0 && (
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Evolução de Carga</Text>
                  <View style={styles.volumeCard}>
                    <Text style={styles.volumeValue}>{currentVolume.toLocaleString('pt-BR')} kg</Text>
                    <Text style={styles.volumeLabel}>Carga total neste treino</Text>
                    
                    {/* --- SUBSTITUIÇÃO DO GRÁFICO --- */}
                    {allUserLogs.length > 0 && (
                        <HistoricoCargaTreinoChart
                            currentLog={log}
                            allUserLogs={allUserLogs}
                            style={[styles.historyContainer, animatedChartStyle]}
                            onDataReady={handleChartDataReady}
                        />
                    )}
                    {/* --- FIM DA SUBSTITUIÇÃO --- */}
                  </View>
                </View>
              )}
            </View>
            <Text style={[styles.statsSectionTitle, { marginTop: 25, marginBottom: 15 }]}>Resumo dos Exercícios</Text>
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <FlatList
                data={log.exercicios.filter(ex => (ex.series as SerieComStatus[]).some(s => s.concluido))} 
                keyExtractor={(item) => item.modeloId}
                // --- SUBSTITUIÇÃO DO RENDERITEM ---
                renderItem={({ item }) => (
                    <ExpandableExerciseItem 
                        item={item} 
                        allUserLogs={allUserLogs} 
                        log={log}
                        userWeight={userWeight}
                    />
                )}
                // --- FIM DA SUBSTITUIÇÃO ---
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }} // Space for the button
            />
            <TouchableOpacity style={styles.continueButton} onPress={() => router.replace('/(tabs)/treinoHoje')}>

              <Text style={styles.continueButtonText}>Fechar</Text>
            </TouchableOpacity>
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
        backgroundColor: '#141414',
        paddingHorizontal: 15,
        justifyContent: 'space-between',
    },
    completeModalHeader: {
        alignItems: "center",
        width: '100%',
        paddingBottom: 30,
        paddingTop: 30,
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
        textAlign: 'left',
    },
    progressItem: {
        marginBottom: 15,
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
        alignItems: 'center',
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
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 8,
    },
    performanceLabel: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 4,
    },
    continueButton: {
        backgroundColor: '#1cb0f6',
        paddingVertical: 15,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        position: 'absolute',
        bottom: 20,
        left: 15,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
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
    // Calendar Styles
    calendarContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 8,
      backgroundColor: '#1f1f1f',
      borderRadius: 15,
      borderWidth: 1,
      borderTopColor: '#ffffff2a',
      borderLeftColor: '#ffffff2a', 
      borderBottomColor: '#ffffff1a',
      borderRightColor: '#ffffff1a',
      width: '100%',
    },
    dayContainer: {
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 2 ,
      borderRadius: 10,
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 1,
      flexBasis: '13%',  
    },
    progressionOverlay: {
      backgroundColor: '#ffffff1a',
    },
    loggedDay: {
      backgroundColor: '#00A6FF33',
      borderColor: '#00A6FF',
      borderWidth: 1.5,
    },
    missedDay: {
      borderColor: '#FFA500',
      borderWidth: 1.5,
    },
    scheduledDay: {
      borderWidth: 1.5,
      borderTopColor: '#ffffff2a',
      borderLeftColor: '#ffffff2a', 
      borderBottomColor: '#ffffff1a',
      borderRightColor: '#ffffff1a',
      backgroundColor: '#ffffff0d',
    },
    dayText: {
      fontWeight: 'bold',
      color: '#E0E0E0',
    },
    dateText: {
      marginTop: 5,
      color: '#FFFFFF',
    },
    // Estilos de exerciseItem removidos (agora estão no componente)
});
