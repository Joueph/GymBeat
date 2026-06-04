// userService.ts

import { User } from "firebase/auth";
// ADICIONADO: deleteField e writeBatch para operações atômicas
import {
  arrayRemove,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebaseconfig";
import { Usuario } from "./models/usuario";

import NetInfo from "@react-native-community/netinfo";
import { cacheUserSession, getCachedUserSession } from "./services/offlineCacheService";
import { queueAction } from "./services/offlineQueueService";

// ... (as outras funções como getUserProfile, updateUserProfile, etc. permanecem as mesmas)
/**
 * Busca o perfil de usuario no Firestore, com fallback para a sessao em cache.
 * @param uid ID do usuario.
 * @returns Perfil do usuario, null quando nao existir, ou rejeita quando Firestore/cache falharem.
 */
export const getUserProfile = async (uid: string) => {
  if (!uid) return null;
  try {
    const userRef = doc(db, `users/${uid}`);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() } as Usuario;
    } else {
      console.log("Nenhum documento de usuário encontrado!");
      return null;
    }
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);

    // Fallback offline
    const cached = await getCachedUserSession();
    if (cached && cached.id === uid) {
      console.log("[UserService] Retornando usuário do cache (offline)");
      return cached;
    }

    throw error;
  }
};

/**
 * Atualiza campos do perfil de usuario.
 * @param uid ID do usuario.
 * @param data Campos parciais de Usuario enviados ao Firestore.
 * @returns Promise resolvida quando o update terminar; rejeita em erro de escrita.
 */
export const updateUserProfile = async (uid: string, data: Partial<Usuario>, isSyncing: boolean = false) => {
  if (!uid) return;
  const networkState = await NetInfo.fetch();
  const isOnline = (networkState.isConnected ?? true) && networkState.isInternetReachable !== false;

  if (!isOnline && !isSyncing) {
    const cached = await getCachedUserSession();
    if (cached && cached.id === uid) {
      await cacheUserSession({ ...cached, ...data, id: uid } as Usuario);
    }
    await queueAction('UPDATE_USER_PROFILE', { uid, data });
    return;
  }

  try {
    const userRef = doc(db, `users/${uid}`);
    await updateDoc(userRef, data);
    const cached = await getCachedUserSession();
    if (cached && cached.id === uid) {
      await cacheUserSession({ ...cached, ...data, id: uid } as Usuario);
    }
    console.log("Perfil do usuário atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar o perfil do usuário:", error);
    throw error;
  }
};

/**
 * Busca usuarios por prefixo de nome em lowercase, excluindo o usuario atual.
 * @param searchText Texto digitado para busca.
 * @param currentUserId ID do usuario que esta buscando.
 * @returns Lista de usuarios encontrados, sem incluir o usuario atual.
 */
export const searchUsers = async (searchText: string, currentUserId: string): Promise<Usuario[]> => {
  if (!searchText.trim()) return [];
  const lowerCaseSearchText = searchText.trim().toLowerCase();
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef,
      where('nome_lowercase', '>=', lowerCaseSearchText),
      where('nome_lowercase', '<=', lowerCaseSearchText + '\uf8ff')
    );
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Usuario))
      .filter(user => user.id !== currentUserId);
    return users;
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    throw error;
  }
};

/**
 * Cria ou mescla o documento de perfil do usuario e seu perfil publico inicial.
 * @param user Usuario autenticado do Firebase Auth.
 * @param additionalData Dados coletados no onboarding ou em fluxos de cadastro.
 * @returns Promise resolvida apos gravar os documentos de perfil.
 */
