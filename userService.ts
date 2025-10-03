import { User } from "firebase/auth/react-native";
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebaseconfig";
import { Usuario } from "./models/usuario";

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

export const createUserProfileDocument = async (user: User, additionalData: Partial<Usuario>) => {
  if (!user) return;

  const userRef = doc(db, `users/${user.uid}`);
  const nome = additionalData.nome || user.email;

  const userData = {
    uid: user.uid,
    email: user.email,
    dataCriacao: serverTimestamp(),
    nome: nome,
    nome_lowercase: nome?.toLowerCase(),
    dataNascimento: additionalData.dataNascimento || null,
    altura: additionalData.altura || null,
    peso: additionalData.peso || null,
    fichas: [],
    // ALTERAÇÃO AQUI: Inicializa 'amizades' como um mapa vazio.
    amizades: {},
    // ALTERAÇÃO DE CONSISTÊNCIA: Renomeado para 'solicitacoesRecebidas' para bater com o resto do código.
    solicitacoesRecebidas: [],
    solicitacoesEnviadas: [],
    settings: { privacy: { profileVisibility: 'amigos' } }, // Configuração padrão de privacidade
    role: 'usuario',
    photoURL: additionalData.photoURL || '',
    ...additionalData,
  };

  try {
    await setDoc(userRef, userData, { merge: true });

    // Cria o documento de perfil público inicial
    const publicProfileRef = doc(db, `users/${user.uid}/publicProfile/data`);
    await setDoc(publicProfileRef, {
      amizades: {},
      profileVisibility: 'amigos'
    });

    console.log(`User profile document created/updated for: ${user.email}`);
  } catch (error) {
    console.error("Error creating user profile document:", error);
    throw error;
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