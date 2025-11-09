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
import React, { useCallback, useState } from 'react'; // Adicionado ScrollView
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../authprovider';

import { MetricCard } from '@/components/MetricCard';
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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [isWeightDrawerVisible, setWeightDrawerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!user) return;

        try {
          // Busca os dados do Firestore e o log ativo do cache simultaneamente
          const [activeFicha, firestoreLogs, cachedLog, profile]: [Ficha | null, Log[], Log | null, Usuario | null] = await Promise.all([
            getFichaAtiva(user.id),
            getLogsByUsuarioId(user.id),
            getCachedActiveWorkoutLog(),
            getUserProfile(user.id)
          ]);

          let combinedLogs = firestoreLogs;

          // Se um log ativo foi encontrado no cache, ele tem prioridade.
          if (cachedLog) {
            // Remove qualquer log "em andamento" que possa ter vindo do Firestore para evitar duplicatas
            combinedLogs = firestoreLogs.filter(log => log.id !== cachedLog.id);
            combinedLogs.push(cachedLog);
          }

          if (activeFicha && activeFicha.treinos.length > 0) {
            const fetchedTreinos: Treino[] = await getTreinosByIds(activeFicha.treinos);
            setTreinos(fetchedTreinos);
            setActiveFicha(activeFicha);
          } else {
            setTreinos([]);
          }

          setLogs(combinedLogs);
          setUserProfile(profile);
        } catch (error) {
          console.error("Erro ao buscar dados da ficha ativa:", error);
          setTreinos([]);
        }
      };

      fetchData();
    }, [user])
  );

  const weeklyMetrics = React.useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyLogs = logs.filter(log => {
      if (!log.horarioFim) return false;
      const logDate = new Date(log.horarioFim.seconds * 1000);
      return logDate >= startOfWeek;
    });

    let totalSeconds = 0;
    let totalSets = 0;
    let totalVolume = 0;

    for (const log of weeklyLogs) {
      if (log.horarioInicio && log.horarioFim) {
        totalSeconds += log.horarioFim.seconds - log.horarioInicio.seconds;
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

    const formattedVolume = totalVolume > 1000 
      ? `${(totalVolume / 1000).toFixed(1)} t` 
      : `${Math.round(totalVolume)} kg`;

    return {
      tempoDeTreino: formattedTime,
      series: totalSets,
      volume: formattedVolume,
    };
  }, [logs]);

  const handleSaveWeight = async (newWeight: number) => {
    if (!user || !userProfile) return;

    const newWeightRecord = { valor: newWeight, data: new Date() };
    const updatedHistorico = [...(userProfile.historicoPeso || []), newWeightRecord];

    try {
      // Atualiza o perfil no Firestore
      await updateUserProfile(user.id, { historicoPeso: updatedHistorico });

      // Atualiza o estado local para refletir a mudança imediatamente
      setUserProfile(prev => prev ? { ...prev, historicoPeso: updatedHistorico } : null);

      setWeightDrawerVisible(false); // Fecha o drawer
    } catch (error) {
      console.error("Erro ao salvar o novo peso:", error);
      Alert.alert("Erro", "Não foi possível salvar seu novo peso. Tente novamente.");
    }
  };

  const getLatestWeight = () => (
    userProfile?.historicoPeso && userProfile.historicoPeso.length > 0 ? userProfile.historicoPeso[userProfile.historicoPeso.length - 1].valor : 70
  );

  const renderWeeklyProgress = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutsThisWeek = new Set(
      logs
        .filter(log => {
          if (!log.horarioFim || !log.treino?.id) return false;
          const logDate = new Date(log.horarioFim.seconds * 1000);
          return logDate >= startOfWeek;
        })
        .map(log => log.treino!.id)
    );

    const treinosRealizados = completedWorkoutsThisWeek.size;
    const treinosNaSemana = activeFicha?.treinos.length || 0;
    const progress = treinosNaSemana > 0 ? treinosRealizados / treinosNaSemana : 0;

    if (treinosNaSemana === 0) {
      return null; // Não renderiza nada se não houver treinos na ficha
    }

    return (
      <View style={styles.weeklyProgressContainer}>
        <View>
          <Text style={styles.progressCountText}>
            {treinosRealizados} / {treinosNaSemana}
          </Text>
          <Text style={styles.progressLabelText}>Treinos concluídos</Text>
        </View>
        <View style={styles.progressCircleContainer}>
          <ProgressCircle progress={progress} size={80} strokeWidth={6} />
          <Text style={styles.progressPercentageText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
    );
  };

  const renderTodaysWorkoutCard = () => {
    const weekDayMap: { [key: number]: DiaSemana } = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    const todayIndex = new Date().getDay();
    const todayKey = weekDayMap[todayIndex];

    const todaysWorkout = treinos.find(t => t.diasSemana.includes(todayKey));

    if (!todaysWorkout) {
      return null; // Ou renderizar um card de "Descanso"
    }

    const totalSeries = todaysWorkout.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
    const estimatedTime = totalSeries * 2; // Estimativa de 2 minutos por série

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
    const currentDayIndex = today.getDay(); // 0 para Domingo, 1 para Segunda, etc.

    // Identifica os IDs dos treinos que já foram concluídos nesta semana.
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDayIndex);
    startOfWeek.setHours(0, 0, 0, 0);

    const completedWorkoutIdsThisWeek = new Set(
      logs
        .filter(log => {
          if (!log.horarioFim || !log.treino?.id) return false;
          const logDate = new Date(log.horarioFim.seconds * 1000);
          return logDate >= startOfWeek;
        })
        .map(log => log.treino!.id)
    );

    return (
      <View style={styles.calendarContainer}>
        {weekDays.map((day, index) => {
          const isToday = index === currentDayIndex;
          const date = new Date();
          date.setDate(today.getDate() - (currentDayIndex - index));
          const dateString = date.toDateString();

          const dayKey = weekDayMap[index];
          // Verifica se o treino agendado para este dia já foi concluído na semana.
          const scheduledTreinoForDay = treinos.find(treino => treino.diasSemana.includes(dayKey));
          const isScheduledButNotDone = scheduledTreinoForDay && !completedWorkoutIdsThisWeek.has(scheduledTreinoForDay.id!);

          // Encontra um log concluído para a data específica OU um log em andamento se for hoje.
          const logDoDia = logs.find(log => 
            (log.horarioFim && new Date(log.horarioFim.seconds * 1000).toDateString() === dateString) ||
            (!log.horarioFim && isToday) // Se não tem horário de fim e é hoje, é um treino em andamento.
          );

          let progress = 0;
          if (logDoDia) {
            const totalSeries = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.length || 0), 0);
            const seriesFeitas = logDoDia.exercicios.reduce((acc, ex) => acc + (ex.series?.filter(s => (s as any).concluido).length || 0), 0);
            if (totalSeries > 0) {
              progress = seriesFeitas / totalSeries;
            }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Progresso</Text>
      </View>
      {renderWeeklyCalendar()}
      <Text style={styles.sectionTitle}>Minha semana</Text>
      {renderWeeklyProgress()}
      {renderTodaysWorkoutCard()}
      <Text style={styles.sectionTitle}>Minhas métricas</Text>
      {userProfile && (
        <View style={styles.metricsContainer}>
          <MetricCard 
            metricName="Peso Corporal"
            metricValue={`${getLatestWeight()} kg`}
            isEditable={true}
            onEdit={() => setWeightDrawerVisible(true)}
            historyData={userProfile.historicoPeso}
          />
          <MetricCard metricName="Tempo de treino" metricValue={weeklyMetrics.tempoDeTreino} />
          <MetricCard metricName="Séries" metricValue={String(weeklyMetrics.series)} />
          <MetricCard metricName="Volume" metricValue={weeklyMetrics.volume} />
        </View>
      )}

      {/* Drawer para inserir o peso */}
      <WeightInputDrawer
        visible={isWeightDrawerVisible}
        onClose={() => setWeightDrawerVisible(false)}
        onSave={handleSaveWeight}
        initialValue={getLatestWeight()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },
  scrollContentContainer: {
    paddingHorizontal:16,
    paddingTop: '15%',
    paddingBottom: 40, // Adiciona espaço no final para não colar na barra de abas
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 10,
  },
  headerTitle: {
    color: '#EAEAEA',
    fontSize: 40,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#141414',
    borderRadius: 110,
    borderColor: '#ffffff1a',
    borderWidth: 0.5,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: 45,
    height: 65,
  },
  dateContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dateTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    color: '#888', // Cor cinza para o nome do dia
    fontSize: 12,
    fontWeight: '300', // Light
  },
  dateText: {
    color: '#EAEAEA', // Cor branca para o número da data
    fontSize: 16,
    fontWeight: '600', // Semibold
  },
  todayContainer: {
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
  },
  scheduledDayCircle: {
    width: 32,
    height: 32,
    borderColor: '#888',
    borderWidth: 1.5,
    borderRadius: 16,
  },
  weeklyProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    padding: 20,
    marginTop: 8,
  },
  progressCountText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  progressLabelText: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  progressCircleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentageText: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#EAEAEA',
    marginTop: 16,
  },
  todayWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 15, // Alinha com o padding geral
  },
  currentFichaText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  todayWorkoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1D23',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2A2E37',
    padding: 20,
    marginTop: 8,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  workoutDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  workoutDetailText: {
    color: '#888',
    fontSize: 14,
    alignSelf:'flex-end'
  },
  detailSeparator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#555',
    marginHorizontal: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    justifyContent: 'space-between', // Garante que o espaço seja distribuído entre os itens
    rowGap: 8, // Adiciona espaçamento vertical entre as linhas de cards
  },
});