import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  getDoc,
  documentId,
} from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Treino } from '../models/treino';
import { Ficha } from '../models/ficha';

const treinosCollection = collection(db, 'treinos');

/**
 * Adiciona um novo treino e o associa a uma ficha.
 * @param treinoData - Dados do treino a serem adicionados.
 * @param fichaId - ID da ficha à qual o treino será vinculado.
 */

/**
 * Busca múltiplos documentos de treino com base em uma lista de IDs.
 * @param treinoIds - Array de IDs dos treinos a serem buscados.
 */
export const getTreinosByIds = async (treinoIds: string[]): Promise<Treino[]> => {
    if (!treinoIds || treinoIds.length === 0) {
        return [];
    }
    try {
        const q = query(treinosCollection, where(documentId(), 'in', treinoIds));
        const querySnapshot = await getDocs(q);
        const treinos: Treino[] = [];
        querySnapshot.forEach((doc) => {
            treinos.push({ id: doc.id, ...doc.data() } as Treino);
        });
        return treinos;
    } catch (error) {
        console.error('Erro ao buscar treinos por IDs: ', error);
        throw error;
    }
};

export const addTreino = async (treinoData: Omit<Treino, 'id' | 'dataCriacao' | 'logs'>, fichaId: string) => {
  try {
    // Adiciona o treino à coleção 'treinos'
    const docRef = await addDoc(treinosCollection, {
      ...treinoData,
      dataCriacao: serverTimestamp(),
      logs: [],
    });

    // Atualiza a ficha para incluir o ID do novo treino
    const fichaRef = doc(db, 'fichas', fichaId);
    await updateDoc(fichaRef, {
      treinos: arrayUnion(docRef.id)
    });

    console.log('Treino adicionado com ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar treino: ', error);
    throw error;
  }
};

/**
 * Busca todos os treinos de um usuário.
 * @param usuarioId - O UID do usuário.
 */
export const getTreinosByUsuarioId = async (usuarioId: string): Promise<Treino[]> => {
  try {
    const q = query(treinosCollection, where('usuarioId', '==', usuarioId));
    const querySnapshot = await getDocs(q);

    const treinos: Treino[] = [];
    querySnapshot.forEach((doc) => {
      treinos.push({ id: doc.id, ...doc.data() } as Treino);
    });

    return treinos;
  } catch (error) {
    console.error('Erro ao buscar treinos: ', error);
    throw error;
  }
};