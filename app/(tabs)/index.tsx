// joueph/gymbeat/GymBeat-Android/gymbeat/app/(tabs)/index.tsx

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { DiaSemana, Treino } from '../../models/treino';
import { Usuario } from '../../models/usuario';
import { addFicha, getFichaAtiva } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { getTreinosByIds } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

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

interface FriendData extends Usuario {
  hasTrainedToday: boolean;
  weeklyLogs: Log[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Log[]>([]);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [activeFicha, setActiveFicha] = useState<Ficha | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [activeLog, setActiveLog] = useState<Log | null>(null);
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

            // Verifica se há um treino em andamento
            const ongoingLog = userLogs.find(log => !log.horarioFim);
            setActiveLog(ongoingLog || null);

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

            if (userProfile && Array.isArray(userProfile.amizades)) {
              const friendsData = await Promise.all(
                userProfile.amizades.map(async (friendId: string) => {
                  const friendProfile = await getUserProfile(friendId);
                  // VERIFICAÇÃO DE AMIZADE MÚTUA
                  if (friendProfile && friendProfile.amizades?.includes(user.uid)) {
                    // NOVA VERIFICAÇÃO DE PRIVACIDADE
                    const friendPrivacy = friendProfile.settings?.privacy;
                    // Se o perfil do amigo estiver configurado como privado, não o exiba.
                    if (friendPrivacy?.profileVisibility === 'ninguém') {
                      return null;
                    }

                    // Fetch logs for the current week
                    const weekStart = getStartOfWeek(new Date());
                    const friendLogs = await getLogsByUsuarioId(friendId);
                    const weeklyLogs = friendLogs.filter(log => {
                        const logDate = toDate(log.horarioFim);
                        return logDate && logDate >= weekStart;
                    });
                    // VERIFICAÇÃO DE TREINO HOJE
                    const today = new Date().toDateString();
                    let hasTrainedToday = false;
                    if (friendProfile.lastTrained) {
                      const lastTrainedDate = toDate(friendProfile.lastTrained);
                      hasTrainedToday = lastTrainedDate?.toDateString() === today;
                    }
                    return { ...friendProfile, hasTrainedToday, weeklyLogs };
                  }
                  return null;
                })
              );
              setFriends(friendsData.filter(Boolean) as FriendData[]);
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

  const getStreakImage = () => {
    const streakGoal = profile?.streakGoal || 2; // Usa a meta do perfil
    switch (streakGoal) {
      case 2: return require('../../assets/images/Streak-types/Vector_2_dias.png');
      case 3: return require('../../assets/images/Streak-types/Vector_3_dias.png');
      case 4: return require('../../assets/images/Streak-types/Vector_4_dias.png');
      case 5: return require('../../assets/images/Streak-types/Vector_5_dias.png');
      case 6: return require('../../assets/images/Streak-types/Vector_6_dias.png');
      case 7: return require('../../assets/images/Streak-types/Vector_7_dias.png');
      default:
        // Retorna uma imagem padrão
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

  const renderWeeklyDots = (item: FriendData) => {
    const trainedDays = new Set(
      item.weeklyLogs.map(log => toDate(log.horarioFim)?.getDay())
    );

    return (
      <View style={styles.weeklyDotsContainer}>
        {Array.from({ length: 7 }).map((_, i) => (
          // Domingo é 0, então o mapeamento está correto
          <View key={i} style={[styles.dot, trainedDays.has(i) && styles.dotFilled]} />
        ))}
      </View>
    );
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

  const renderActiveWorkout = () => {
    if (!activeLog) return null;

    return (
      <View style={styles.nextWorkoutCard}>
        <ThemedText type="subtitle" style={styles.cardTitle}><MaterialCommunityIcons name="progress-clock" size={16} color="#FFA500" /> Treino Rolando</ThemedText>
        <TouchableOpacity style={styles.workoutContent} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}`)}>
          <View style={styles.workoutInfoContainer}>
            <View style={styles.workoutTitleContainer}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="#fff" />
              <ThemedText style={styles.workoutName}>{activeLog.treino.nome}</ThemedText>
            </View>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeLog.treino.fichaId}&treinoId=${activeLog.treino.id}`)}>
            <ThemedText style={styles.startButtonText}>Continuar</ThemedText>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNextWorkout = () => {
    if (activeLog || treinos.length === 0 || !activeFicha) return null;

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
      <View style={styles.nextWorkoutCard}>
        <ThemedText type="subtitle" style={styles.cardTitle}>{titulo}</ThemedText>
        <TouchableOpacity style={styles.workoutContent} onPress={() => router.push(`/(treino)/editarTreino?fichaId=${activeFicha.id}&treinoId=${nextTreino.id}`)}>
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
          <TouchableOpacity style={styles.startButton} onPress={() => router.push(`/(treino)/ongoingWorkout?fichaId=${activeFicha.id}&treinoId=${nextTreino.id}`)}>
            <ThemedText style={styles.startButtonText}>Começar</ThemedText>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Componente do Header Customizado
  const CustomHeader = () => (
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
            <ThemedText style={styles.greetingText}>Olá, {profile?.nome?.split(' ')[0]}!</ThemedText>
            <ThemedText style={styles.subGreetingText}>Vamos treinar hoje?</ThemedText>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.headerStreakContainer}>
        <Image source={getStreakImage()} style={styles.headerStreakImage} />
        <View style={styles.headerStreakTextContainer}>
          <ThemedText style={styles.headerStreakNumber}>{weeklyStats.streak}</ThemedText>
          <ThemedText style={styles.headerStreakLabel}>semanas</ThemedText>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const ListHeader = () => {
    const workoutsThisWeekMet = weeklyStats.workoutsThisWeek >= weeklyStats.goal;
    return (
      <>
        {/* O header antigo foi removido daqui */}
        <ThemedView style={styles.section}>
          {renderWeeklyCalendar()}
        </ThemedView>
        <ThemedView style={styles.transparentSection}>
          {activeLog ? renderActiveWorkout() : (treinos.length > 0 && activeFicha) ? renderNextWorkout() : null}
        </ThemedView>

<ThemedView style={styles.section}>
    <ThemedText type="subtitle" style={styles.cardTitle}>Minhas Metas</ThemedText>
    <View style={styles.goalsContainer}>
      
      {/* Meta de Treinos na Semana */}
      <View style={styles.statBox}>
        {/* Este é o "progressBarFill" da sua barra vertical */}
        <LinearGradient
          colors={['#1cb0f620', '#1cb0f6']} // Cor sólida para o preenchimento
          style={[
            styles.statBoxProgress,
            {
              // Ajustamos a ALTURA com base na porcentagem
              height: `${Math.min(100, (weeklyStats.workoutsThisWeek / (weeklyStats.goal || 1)) * 100)}%`,
            },
          ]}
        />
        {/* Conteúdo fica por cima do preenchimento */}
        <ThemedText style={styles.statValue}>{weeklyStats.workoutsThisWeek}/{weeklyStats.goal}</ThemedText>
        <ThemedText style={styles.statLabel}>Treinos na semana</ThemedText>
      </View>
      
      {/* Meta de Semanas em Sequência */}
      <View style={styles.statBox}>
        {/* "progressBarFill" para a segunda barra */}
        <LinearGradient
          colors={['#DAA52020', '#DAA520']} // Cor sólida para o preenchimento
          style={[
            styles.statBoxProgress,
            {
              // Novamente, ajustamos a ALTURA
              height: `${Math.min(100, (weeklyStats.streak / (profile?.weeksStreakGoal || 1)) * 100)}%`,
            }
          ]}
        />
        <ThemedText style={styles.statValue}>{weeklyStats.streak}/{profile?.weeksStreakGoal || 4}</ThemedText>
        <ThemedText style={styles.statLabel}>Semanas em sequência</ThemedText>
      </View>

    </View>
</ThemedView>
        {!activeFicha && (
          <ThemedView style={styles.section}>
            <TouchableOpacity style={styles.newSheetButton} onPress={() => setModalVisible(true)}>
              <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Criar Nova Ficha</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={{ marginBottom: 10, color:'#fff' }}>Amigos</ThemedText>
        </ThemedView>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Renderize o Header Customizado aqui */}
        <CustomHeader />
        
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.friendItem}>
              <ThemedText style={styles.friendName}>{item.nome}</ThemedText>
              {renderWeeklyDots(item)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030405',
  },
  container: {
    flex: 1,
  },
  // ESTILOS PARA O NOVO HEADER
  customHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#030405',
    marginBottom: 20,
    marginTop: 30,
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
    borderColor: '#FFA500', // Laranja
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
  headerRight: {
    // Espaçamento se necessário
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
  // ESTILOS ANTIGOS
  section: {
    marginBottom: 15,
    backgroundColor: '#030405',
    paddingHorizontal: 10,
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
    borderColor: '#ffffff29',
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
    borderColor: '#ffffff1a',
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
    backgroundColor: '#141414',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ffffff29',
  },
  workoutContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    alignItems: 'center',
    marginBottom: 15,
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
  goalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },

// ...dentro do StyleSheet.create

statBox: {
  flex: 1,
  position: 'relative', // Essencial para o posicionamento absoluto do filho
  backgroundColor: '#ffffff1a',
  paddingVertical: 20,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden', // Garante que o gradiente não vaze para fora
  borderRadius: 15,
  height: 140,
},

// Este é o nosso "progressBarFill"
statBoxProgress: {
  position: 'absolute',
  left: 0,
  bottom: 0,       // Começa de baixo
  width: '100%',   // Ocupa a largura total
  // A altura ('height') é definida dinamicamente no componente
},

// ...resto dos estilos
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
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 10,
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
  weeklyDotsContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  dotFilled: {
    backgroundColor: '#DAA520',
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
});