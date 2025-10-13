import { ThemedText } from '@/components/themed-text';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../firebaseconfig';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { DiaSemana, Treino } from '../../models/treino';
import { Usuario } from '../../models/usuario';
import { addFicha, getFichaAtiva } from '../../services/fichaService';
import { useAuth } from '../authprovider';

const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab'
};

const DIAS_SEMANA_ABREV: { [key: string]: string } = {
  'dom': 'dom', 'seg': 'seg', 'ter': 'ter', 'qua': 'qua', 'qui': 'qui', 'sex': 'sex', 'sab': 'sáb'
};

interface TimelineItem {
  id: string;
  type: 'workout' | 'rest' | 'header';
  date: Date;
  treino?: Treino;
}


export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeLog, setActiveLog] = useState<Log | null>(null);
  const [treinoDeHoje, setTreinoDeHoje] = useState<Treino | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ workoutsThisWeek: 0, streak: 0, goal: 2 });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
        setLoading(false);
        return;
    }
    
    setLoading(true);

    const unsubscribeUser = onSnapshot(doc(db, "users", user.uid), async (userDoc) => {
        if (userDoc.exists()) {
            const userProfile = { id: userDoc.id, ...userDoc.data() } as Usuario;
            setProfile(userProfile);

            const fichaAtiva = await getFichaAtiva(user.uid);
            setActiveFicha(fichaAtiva);
            if (fichaAtiva && fichaAtiva.treinos.length > 0) {
                const { getTreinosByIds } = require('../../services/treinoService');
                const userTreinos = await getTreinosByIds(fichaAtiva.treinos);
                
                const hoje = new Date();
                const diaString = DIAS_SEMANA_MAP[hoje.getDay()] as DiaSemana;
                const treinoDoDia = userTreinos.find((t: { diasSemana: string | string[]; }) => t.diasSemana.includes(diaString));

                setTreinos(userTreinos);
                setTreinoDeHoje(treinoDoDia || null);
            } else {
                setTreinos([]);
            }
        } else {
            setProfile(null);
        }
        // Apenas para garantir que o loading pare se o usuário não tiver perfil/ficha
        if (!dataLoaded) {
            setLoading(false);
            setDataLoaded(true);
        }
    });

    const { collection, query, where, onSnapshot: onLogsSnapshot } = require('firebase/firestore');
    const logsQuery = query(collection(db, 'logs'), where('usuarioId', '==', user.uid));

    const unsubscribeLogs = onLogsSnapshot(logsQuery, (querySnapshot: any[]) => {
        const userLogs: Log[] = [];
        querySnapshot.forEach((doc) => {
            userLogs.push({ id: doc.id, ...doc.data() } as Log);
        });
        setLogs(userLogs);

        const ongoingLog = userLogs.find(log => !log.horarioFim && log.status !== 'cancelado');
        setActiveLog(ongoingLog || null);

        const streakGoal = profile?.streakGoal || 2;
        const today = new Date();
        const startOfThisWeek = getStartOfWeek(today);
        const workoutsThisWeek = userLogs.filter(log => {
            const logDate = toDate(log.horarioFim);
            return logDate && logDate >= startOfThisWeek;
        }).length;

        let streak = 0;
        if (userLogs.length > 0) {
            const workoutsByWeek: { [weekStart: string]: number } = {};
            userLogs.forEach(log => {
                const logDate = toDate(log.horarioFim);
                if (logDate) {
                    const weekStartDate = getStartOfWeek(logDate);
                    const weekStartString = weekStartDate.toISOString().split('T')[0];
                    workoutsByWeek[weekStartString] = (workoutsByWeek[weekStartString] || 0) + 1;
                }
            });

            let weekToCheck = getStartOfWeek(new Date());
            while (true) {
                const weekString = weekToCheck.toISOString().split('T')[0];
                if (workoutsByWeek[weekString] && workoutsByWeek[weekString] >= streakGoal) {
                    streak++;
                    weekToCheck.setDate(weekToCheck.getDate() - 7);
                } else {
                    break;
                }
            }
        }
        setWeeklyStats({ workoutsThisWeek, streak, goal: streakGoal });

        if (!dataLoaded) {
            setLoading(false);
            setDataLoaded(true);
        }
    });

    return () => {
        unsubscribeUser();
        unsubscribeLogs();
    };
  }, [user, profile?.streakGoal]);

  const getAverageDuration = (treinoId: string): number | null => {
    const relevantLogs = logs.filter(log => 
      log.treino.id === treinoId && 
      log.horarioFim && 
      log.status !== 'cancelado'
    );

    if (relevantLogs.length === 0) return null;

    const totalDuration = relevantLogs.reduce((acc, log) => {
      const start = toDate(log.horarioInicio);
      const end = toDate(log.horarioFim);
      if (start && end) {
        return acc + (end.getTime() - start.getTime());
      }
      return acc;
    }, 0);

    return Math.round(totalDuration / relevantLogs.length / 60000); // em minutos
  };

  const getMuscleGroups = (treino: Treino): string => [...new Set(treino.exercicios.map(ex => ex.modelo.grupoMuscular))].join(' • ');

  const generateTimelineData = (): TimelineItem[] => {
    if (!activeFicha || treinos.length === 0) {
        return [];
    }

    const timeline: TimelineItem[] = [];
    const today = new Date();

    for (let i = 1; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayString = DIAS_SEMANA_MAP[date.getDay()] as DiaSemana;

        const treinoDoDia = treinos.find(t => t.diasSemana.includes(dayString) && t.id !== treinoDeHoje?.id);

        if (treinoDoDia) {
            timeline.push({
              id: `workout-${date.toISOString()}`,
              type: 'workout', date, treino: treinoDoDia,
            });
        } else {
            if (i < 6) {
                timeline.push({
                  id: `rest-${date.toISOString()}`,
                  type: 'rest', date,
                });
            }
        }
    }
    return timeline;
  };

  const getStreakImage = () => {
    const streakGoal = profile?.streakGoal || 2;
    switch (streakGoal) {
      case 2: return require('../../assets/images/Streak-types/Vector_2_dias.png');
      case 3: return require('../../assets/images/Streak-types/Vector_3_dias.png');
      case 4: return require('../../assets/images/Streak-types/Vector_4_dias.png');
      case 5: return require('../../assets/images/Streak-types/Vector_5_dias.png');
      case 6: return require('../../assets/images/Streak-types/Vector_6_dias.png');
      case 7: return require('../../assets/images/Streak-types/Vector_7_dias.png');
      default:
        return require('../../assets/images/Streak-types/Vector_2_dias.png');
    }
  };

  const handleCreateNewFicha = async () => {
    if (!user) return;
    try {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 2);
      const newFichaId = await addFicha({
        usuarioId: user.uid,
        nome: 'Nova Ficha (Edite)',
        treinos: [],
        dataExpiracao: expirationDate,
        opcoes: 'Programa de treinamento',
        ativa: false
      });

      if (newFichaId) {
        setModalVisible(false);
        router.push({ pathname: '/(treino)/criatFicha', params: { fichaId: newFichaId } });
      }
    } catch (error) {
      console.error("Erro ao criar nova ficha:", error);
    }
  };

  const renderWeeklyCalendar = () => {
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const today = new Date();
    const currentDay = today.getDay();

    const loggedDays = new Set(
      logs.map(log => {
        const logDate = toDate(log.horarioFim);
        return logDate ? logDate.toDateString() : null;
      })
      .filter((d): d is string => d !== null)
    );

    const scheduledDays = activeFicha ? new Set(treinos.flatMap(t => t.diasSemana)) : new Set();

    return (
      <View style={styles.calendarContainer}>
        {weekDays.map((day, index) => {
          const date = new Date();
          date.setDate(today.getDate() - (currentDay - index));
          const isPastOrToday = index <= currentDay;
          const isLogged = loggedDays.has(date.toDateString());
          const dayString: DiaSemana = DIAS_SEMANA_MAP[index] as DiaSemana;
          const isScheduled = scheduledDays.has(dayString);

          const dayStyles = [
            styles.dayContainer,
            isPastOrToday && styles.progressionOverlay,
            isLogged && styles.loggedDay,
            isScheduled && styles.scheduledDay,
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

  const CustomHeader = () => {
    const insets = useSafeAreaInsets();
    <View style={styles.customHeaderContainer}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => router.push('./perfil')} style={styles.profileImageContainer}>
          <Image
            source={{ uri: profile?.photoURL || 'https://via.placeholder.com/150' }}
            style={styles.profileImage} 
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('./perfil')}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Olá, {profile?.nome?.split(' ')[0]}!</Text>
            <Text style={styles.subGreetingText}>Vamos treinar hoje?</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.headerStreakContainer}>
        <Image source={getStreakImage()} style={styles.headerStreakImage} />
        <View style={styles.headerStreakTextContainer}>
          <Text style={styles.headerStreakNumber}>{weeklyStats.streak}</Text>
          <Text style={styles.headerStreakLabel}>semanas</Text>
        </View>
      </View>
    </View>
};

const HeroWorkoutCard = () => {
  if (activeLog) {
    // Card para "Continuar Treino"
    return (
      <TouchableOpacity style={styles.heroCard} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}&logId=${activeLog.id}`)}>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>{activeLog.treino.nome}</Text>
          <Text style={styles.heroInfo}>Treino em andamento...</Text>
        </View>
        <TouchableOpacity style={styles.heroStartButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}&logId=${activeLog.id}`)}>
          <FontAwesome name="play" size={16} color="#030405" />
          <Text style={styles.heroStartButtonText}>Continuar Treino</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (treinoDeHoje && activeFicha) {
    const avgDuration = getAverageDuration(treinoDeHoje.id);
    const muscleGroups = getMuscleGroups(treinoDeHoje);
    const exerciseCount = treinoDeHoje.exercicios.length;

    return (
      <TouchableOpacity style={styles.heroCard} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeFicha.id}&treinoId=${treinoDeHoje.id}`)}>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>{treinoDeHoje.nome}</Text>
          <Text style={styles.heroInfo}>
            {exerciseCount} Exercícios • {muscleGroups}
            {avgDuration && ` • ~${avgDuration} min`}
          </Text>
        </View>
        <TouchableOpacity style={styles.heroStartButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeFicha.id}&treinoId=${treinoDeHoje.id}`)}>
          <FontAwesome name="play" size={16} color="#030405" />
          <Text style={styles.heroStartButtonText}>Iniciar Treino</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (!activeFicha) {
    return (
      <View style={styles.heroCard}>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>Nenhum plano ativo</Text>
          <Text style={styles.heroInfo}>Crie um novo plano de treino para começar sua jornada.</Text>
        </View>
        <TouchableOpacity style={styles.heroStartButton} onPress={() => setModalVisible(true)}>
          <FontAwesome name="plus" size={16} color="#030405" />
          <Text style={styles.heroStartButtonText}>Criar Nova Ficha</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null; // Não mostra nada se houver ficha ativa mas nenhum treino para hoje
};
  
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const TimelineHeader = () => {
    return (
      <>
        <View style={styles.customHeaderContainer}>
            <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => router.push('./perfil')} style={styles.profileImageContainer}>
                <Image source={{ uri: profile?.photoURL || 'https://via.placeholder.com/150' }} style={styles.profileImage} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('./perfil')}>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.greetingText}>Olá, {profile?.nome?.split(' ')[0]}!</Text>
                    <Text style={styles.subGreetingText}>Vamos treinar hoje?</Text>
                </View>
                </TouchableOpacity>
            </View>
            <View style={styles.headerStreakContainer}>
                <Image source={getStreakImage()} style={styles.headerStreakImage} />
                <View style={styles.headerStreakTextContainer}>
                <Text style={styles.headerStreakNumber}>{weeklyStats.streak}</Text>
                <Text style={styles.headerStreakLabel}>semanas</Text>
                </View>
            </View>
        </View>
        <View style={styles.transparentSection}>
          {renderWeeklyCalendar()} 
        </View>
        
        <View style={styles.transparentSection}>
          <Text style={styles.cardTitle}>Minhas Metas</Text>
          <View style={styles.goalsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{weeklyStats.workoutsThisWeek}/{weeklyStats.goal}</Text>
              <Text style={styles.statLabel}>Treinos na semana</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{weeklyStats.streak}/{profile?.weeksStreakGoal || 4}</Text>
              <Text style={styles.statLabel}>Semanas em sequência</Text>
            </View>
          </View>
        </View>

        <View style={[styles.transparentSection, { marginTop: 0 }]}>
            <Text style={styles.cardTitle}>Treino de Hoje</Text>
            <HeroWorkoutCard />
        </View>        
        {timelineData.length > 0 && (
          <Text style={[styles.cardTitle, { paddingHorizontal: 10, marginTop: 20, marginBottom: 0 }]}>Minha agenda</Text>
        )}
      </>
    );
  };

  const TimelineWorkoutItem = ({ item, isWorkoutActive }: { item: TimelineItem, isWorkoutActive: boolean }) => {
    if (!item.treino || !activeFicha) return null;

    const title = `Treino de ${DIAS_SEMANA_ABREV[DIAS_SEMANA_MAP[item.date.getDay()]]}`;
    const numExercicios = item.treino.exercicios.length;
    
    const lastCompletedLog = logs.find(log => log.treino.id === item.treino?.id && log.horarioFim);
    let duration = "N/A";
    if (lastCompletedLog) {
        const startTime = toDate(lastCompletedLog.horarioInicio);
        const endTime = toDate(lastCompletedLog.horarioFim);
        if (startTime && endTime) {
            duration = `${Math.round((endTime.getTime() - startTime.getTime()) / 60000)} min`;
        }
    }

    return (
        <View style={styles.timelineItemContainer}>
            <View style={styles.timelineTrackContainer}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineTrack} />
            </View>
            <View style={styles.nextWorkoutCard}>
                <Text style={styles.cardTitle}>{title}</Text>
                <View style={styles.workoutContent}>
                    <View style={styles.workoutInfoContainer}>
                        <TouchableOpacity style={styles.workoutTitleContainer} onPress={() => router.push(`/(treino)/editarTreino?fichaId=${activeFicha.id}&treinoId=${item.treino!.id}`)}>
                            <FontAwesome5 name="dumbbell" size={16} color="#ccc" />
                            <Text style={styles.workoutName}>{item.treino.nome}</Text>
                        </TouchableOpacity>
                        <View style={styles.workoutDetailsContainer}>
                            <FontAwesome name="bars" size={16} color="#ccc" />
                            <Text style={styles.workoutDetailText}>{numExercicios} {numExercicios === 1 ? 'exercício' : 'exercícios'}</Text>
                            <FontAwesome name="clock-o" size={16} color="#ccc" style={{ marginLeft: 15 }} />
                            <Text style={styles.workoutDetailText}>{duration}</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={[styles.startButton, isWorkoutActive && styles.disabledButton]} 
                        onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeFicha.id}&treinoId=${item.treino!.id}`)}
                        disabled={isWorkoutActive}
                    >
                        <Text style={styles.startButtonText}>Começar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
  };

  const TimelineRestItem = ({ item }: { item: TimelineItem }) => {
    const title = `Descanso - ${DIAS_SEMANA_ABREV[DIAS_SEMANA_MAP[item.date.getDay()]]}`;

    return (
        <View style={styles.timelineItemContainer}>
            <View style={styles.timelineTrackContainer}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineTrack} />
            </View>
            <View style={styles.restCard}>
                <FontAwesome5 name="bed" size={16} color="#ccc" />
                <Text style={styles.restCardText}>{title}</Text>
            </View>
        </View>
    );
  };

  const timelineData = generateTimelineData();

  return (
    <>
      <FlatList
        data={timelineData}
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 50 }}
        renderItem={({ item }) => {
          if (item.type === 'workout') {
              return <TimelineWorkoutItem item={item} isWorkoutActive={!!activeLog} />;
          }
          if (item.type === 'rest') {
              return <TimelineRestItem item={item} />;
          }
          return null;
        }}
        ListEmptyComponent={
          !activeLog ? ( // Só mostra a mensagem de empty se não houver treino ativo
            <View style={[styles.emptyTimelineContainer, { marginTop: 20 }]}>
              <Text style={styles.emptyTimelineText}>
                {activeFicha ? "Nenhum treino agendado para os próximos dias." : "Crie ou ative uma ficha para ver seus treinos aqui."}
              </Text>
            </View>
          ) : null
        }
        ListHeaderComponent={TimelineHeader}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={50} tint="dark" style={styles.blurContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />

          <View style={styles.modalView}>
            <Text style={{fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 15 }}>Criar Nova Ficha</Text>
            <Text style={{ marginBottom: 20, textAlign: 'center', color: '#ccc' }}>
              Comece um novo plano de treino. Você pode montar sua própria ficha ou usar um de nossos modelos pré-definidos.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleCreateNewFicha}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Criar Ficha do Zero</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, {  borderBlockColor: '#58CC02' }]} onPress={() => {
              setModalVisible(false);
              router.push('/(tabs)/workouts');
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ver Modelos</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: "15%",
    flex: 1,
    backgroundColor: '#030405',
  },
  customHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#030405',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFA500', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subGreetingText: {
    fontSize: 14,
    color: '#aaa',
  },
  headerStreakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerStreakImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  headerStreakTextContainer: {
    alignItems: 'flex-start',
    gap: 0,
  },
  headerStreakNumber: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStreakLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  section: {
    marginBottom: 15,
    backgroundColor: '#030405',
  },
  transparentSection: {
    marginTop: 20,
    marginBottom: 15,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030405',
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
    backgroundColor: '#141414',
    borderRadius: 15,
    borderWidth: 1,
    borderTopColor: '#ffffff2a',
    borderLeftColor: '#ffffff2a', 
    borderBottomColor: '#ffffff1a',
    borderRightColor: '#ffffff1a',
    width: '100%',
    gap: 5,
  },
  dayContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2 ,
    borderRadius: 10,
    flexDirection: 'column',
    justifyContent: 'space-between',
    flexBasis: '13%',  
  },
  progressionOverlay: {
    backgroundColor: '#ffffff1a',
  },
  loggedDay: {
    backgroundColor: '#DAA520',
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
  nextWorkoutCard: {
    backgroundColor: '#1C1C1E',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderTopColor: '#ffffff1a',
    borderLeftColor: '#ffffff1a', 
    borderBottomColor: '#ffffff0a',
    borderRightColor: '#ffffff0a',
    flex: 1,
  },
  workoutContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfoContainer: {
    flex: 1,
    marginRight: 15,
  },
  workoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flex: 1,
  },
  workoutName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  workoutDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDetailText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 5,
  },  
  goalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  statBox: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ffffff1a',
    paddingVertical: 20,
    paddingHorizontal: 10,    
    borderWidth: 1,
    borderTopColor: '#ffffff2a',
    borderLeftColor: '#ffffff2a', 
    borderBottomColor: '#ffffff1a',
    borderRightColor: '#ffffff1a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', 
    borderRadius: 15,
    height: 140,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingTop: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  startButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderTopColor: '#ffffff2a',
    borderLeftColor: '#ffffff2a', 
    borderBottomColor: '#ffffff1a',
    borderRightColor: '#ffffff1a',
  },
  disabledButton: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyTimelineContainer: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTimelineText: {
    color: '#aaa',
    textAlign: 'center',
    fontSize: 16,
  },
  newSheetButton: {
    backgroundColor: '#1cb0f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalView: {
    width: '100%',
    backgroundColor: '#030405',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalButton: {
    backgroundColor: '#1cb0f6',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  timelineItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 15,
  },
  timelineTrackContainer: {
    width: 30,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    marginTop: 20,
    zIndex: 1,
  },
  timelineTrack: {
    flex: 1,
    width: 2,
    backgroundColor: '#333',
    borderStyle: 'dotted',
    borderColor: '#555',
    borderWidth: 1,
    marginTop: 4,
  },
  restCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginLeft: 10,
  },
  restCardText: {
    color: '#aaa',
    fontSize: 16,
    marginLeft: 10,
    fontStyle: 'italic',
  },
  cardTitle: { color: '#fff', alignItems: 'center', marginBottom: 15, fontSize: 20, fontWeight: 'bold', paddingBottom: 5, },
  // Hero Card
  heroCard: {
    backgroundColor: '#141414f1',
    borderRadius: 16,
    padding: 20,
    borderTopColor: '#00A6FFca',
    borderLeftColor: '#00A6FFca', 
    borderBottomColor: '#00A6FFaa',
    borderRightColor: '#00A6FFaa',
    borderWidth: 2,
    shadowColor: '#00A6FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 15,
  },
  heroTextContainer: {
    marginBottom: 20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  heroInfo: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
  heroStartButton: { backgroundColor: '#00A6FF', borderRadius: 10, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', },
  heroStartButtonText: {
    color: '#030405',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
