// joueph/gymbeat/GymBeat-Android/gymbeat/app/(tabs)/index.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable, ActivityIndicator, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../authprovider';
import { getLogsByUsuarioId } from '../../services/logService';
import { addFicha, getFichaAtiva } from '../../services/fichaService';
import { getTreinosByIds } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { Usuario } from '../../models/usuario';
import { DiaSemana, Treino } from '../../models/treino';
import { Log } from '../../models/log';
import { Ficha } from '../../models/ficha';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useFocusEffect } from 'expo-router';

// Helper para converter Timestamps do Firestore e outros formatos para um objeto Date.
const toDate = (date: any): Date | null => {
  if (!date) return null;
  // Se for um objeto Timestamp do Firestore, use o método toDate()
  if (typeof date.toDate === 'function') return date.toDate();
  // Tenta criar uma data a partir do valor (pode ser string, número ou já um Date)
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

// Helper para obter o início da semana (domingo) para uma data.
const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 para Domingo
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

export default function HomeScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const router = useRouter();
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [friends, setFriends] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState({ workoutsThisWeek: 0, streak: 0, goal: 2 });

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (user) {
          setLoading(true);
          try {
            // Fetch logs, profile, and active ficha in parallel
            const [userLogs, userProfile, fichaAtiva] = await Promise.all([
              getLogsByUsuarioId(user.uid),
              getUserProfile(user.uid),
              getFichaAtiva(user.uid),
            ]);
  
            setLogs(userLogs);
            setProfile(userProfile);
            setActiveFicha(fichaAtiva);

            // Calcular estatísticas semanais
            const streakGoal = userProfile?.streakGoal || 2;

            // 1. Calcular treinos nesta semana
            const today = new Date();
            const startOfThisWeek = getStartOfWeek(today);
            const workoutsThisWeek = userLogs.filter(log => {
                const logDate = toDate(log.horarioFim);
                return logDate && logDate >= startOfThisWeek;
            }).length;

            // 2. Calcular sequência (streak)
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
                        break; // A sequência é interrompida na primeira semana que não atinge a meta.
                    }
                }
            }
            setWeeklyStats({ workoutsThisWeek, streak, goal: streakGoal });

            if (fichaAtiva && fichaAtiva.treinos.length > 0) {
              const userTreinos = await getTreinosByIds(fichaAtiva.treinos);
              setTreinos(userTreinos);
            } else {
              setTreinos([]);
            }
  
            if (userProfile && userProfile.amizades) {
              const friendsData = await Promise.all(
                userProfile.amizades.map(async (friendId) => {
                  const friendProfile = await getUserProfile(friendId);
                  // Check for mutual friendship
                  if (friendProfile && friendProfile.amizades?.includes(user.uid)) {
                     // Check if friend has trained today based on the 'lastTrained' field
                    const today = new Date().toDateString();
                    let hasTrainedToday = false;
                    if (friendProfile.lastTrained) {
                      const lastTrainedDate = toDate(friendProfile.lastTrained);
                      if (lastTrainedDate) {
                        hasTrainedToday = lastTrainedDate.toDateString() === today;
                      }
                    }
                    return { ...friendProfile, hasTrainedToday: hasTrainedToday };
                  }
                  return null;
                })
              );
              setFriends(friendsData.filter(Boolean) as (Usuario & { hasTrainedToday: boolean })[]);
            }
          } catch (error) {
            console.error("Erro ao buscar dados:", error);
          } finally {
            setLoading(false);
          }
        }
      };
      fetchData();
    }, [user])
  );

  const [waveAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimation, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.delay(3000)
      ])
    ).start();
  }, []);

  const waveRotation = waveAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '30deg']
  });

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
        router.push(`/treino/criarFicha?fichaId=${newFichaId}`);
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

    const scheduledDays = new Set(treinos.flatMap(t => t.diasSemana));

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

  const renderNextWorkout = () => {
    if (treinos.length === 0 || !activeFicha) {
      return null;
    }

    const hoje = new Date().getDay();
    let proximoTreino: Treino | undefined;
    let diaDoTreino: number = -1;

    // 1. Find today's workout
    const diaStringHoje = DIAS_SEMANA_MAP[hoje] as DiaSemana;
    proximoTreino = treinos.find(t => t.diasSemana.includes(diaStringHoje));

    if (proximoTreino) {
      diaDoTreino = hoje;
    } else {
      // 2. If no workout today, find the next one
      for (let i = 1; i < 7; i++) {
        const proximoDiaIndex = (hoje + i) % 7;
        const proximoDiaString = DIAS_SEMANA_MAP[proximoDiaIndex] as DiaSemana;
        const treinoEncontrado = treinos.find(t => t.diasSemana.includes(proximoDiaString));
        if (treinoEncontrado) {
          proximoTreino = treinoEncontrado;
          diaDoTreino = proximoDiaIndex;
          break;
        }
      }
    }

    if (!proximoTreino) {
      return null; // No workouts scheduled at all
    }

    const titulo = diaDoTreino === hoje ? "Treino de Hoje" : `Treino de ${DIAS_SEMANA_ABREV[DIAS_SEMANA_MAP[diaDoTreino]]}`;
    
    const nextTreino = proximoTreino;
    const lastLog = logs.find(log => log.treino.id === nextTreino.id);
    const duration = lastLog ? `${Math.round((toDate(lastLog.horarioFim)!.getTime() - toDate(lastLog.horarioInicio)!.getTime()) / 60000)} min` : "N/A";
    const numExercicios = nextTreino.exercicios.length;

    return (
      <View>
        <ThemedText type="subtitle" style={styles.cardTitle}>{titulo}</ThemedText>
        <View style={styles.nextWorkoutCard}>
          <View style={styles.workoutInfoContainer}>
            <View style={styles.workoutTitleContainer}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="#ccc" />
              <ThemedText style={styles.workoutName}>{nextTreino.nome}</ThemedText>
            </View>
            <View style={styles.workoutDetailsContainer}>
              <FontAwesome name="bars" size={16} color="#ccc" />
              <ThemedText style={styles.workoutDetailText}>{numExercicios} {numExercicios === 1 ? 'exercício' : 'exercícios'}</ThemedText>
              <FontAwesome name="clock-o" size={16} color="#ccc" style={{ marginLeft: 15 }} />
              <ThemedText style={styles.workoutDetailText}>{duration}</ThemedText>
            </View>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={() => router.push(`/treino/ongoingWorkout?fichaId=${activeFicha.id}&treinoId=${nextTreino.id}`)}>
            <ThemedText style={styles.startButtonText}>Começar</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const ListHeader = () => {
    const workoutsThisWeekMet = weeklyStats.workoutsThisWeek >= weeklyStats.goal;
    return (
      <>
        <View style={styles.headerContainer}>
          <View style={{ gap: 5, flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 5 , paddingTop: 10}}>
            <ThemedText style={styles.smallGreeting}>Olá,</ThemedText>
            <ThemedText style={styles.largeUsername}>{profile?.nome}</ThemedText>
          </View>
          <Animated.Text style={[styles.waveEmoji, { transform: [{ rotate: waveRotation }] }]}>
            👋
          </Animated.Text>
        </View>
        <ThemedView style={styles.section}>
          {renderWeeklyCalendar()}
        </ThemedView>
        <ThemedView style={styles.section}>
          {renderNextWorkout()}
        </ThemedView>
        <ThemedView style={styles.section}>
          <View style={styles.statsContainer}>
            <View style={[styles.statBox, workoutsThisWeekMet && styles.statBoxMet]}>
              <ThemedText style={styles.statValue}>{weeklyStats.workoutsThisWeek}/{weeklyStats.goal}</ThemedText>
              <ThemedText style={styles.statLabel}>Treinos na semana</ThemedText>
            </View>
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{weeklyStats.streak}</ThemedText>
              <ThemedText style={styles.statLabel}>Semanas em sequência</ThemedText>
            </View>
          </View>
        </ThemedView>
        <ThemedView style={styles.section}>
          <TouchableOpacity style={styles.newSheetButton} onPress={() => setModalVisible(true)}>
            <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Criar Nova Ficha</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={{ marginBottom: 10 }}>Amigos</ThemedText>
        </ThemedView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <ThemedText style={styles.friendName}>{item.nome}</ThemedText>
            <View style={styles.friendStatus}>
              {item.hasTrainedToday ? (
                <>
                  <FontAwesome name="check-circle" size={16} color="#58CC02" />
                  <ThemedText style={styles.friendStatusText}> Treinou Hoje</ThemedText>
                </>
              ) : (
                <>
                  <FontAwesome name="times-circle" size={16} color="#ff3b30" />
                  <ThemedText style={styles.friendStatusText}> Não treinou</ThemedText>
                </>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyFriendsContainer}>
            <ThemedText style={styles.emptyFriendsText}>
              Você ainda não tem amigos. Adicione amigos para ver a atividade deles aqui!
            </ThemedText>
          </View>
        }
        ListHeaderComponent={ListHeader}
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
            <ThemedText type="title" style={{ marginBottom: 15 }}>Criar Nova Ficha</ThemedText>
            <ThemedText style={{ marginBottom: 20, textAlign: 'center' }}>
              Comece um novo plano de treino. Você pode montar sua própria ficha ou usar um de nossos modelos pré-definidos.
            </ThemedText>
            <TouchableOpacity style={styles.modalButton} onPress={handleCreateNewFicha}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Criar Ficha do Zero</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, {  borderBlockColor: '#58CC02' }]} onPress={() => {
              setModalVisible(false);
              router.push('/(tabs)/workouts');
            }}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Ver Modelos</ThemedText>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 15,
    backgroundColor: '#00141c',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
    gap: 5,
    flexWrap: 'wrap',
    flexGrow: 1,
  },
  smallGreeting: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#ccc',
  },
  largeUsername: {
    fontSize: 45,
    fontWeight: 'bold',
    color: '#fff',
    paddingTop: 15,
    paddingBottom: 5,
    flexWrap: 'wrap',
    flex: 1,
  },

  waveEmoji: {
    fontSize: 30,
    marginLeft: 8,
  },
  section: {
    marginBottom: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00141c',
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loggedDay: {
    backgroundColor: '#DAA520', // Dourado Pastel
  },
  scheduledDay: {
    borderWidth: 1.5,
    borderColor: '#a78bfa',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    marginBottom: 10,
  },
  workoutInfoContainer: {
    flex: 1,
    marginRight: 15,
  },
  workoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 10,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxMet: {
    backgroundColor: 'rgba(218, 165, 32, 0.2)',
    borderColor: '#DAA520',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#58CC02',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  friendName: {
    fontSize: 16,
    color: '#fff',
  },
  friendStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendStatusText: {
    color: '#ccc',
    marginLeft: 6,
  },
  emptyFriendsContainer: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyFriendsText: {
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
    backgroundColor: '#0d181c',
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
});