// services/offlineSyncService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_OPERATIONS_KEY = 'pendingOfflineOperations';

/**
 * Estrutura para rastrear operações offline que precisam ser sincronizadas.
 */
export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collectionPath: string; // ex: 'treinos', 'logs'
  documentId?: string;
  data?: any;
  timestamp: number;
}

/**
 * Adiciona uma operação à fila de sincronização offline.
 * @param operation A operação a ser adicionada à fila.
 */
export const addPendingOperation = async (operation: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existingOps = await getPendingOperations();
    
    const newOperation: PendingOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    existingOps.push(newOperation);
    await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(existingOps));
    
    console.log(`[OfflineSync] Operação adicionada à fila: ${newOperation.type} em ${operation.collectionPath}`);
  } catch (error) {
    console.error('[OfflineSync] Erro ao adicionar operação à fila:', error);
  }
};

/**
 * Recupera todas as operações pendentes.
 * @returns Array de operações pendentes.
 */
export const getPendingOperations = async (): Promise<PendingOperation[]> => {
  try {
    const opsJson = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
    return opsJson ? JSON.parse(opsJson) : [];
  } catch (error) {
    console.error('[OfflineSync] Erro ao recuperar operações pendentes:', error);
    return [];
  }
};

/**
 * Remove uma operação da fila após sincronização bem-sucedida.
 * @param operationId O ID da operação a ser removida.
 */
export const removePendingOperation = async (operationId: string): Promise<void> => {
  try {
    const existingOps = await getPendingOperations();
    const filteredOps = existingOps.filter(op => op.id !== operationId);
    await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(filteredOps));
    
    console.log(`[OfflineSync] Operação ${operationId} removida da fila.`);
  } catch (error) {
    console.error('[OfflineSync] Erro ao remover operação da fila:', error);
  }
};

/**
 * Limpa todas as operações pendentes (ex: após sincronização bem-sucedida).
 */
export const clearPendingOperations = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_OPERATIONS_KEY);
    console.log('[OfflineSync] Todas as operações pendentes foram limpas.');
  } catch (error) {
    console.error('[OfflineSync] Erro ao limpar operações pendentes:', error);
  }
};

/**
 * Hook para sincronizar operações pendentes quando a conexão for restaurada.
 * Deve ser chamado quando o app detectar que voltou online.
 */
export const syncPendingOperations = async (
  syncCallback: (operations: PendingOperation[]) => Promise<void>
): Promise<void> => {
  try {
    const pendingOps = await getPendingOperations();
    
    if (pendingOps.length === 0) {
      console.log('[OfflineSync] Nenhuma operação pendente para sincronizar.');
      return;
    }

    console.log(`[OfflineSync] Sincronizando ${pendingOps.length} operações...`);
    
    await syncCallback(pendingOps);
    
    await clearPendingOperations();
    console.log('[OfflineSync] Sincronização concluída com sucesso!');
  } catch (error) {
    console.error('[OfflineSync] Erro durante sincronização:', error);
    // Não limpamos as operações aqui para que possam ser retentadas
    throw error;
  }
};
