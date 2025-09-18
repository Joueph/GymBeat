// joueph/gymbeat/GymBeat-Android/gymbeat/app/(tabs)/index.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Pressable, ActivityIndicator, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../authprovider';
import { getLogsByUsuarioId } from '../../services/logService';
import { addFicha } from '../../services/fichaService';
import { getTreinosByUsuarioId } from '../../services/treinoService';
import { getUserProfile } from '../../userService';
import { Usuario } from '../../models/usuario';
import { Treino } from '../../models/treino';
import { Log } from '../../models/log';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const router = useRouter();
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [friends, setFriends] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        try {
          // Fetch logs, treinos, and friends in parallel
          const [userLogs, userTreinos, userProfile] = await Promise.all([
            getLogsByUsuarioId(user.uid),
            getTreinosByUsuarioId(user.uid),
            getUserProfile(user.uid),
          ]);

          setLogs(userLogs);
          setTreinos(userTreinos);
          setProfile(userProfile);

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
                    const lastTrainedDate = (friendProfile.lastTrained as any).toDate ? (friendProfile.lastTrained as any).toDate() : new Date(friendProfile.lastTrained);
                    hasTrainedToday = lastTrainedDate.toDateString() === today;
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
  }, [user]);

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
 
    const loggedDays = new Set(logs.map(log => {
      // Firestore Timestamps precisam ser convertidos para Datas JS
      const logDate = log.horarioFim && typeof (log.horarioFim as any).toDate === 'function'
        ? (log.horarioFim as any).toDate()
        : new Date(log.horarioFim as any);
      return logDate.toDateString();
    }));

    return (
      <View style={styles.calendarContainer}>
        {weekDays.map((day, index) => {
          const date = new Date();
          date.setDate(today.getDate() - (currentDay - index));
          const isPastOrToday = index <= currentDay;
          const isLogged = loggedDays.has(date.toDateString());
 
          const dayStyles = [
            styles.dayContainer,
            isPastOrToday && styles.progressionOverlay,
            isLogged && styles.loggedDay,
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
    if (treinos.length > 0) {
      const nextTreino = treinos[0]; // Simple logic: gets the first workout
      const lastLog = logs.find(log => log.treino.id === nextTreino.id);
      const duration = lastLog ? `${Math.round((new Date(lastLog.horarioFim).getTime() - new Date(lastLog.horarioInicio).getTime()) / 60000)} min` : "N/A";

      return (
        <View style={styles.duolingoCard}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Próximo Treino: {nextTreino.nome}</ThemedText>
          <ThemedText style={styles.cardText}>Duração Média: {duration}</ThemedText>
          <ThemedText style={styles.cardText}>Exercícios: {nextTreino.exercicios.map(e => e.modelo.nome).join(', ')}</ThemedText>
          <TouchableOpacity style={styles.startButton}>
            <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Começar Treino</ThemedText>
          </TouchableOpacity>
        </View>
      );
    } else {
      return null;
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const ListHeader = () => (
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
        <TouchableOpacity style={styles.newSheetButton} onPress={() => setModalVisible(true)}>
          <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Criar Nova Ficha</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={{ marginBottom: 10 }}>Amigos</ThemedText>
      </ThemedView>
    </>
  );

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
  dayText: {
    fontWeight: 'bold',
    color: '#E0E0E0',
  },
  dateText: {
    marginTop: 5,
    color: '#FFFFFF',
  },
  duolingoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    color: '#fff',
    marginBottom: 10,
  },
  cardText: {
    color: '#ccc',
    marginBottom: 5,
  },
  startButton: {
    backgroundColor: '#58CC02',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  actionButton: {
    backgroundColor: '#1cb0f6',
    padding: 10,
    borderRadius: 8,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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