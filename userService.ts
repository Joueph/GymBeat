// userService.ts

import { User } from "firebase/auth";
// ADICIONADO: deleteField e writeBatch para operações atômicas
import { deleteUser } from "firebase/auth";
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
import { auth, db } from "./firebaseconfig";
import { Usuario } from "./models/usuario";

import { getCachedUserSession } from "./services/offlineCacheService";

// ... (as outras funções como getUserProfile, updateUserProfile, etc. permanecem as mesmas)
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

export const updateUserProfile = async (uid: string, data: Partial<Usuario>) => {
  if (!uid) return;
  try {
    const userRef = doc(db, `users/${uid}`);
    await updateDoc(userRef, data);
    console.log("Perfil do usuário atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar o perfil do usuário:", error);
    throw error;
  }
};

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

/**
 * Exclui a conta do usuário e seus dados associados.
 */
export const deleteUserAccount = async (uid: string) => {
  if (!uid) return;

  try {
    // 1. Excluir dados do Firestore
    // Nota: A exclusão de documentos não exclui subcoleções automaticamente no Firestore client-side.
    // Para uma exclusão completa de subcoleções, seria ideal usar uma Cloud Function.
    // Aqui faremos o melhor esforço para limpar os dados principais.

    const batch = writeBatch(db);

    const userRef = doc(db, `users/${uid}`);
    batch.delete(userRef);

    // Tenta excluir perfil público se existir
    const publicProfileRef = doc(db, `users/${uid}/publicProfile/data`);
    batch.delete(publicProfileRef);

    // Excluir estatísticas de onboarding
    const statsRef = doc(db, `estatisticasOnboarding/${uid}`);
    batch.delete(statsRef);

    await batch.commit();

    // 2. Excluir usuário do Authentication
    const user = auth.currentUser;
    if (user) {
      await deleteUser(user);
    }

    console.log(`Conta excluída com sucesso: ${uid}`);
  } catch (error) {
    console.error("Erro ao excluir conta do usuário:", error);
    throw error;
  }
};
