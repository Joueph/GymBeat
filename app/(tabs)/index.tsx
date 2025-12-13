import { OngoingWorkoutFooter } from '@/components/OngoingWorkoutFooter';
import { WeightInputDrawer } from '@/components/WeightInputDrawer';
import { Ficha } from '@/models/ficha';
import { Log } from '@/models/log';
import { DiaSemana, Treino } from '@/models/treino';
import { Usuario } from '@/models/usuario';
import { getFichaAtiva } from '@/services/fichaService';
import { getLogsByUsuarioId } from '@/services/logService';
import { getCachedActiveWorkoutLog } from '@/services/offlineCacheService';
import { getTreinosByIds } from '@/services/treinoService';
import { getUserProfile, updateUserProfile } from '@/userService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../authprovider';
import { ConfigIcon } from '../icon/ConfigIcon';

import { MetricCard } from '@/components/MetricCard';
import { widgetService } from '@/services/widgetService';
import { FeatureUpvoteModal } from '../FeatureUpvoteModal';

const ProgressCircle = ({ progress, size = 32, strokeWidth = 2.5 }: { progress: number, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle stroke="#888" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} opacity={0.3} />
        <Circle stroke="#3B82F6" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [isWeightDrawerVisible, setWeightDrawerVisible] = useState(false);
  const [isFeatureUpvoteModalVisible, setFeatureUpvoteModalVisible] = useState(false);

  // Busca de dados automática ao focar na tela
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!user) return;

        try {
          // Promise.all para buscar tudo em paralelo
          const [activeFichaResp, firestoreLogs, cachedLog, profile] = await Promise.all([
            getFichaAtiva(user.id),
            getLogsByUsuarioId(user.id),
            getCachedActiveWorkoutLog(),
            getUserProfile(user.id)
          ]);

          let combinedLogs = firestoreLogs;

          // Se existe um log em cache (treino em andamento), ele tem prioridade visual
          if (cachedLog) {
            combinedLogs = firestoreLogs.filter(log => log.id !== cachedLog.id);
            combinedLogs.push(cachedLog);
          }

          setLogs(combinedLogs);
          setUserProfile(profile);

          let currentTreinos: Treino[] = [];
          if (activeFichaResp) {
            currentTreinos = activeFichaResp.treinos.length > 0 ? await getTreinosByIds(activeFichaResp.treinos) : [];
            setActiveFicha(activeFichaResp);
            setTreinos(currentTreinos);
          } else {
            setTreinos([]);
            setActiveFicha(null);
          }
          // ATUALIZA O WIDGET SILENCIOSAMENTE
          // Isso garante que se o treino acabou de ser finalizado e o Firestore já tem o dado, o widget fica syncado.
          await widgetService.updateAll(currentTreinos, combinedLogs);

        } catch (error) {
          console.error("Erro ao buscar dados da ficha ativa:", error);
        }
      };

      fetchData();
    }, [user])
  );

  // ... (Métricas semanais e históricas mantidas iguais) ...
  const weeklyMetrics = React.useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyLogs = logs.filter(log => {
      if (!log.horarioFim) return false;
      // Parse seguro de data
      const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
      return new Date(time) >= startOfWeek;
    });

    let totalSeconds = 0;
    let totalSets = 0;
    let totalVolume = 0;

    for (const log of weeklyLogs) {
      if (log.horarioInicio && log.horarioFim) {
        const start = log.horarioInicio.seconds || (new Date(log.horarioInicio).getTime() / 1000);
        const end = log.horarioFim.seconds || (new Date(log.horarioFim).getTime() / 1000);
        totalSeconds += end - start;
      }
      if (log.cargaAcumulada) {
        totalVolume += log.cargaAcumulada;
      }
      for (const exercicio of log.exercicios) {
        totalSets += exercicio.series?.filter(s => (s as any).concluido).length || 0;
      }
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const formattedTime = `${hours}h ${minutes}m`;
    const formattedVolume = totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(1)} t` : `${Math.round(totalVolume)} kg`;

    return {
      tempoDeTreino: formattedTime,
      series: totalSets,
      volume: formattedVolume,
    };
  }, [logs]);

  const historyMetrics = React.useMemo(() => {
    const generateWeeklyHistory = (getValue: (log: Log) => number) => {
        const weeklyTotals = new Map<string, { total: number, weekStartDate: Date }>();
        const getWeekStart = (d: Date) => {
            const date = new Date(d);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - date.getDay()); 
            return date;
        };
        const fiveWeeksAgo = getWeekStart(new Date());
        fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - (4 * 7));

        const completedLogs = logs.filter(log => {
            const time = log.horarioFim?.seconds ? log.horarioFim.seconds * 1000 : (log.horarioFim ? new Date(log.horarioFim).getTime() : 0);
            if (!time) return false;
            return new Date(time) >= fiveWeeksAgo;
        });

        for (const log of completedLogs) {
            const time = log.horarioFim?.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
            const weekStartDate = getWeekStart(new Date(time));
            const weekKey = weekStartDate.toISOString().split('T')[0];
            const current = weeklyTotals.get(weekKey) || { total: 0, weekStartDate: weekStartDate };
            current.total += getValue(log);
            weeklyTotals.set(weekKey, current);
        }

        const result: { valor: number; data: Date }[] = [];
        for (let i = 0; i < 5; i++) {
            const weekStartDate = getWeekStart(new Date());
            weekStartDate.setDate(weekStartDate.getDate() - ((4 - i) * 7));
            const weekKey = weekStartDate.toISOString().split('T')[0];
            result.push({ data: weekStartDate, valor: weeklyTotals.get(weekKey)?.total || 0 });
        }
        return result;
    };

    const timeHistory = generateWeeklyHistory(log => {
      const start = log.horarioInicio?.seconds || (log.horarioInicio ? new Date(log.horarioInicio).getTime() / 1000 : 0);
      const end = log.horarioFim?.seconds || (log.horarioFim ? new Date(log.horarioFim).getTime() / 1000 : 0);
      if (start && end) return (end - start) / 60;
      return 0;
    });
    const seriesHistory = generateWeeklyHistory(log => log.exercicios.reduce((acc, ex) => acc + (ex.series?.filter(s => (s as any).concluido).length || 0), 0));
    const volumeHistory = generateWeeklyHistory(log => log.cargaAcumulada || 0);

    let weightHistory: { valor: number; data: Date }[] = [];
    if (userProfile?.historicoPeso && userProfile.historicoPeso.length > 0) {
        weightHistory = [...userProfile.historicoPeso]
            .map(h => {
                const date = typeof (h.data as any)?.toDate === 'function' ? (h.data as any).toDate() : new Date(h.data as any);
                return { valor: h.valor, data: date };
            })
            .sort((a, b) => a.data.getTime() - b.data.getTime());
    }

    return { tempoDeTreino: timeHistory, series: seriesHistory, volume: volumeHistory, pesoCorporal: weightHistory };
  }, [logs, userProfile]);

  const handleSaveWeight = async (newWeight: number) => {
    if (!user || !userProfile) return;
    const newWeightRecord = { valor: newWeight, data: new Date() };
    const updatedHistorico = [...(userProfile.historicoPeso || []), newWeightRecord];
    try {
      await updateUserProfile(user.id, { historicoPeso: updatedHistorico });
      setUserProfile(prev => prev ? { ...prev, historicoPeso: updatedHistorico } : null);
      setWeightDrawerVisible(false);
    } catch (error) {
      console.error("Erro ao salvar o novo peso:", error);
      Alert.alert("Erro", "Não foi possível salvar seu novo peso. Tente novamente.");
    }
  };

  const getLatestWeight = () => {
    if (!userProfile?.historicoPeso || userProfile.historicoPeso.length === 0) return 70;
    const sortedHistorico = [...userProfile.historicoPeso]
      .map(h => ({ ...h, data: typeof (h.data as any)?.toDate === 'function' ? (h.data as any).toDate() : new Date(h.data as any) }))
      .sort((a, b) => b.data.getTime() - a.data.getTime());
    return sortedHistorico[0].valor;
  };

  const renderWeeklyProgress = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutsThisWeek = new Set(
      logs.filter(log => {
          if (!log.horarioFim || !log.treino?.id) return false;
          const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
          return new Date(time) >= startOfWeek;
        }).map(log => log.treino!.id)
    );

    const treinosRealizados = completedWorkoutsThisWeek.size;
    const treinosNaSemana = activeFicha?.treinos.length || 0;
    const progress = treinosNaSemana > 0 ? treinosRealizados / treinosNaSemana : 0;
    if (treinosNaSemana === 0) return null;

    return (
      <View style={styles.weeklyProgressContainer}>
        <View>
          <Text style={styles.progressCountText}>{treinosRealizados} / {treinosNaSemana}</Text>
          <Text style={styles.progressLabelText}>Treinos concluídos</Text>
        </View>
        <View style={styles.progressCircleContainer}>
          <ProgressCircle progress={progress} size={80} strokeWidth={6} />
          <Text style={styles.progressPercentageText}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>
    );
  };

  const renderTodaysWorkoutCard = () => {
    const weekDayMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const todayIndex = new Date().getDay();
    const todayKey = weekDayMap[todayIndex];
    const todaysWorkout = treinos.find(t => t.diasSemana.includes(todayKey));
    if (!todaysWorkout) return null;

    const totalSeries = todaysWorkout.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
    const estimatedTime = totalSeries * 2;

    return (
      <>
        <View style={styles.todayWorkoutHeader}>
          <Text style={styles.sectionTitle}>Treino De Hoje</Text>
          {activeFicha && <Text style={styles.currentFichaText}>{activeFicha.nome}</Text>}
        </View>
        <TouchableOpacity 
          style={styles.todayWorkoutCard}
          onPress={() => router.push({ pathname: '/(treino)/editarTreino', params: { treinoId: todaysWorkout.id, fichaId: activeFicha?.id } })}
        >
          <View>
            <Text style={styles.workoutName}>{todaysWorkout.nome}</Text>
            <View style={styles.workoutDetailsContainer}>
              <Text style={styles.workoutDetailText}>{todayKey.toUpperCase()}</Text>
              <View style={styles.detailSeparator} />
              <Text style={styles.workoutDetailText}>~{estimatedTime} min</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={28} color="#262A32" />
        </TouchableOpacity>
      </>
    );
  };

  const renderWeeklyCalendar = () => {
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekDayMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const today = new Date();
    const currentDayIndex = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIndex);
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutIdsThisWeek = new Set(
      logs.filter(log => {
          if (!log.horarioFim || !log.treino?.id) return false;
          const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
          return new Date(time) >= startOfWeek;
        }).map(log => log.treino!.id)
    );

    return (
      <View style={styles.calendarContainer}>
        {weekDays.map((day, index) => {
          const isToday = index === currentDayIndex;
          const date = new Date();
          date.setDate(today.getDate() - (currentDayIndex - index));
          const dateString = date.toDateString();
          const dayKey = weekDayMap[index];
          const scheduledTreinoForDay = treinos.find(treino => treino.diasSemana.includes(dayKey));
          const isScheduledButNotDone = scheduledTreinoForDay && !completedWorkoutIdsThisWeek.has(scheduledTreinoForDay.id!);

          const logDoDia = logs.find(log => {
            if (log.horarioFim) {
                const time = log.horarioFim.seconds ? log.horarioFim.seconds * 1000 : new Date(log.horarioFim).getTime();
                return new Date(time).toDateString() === dateString;
            }
            return !log.horarioFim && isToday;
          });

          let progress = 0;
          if (logDoDia) {
            const totalSeries = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
            const seriesFeitas = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.filter(s => (s as any).concluido).length || 0), 0);
            if (totalSeries > 0) progress = seriesFeitas / totalSeries;
          }

          return (
            <View key={day} style={[styles.dayContainer, isToday && styles.todayContainer]}>
              <Text style={styles.dayText}>{day}</Text>
              <View style={styles.dateContainer}>
                {logDoDia ? (
                  <ProgressCircle progress={progress} />
                ) : (
                  isScheduledButNotDone && <View style={styles.scheduledDayCircle} />
                )}
                <View style={[StyleSheet.absoluteFillObject, styles.dateTextContainer]}>
                  <Text style={styles.dateText}>{date.getDate()}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Progresso</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.framedConfigButton} onPress={() => setFeatureUpvoteModalVisible(true)}>
                <Ionicons name="arrow-up" size={16} color="#EAEAEA" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.framedConfigButton} onPress={() => router.push('/settings')}>
              <ConfigIcon width={16} height={16} rotation={90} />
            </TouchableOpacity>
          </View>
        </View>
        
        {renderWeeklyCalendar()}
        <Text style={styles.sectionTitle}>Minha semana</Text>
        {renderWeeklyProgress()}
        {renderTodaysWorkoutCard()}
        <Text style={styles.sectionTitle}>Minhas métricas</Text>
        
        {userProfile && (
          <View style={styles.metricsContainer}>
            <MetricCard metricName="Peso Corporal" metricValue={`${getLatestWeight()} kg`} isEditable={true} onEdit={() => setWeightDrawerVisible(true)} historyData={historyMetrics.pesoCorporal} />
            <MetricCard metricName="Tempo de treino" metricValue={weeklyMetrics.tempoDeTreino} historyData={historyMetrics.tempoDeTreino} />
            <MetricCard metricName="Séries" metricValue={String(weeklyMetrics.series)} historyData={historyMetrics.series} />
            <MetricCard metricName="Volume" metricValue={weeklyMetrics.volume} historyData={historyMetrics.volume} />
          </View>
        )}

        <WeightInputDrawer visible={isWeightDrawerVisible} onClose={() => setWeightDrawerVisible(false)} onSave={handleSaveWeight} initialValue={getLatestWeight()} />
        <FeatureUpvoteModal visible={isFeatureUpvoteModalVisible} onClose={() => setFeatureUpvoteModalVisible(false)} />
      </ScrollView>
      <OngoingWorkoutFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D10' },
  scrollContentContainer: { paddingHorizontal:16, paddingTop: '15%', paddingBottom: 40 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  framedConfigButton: { backgroundColor: '#141414', borderRadius: 110, borderColor: '#ffffff1a', borderWidth: 0.5, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#EAEAEA', fontSize: 40, fontWeight: 'bold' },
  calendarContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 },
  dayContainer: { alignItems: 'center', justifyContent: 'center', gap: 8, width: 45, height: 65 },
  dateContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dateTextContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  dayText: { color: '#888', fontSize: 12, fontWeight: '300' },
  dateText: { color: '#EAEAEA', fontSize: 16, fontWeight: '600' },
  todayContainer: { backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37' },
  scheduledDayCircle: { width: 32, height: 32, borderColor: '#888', borderWidth: 1.5, borderRadius: 16 },
  weeklyProgressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37', padding: 20, marginTop: 8 },
  progressCountText: { color: '#FFFFFF', fontSize: 40, fontWeight: 'bold' },
  progressLabelText: { color: '#888', fontSize: 14, marginTop: 4 },
  progressCircleContainer: { justifyContent: 'center', alignItems: 'center' },
  progressPercentageText: { position: 'absolute', color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#EAEAEA', marginTop: 16 },
  todayWorkoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 15 },
  currentFichaText: { color: '#888', fontSize: 14, fontWeight: '500' },
  todayWorkoutCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1D23', borderRadius: 12, borderWidth: 0.5, borderColor: '#2A2E37', padding: 20, marginTop: 8 },
  workoutName: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  workoutDetailsContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  workoutDetailText: { color: '#888', fontSize: 14, alignSelf:'flex-end' },
  detailSeparator: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#555', marginHorizontal: 8 },
  metricsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, justifyContent: 'space-between', rowGap: 8 },
});