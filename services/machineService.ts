import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Log } from '../models/log';
import { Machine } from '../models/machine';

const machinesCollection = collection(db, 'machines');

/**
 * Busca as maquinas cadastradas para um exercicio de um usuario.
 * @param exerciseId ID do modelo de exercicio associado as maquinas.
 * @param userId ID do usuario dono das maquinas.
 * @returns Lista de maquinas nao deletadas, ordenadas por uso recente.
 */
export const getMachinesForExercise = async (exerciseId: string, userId: string): Promise<Machine[]> => {
    try {
        const q = query(
            machinesCollection,
            where('exerciseId', '==', exerciseId),
            where('userId', '==', userId),
            where('isDeleted', '==', false)
            // orderBy('lastUsed', 'desc') // Requires composite index, might skip strictly or do client-side sort
        );
        const snapshot = await getDocs(q);
        const machines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine));

        // Sort client-side to avoid index requirement for now
        machines.sort((a, b) => {
            const timeA = a.lastUsed?.toMillis ? a.lastUsed.toMillis() : (a.lastUsed ? new Date(a.lastUsed).getTime() : 0);
            const timeB = b.lastUsed?.toMillis ? b.lastUsed.toMillis() : (b.lastUsed ? new Date(b.lastUsed).getTime() : 0);
            return timeB - timeA;
        });

        return machines;
    } catch (error) {
        console.error('Error fetching machines:', error);
        return [];
    }
};

/**
 * Cria uma maquina/variacao para um exercicio especifico.
 * @param exerciseId ID do modelo de exercicio.
 * @param userId ID do usuario dono da maquina.
 * @param name Nome exibido para a maquina.
 * @returns A maquina criada, ou null se a escrita falhar.
 */
export const createMachine = async (exerciseId: string, userId: string, name: string): Promise<Machine | null> => {
    try {
        const newMachine: Omit<Machine, 'id'> = {
            exerciseId,
            userId,
            name,
            isDeleted: false,
            lastUsed: new Date()
        };
        const docRef = await addDoc(machinesCollection, newMachine);
        return { id: docRef.id, ...newMachine };
    } catch (error) {
        console.error('Error creating machine:', error);
        return null;
    }
};

/**
 * Atualiza campos de uma maquina existente.
 * @param machineId ID da maquina no Firestore.
 * @param updates Campos parciais a persistir.
 * @returns Promise resolvida quando o update terminar; erros sao logados e nao relancados.
 */
export const updateMachine = async (machineId: string, updates: Partial<Machine>) => {
    try {
        const docRef = doc(db, 'machines', machineId);
        await updateDoc(docRef, updates);
    } catch (error) {
        console.error('Error updating machine:', error);
    }
};

/**
 * Marca uma maquina como deletada sem remover o documento.
 * @param machineId ID da maquina no Firestore.
 * @returns Promise resolvida quando o soft delete terminar; erros sao logados e nao relancados.
 */
export const softDeleteMachine = async (machineId: string) => {
    try {
        const docRef = doc(db, 'machines', machineId);
        await updateDoc(docRef, { isDeleted: true });
    } catch (error) {
        console.error('Error deleting machine:', error);
    }
};

/**
 * Busca o log recente mais novo em que uma maquina foi usada em um exercicio.
 * @param exerciseId ID do modelo de exercicio buscado dentro dos logs.
 * @param machineId ID da maquina buscada dentro dos exercicios do log.
 * @param userId ID do usuario dono dos logs.
 * @returns O log correspondente mais recente entre os ultimos 50, ou null.
 */
export const getLastLogForMachine = async (exerciseId: string, machineId: string, userId: string): Promise<Log | null> => {
    // Queries logs to find the last time this specific machine was used for this exercise
    // Since logs structure is: Logs -> [Exercises]. We can't easily query "Logs where exercises includes machineId".
    // We might have to fetch recent logs for this exercise regardless of machine, then filter?
    // OR, if we assume 'Exercicio' in Log has 'machineId'.
    // Querying inside arrays in Firestore is tricky without specific array-contains.
    // Given the data structure, we might need to fetch the last N logs for this user/exercise and find the match.

    // Efficient approach: Fetch last 20 logs for this user containing this exercise?
    // Current 'logs' collection doesn't easily expose "contains exercise X".
    // It's usually better to denormalize or rely on client side if acceptable.
    // 'getLogsByUsuarioId' fetches all logs. That's heavy.

    // Let's look at `getLogsByUsuarioId`. It pulls everything. 
    // Maybe we rely on the cached logs service to search locally?
    // Or we fetch 'logs' where 'exercicios' have this machine.
    // But 'exercicios' is a map/array.

    // Workaround: We will rely on `getHistoryForExercise` if it exists, or build one.
    // Actually, `services/logService.ts` has `getLogsByUsuarioId`.
    // Let's assume we use `services/statsService` or similar if it exists?
    // No, I'll implement a helper here that queries logs roughly.
    // BUT since we can't easily query inside the array of objects without deep limitations,
    // I will fetch the most recent logs for the user (limit 50?) and search manually.

    try {
        const logsRef = collection(db, 'logs');
        const q = query(
            logsRef,
            where('usuarioId', '==', userId),
            orderBy('horarioFim', 'desc'),
            limit(50)
        );
        const snapshot = await getDocs(q);

        for (const doc of snapshot.docs) {
            const log = doc.data() as Log;
            // Check if this log has the exercise AND the machine
            // Note: Data structure of 'exercicios' in Log needs scanning
            if (log.exercicios) {
                const match = log.exercicios.find(ex => ex.modeloId === exerciseId && ex.machineId === machineId);
                if (match) return log;
            }
        }
        return null;
    } catch (e) {
        console.error("Error finding log for machine:", e);
        return null;
    }
}
