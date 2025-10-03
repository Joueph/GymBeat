import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { memo, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { Treino } from '../../models/treino';
import { Usuario } from '../../models/usuario';
import { getFichaAtiva } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { getTreinosByIds } from '../../services/treinoService';
import { acceptFriendRequest, getUserProfile, rejectFriendRequest } from '../../userService';
import { useAuth } from '../authprovider';

// Interface de dados ATUALIZADA para refletir o status de treino
interface FriendData extends Usuario {
  hasTrainedToday: boolean;
  weeklyLogs: Log[];
}

const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay(); // 0 para Domingo
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const FriendListItem = memo(({ item }: { item: FriendData }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [friendFicha, setFriendFicha] = useState<Ficha | null>(null);
  const [friendTreinos, setFriendTreinos] = useState<Treino[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<Log[]>([]);

  const toggleExpand = async () => {
    const expanding = !isExpanded;
    setIsExpanded(expanding);

    if (expanding && !friendFicha) { // Fetch data only on first expansion
      setIsLoadingDetails(true);
      try {
        const [ficha, logs] = await Promise.all([
          getFichaAtiva(item.id),
          getLogsByUsuarioId(item.id) // Fetch all logs for the calendar
        ]);
        setFriendFicha(ficha);
        setMonthlyLogs(logs);

        if (ficha && ficha.treinos.length > 0) {
          const treinos = await getTreinosByIds(ficha.treinos);
          setFriendTreinos(treinos);
        }
      } catch (error) {
        console.error("Error fetching friend details:", error);
        Alert.alert("Erro", "Não foi possível carregar os detalhes do amigo.");
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  const renderWeeklyDots = () => {
    const weekStart = getStartOfWeek(new Date());
    const trainedDays = new Set(
      item.weeklyLogs.map(log => toDate(log.horarioFim)?.getDay())
    );

    return (
      <View style={styles.weeklyDotsContainer}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={[styles.dot, trainedDays.has(i) && styles.dotFilled]} />
        ))}
      </View>
    );
  };

  const renderMonthlyCalendar = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const loggedDays = new Set(
      monthlyLogs
        .filter(log => {
          const logDate = toDate(log.horarioFim);
          return logDate && logDate.getFullYear() === year && logDate.getMonth() === month;
        })
        .map(log => toDate(log.horarioFim)!.getDate())
    );

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`blank-${i}`} style={styles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const isLogged = loggedDays.has(i);
      days.push(
        <View key={i} style={styles.dayCell}>
          <View style={[styles.dayRing, isLogged && styles.loggedDayRing]}>
            <Text style={styles.dayText}>{i}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.weekDaysContainer}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <Text key={i} style={styles.weekDayText}>{day}</Text>)}
        </View>
        <View style={styles.calendarGrid}>{days}</View>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={toggleExpand}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.pfp} />
        ) : (
          <View style={styles.pfpPlaceholder}>
            <FontAwesome name="user" size={20} color="#555" />
          </View>
        )}
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>{item.nome}</Text>
          {renderWeeklyDots()}
        </View>
        <FontAwesome name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#ccc" />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {isLoadingDetails ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {friendFicha ? (
                <View style={styles.fichaContainer}>
                  <Text style={styles.expandedSectionTitle}>Ficha Ativa: {friendFicha.nome}</Text>
                  {friendTreinos.map(treino => (
                    <View key={treino.id} style={styles.treinoItem}>
                      <Text style={styles.treinoName}>{treino.nome}</Text>
                      <Text style={styles.treinoDays}>{treino.diasSemana.join(', ').toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Este amigo não possui uma ficha ativa.</Text>
              )}
              <View style={styles.divider} />
              <Text style={styles.expandedSectionTitle}>Atividade em {new Date().toLocaleString('pt-BR', { month: 'long' })}</Text>
              {renderMonthlyCalendar()}
            </>
          )}
        </View>
      )}
    </View>
  );
});

