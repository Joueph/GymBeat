import NetInfo from '@react-native-community/netinfo';
import { addFicha, setFichaAtiva, updateFicha } from './fichaService';
import { addLog } from './logService';
import { getOfflineQueue, OfflineAction, setOfflineQueue } from './offlineQueueService';
import { addTreino, updateTreino, updateTreinosOrdem } from './treinoService';
import { updateUserProfile } from '../userService';

/**
 * Processes the offline queue, attempting to sync actions with the server.
 * @returns Promise resolved after replaying queued actions or leaving them queued for retry.
 */
export const processQueue = async (): Promise<void> => {
    const state = await NetInfo.fetch();
    if (!((state.isConnected ?? true) && state.isInternetReachable !== false)) {
        console.log('[SyncService] Sem conexão. Processamento abortado.');
        return;
    }

    try {
        const queue = await getOfflineQueue();
        if (queue.length === 0) return;

        console.log(`[SyncService] Processando fila com ${queue.length} itens...`);

        const remainingQueue: OfflineAction[] = [];

        for (const action of queue) {
            try {
                console.log(`[SyncService] Processando ação: ${action.type} (${action.id})`);

                switch (action.type) {
                    case 'ADD_LOG':
                        // Payload esperado: { logData: ..., logId?: ... }
                        await addLog(action.payload.logData, action.payload.logId, false, true); // true = isSyncing
                        break;

                    case 'UPDATE_TREINO':
                        // Payload: { treinoId: string, treinoData: Partial<Treino> }
                        await updateTreino(action.payload.treinoId, action.payload.treinoData, true); // true = isSyncing
                        break;

                    case 'ADD_TREINO':
                        // Payload: { treinoData: Omit<Treino, 'id'> }
                        await addTreino(action.payload.treinoData, true); // true = isSyncing
                        break;

                    case 'ADD_FICHA':
                        await addFicha(action.payload.fichaData, true);
                        break;

                    case 'UPDATE_FICHA':
                        await updateFicha(action.payload.fichaId, action.payload.data, true);
                        break;

                    case 'SET_FICHA_ATIVA':
                        await setFichaAtiva(
                            action.payload.userId,
                            action.payload.fichaId,
                            action.payload.previousFichaId,
                            true
                        );
                        break;

                    case 'UPDATE_TREINOS_ORDEM':
                        await updateTreinosOrdem(action.payload.treinoIds);
                        break;

                    case 'UPDATE_USER_PROFILE':
                        await updateUserProfile(action.payload.uid, action.payload.data, true);
                        break;
                }

                console.log(`[SyncService] Ação ${action.type} processada com sucesso.`);

            } catch (error) {
                console.error(`[SyncService] Falha ao processar ação ${action.id}:`, error);
                action.retryCount++;
                // Se falhar muitas vezes, remove da fila
                if (action.retryCount < 5) {
                    remainingQueue.push(action);
                } else {
                    console.error(`[SyncService] Ação ${action.id} removida após falhar 5 vezes.`);
                }
            }
        }

        await setOfflineQueue(remainingQueue);

        if (remainingQueue.length === 0) {
            console.log('[SyncService] Fila processada e limpa.');
        } else {
            console.log(`[SyncService] Processamento parcial. Restam ${remainingQueue.length} itens.`);
        }

    } catch (error) {
        console.error('[SyncService] Erro ao processar a fila:', error);
    }
};
