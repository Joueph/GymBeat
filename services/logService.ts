import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';

const logsCollection = collection(db, 'logs');

/**
 * Cria um novo log de treino para um usuário.
 * @param logData - Dados do log a serem adicionados.
 */
export const addLog = async (logData: Partial<Omit<Log, 'id'>> | null, logId?: string, shouldDelete: boolean = false) => {

  try {
    if (shouldDelete && logId) {
      await deleteDoc(doc(db, 'logs', logId));
      return logId;
    }

    if (logId) {
      // Atualiza um log existente (merge)
      await setDoc(doc(db, 'logs', logId), logData, { merge: true });
      return logId;
    } else if (logData) {
      // Cria um novo log
      const docRef = await addDoc(collection(db, 'logs'), logData);
      return docRef.id;
    }
    
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
    const q = query(logsCollection, where('usuarioId', '==', usuarioId));
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