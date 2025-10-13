import { FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { memo, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebaseconfig';
import { Ficha } from '../../models/ficha';
import { Log } from '../../models/log';
import { Projeto } from '../../models/projeto';
import { Treino } from '../../models/treino';
import { Usuario } from '../../models/usuario';
import { getFichaAtiva } from '../../services/fichaService';
import { getLogsByUsuarioId } from '../../services/logService';
import { getTreinosByIds } from '../../services/treinoService';
import { acceptFriendRequest, getUserProfile, rejectFriendRequest } from '../../userService';
import { useAuth } from '../authprovider';

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
    const day = d.getDay();
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
  const router = useRouter();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOptionsModalVisible, setAddOptionsModalVisible] = useState(false);
  const [isNotificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [isJoinProjectModalVisible, setJoinProjectModalVisible] = useState(false);
  const [isAddFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projetos, setProjetos] = useState<Projeto[]>([]);
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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (userDoc) => {
      if (userDoc.exists()) {
        const userProfile = { id: userDoc.id, ...userDoc.data() } as Usuario;

        if (userProfile.projetos && userProfile.projetos.length > 0) {
            const projetosPromises = userProfile.projetos.map((id: string) => getDoc(doc(db, 'projetos', id)));
            const projetosSnapshots = await Promise.all(projetosPromises);
            const projetosData = projetosSnapshots
                .filter(docSnap => docSnap.exists())
                .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Projeto));
            setProjetos(projetosData);
        } else {
            setProjetos([]);
        }
        
        const amizadesMap = userProfile.amizades || {};

        const requesterIds = Object.keys(amizadesMap).filter(id => amizadesMap[id] === false);
        const requestProfiles = await Promise.all(requesterIds.map(id => getUserProfile(id)));
        setFriendRequests(requestProfiles.filter((p): p is Usuario => p !== null));

        const confirmedFriendIds = Object.keys(amizadesMap).filter(id => amizadesMap[id] === true);
        
        const friendsDataPromises = confirmedFriendIds.map(async (friendId) => {
          const friendProfile = await getUserProfile(friendId);
          if (friendProfile) {
            const weekStart = getStartOfWeek(new Date());
            const friendLogs = await getLogsByUsuarioId(friendId);
            const weeklyLogs = friendLogs.filter(log => {
                const logDate = toDate(log.horarioFim);
                return logDate && logDate >= weekStart;
            });

            const today = new Date().toDateString();
            const lastTrainedDate = toDate(friendProfile.lastTrained);
            const hasTrainedToday = lastTrainedDate ? lastTrainedDate.toDateString() === today : false;
            
            return { ...friendProfile, hasTrainedToday, weeklyLogs };
          }
          return null;
        });

        const friendsData = (await Promise.all(friendsDataPromises)).filter(Boolean) as FriendData[];
        setFriends(friendsData);

      } else {
        setFriends([]);
        setFriendRequests([]);
        setProjetos([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleJoinProject = () => {
      const match = projectCode.match(/\{([^}]+)\}/);
      const extractedId = match ? match[1] : projectCode;
      if (extractedId.trim()) {
          setJoinProjectModalVisible(false);
          router.push(`/(projetos)/${extractedId.trim()}`);
      } else {
          Alert.alert("Código Inválido", "Por favor, insira um código de projeto válido.");
      }
  };

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
      
      await sendFriendRequestCallable({
        fromUserId: user.uid,
        friendCode: friendCode.trim(),
      });
      
      Alert.alert("Sucesso", "Pedido de amizade enviado!");
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
      Alert.alert("Pedido Recusado", "O pedido de amizade foi recusado.");
    } catch (error) {
      console.error("Erro ao recusar pedido:", error);
      Alert.alert("Erro", "Não foi possível recusar o pedido de amizade.");
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const ListHeader = () => (
    <>
      <View style={styles.section}>
        {/* O View sectionHeader foi removido pois o padding agora está no estilo do título */}
        <Text style={styles.mainSectionTitle}>Meus Projetos</Text>
        <FlatList
          data={[...projetos, { id: 'add' }]}
          renderItem={({ item }: { item: Projeto | { id: 'add' } }) => {
            if ('titulo' in item) {
              return (
                <TouchableOpacity style={styles.projetoCard} onPress={() => router.push(`/(projetos)/${item.id}`)}>
                  <Image source={{ uri: item.fotoCapa || 'https://via.placeholder.com/350x150.png/141414/808080?text=Projeto' }} style={styles.projetoCardImage} />
                  <View style={styles.projetoCardOverlay} />
                  <View style={styles.projetoCardContent}>
                    <Text style={styles.projetoCardTitle} numberOfLines={2}>{item.titulo}</Text>
                    <View style={styles.projetoCardInfo}>
                      <View style={styles.infoItem}><FontAwesome name="users" size={14} color="#fff" /><Text style={styles.infoText}>{item.participantes?.length || 0}</Text></View>
                      <View style={styles.infoItem}><FontAwesome name="fire" size={14} color="#DAA520" /><Text style={styles.infoText}>{item.semanasSeguidas || 0}</Text></View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            } else {
              return (
                <TouchableOpacity style={styles.createProjetoCard} onPress={() => setAddOptionsModalVisible(true)}>
                  <FontAwesome name="plus" size={30} color="#888" />
                </TouchableOpacity>
              );
            }
          }}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 8, paddingVertical: 10 }}
        />
      </View>
      <Text style={[styles.mainSectionTitle, { marginTop: 15, marginBottom: 0 }]}>Amigos</Text>
    </>
  );

  return (
    <>
      <FlatList
        data={friends}
        renderItem={({ item }) => <FriendListItem item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Adicione amigos para vê-los aqui!</Text></View>}
      />
      
      {/* Modal de Opções: Criar ou Entrar em Projeto */}
      <Modal visible={isAddOptionsModalVisible} transparent={true} animationType="fade" onRequestClose={() => setAddOptionsModalVisible(false)}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setAddOptionsModalVisible(false)}>
              <View style={styles.drawerContainer}>
                  <TouchableOpacity style={styles.drawerOption} onPress={() => { setAddOptionsModalVisible(false); router.push('/(projetos)/criar'); }}>
                      <FontAwesome name="plus-circle" size={20} color="#fff" />
                      <Text style={styles.drawerOptionText}>Criar um novo projeto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerOption} onPress={() => { setAddOptionsModalVisible(false); setJoinProjectModalVisible(true); }}>
                      <FontAwesome name="sign-in" size={20} color="#fff" />
                      <Text style={styles.drawerOptionText}>Entrar em um projeto</Text>
                  </TouchableOpacity>
              </View>
          </TouchableOpacity>
      </Modal>

      {/* Modal para Entrar em Projeto com Código */}
      <Modal visible={isJoinProjectModalVisible} transparent={true} animationType="slide" onRequestClose={() => setJoinProjectModalVisible(false)}>
          <View style={styles.modalCenteredView}>
              <View style={styles.modalView}>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setJoinProjectModalVisible(false)}>
                      <FontAwesome name="close" size={22} color="#ccc" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Entrar em um Projeto</Text>
                  <TextInput 
                    style={styles.joinProjectInput} 
                    placeholder="Cole a mensagem de convite aqui" 
                    placeholderTextColor="#888" 
                    value={projectCode} 
                    onChangeText={setProjectCode}
                    multiline
                  />
                  <TouchableOpacity style={styles.addButton} onPress={handleJoinProject}>
                      <Text style={styles.addButtonText}>Acessar Projeto</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

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

      {/* Modal Adicionar Amigo */}
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
                <TouchableOpacity style={[styles.addButton, {width: 'auto', marginLeft: 10, paddingHorizontal: 15}]} onPress={handleAddFriend}>
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

const cardWidth = Dimensions.get('window').width * 0.9;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#030405",
    paddingBottom: 20,
    flexGrow: 1,
  },
  section: {
    marginBottom: 15,
    backgroundColor: '#030405',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
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
    color: "#fff",
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  mainSectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    paddingHorizontal: 16,
    marginTop: 10,
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
    backgroundColor: '#1cb0f6',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
  },
  projetoCard: {
    width: cardWidth,
    height: 150,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: '#141414',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  projetoCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  projetoCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  projetoCardContent: {
    padding: 12,
  },
  projetoCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  projetoCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  createProjetoCard: {
    width: 120,
    height: 150,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#222',
    borderStyle: 'dashed',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    backgroundColor: '#141414',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  drawerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  drawerOptionText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 15,
  },
  modalCenteredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
      margin: 20,
      backgroundColor: '#141414',
      borderRadius: 20,
      padding: 35,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      width: '90%',
  },
  joinProjectInput: {
    height: 60,
    width: '100%',
    backgroundColor: '#141414',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
});
