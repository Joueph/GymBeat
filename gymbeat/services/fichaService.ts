import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseconfig'; // Sua configuração do Firebase
import { Ficha } from '../models/ficha';

// Referência para a coleção 'fichas' no Firestore
const fichasCollection = collection(db, 'fichas');

/**
 * Adiciona uma nova ficha de treino para um usuário.
 * @param fichaData - Os dados da ficha a serem adicionados, sem o ID.
 */
export const addFicha = async (fichaData: Omit<Ficha, 'id' | 'dataCriacao'>) => {
  try {
    const docRef = await addDoc(fichasCollection, {
      ...fichaData,
      dataCriacao: serverTimestamp(), // Usa o timestamp do servidor
    });
    console.log('Ficha adicionada com o ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar ficha: ', error);
    throw error;
  }
};

/**
 * Busca todas as fichas de um usuário específico.
 * @param usuarioId - O UID do usuário.
 * @returns Uma lista de fichas do usuário.
 */
export const getFichasByUsuarioId = async (usuarioId: string): Promise<Ficha[]> => {
  try {
    const q = query(fichasCollection, where('usuarioId', '==', usuarioId));
    const querySnapshot = await getDocs(q);

    const fichas: Ficha[] = [];
    querySnapshot.forEach((doc) => {
      fichas.push({ id: doc.id, ...doc.data() } as Ficha);
    });

    return fichas;
  } catch (error) {
    console.error('Erro ao buscar fichas: ', error);
    throw error;
  }
};

/**
 * Busca uma ficha específica pelo seu ID.
 * @param fichaId - O ID da ficha.
 * @returns A ficha correspondente ou null se não encontrada.
 */
export const getFichaById = async (fichaId: string): Promise<Ficha | null> => {
  try {
    const fichaRef = doc(db, 'fichas', fichaId);
    const docSnap = await getDoc(fichaRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Ficha;
    } else {
      console.log("Nenhuma ficha encontrada com o ID:", fichaId);
      return null;
    }
  } catch (error) {
    console.error('Erro ao buscar ficha por ID: ', error);
    throw error;
  }
};

/**
 * Atualiza os dados de uma ficha de treino.
 * @param fichaId - O ID da ficha a ser atualizada.
 * @param data - Os dados a serem atualizados.
 */
export const updateFicha = async (fichaId: string, data: Partial<Ficha>) => {
  try {
    const fichaRef = doc(db, 'fichas', fichaId);
    await updateDoc(fichaRef, data);
    console.log('Ficha atualizada com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar ficha: ', error);
    throw error;
  }
};