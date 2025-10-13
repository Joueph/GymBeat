import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseconfig';
import { Exercicio } from '../../models/exercicio';
import { Log } from '../../models/log';
import { getLogsByUsuarioId } from '../../services/logService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

const ProgressBar = memo(({ progress }: { progress: number }) => (
    <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
    </View>
));

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

const parseReps = (reps: any): number => {
    if (typeof reps === 'number') return reps;
    if (typeof reps === 'string') {
      const numbers = reps.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        if (numbers.length >= 2) {
          const num1 = Number(numbers[0]);
          const num2 = Number(numbers[1]);
          return Math.round((num1 + num2) / 2);
        }
        return Number(numbers[0]);
      }
    }
    return 0;
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

const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function TreinoCompletoScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { logId } = useLocalSearchParams<{ logId: string }>();

    const [loading, setLoading] = useState(true);
    const [log, setLog] = useState<Log | null>(null);
    const [duration, setDuration] = useState(0);
    const [weeklyProgress, setWeeklyProgress] = useState({ completed: 0, total: 0 });
    const [weekStreak, setWeekStreak] = useState(0);
    const [volumeData, setVolumeData] = useState<{ current: number; previous: number[]; percentageChange: number | null; } | null>(null);

    useEffect(() => {
        if (!logId || !user) {
            Alert.alert("Erro", "Não foi possível carregar os dados do treino.");
            router.back();
            return;
        }

        const fetchData = async () => {
            try {
                const logRef = doc(db, 'logs', logId);
                const logSnap = await getDoc(logRef);
                if (!logSnap.exists()) throw new Error("Log não encontrado.");
                
                const completedLog = { id: logSnap.id, ...logSnap.data() } as Log;
                setLog(completedLog);

                const inicio = toDate(completedLog.horarioInicio);
                const fim = toDate(completedLog.horarioFim);
                if (inicio && fim) {
                    setDuration(Math.round((fim.getTime() - inicio.getTime()) / 1000));
                }

                await calculateCompletionData(completedLog);

            } catch (error) {
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
        if (!user) return;
        try {
            const [userProfile, userLogs] = await Promise.all([
                getUserProfile(user.uid),
                getLogsByUsuarioId(user.uid)
            ]);

            const streakGoal = userProfile?.streakGoal || 2;
            const today = new Date();
            const startOfThisWeek = getStartOfWeek(today);

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

            const relevantLogs = userLogs
                .filter(log => log.horarioFim && log.treino.id === completedLog.treino.id)
                .sort((a, b) => toDate(b.horarioFim)!.getTime() - toDate(a.horarioFim)!.getTime());

            if (relevantLogs.length > 0) {
                const currentVolume = calculateVolume(completedLog.exerciciosFeitos);
                const previousLogs = relevantLogs.filter(l => l.id !== completedLog.id);
                
                const volumes = previousLogs.map(log => calculateVolume(log.exerciciosFeitos));
                const previousLogsVolumes = volumes.slice(0, 3);

                let percentageChange: number | null = null;
                if (volumes.length > 0) {
                    const previousVolume = volumes[0];
                    if (previousVolume > 0) {
                        percentageChange = ((currentVolume - previousVolume) / previousVolume) * 100;
                    }
                }
                setVolumeData({
                    current: currentVolume,
                    previous: previousLogsVolumes,
                    percentageChange: percentageChange,
                });
            } else {
                 setVolumeData({ current: calculateVolume(completedLog.exerciciosFeitos), previous: [], percentageChange: null });
            }
        } catch (error) { console.error("Error calculating completion data:", error); }
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
    }

    if (!log) {
        return <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar o treino.</Text></View>;
    }
    
    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
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
                      <Text style={styles.performanceValue}>{log.exerciciosFeitos.length}</Text>
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
            <TouchableOpacity style={styles.continueButton} onPress={() => router.replace('/')}>
              <Text style={styles.continueButtonText}>Fechar</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        padding: 30,
        justifyContent: 'space-between',
    },
    completeModalHeader: {
        alignItems: "center",
        width: '100%',
        paddingBottom: 30,
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
        marginTop: 20,
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
