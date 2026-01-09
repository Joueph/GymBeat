import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, getDocFromCache, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { OngoingWorkoutFooter } from '../../components/OngoingWorkoutFooter';
import { AddFriendModal } from '../../components/amigos/AddFriendModal';
import { FriendData, FriendListItem } from '../../components/amigos/FriendListItem';
import { FriendRequestsModal } from '../../components/amigos/FriendRequestsModal';
import { PerfilCard } from '../../components/amigos/PerfilCard';
import { ProjetosSection } from '../../components/amigos/ProjetosSection';
import { db } from '../../firebaseconfig';
import { Log } from '../../models/log';
import { Projeto } from '../../models/projeto';
import { Usuario } from '../../models/usuario';
import { getLogsByUsuarioId } from '../../services/logService';
import { getTreinosByUsuarioId } from '../../services/treinoService';
import { acceptFriendRequest, getUserProfile, rejectFriendRequest } from '../../userService';
import { useAuth } from '../authprovider';
import { useNetwork } from '../networkprovider';


const toDate = (date: any): Date | null => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};
// FriendListItem extracted to components/amigos/FriendListItem.tsx

export default function AmigosScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetwork(); // Check network status
  const router = useRouter();
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOptionsModalVisible, setAddOptionsModalVisible] = useState(false);
  const [isNotificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [isJoinProjectModalVisible, setJoinProjectModalVisible] = useState(false);
  const [isAddFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState(''); // Only kept if needed by other logic, but should be removed if moved to modal
  const [projectCode, setProjectCode] = useState('');
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [friendRequests, setFriendRequests] = useState<Usuario[]>([]);

  const [userWorkoutsCount, setUserWorkoutsCount] = useState(0);
  const [userTotalVolume, setUserTotalVolume] = useState(0);
  const isInitialLoad = useRef(true);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        if (!user) return;

        if (isInitialLoad.current) {
          setLoading(true);
        }

        try {
          const cachedDoc = await getDocFromCache(doc(db, "users", user.id));
          if (cachedDoc.exists()) {
            // Cache hit logic if needed
          }
        } catch (error) {
          console.log("Aguardando conexão online.");
        }

        const unsubscribe = onSnapshot(doc(db, "users", user.id), async (userDoc) => {
          try {
            // 1. Busca dados do próprio usuário (Treinos e Logs)
            const [userWorkouts, userLogs] = await Promise.all([
              getTreinosByUsuarioId(user.id),
              getLogsByUsuarioId(user.id)
            ]);

            setUserWorkoutsCount(userWorkouts.length);
            const totalVolume = userLogs.reduce((sum, log) => sum + (log.cargaAcumulada || 0), 0);
            setUserTotalVolume(totalVolume);

            if (userDoc.exists()) {
              const userProfile = { id: userDoc.id, ...userDoc.data() } as Usuario;

              // 2. Busca Projetos
              if (userProfile.projetos && userProfile.projetos.length > 0) {
                const projetosPromises = userProfile.projetos.map(async (id: string) => {
                  try {
                    const docSnap = await getDoc(doc(db, 'projetos', id));
                    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Projeto : null;
                  } catch (e) {
                    console.warn(`Erro ao carregar projeto ${id}`, e);
                    return null;
                  }
                });
                const projetosSnapshots = await Promise.all(projetosPromises);
                setProjetos(projetosSnapshots.filter((p): p is Projeto => p !== null));
              } else {
                setProjetos([]);
              }

              const amizadesMap = userProfile.amizades || {};

              // 3. Busca Solicitações de Amizade (com tratamento de erro individual)
              const requesterIds = Object.keys(amizadesMap).filter(id => amizadesMap[id] === false);
              const requestProfilesPromises = requesterIds.map(async (id) => {
                try {
                  return await getUserProfile(id);
                } catch (error) {
                  console.warn(`[Amigos] Ignorando solicitação de usuário inacessível/deletado (${id}):`, error);
                  return null;
                }
              });
              const requestProfiles = await Promise.all(requestProfilesPromises);
              setFriendRequests(requestProfiles.filter((p): p is Usuario => p !== null));

              // 4. Busca Amigos Confirmados (com tratamento de erro individual)
              const confirmedFriendIds = Object.keys(amizadesMap).filter(id => amizadesMap[id] === true);

              const friendsDataPromises = confirmedFriendIds.map(async (friendId: string) => {
                try {
                  const functions = getFunctions();
                  const getFriendActivity = httpsCallable(functions, 'getFriendActivity');
                  const result = await getFriendActivity({ friendId });

                  const friendData = result.data as any;

                  if (!friendData || !friendData.profile) {
                    console.warn(`[Amigos] Dados incompletos para o amigo ${friendId}.`);
                    return null;
                  }

                  const weeklyLogs = (friendData.weeklyLogs || []).map((log: any) => ({ ...log, horarioFim: toDate(log.horarioFim) })) as Log[];
                  const lastTrainedDate = toDate(friendData.profile.lastTrained);
                  const hasTrainedToday = lastTrainedDate ? lastTrainedDate.toDateString() === new Date().toDateString() : false;

                  return { ...friendData.profile, hasTrainedToday, weeklyLogs } as FriendData;
                } catch (error) {
                  console.warn(`[Amigos] Ignorando amigo inacessível/deletado (${friendId}).`, error);
                  return null;
                }
              });

              const friendsData = (await Promise.all(friendsDataPromises)).filter(Boolean) as FriendData[];
              setFriends(friendsData);

            }
          } catch (globalError) {
            console.error("[Amigos] Erro crítico ao processar dados:", globalError);
          } finally {
            setLoading(false);
          }
        });

        return () => unsubscribe();
      };

      fetchData();
    }, [user])
  );

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

  // handleAddFriend logic moved to AddFriendModal

  const handleShareCode = async () => {
    if (!user) return;
    try {
      // Generate Deep Link
      // Assuming the website handles the /invite path and redirects to app or store
      // Or if strictly internal, could use gymbeat://invite, but web URL is safer for cross-platform sharing 
      // where the recipient might not have the app.
      const url = `https://gymbeat.com.br/invite?friendCode=${encodeURIComponent(user.email || '')}`;

      const messageToShare = `Junte-se a mim no GymBeat! Clique aqui para aceitar meu convite de amizade: ${url}`;

      await Share.share({
        message: messageToShare,
        // url: url, // iOS sometimes prefers url field, but message usually works for both textual + url
        title: 'Convite GymBeat'
      });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível compartilhar seu código.");
    }
  }

  // handleFriendCodeChange logic moved to AddFriendModal

  const handleAcceptRequest = async (requesterId: string) => {
    if (!user) return;
    try {
      await acceptFriendRequest(user.id, requesterId);
      Alert.alert("Amizade Aceita!", "Vocês agora são amigos.");
    } catch (error) {
      console.error("Erro ao aceitar pedido:", error);
      Alert.alert("Erro", "Não foi possível aceitar o pedido de amizade.");
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    if (!user) return;
    try {
      await rejectFriendRequest(user.id, requesterId);
      Alert.alert("Pedido Recusado", "O pedido de amizade foi recusado.");
    } catch (error) {
      console.error("Erro ao recusar pedido:", error);
      Alert.alert("Erro", "Não foi possível recusar o pedido de amizade.");
    }
  };

  if (!isOnline) {
    return (
      <View style={[styles.centered, { backgroundColor: "#030405" }]}>
        <FontAwesome name="wifi" size={50} color="#555" style={{ marginBottom: 20 }} />
        <Text style={[styles.emptyText, { fontSize: 18, textAlign: 'center' }]}>
          Você está offline.
        </Text>
        <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 10, maxWidth: '80%' }}>
          Recursos sociais como ranking, amigos e projetos precisam de internet para funcionar.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  const ListHeader = () => (
    <>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Social</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setNotificationsModalVisible(true)} style={styles.headerButton}>
            <FontAwesome name="bell" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddFriendModalVisible(true)} style={styles.headerButton}>
            <FontAwesome name="user-plus" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareCode} style={styles.headerButton}>
            <FontAwesome name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <PerfilCard
        user={user}
        friendsCount={friends.length}
        workoutsCount={userWorkoutsCount}
        totalVolume={userTotalVolume}
      />
      <ProjetosSection
        projetos={projetos}
        onAddProjectPress={() => setAddOptionsModalVisible(true)}
      />
      <Text style={[styles.mainSectionTitle, { marginTop: 15, marginBottom: 10 }]}>Amigos</Text>
    </>
  );

  return (
    <>
      <FlatList
        data={friends}
        renderItem={({ item }) => <FriendListItem item={item} />}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, backgroundColor: "#030405" }}
        contentContainerStyle={styles.container}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Adicione amigos para vê-los aqui!</Text></View>}
      />
      <OngoingWorkoutFooter />

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

      <FriendRequestsModal
        visible={isNotificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
        requests={friendRequests}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />

      <AddFriendModal
        visible={isAddFriendModalVisible}
        onClose={() => setAddFriendModalVisible(false)}
        user={user}
      />
    </>
  );
}



const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: '15%',
    marginBottom: 10,
  },
  headerTitle: {
    color: '#FBFBFB',
    fontSize: 40,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerButton: {
    padding: 8,
  },
  container: {
    backgroundColor: "#0B0D10",
    flexGrow: 1,
  },
  section: {
    marginBottom: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#141414",
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
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
    marginBottom: 20,
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
    backgroundColor: '#2A2E37',
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
    backgroundColor: '#2A2E37',
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
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#333',
  },
  notificationButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#2A2E37',
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