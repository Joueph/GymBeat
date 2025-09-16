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
  deleteDoc,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseconfig'; // Sua configuração do Firebase
import { Ficha } from '../models/ficha';

// Referência para a coleção 'fichas' no Firestore
const fichasCollection = collection(db, 'fichas');

/**
 * Adiciona uma nova ficha de treino para um usuário.
 * @param fichaData - Os dados da ficha a serem adicionados, sem o ID.
 */

/**
 * Busca a ficha ATIVA de um usuário.
 */

export const getFichaAtiva = async (usuarioId: string): Promise<Ficha | null> => {
  try {
    const q = query(
      fichasCollection, 
      where('usuarioId', '==', usuarioId), 
      where('ativa', '==', true),
      limit(1) // Garante que apenas uma seja retornada
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Ficha;
  } catch (error) {
    console.error("Erro ao buscar ficha ativa: ", error);
    throw error;
  }
};

/**
 * Define uma ficha como ativa e desativa todas as outras do mesmo usuário.
 * @param usuarioId O ID do usuário.
 * @param fichaId O ID da ficha a ser ativada.
 */
export const setFichaAtiva = async (usuarioId: string, fichaId: string): Promise<void> => {
  try {
    // 1. Pega todas as fichas do usuário
    const q = query(fichasCollection, where('usuarioId', '==', usuarioId));
    const querySnapshot = await getDocs(q);

    // 2. Cria um batch para atualizações atômicas
    const batch = writeBatch(db);

    querySnapshot.forEach((document) => {
      const fichaRef = doc(db, 'fichas', document.id);
      // 3. Ativa a ficha selecionada, desativa as outras
      batch.update(fichaRef, { ativa: document.id === fichaId });
    });

    // 4. Commita o batch
    await batch.commit();
    console.log('Ficha ativa definida com sucesso.');
  } catch (error) {
    console.error('Erro ao definir ficha ativa: ', error);
    throw error;
  }
};

/**
 * Deleta uma ficha específica pelo seu ID.
 * @param fichaId - O ID da ficha a ser deletada.
 */
export const deleteFicha = async (fichaId: string): Promise<void> => {
  try {
    const fichaRef = doc(db, 'fichas', fichaId);
    await deleteDoc(fichaRef);
    console.log('Ficha deletada com sucesso!');
  } catch (error) {
    console.error('Erro ao deletar ficha: ', error);
    throw error;
  }
};

/**
 * Busca todas as fichas INATIVAS de um usuário.
 */
export const getFichasInativas = async (usuarioId: string): Promise<Ficha[]> => {
  try {
    const q = query(
        fichasCollection, 
        where('usuarioId', '==', usuarioId),
        where('ativa', '==', false)
    );
    const querySnapshot = await getDocs(q);
    const fichas: Ficha[] = [];
    querySnapshot.forEach((doc) => {
      fichas.push({ id: doc.id, ...doc.data() } as Ficha);
    });
    return fichas;
  } catch (error) {
    console.error("Erro ao buscar fichas inativas: ", error);
    throw error;
  }
};

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