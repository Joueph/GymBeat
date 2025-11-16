// services/offlineSyncImplementation.ts
// Exemplo de implementação real de sincronização offline

import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';
import { addLog } from './logService';
import { getPendingOperations, PendingOperation, removePendingOperation } from './offlineSyncService';

/**
 * Sincroniza operações pendentes de logs com Firestore.
 * Este é um exemplo de como implementar a sincronização real.
 * 
 * NOTA: Esta função deve ser chamada quando o app detecta que está online,
 * geralmente no useEffect do _layout.tsx ou em um contexto global.
 * 
 * @param userId ID do usuário para validação
 */
export const syncLogsFromOfflineQueue = async (userId: string): Promise<void> => {
  try {
    const pendingOps = await getPendingOperations();
    
    // Filtrar apenas operações de logs
    const logOps = pendingOps.filter(op => op.collectionPath === 'logs');
    
    if (logOps.length === 0) {
      console.log('[OfflineSync] Nenhum log pendente para sincronizar');
      return;
    }

    console.log(`[OfflineSync] Sincronizando ${logOps.length} logs...`);

    // Usar batch write para garantir atomicidade
    const batch = writeBatch(db);
    const successfulOps: string[] = [];

    for (const operation of logOps) {
      try {
        const log = operation.data as Log;

        // Validar dados essenciais
        if (!log || !log.usuarioId) {
          console.warn(`[OfflineSync] Log inválido:`, log);
          successfulOps.push(operation.id);
          continue;
        }

        // Garantir que o log é do usuário correto
        if (log.usuarioId !== userId) {
          console.warn(`[OfflineSync] Log não pertence ao usuário logado`);
          successfulOps.push(operation.id); // Remover mesmo assim para não ficar preso
          continue;
        }

        switch (operation.type) {
          case 'create':
            // Adicionar novo log (será criado com novo ID no Firestore)
            const { id, ...logData } = log;
            await addLog({ ...logData, usuarioId: userId });
            successfulOps.push(operation.id);
            break;

          case 'update':
            // Atualizar log existente
            if (operation.documentId) {
              const logRef = doc(db, 'logs', operation.documentId);
              batch.update(logRef, { ...operation.data, updatedAt: new Date() });
              successfulOps.push(operation.id);
            }
            break;

          case 'delete':
            // Deletar log
            if (operation.documentId) {
              const logRef = doc(db, 'logs', operation.documentId);
              batch.delete(logRef);
              successfulOps.push(operation.id);
            }
            break;
        }
      } catch (error) {
        console.error(`[OfflineSync] Erro ao processar operação ${operation.id}:`, error);
        // Não adicionar aos successfulOps para tentar novamente depois
      }
    }

    // Commit batch
    await batch.commit();

    // Remover operações bem-sucedidas da fila
    for (const opId of successfulOps) {
      await removePendingOperation(opId);
    }

    console.log(`[OfflineSync] ${successfulOps.length}/${logOps.length} logs sincronizados`);

  } catch (error) {
    console.error('[OfflineSync] Erro ao sincronizar logs:', error);
    throw error;
  }
};

/**
 * Sincroniza TODAS as operações pendentes de qualquer coleção.
 * Use quando tiver múltiplos tipos de operações para sincronizar.
 */
export const syncAllPendingOperations = async (userId: string): Promise<void> => {
  try {
    const pendingOps = await getPendingOperations();
    
    if (pendingOps.length === 0) {
      console.log('[OfflineSync] Nenhuma operação pendente');
      return;
    }

    // Agrupar por tipo de coleção
    const opsByCollection = new Map<string, PendingOperation[]>();
    pendingOps.forEach(op => {
      if (!opsByCollection.has(op.collectionPath)) {
        opsByCollection.set(op.collectionPath, []);
      }
      opsByCollection.get(op.collectionPath)!.push(op);
    });

    // Sincronizar cada tipo de coleção
    for (const [collection, ops] of opsByCollection) {
      try {
        switch (collection) {
          case 'logs':
            await syncLogsFromOfflineQueue(userId);
            break;
          // Adicionar outros tipos de sincronização aqui
          // case 'treinos':
          //   await syncTreinosFromOfflineQueue(userId);
          //   break;
          default:
            console.warn(`[OfflineSync] Tipo de coleção desconhecido: ${collection}`);
        }
      } catch (error) {
        console.error(`[OfflineSync] Erro ao sincronizar ${collection}:`, error);
        // Continuar com outras coleções mesmo se uma falhar
      }
    }

    console.log('[OfflineSync] Sincronização completa');
  } catch (error) {
    console.error('[OfflineSync] Erro fatal na sincronização:', error);
    throw error;
  }
};

/**
 * Retry com exponential backoff para sincronização.
 * Use se quiser tentar novamente automaticamente.
 */
export const syncWithRetry = async (
  userId: string,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<boolean> => {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OfflineSync] Tentativa ${attempt}/${maxRetries}...`);
      await syncAllPendingOperations(userId);
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[OfflineSync] Falha final após ${maxRetries} tentativas`);
        return false;
      }

      console.warn(
        `[OfflineSync] Tentativa ${attempt} falhou. Aguardando ${delay}ms antes de retry...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  return false;
};