export const createUserProfileDocument = async (
  user: User,
  additionalData: Partial<Usuario>
) => {
  if (!user) return;
  const userRef = doc(db, `users/${user.uid}`);
  const nome = additionalData.nome || user.email || 'Usuário Sem Nome';
  const userData = {
    uid: user.uid,
    email: user.email,
    dataCriacao: serverTimestamp(),
    nome: nome,
    nome_lowercase: nome.toLowerCase(),
    photoURL: additionalData.photoURL || '',
    dataNascimento: additionalData.dataNascimento || null,
    altura: additionalData.altura || null,
    historicoPeso: additionalData.historicoPeso || [],
    genero: additionalData.genero || null,
    nivel: additionalData.nivel || null,
    isPro: additionalData.isPro || false,
    streakGoal: additionalData.streakGoal || 3,
    weeksStreakGoal: additionalData.weeksStreakGoal || 4,
    workoutScreenType: additionalData.workoutScreenType || 'simplified', // New field

    // --- NOVOS DADOS VINDOS DO ONBOARDING ---
    objetivoPrincipal: additionalData.objetivoPrincipal || null,
    localTreino: additionalData.localTreino || null,
    possuiEquipamentosCasa: additionalData.possuiEquipamentosCasa === undefined ? null : additionalData.possuiEquipamentosCasa,
    problemasParaTreinar: additionalData.problemasParaTreinar || [],

    // --- O RESTANTE DOS DADOS ---
    fichas: [],
    amizades: {}, // Inicia o mapa de amizades vazio
    solicitacoesRecebidas: [],
    settings: {
      privacy: {
        profileVisibility: 'amigos',
      },
    },
    role: 'usuario',
  };
  try {
    await setDoc(userRef, userData, { merge: true });
    const publicProfileRef = doc(db, `users/${user.uid}/publicProfile/data`);
    await setDoc(publicProfileRef, {
      amizades: {},
      profileVisibility: 'amigos',
    });
    console.log(`Documento de perfil criado com sucesso para: ${user.email}`);
  } catch (error) {
    console.error("Erro ao criar o documento de perfil do usuário:", error);
    throw new Error('Ocorreu um erro ao criar o perfil do usuário.');
  }
};


/**
 * ATUALIZADO: Aceita um pedido de amizade.
 * Altera o status da amizade para 'true' no documento do usuário atual.
 * @param currentUserId ID do usuário que está aceitando o pedido.
 * @param requesterId ID do usuário que enviou o pedido.
 * @returns Promise resolvida apos atualizar o mapa de amizades do usuario atual.
 */
export const acceptFriendRequest = async (currentUserId: string, requesterId: string) => {
  if (!currentUserId || !requesterId) return;
  const currentUserRef = doc(db, `users/${currentUserId}`);

  // Atualiza o mapa de amizades, mudando o status de `false` (pendente) para `true` (confirmado).
  await updateDoc(currentUserRef, {
    [`amizades.${requesterId}`]: true,
    // Remove a solicitação da lista antiga para manter a consistência.
    solicitacoesRecebidas: arrayRemove(requesterId)
  });
};


/**
 * ATUALIZADO: Rejeita um pedido de amizade.
 * Remove a relação de amizade de AMBOS os documentos de usuário para evitar inconsistências.
 * @param currentUserId ID do usuário que está rejeitando o pedido.
 * @param requesterId ID do usuário que enviou o pedido.
 * @returns Promise resolvida apos remover os vinculos nos dois documentos.
 */
export const rejectFriendRequest = async (currentUserId: string, requesterId: string) => {
  if (!currentUserId || !requesterId) return;

  const currentUserRef = doc(db, `users/${currentUserId}`);
  const requesterRef = doc(db, `users/${requesterId}`);

  try {
    // Usamos um "write batch" para garantir que a exclusão ocorra em ambos os documentos
    // de forma atômica (ou tudo funciona, ou nada funciona).
    const batch = writeBatch(db);

    // 1. Remove o pedido pendente (e.g., { [requesterId]: false }) do usuário atual.
    batch.update(currentUserRef, {
      [`amizades.${requesterId}`]: deleteField(),
      solicitacoesRecebidas: arrayRemove(requesterId) // Limpeza da lista antiga
    });

    // 2. Remove a amizade enviada (e.g., { [currentUserId]: true }) do outro usuário.
    batch.update(requesterRef, {
      [`amizades.${currentUserId}`]: deleteField()
    });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao rejeitar pedido de amizade:", error);
    throw new Error("Não foi possível rejeitar o pedido de amizade.");
  }
};

/**
 * Concede um período de teste gratuito ao usuário.
 * Define o campo `premiumUntil` para a data atual + dias especificados.
 * @param uid ID do usuario que recebera o trial.
 * @param days Quantidade de dias de trial a partir da data atual.
 * @returns Promise resolvida apos gravar premiumUntil no perfil.
 */
export const grantFreeTrial = async (uid: string, days: number = 14) => {
  if (!uid) return;
  try {
    const userRef = doc(db, `users/${uid}`);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    await updateDoc(userRef, {
      premiumUntil: futureDate.toISOString()
    });
    console.log(`Trial gratuito de ${days} dias concedido para: ${uid}`);
  } catch (error) {
    console.error("Erro ao conceder trial gratuito:", error);
    throw error;
  }
};
