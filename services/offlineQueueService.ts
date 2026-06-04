import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'offlineActionQueue';

export type OfflineActionType = 'ADD_LOG' | 'UPDATE_TREINO' | 'ADD_TREINO';

export interface OfflineAction {
    id: string;
    type: OfflineActionType;
    payload: any;
    timestamp: number;
    retryCount: number;
}

/**
 * Adds an action to the AsyncStorage-backed offline queue.
 * @param type Type of operation the sync layer should replay later.
 * @param payload Operation-specific data needed to perform the replay.
 * @returns Promise resolved after the queue is persisted, or after an error is logged.
 */
export const queueAction = async (type: OfflineActionType, payload: any): Promise<void> => {
    try {
        const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];

        const newAction: OfflineAction = {
            id: `action-${Date.now()}-${Math.random()}`,
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
        };

        queue.push(newAction);
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        console.log(`[OfflineQueue] Ação ${type} adicionada à fila. Total: ${queue.length}`);
    } catch (error) {
        console.error('[OfflineQueue] Erro ao adicionar ação à fila:', error);
    }
};

/**
 * Retrieves the current offline action queue.
 * @returns Stored actions, or an empty array when the queue is missing or unreadable.
 */
export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
    try {
        const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
        console.error('[OfflineQueue] Erro ao recuperar fila:', error);
        return [];
    }
};

/**
 * Replaces the offline action queue after processing or retry bookkeeping.
 * @param queue Full queue value to persist.
 * @returns Promise resolved after the queue is saved, or after an error is logged.
 */
export const setOfflineQueue = async (queue: OfflineAction[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('[OfflineQueue] Erro ao salvar fila:', error);
    }
};

/**
 * Gets the current number of queued offline actions.
 * @returns Number of queued actions, or 0 when the queue cannot be read.
 */
export const getQueueSize = async (): Promise<number> => {
    try {
        const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        const queue = queueJson ? JSON.parse(queueJson) : [];
        return queue.length;
    } catch {
        return 0;
    }
}
