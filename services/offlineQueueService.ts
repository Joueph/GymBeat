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
 * Adds an action to the offline queue.
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
 * Retrieves the current offline queue.
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
 * Updates the offline queue (e.g. after processing items).
 */
export const setOfflineQueue = async (queue: OfflineAction[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('[OfflineQueue] Erro ao salvar fila:', error);
    }
};

/**
 * Gets the current size of the queue.
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
