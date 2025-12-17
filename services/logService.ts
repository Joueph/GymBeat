import NetInfo from '@react-native-community/netinfo';
import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';
import { cacheUserLogs, getCachedUserLogs } from './offlineCacheService';
import { queueAction } from './offlineQueueService';

const logsCollection = collection(db, 'logs');

/**
 * Cria um novo log de treino para um usuário.
 * @param logData - Dados do log a serem adicionados.
 * @param logId - ID opcional para atualizar ou remover.
 * @param shouldDelete - Se deve deletar o log.
 * @param isSyncing - Flag para indicar se a chamada vem do sync offline (evita loop).
 */
export const addLog = async (logData: Partial<Omit<Log, 'id'>> | null, logId?: string, shouldDelete: boolean = false, isSyncing: boolean = false) => {
  try {
    const networkState = await NetInfo.fetch();
    const isOnline = networkState.isConnected;

    // Helper para enfileirar e atualizar cache
    const queueAndCache = async () => {
      console.log('[LogService] Enfileirando log (Offline/Erro).');
      const tempId = logId || `temp-log-${Date.now()}`;

      // 1. Enfileira a ação
      await queueAction('ADD_LOG', { logData, logId: tempId });

      // 2. Atualiza o cache local imediatamente para refletir na UI
      if (logData && logData.usuarioId) {
        const userLogs = await getCachedUserLogs(logData.usuarioId);
        // Se já existe (update), substitui. Se não, adiciona.
        const existingIndex = userLogs.findIndex(l => l.id === tempId);

        const newLogObj = { ...logData, id: tempId } as Log;

        let updatedLogs;
        if (existingIndex >= 0) {
          updatedLogs = [...userLogs];
          updatedLogs[existingIndex] = newLogObj;
        } else {
          updatedLogs = [newLogObj, ...userLogs];
        }

        await cacheUserLogs(logData.usuarioId, updatedLogs);
      }
      return tempId;
    };

    // Lógica Offline explícita (se não estiver sincronizando)
    if (!isOnline && !isSyncing && !shouldDelete) {
      return await queueAndCache();
    }

    if (shouldDelete && logId) {
      await deleteDoc(doc(db, 'logs', logId));
      return logId;
    }

    if (logId) {
      // Atualiza um log existente (merge)
      // Se não estiver sincronizando, tenta salvar no Firestore.
      await setDoc(doc(db, 'logs', logId), logData, { merge: true });
      return logId;
    } else if (logData) {
      // Cria um novo log
      const docRef = await addDoc(collection(db, 'logs'), logData);
      return docRef.id;
    }

  } catch (error) {
    console.error('Erro ao adicionar log: ', error);

    // FAIL-SAFE: Se falhar e não estivermos sincronizando (para evitar loops infinitos de erro no sync),
    // assumimos que é um problema de rede ou momentâneo e enfileiramos.
    if (!isSyncing && !shouldDelete) {
      console.log('[LogService] Erro ao salvar online. Ativando fallback para fila offline.');
      return await queueAndCache();
    }

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

    // Cache logs
    cacheUserLogs(usuarioId, logs);

    return logs;
  } catch (error) {
    console.error('Erro ao buscar logs (tentando offline): ', error);
    const cached = await getCachedUserLogs(usuarioId);
    if (cached && cached.length > 0) {
      console.log('[LogService] Usando logs em cache');
      return cached;
    }
    throw error;
  }
};

/**
 * Busca os logs de treino associados a um projeto.
 * @param projetoId - O ID do projeto.
 */
export const getLogsByProjetoId = async (projetoId: string): Promise<Log[]> => {
  try {
    // Presume-se que os logs compartilhados com um projeto têm um campo 'projetoId'
    const q = query(logsCollection, where('projetoId', '==', projetoId));
    const querySnapshot = await getDocs(q);

    const logs: Log[] = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() } as Log);
    });

    // Ordena os logs por data, do mais recente para o mais antigo
    logs.sort((a, b) => {
      const dateA = a.horarioFim?.toDate ? a.horarioFim.toDate() : new Date(0);
      const dateB = b.horarioFim?.toDate ? b.horarioFim.toDate() : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return logs;
  } catch (error) {
    console.error('Erro ao buscar logs do projeto: ', error);
    throw error;
  }
};
