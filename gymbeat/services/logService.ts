import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';

const logsCollection = collection(db, 'logs');

/**
 * Cria um novo log de treino para um usuário.
 * @param logData - Dados do log a serem adicionados.
 */
export const addLog = async (logData: Omit<Log, 'id'>) => {
  try {
    const docRef = await addDoc(logsCollection, logData);
    console.log('Log adicionado com o ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar log: ', error);
    throw error;
  }
};

/**
 * Busca os logs de treino de um usuário, ordenados por data.
 * @param usuarioId - O UID do usuário.
 */
export const getLogsByUsuarioId = async (usuarioId: string): Promise<Log[]> => {
  try {
    const q = query(logsCollection, where('usuarioId', '==', usuarioId), orderBy('horarioFim', 'desc'));
    const querySnapshot = await getDocs(q);

    const logs: Log[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as Log);
    });

    return logs;
  } catch (error) {
    console.error('Erro ao buscar logs: ', error);
    throw error;
  }
};