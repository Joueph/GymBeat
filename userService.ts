//userService.ts

import { User } from "firebase/auth";
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebaseconfig"; // Verifique se o caminho para sua config do Firebase está correto
import { Usuario } from "./models/usuario"; // Verifique se o caminho para seu modelo Usuario está correto

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

/**
 * Cria ou atualiza o documento de um usuário no Firestore, juntamente com seu subdocumento de perfil público.
 * @param user O objeto de usuário do Firebase Authentication.
 * @param additionalData Dados adicionais coletados durante o cadastro.
 */
export const createUserProfileDocument = async (
  user: User,
  additionalData: Partial<Usuario>
) => {
  if (!user) return;

  // Referência para o documento principal do usuário
  const userRef = doc(db, `users/${user.uid}`);

  const nome = additionalData.nome || user.email || 'Usuário Sem Nome';

  // Construindo o objeto de dados do usuário de forma segura
  const userData = {
    uid: user.uid,
    email: user.email,
    dataCriacao: serverTimestamp(),
    nome: nome,
    nome_lowercase: nome.toLowerCase(),
    
    // Dados adicionais tratados explicitamente para evitar 'undefined'
    photoURL: additionalData.photoURL || '',
    dataNascimento: additionalData.dataNascimento || null,
    altura: additionalData.altura || null,
    peso: additionalData.peso || null,
    genero: additionalData.genero || null,
    nivel: additionalData.nivel || null,
    isPro: additionalData.isPro || false,

    // Valores padrão para novos usuários
    fichas: [],
    amizades: {},
    solicitacoesRecebidas: [],
    settings: {
      privacy: {
        profileVisibility: 'amigos',
      },
    },
    role: 'usuario',
  };

  try {
    // Usando { merge: true } é uma boa prática para não sobrescrever dados acidentalmente
    // caso esta função seja chamada em outros contextos além do cadastro inicial.
    await setDoc(userRef, userData, { merge: true });

    // Cria o documento de perfil público inicial na subcoleção
    const publicProfileRef = doc(db, `users/${user.uid}/publicProfile/data`);
    await setDoc(publicProfileRef, {
      amizades: {}, // Pode conter contagem de amigos, etc.
      profileVisibility: 'amigos', // Corresponde ao `settings` do documento principal
    });

    console.log(`Documento de perfil criado com sucesso para: ${user.email}`);
  } catch (error) {
    console.error("Erro ao criar o documento de perfil do usuário:", error);
    // Propaga o erro para que a UI possa notificar o usuário
    throw new Error('Ocorreu um erro ao criar o perfil do usuário.');
  }
};


// Esta função parece ser legada, pois AmigosScreen.tsx usa a Cloud Function "onCall".
// Não necessita de alteração, mas considere removê-la se não estiver em uso.
export const sendFriendRequest = async (fromUserId: string, toUserId: string) => {
  if (!fromUserId || !toUserId) return;
  const fromUserRef = doc(db, `users/${fromUserId}`);
  await updateDoc(fromUserRef, {
    solicitacoesEnviadas: arrayUnion(toUserId)
  });
};

/**
 * Aceita um pedido de amizade.
 * @param currentUserId ID do usuário que está aceitando o pedido.
 * @param requesterId ID do usuário que enviou o pedido.
 */
export const acceptFriendRequest = async (currentUserId: string, requesterId: string) => {
  if (!currentUserId || !requesterId) return;
  const currentUserRef = doc(db, `users/${currentUserId}`);

  // ALTERAÇÃO PRINCIPAL AQUI
  await updateDoc(currentUserRef, {
    // Adiciona o amigo ao MAPA usando notação de ponto.
    [`amizades.${requesterId}`]: true,
    // Remove a solicitação do array.
    solicitacoesRecebidas: arrayRemove(requesterId)
  });
};


/**
 * Rejeita um pedido de amizade.
 * @param currentUserId ID do usuário que está rejeitando o pedido.
 * @param requesterId ID do usuário que enviou o pedido.
 */
export const rejectFriendRequest = async (currentUserId: string, requesterId: string) => {
  if (!currentUserId || !requesterId) return;
  const currentUserRef = doc(db, `users/${currentUserId}`);
  // ALTERAÇÃO DE CONSISTÊNCIA: Renomeado para bater com o resto do código.
  await updateDoc(currentUserRef, { solicitacoesRecebidas: arrayRemove(requesterId) });
};