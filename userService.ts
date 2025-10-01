import { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseconfig";
import { Usuario } from "./models/usuario"; // Importe a interface Usuario

/**
 * Cria ou atualiza um documento de perfil de usuário no Firestore.
 * @param user O objeto de usuário da Autenticação Firebase.
 * @param additionalData Dados adicionais para armazenar para o usuário.
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

export const createUserProfileDocument = async (user: User, additionalData: Partial<Usuario>) => {
  if (!user) return;

  const userRef = doc(db, `users/${user.uid}`);

  const userData = {
    uid: user.uid,
    email: user.email,
    dataCriacao: serverTimestamp(),
    // Dados padrão ou vindos do formulário de cadastro
    nome: additionalData.nome || user.email,
    dataNascimento: additionalData.dataNascimento || null,
    altura: additionalData.altura || null,
    peso: additionalData.peso || null,
    fichas: [],
    amizades: [],
    role: 'usuario',
    photoURL: additionalData.photoURL || '', // URL da foto de perfil
    ...additionalData,
  };



try {
    // Use setDoc para criar o documento. O { merge: true } evita sobrescrever dados se o doc já existir.
    await setDoc(userRef, userData, { merge: true });
    console.log(`User profile document created/updated for: ${user.email}`);
  } catch (error) {
    console.error("Error creating user profile document:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};