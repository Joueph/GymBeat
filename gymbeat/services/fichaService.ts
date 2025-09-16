import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
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

// Você pode adicionar outras funções aqui, como updateFicha e deleteFicha.