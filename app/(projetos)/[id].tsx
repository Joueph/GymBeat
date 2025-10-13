import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebaseconfig';
import { Log } from '../../models/log';
import { Projeto } from '../../models/projeto';
import { Usuario } from '../../models/usuario';
import { getLogsByProjetoId } from '../../services/logService';
import { getUserProfile } from '../../userService';
import { useAuth } from '../authprovider';

// Definindo um tipo para os participantes com status de amizade
interface Participant extends Usuario {
    isFriend: boolean;
    requestSent: boolean;
}

// Definindo um tipo para os logs do projeto com dados do usuário
interface ProjectLog extends Log {
    userName: string;
    userPhotoURL?: string;
}

// Definindo um tipo de união para os itens da lista
type ListItem = Participant | ProjectLog;

export default function ProjetoDetalheScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const navigation = useNavigation();

    const [projeto, setProjeto] = useState<Projeto | null>(null);
    const [loading, setLoading] = useState(true);
    const [isParticipante, setIsParticipante] = useState(false);
    const [activeTab, setActiveTab] = useState<'treinos' | 'participantes'>('treinos');
    const [participantes, setParticipantes] = useState<Participant[]>([]);
    const [logs, setLogs] = useState<ProjectLog[]>([]);

    // Carrega o projeto e verifica o status de participante
    useEffect(() => {
        if (!id || !user) return;

        const projetoDocRef = doc(db, 'projetos', id);
        const unsubscribeProjeto = onSnapshot(projetoDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const projetoData = { id: docSnap.id, ...docSnap.data() } as Projeto;
                setProjeto(projetoData);
                const userIsParticipante = projetoData.participantes.includes(user.uid);
                setIsParticipante(userIsParticipante);
            } else {
                Alert.alert("Erro", "Projeto não encontrado.");
                router.back();
            }
            setLoading(false);
        });

        return () => unsubscribeProjeto();
    }, [id, user, router]);

    // Carrega os detalhes dos participantes e os logs
    useEffect(() => {
        if (!projeto || !user) return;

        // Função para carregar participantes
        const fetchParticipantes = async () => {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            const currentUserFriends = userDoc.exists() ? userDoc.data().amizades || {} : {};

            const profilesPromises = projeto.participantes.map(async (uid) => {
                const profile = await getUserProfile(uid);
                if (profile) {
                    return {
                        ...profile,
                        isFriend: currentUserFriends[uid] === true,
                        requestSent: currentUserFriends[uid] === false,
                    };
                }
                return null;
            });

            const profiles = (await Promise.all(profilesPromises)).filter(p => p !== null) as Participant[];
            setParticipantes(profiles);
        };

        // Função para carregar logs
        const fetchLogs = async () => {
            try {
                const projectLogs = await getLogsByProjetoId(projeto.id);
                const logsWithUserInfoPromises = projectLogs.map(async (log) => {
                    const userProfile = await getUserProfile(log.usuarioId);
                    return {
                        ...log,
                        userName: userProfile?.nome || 'Desconhecido',
                        userPhotoURL: userProfile?.photoURL,
                    };
                });
                const logsWithUserInfo = await Promise.all(logsWithUserInfoPromises);
                setLogs(logsWithUserInfo);
            } catch (error) {
                console.error("Erro ao carregar logs do projeto:", error);
                Alert.alert("Erro", "Não foi possível carregar os treinos.");
            }
        };

        fetchParticipantes();
        if (isParticipante) {
            fetchLogs();
        }

    }, [projeto, user, isParticipante]);

    const handleShareProject = async () => {
        if (!projeto) return;
        try {
            const message = `Venha fazer parte do meu projeto! Copie e cole esta mensagem na aba social do app GymBeat\n\nId do projeto: {${projeto.id}}`;
            await Share.share({ message });
        } catch (error) {
            Alert.alert("Erro", "Não foi possível compartilhar o projeto.");
        }
    };

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: "", // Remove o título
            headerTransparent: true, // Deixa o header transparente
            headerStyle: { backgroundColor: 'transparent' }, // Garante que não haja cor de fundo
            headerTintColor: '#fff', // Cor dos ícones e do botão de voltar
            headerRight: () => (
                <View style={{ flexDirection: 'row', gap: 25, marginRight: 15 }}>
                    {/* Botão de Editar, visível apenas para o criador do projeto */}
                    {user && projeto && user.uid === projeto.criadorId && (
                        <TouchableOpacity onPress={() => router.push({ pathname: '/(projetos)/criar', params: { id: projeto.id }})}>
                            <FontAwesome name="pencil" size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {/* Botão de Compartilhar */}
                    <TouchableOpacity onPress={handleShareProject}>
                        <FontAwesome name="share-alt" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, projeto, user]);

    const handleJoinProject = async () => {
        if (!user || !projeto) return;
        setLoading(true);
        try {
            const projetoDocRef = doc(db, 'projetos', projeto.id);
            const userDocRef = doc(db, 'users', user.uid);

            await updateDoc(projetoDocRef, { participantes: arrayUnion(user.uid) });
            await updateDoc(userDocRef, { projetos: arrayUnion(projeto.id) });

            setIsParticipante(true);
            Alert.alert("Sucesso!", "Você agora faz parte deste projeto.");
        } catch (error) {
            console.error("Erro ao entrar no projeto: ", error);
            Alert.alert("Erro", "Não foi possível entrar no projeto.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleAddFriend = async (participant: Usuario) => {
        if (!user || !participant.email) {
            Alert.alert("Erro", "Não foi possível enviar o pedido.");
            return;
        }
        if (participant.email.toLowerCase() === user.email?.toLowerCase()) {
            Alert.alert("Ops!", "Você não pode adicionar a si mesmo.");
            return;
        }

        try {
            const functions = getFunctions();
            const sendFriendRequestCallable = httpsCallable(functions, 'sendFriendRequest');
            
            await sendFriendRequestCallable({
                fromUserId: user.uid,
                friendCode: participant.email,
            });
            
            Alert.alert("Sucesso", `Pedido de amizade enviado para ${participant.nome}!`);
            setParticipantes(prev => prev.map(p => p.id === participant.id ? { ...p, requestSent: true } : p));

        } catch (error: any) {
            console.error("Erro ao enviar pedido de amizade:", error);
            Alert.alert("Erro", error.message || "Não foi possível enviar o pedido de amizade.");
        }
    };

    if (loading || !projeto) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#fff" /></View>;
    }

    const renderItem = ({ item }: { item: ListItem }) => {
        // Type guard para verificar se o item é um Participante
        if ('isFriend' in item) {
            const isSelf = item.id === user?.uid;
            return (
                <View style={styles.participantItem}>
                    <View style={styles.participantInfo}>
                        <Image source={{ uri: item.photoURL || 'https://via.placeholder.com/100' }} style={styles.pfp} />
                        <Text style={styles.participantName}>{item.nome}</Text>
                    </View>
                    {!isSelf && !item.isFriend && (
                        <TouchableOpacity style={styles.addFriendButton} onPress={() => handleAddFriend(item)} disabled={item.requestSent}>
                            <FontAwesome name={item.requestSent ? "check" : "plus"} size={18} color={item.requestSent ? "#555" : "#1cb0f6"} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        // Caso contrário, o item é um ProjectLog
        return (
            <View style={styles.logItem}>
                <View style={styles.logHeader}>
                    <Image source={{ uri: item.userPhotoURL || 'https://via.placeholder.com/100' }} style={styles.logPfp} />
                    <View>
                        <Text style={styles.logUserName}>{item.userName}</Text>
                        <Text style={styles.logDate}>{item.horarioFim?.toDate().toLocaleDateString('pt-BR')}</Text>
                    </View>
                </View>
                <Text style={styles.logDescription}>{item.observacoes || "Nenhuma observação."}</Text>
            </View>
        );
    };

    const ListHeader = () => (
        <>
            <Text style={styles.title}>{projeto.titulo}</Text> 
            <Text style={styles.description}>{projeto.descricao}</Text>

            {!isParticipante && (
                <TouchableOpacity style={styles.joinButton} onPress={handleJoinProject}>
                    <Text style={styles.joinButtonText}>Participar</Text>
                </TouchableOpacity>
            )}

            {isParticipante && (
                <View style={styles.tabContainer}>
                    <TouchableOpacity style={[styles.tab, activeTab === 'treinos' && styles.activeTab]} onPress={() => setActiveTab('treinos')}>
                        <Text style={styles.tabText}>Treinos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'participantes' && styles.activeTab]} onPress={() => setActiveTab('participantes')}>
                        <Text style={styles.tabText}>Participantes</Text>
                    </TouchableOpacity>
                </View>
            )}
        </>
    );

    return (
        <View style={styles.container}>
            <Image source={{ uri: projeto.fotoCapa || 'https://via.placeholder.com/400x200' }} style={styles.coverImage} />
            <View style={styles.imageOverlay} />
            
            <FlatList<ListItem>
                data={activeTab === 'treinos' ? logs : participantes}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<ListHeader />}
                ListEmptyComponent={<Text style={styles.emptyText}>{activeTab === 'treinos' ? 'Nenhum treino compartilhado ainda.' : 'Nenhum participante para mostrar.'}</Text>}
                contentContainerStyle={styles.listContentContainer}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030405' },
    container: { flex: 1, backgroundColor: '#030405' },
    coverImage: { width: '100%', height: 200 },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    listContentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 10, marginTop: 140 },
    description: { fontSize: 16, color: '#ccc', lineHeight: 22, marginBottom: 20, backgroundColor: '#030405', paddingVertical: 5 },
    joinButton: { backgroundColor: '#1cb0f6', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    joinButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', marginBottom: 15 },
    tab: { paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 2, borderBottomColor: 'transparent', flex: 1, alignItems: 'center' },
    activeTab: { borderBottomColor: '#1cb0f6' },
    tabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    emptyText: { color: '#aaa', textAlign: 'center', marginTop: 20 },
    logItem: { 
        backgroundColor: '#141414', 
        padding: 15, 
        borderRadius: 8, 
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222',
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    logPfp: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    logUserName: {
        color: '#fff',
        fontWeight: 'bold',
    },
    logDate: {
        color: '#888',
        fontSize: 12,
    },
    logDescription: {
        color: '#ccc',
    },
    participantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    participantInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pfp: { width: 45, height: 45, borderRadius: 22.5, marginRight: 15 },
    participantName: { color: '#fff', fontSize: 16 },
    addFriendButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#2c2c2e',
    },
});