export default function AmigosScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [isNotificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState<Usuario | null>(null);
  const [friendRequests, setFriendRequests] = useState<Usuario[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 25, marginRight: 15 }}>
          <TouchableOpacity onPress={() => setNotificationsModalVisible(true)}>
            <FontAwesome name="bell" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddFriendModalVisible(true)}>
            <FontAwesome name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, user]);

  const handleAddFriend = async () => {
    if (!user || !friendCode.trim()) {
      Alert.alert("Código Inválido", "Por favor, insira um código de amigo.");
      return;
    }
    
    if (friendCode.trim().toLowerCase() === user.email?.toLowerCase()) {
      Alert.alert("Ops!", "Você não pode adicionar a si mesmo como amigo.");
      return;
    }

    try {
      const functions = getFunctions();
      const sendFriendRequestCallable = httpsCallable(functions, 'sendFriendRequest');
      
      const result = await sendFriendRequestCallable({
        fromUserId: user.uid,
        friendCode: friendCode.trim(),
      });
      
      // @ts-ignore
      if (result.data.autoAccepted) {
        Alert.alert("Amigo Adicionado!", "O usuário aceita amizades automaticamente e já foi adicionado à sua lista.");
        setAddFriendModalVisible(false);
        fetchFriendsData();
      } else {
        Alert.alert("Sucesso", "Pedido de amizade enviado!");
      }

      setFriendCode('');
    } catch (error: any) {
      console.error("Erro ao enviar pedido de amizade:", error);
      Alert.alert("Erro", error.message || "Não foi possível enviar o pedido de amizade.");
    }
  };

  const handleShareCode = async () => {
    if (!user) return;
    try {
      const messageToShare = `Cole esta mensagem no código de amigo! O código é: {${user.email}}`;
      await Share.share({ message: messageToShare, title: 'Meu Código de Amigo GymBeat' });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível compartilhar seu código.");
    }
  }

  const handleFriendCodeChange = (text: string) => {
    const match = text.match(/\{([^}]+)\}/);
    setFriendCode(match ? match[1] : text);
  };

  const handleAcceptRequest = async (requesterId: string) => {
    if (!user) return;
    try {
      await acceptFriendRequest(user.uid, requesterId);
      setFriendRequests(prev => prev.filter(req => req.id !== requesterId));
      fetchFriendsData(); 
      Alert.alert("Amizade Aceita!", "Vocês agora são amigos.");
    } catch (error) {
      console.error("Erro ao aceitar pedido:", error);
      Alert.alert("Erro", "Não foi possível aceitar o pedido de amizade.");
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    if (!user) return;
    try {
      await rejectFriendRequest(user.uid, requesterId);
      setFriendRequests(prev => prev.filter(req => req.id !== requesterId));
      Alert.alert("Pedido Recusado", "O pedido de amizade foi recusado.");
    } catch (error) {
      console.error("Erro ao recusar pedido:", error);
      Alert.alert("Erro", "Não foi possível recusar o pedido de amizade.");
    }
  };
  
  useEffect(() => {
    if (currentUserProfile?.solicitacoesRecebidas && Array.isArray(currentUserProfile.solicitacoesRecebidas) && currentUserProfile.solicitacoesRecebidas.length > 0) {
      const fetchRequesters = async () => {
        const profiles = await Promise.all(currentUserProfile.solicitacoesRecebidas!.map(id => getUserProfile(id)));
        setFriendRequests(profiles.filter(p => p !== null) as Usuario[]);
      };
      fetchRequesters();
    }
  }, [currentUserProfile?.solicitacoesRecebidas]);

  // Função `fetchFriendsData` ATUALIZADA com a nova lógica
  const fetchFriendsData = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Busca o perfil do usuário logado
      const userProfile = await getUserProfile(user.uid);
      setCurrentUserProfile(userProfile);

      // 2. Verifica se a lista de amizades existe e é um array
      if (userProfile && userProfile.amizades && Array.isArray(userProfile.amizades)) {
        
        // 3. Mapeia os IDs de amigos para buscar os dados de cada um
        const friendsDataPromises = userProfile.amizades.map(async (friendId) => {
          const friendProfile = await getUserProfile(friendId);

          // 4. VERIFICAÇÃO DE AMIZADE MÚTUA
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
            // 5. VERIFICAÇÃO DE TREINO HOJE
            const today = new Date().toDateString();
            let hasTrainedToday = false;
            
            if (friendProfile.lastTrained) {
              const lastTrainedDate = toDate(friendProfile.lastTrained);
              if (lastTrainedDate) {
                hasTrainedToday = lastTrainedDate.toDateString() === today;
              }
            }
            // Retorna o perfil do amigo com a informação de treino
            return { ...friendProfile, hasTrainedToday, weeklyLogs };
          }
          // Retorna nulo se a amizade não for mútua
          return null;
        });

        // 6. Aguarda todas as buscas e filtra os resultados nulos
        const friendsData = (await Promise.all(friendsDataPromises))
                                .filter(Boolean) as FriendData[];
        setFriends(friendsData);
      
      } else {
        // Se não houver amigos, a lista fica vazia
        setFriends([]);
      }
    } catch (error) {
      console.error("Erro ao buscar dados de amigos:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados dos amigos.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchFriendsData();
    }, [fetchFriendsData])
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <>
      <FlatList
        data={friends}
        renderItem={({ item }) => <FriendListItem item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Adicione amigos para vê-los aqui!</Text>
          </View>
        }
      />
      {/* Modal de Notificações */}
      <Modal
        animationType="slide"
        visible={isNotificationsModalVisible}
        onRequestClose={() => setNotificationsModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notificações</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity onPress={fetchFriendsData} style={{ marginRight: 20 }}>
                  <FontAwesome name="refresh" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}>
                  <FontAwesome name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.notificationItem}>
                  <View style={styles.notificationUserInfo}>
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={styles.notificationPfp} />
                    ) : (
                      <View style={styles.notificationPfpPlaceholder}>
                        <FontAwesome name="user" size={20} color="#555" />
                      </View>
                    )}
                    <View>
                      <Text style={styles.notificationName}>{item.nome}</Text>
                      <Text style={styles.notificationText}>enviou um pedido de amizade.</Text>
                    </View>
                  </View>
                  <View style={styles.notificationActions}>
                    <TouchableOpacity style={[styles.notificationButton, styles.acceptButton]} onPress={() => handleAcceptRequest(item.id)}>
                      <Text style={styles.notificationButtonText}>Aceitar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.notificationButton, styles.rejectButton]} onPress={() => handleRejectRequest(item.id)}>
                      <Text style={styles.notificationButtonText}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>Nenhuma notificação nova.</Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de Adicionar Amigo */}
      <Modal
        animationType="slide"
        visible={isAddFriendModalVisible}
        onRequestClose={() => setAddFriendModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Amigo</Text>
              <TouchableOpacity onPress={() => setAddFriendModalVisible(false)}>
                <FontAwesome name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.addSection}>
              <Text style={styles.sectionTitle}>Adicionar por código</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o código do amigo"
                  placeholderTextColor="#888"
                  value={friendCode}
                  onChangeText={handleFriendCodeChange}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
                  <Text style={styles.addButtonText}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.shareSection}>
              <Text style={styles.sectionTitle}>Meu código de amigo</Text>
              <Text style={styles.friendCodeText}>{user?.email}</Text>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareCode}>
                <FontAwesome name="share-alt" size={16} color="#fff" />
                <Text style={styles.shareButtonText}>Compartilhar Código</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#030405",
    padding: 8,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    marginVertical: 8,
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  pfp: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  pfpPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  weeklyDotsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
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
  expandedContent: {
    padding: 15,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    marginTop: 10,
  },
  expandedSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  fichaContainer: {
    paddingTop: 10,
    marginBottom: 10,
  },
  treinoItem: {
    backgroundColor: '#222',
    borderRadius: 6,
    padding: 10,
    marginBottom: 5,
  },
  treinoName: {
    color: '#fff',
    fontWeight: 'bold',
  },
  treinoDays: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  calendarContainer: {
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 10,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    color: '#ccc',
    fontWeight: 'bold',
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayRing: {
    width: '85%',
    height: '85%',
    borderRadius: 50,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'transparent',
  },
  loggedDayRing: {
    borderColor: '#DAA520',
  },
  dayText: {
    color: '#fff',
    fontSize: 12,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#030405",
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff"
  },
  addSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 10,
  },  
  inputContainer: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    backgroundColor: '#141414',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addButton: {
    marginLeft: 10,
    backgroundColor: '#1cb0f6',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#ffffff1a',
    marginVertical: 20,
  },
  shareSection: {
    alignItems: 'center',
  },
  friendCodeText: {
    backgroundColor: '#141414',
    color: '#fff',
    fontSize: 14,
    padding: 15,
    borderRadius: 8,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 20,
    width: '100%',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#2c2c2e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  notificationItem: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  notificationUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  notificationPfp: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  notificationPfpPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notificationText: {
    color: '#ccc',
    fontSize: 14,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  notificationButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#1cb0f6',
  },
  rejectButton: {
    backgroundColor: '#2c2c2e',
  },
  notificationButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  }
});