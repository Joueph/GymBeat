
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocFromCache, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useAuth } from '../app/authprovider';
import { useNetwork } from '../app/networkprovider';
import { FriendData } from '../components/amigos/FriendListItem';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';
import { Projeto } from '../models/projeto';
import { Usuario } from '../models/usuario';
import { getLogsByUsuarioId } from '../services/logService';
import { deletePost, getRecentPosts, likePost, unlikePost } from '../services/postService';
import { getTreinosByUsuarioId } from '../services/treinoService';
import { acceptFriendRequest, getUserProfile, rejectFriendRequest } from '../userService';

const toDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

export function useAmigosData() {
    const { user } = useAuth();
    const { isOnline } = useNetwork();
    const router = useRouter();

    // State
    const [friends, setFriends] = useState<FriendData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOptionsModalVisible, setAddOptionsModalVisible] = useState(false);
    const [isNotificationsModalVisible, setNotificationsModalVisible] = useState(false);
    const [isJoinProjectModalVisible, setJoinProjectModalVisible] = useState(false);
    const [isAddFriendModalVisible, setAddFriendModalVisible] = useState(false);
    const [projectCode, setProjectCode] = useState('');
    const [projetos, setProjetos] = useState<Projeto[]>([]);
    const [friendRequests, setFriendRequests] = useState<Usuario[]>([]);

    // Stats
    const [userWorkoutsCount, setUserWorkoutsCount] = useState(0);
    const [userTotalVolume, setUserTotalVolume] = useState(0);
    const [userPostsCount, setUserPostsCount] = useState(0);

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
                        // Cache hit
                    }
                } catch (error) {
                    // Ignore generic cache errors
                }

                const unsubscribe = onSnapshot(doc(db, "users", user.id), async (userDoc) => {
                    try {
                        // 1. Fetch User Stats
                        const [userWorkouts, userLogs, userPosts] = await Promise.all([
                            getTreinosByUsuarioId(user.id),
                            getLogsByUsuarioId(user.id),
                            getRecentPosts('mine', user.id)
                        ]);

                        setUserWorkoutsCount(userWorkouts.length);
                        const totalVolume = userLogs.reduce((sum, log) => sum + (log.cargaAcumulada || 0), 0);
                        setUserTotalVolume(totalVolume);
                        setUserPostsCount(userPosts.length);

                        if (userDoc.exists()) {
                            const userProfile = { id: userDoc.id, ...userDoc.data() } as Usuario;

                            // 2. Fetch Projects
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

                            // 3. Fetch Friend Requests
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

                            // 4. Fetch Friends DIRECTLY from Firestore (No Cloud Function)
                            const confirmedFriendIds = Object.keys(amizadesMap).filter(id => amizadesMap[id] === true);

                            const friendsDataPromises = confirmedFriendIds.map(async (friendId: string) => {
                                try {
                                    // 1. Fetch Profile
                                    const friendProfile = await getUserProfile(friendId);
                                    if (!friendProfile) return null;

                                    // 2. Fetch Last 7 Days Logs
                                    const sevenDaysAgo = new Date();
                                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                                    const logsRef = collection(db, 'logs');
                                    const q = query(
                                        logsRef,
                                        where("usuarioId", "==", friendId),
                                        where("horarioFim", ">=", sevenDaysAgo),
                                        orderBy("horarioFim", "desc")
                                    );

                                    const querySnapshot = await getDocs(q);
                                    const weeklyLogs = querySnapshot.docs.map(doc => {
                                        const data = doc.data();
                                        return { id: doc.id, ...data, horarioFim: toDate(data.horarioFim) }
                                    }) as Log[];

                                    const lastTrainedDate = toDate(friendProfile.lastTrained);
                                    const hasTrainedToday = lastTrainedDate ? lastTrainedDate.toDateString() === new Date().toDateString() : false;

                                    return { ...friendProfile, hasTrainedToday, weeklyLogs } as FriendData;

                                } catch (error) {
                                    console.warn(`[Amigos] Erro ao buscar dados do amigo ${friendId}:`, error);
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
                        isInitialLoad.current = false;
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

    const handleShareCode = async () => {
        if (!user) return;
        try {
            const url = `https://gymbeat.com.br/invite?friendCode=${encodeURIComponent(user.email || '')}`;
            const messageToShare = `Junte-se a mim no GymBeat! Clique aqui para aceitar meu convite de amizade: ${url}`;

            await Share.share({
                message: messageToShare,
                title: 'Convite GymBeat'
            });
        } catch (error) {
            Alert.alert("Erro", "Não foi possível compartilhar seu código.");
        }
    };

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

    return {
        user,
        isOnline,
        loading,
        friends,
        friendIds: friends.map(f => f.id),
        stats: {
            workoutsCount: userWorkoutsCount,
            totalVolume: userTotalVolume,
            postsCount: userPostsCount
        },
        projects: projetos,
        requests: friendRequests,
        modals: {
            addOptions: { visible: isAddOptionsModalVisible, setVisible: setAddOptionsModalVisible },
            notifications: { visible: isNotificationsModalVisible, setVisible: setNotificationsModalVisible },
            joinProject: { visible: isJoinProjectModalVisible, setVisible: setJoinProjectModalVisible },
            addFriend: { visible: isAddFriendModalVisible, setVisible: setAddFriendModalVisible },
        },
        inputs: {
            projectCode,
            setProjectCode
        },
        actions: {
            handleJoinProject,
            handleShareCode,
            handleAcceptRequest,
            handleRejectRequest,
            deletePost,
            likePost,
            unlikePost
        }
    };
}
