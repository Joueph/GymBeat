// services/treinoService.ts
import NetInfo from '@react-native-community/netinfo';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Exercicio, ExercicioModelo } from '../models/exercicio'; // Import Exercicio and ExercicioModelo
import { Treino } from '../models/treino';
import { TreinoModelo } from '../models/treinoModelo';
import {
  cacheUserTreinos,
  getCachedTreinoById,
  getCachedTreinosByIds,
  getCachedUserTreinos,
  updateCachedFicha,
  updateCachedTreino,
  upsertCachedTreino
} from './offlineCacheService';
import { queueAction } from './offlineQueueService';

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

/**
 * Busca um modelo de exercicio usado para popular um treino.
 * @param modeloId ID do documento em exerciciosModelos.
 * @returns Modelo de exercicio encontrado, ou null quando inexistente.
 */
const getExercicioModeloById = async (modeloId: string): Promise<ExercicioModelo | null> => {
  const docRef = doc(db, 'exerciciosModelos', modeloId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as ExercicioModelo;
  }
  return null;
};

/**
 * Fetches a single workout by its ID.
 * @param treinoId ID of the workout document.
 * @returns The workout with populated exercise models, null when missing, or cached data on failure.
 */
export const getTreinoById = async (treinoId: string): Promise<Treino | null> => {
  const networkState = await NetInfo.fetch();
  if (!((networkState.isConnected ?? true) && networkState.isInternetReachable !== false)) {
    return await getCachedTreinoById(treinoId);
  }

  try {
    const docRef = doc(db, 'treinos', treinoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const treinoData = { id: docSnap.id, ...docSnap.data() } as Treino;

      // Populate 'modelo' for each exercise
      if (treinoData.exercicios && treinoData.exercicios.length > 0) {
        const populatedExerciciosPromises = treinoData.exercicios.map(async (ex: Exercicio) => {
          if (ex.modeloId) {
            const modelo = await getExercicioModeloById(ex.modeloId);
            if (modelo) {
              return { ...ex, modelo: modelo };
            }
          }
          return null; // Return null for exercises where the model is not found
        });

        const resolvedExercicios = await Promise.all(populatedExerciciosPromises);

        // Filter out the null values
        const populatedExercicios = resolvedExercicios.filter((ex): ex is Exercicio => ex !== null);

      treinoData.exercicios = populatedExercicios;
      }
      await upsertCachedTreino(treinoData.usuarioId, treinoData);
      return treinoData; // Return the fully populated Treino object
    }
    return null;
  } catch (error) {
    console.error('[TreinoService] Erro ao buscar treino:', error);
    // Fallback: tenta recuperar do cache se offline
    const cachedTreino = await getCachedTreinoById(treinoId);
    if (cachedTreino) {
      console.log('[TreinoService] Usando treino em cache (offline)');
      return cachedTreino;
    }
    return null;
  }
};

/**
 * Fetches multiple workouts based on an array of IDs.
 * @param treinoIds Workout document IDs to fetch.
 * @returns Workouts found in Firestore, or cached workouts when Firestore fails.
 */
export const getTreinosByIds = async (treinoIds: string[]): Promise<Treino[]> => {
  if (!treinoIds || treinoIds.length === 0) {
    return [];
  }
  const networkState = await NetInfo.fetch();
  if (!((networkState.isConnected ?? true) && networkState.isInternetReachable !== false)) {
    return await getCachedTreinosByIds(treinoIds);
  }

  const treinosRef = collection(db, 'treinos');
  try {
    const q = query(treinosRef, where('__name__', 'in', treinoIds));
    const querySnapshot = await getDocs(q);
    const treinos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Treino));
    for (const treino of treinos) {
      await upsertCachedTreino(treino.usuarioId, treino);
    }
    return treinos;
  } catch (error) {
    console.error('[TreinoService] Erro ao buscar treinos por IDs (offline fallback):', error);
    // Tenta recuperar individualmente do cache
    const cached = await getCachedTreinosByIds(treinoIds);
    return cached;
  }
};

/**
 * Fetches all workouts for a given user ID.
 * @param userId ID of the workout owner.
 * @returns User workouts sorted by ordem, or cached workouts when Firestore fails.
 */
export const getTreinosByUsuarioId = async (userId: string): Promise<Treino[]> => {
  const networkState = await NetInfo.fetch();
  if (!((networkState.isConnected ?? true) && networkState.isInternetReachable !== false)) {
    const cached = await getCachedUserTreinos(userId);
    return cached;
  }

  try {
    const treinosRef = collection(db, 'treinos');
    const q = query(treinosRef, where('usuarioId', '==', userId));
    const querySnapshot = await getDocs(q);
    const treinos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Treino));

    // Fallback sort in case 'ordem' is not defined for some documents
    treinos.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));

    // Cache the list
    cacheUserTreinos(userId, treinos);

    return treinos;
  } catch (error) {
    console.error('[TreinoService] Erro ao buscar treinos do usuário:', error);
    const cached = await getCachedUserTreinos(userId);
    if (cached && cached.length > 0) {
      console.log('[TreinoService] Usando treinos em cache (offline)');
      return cached;
    }
    throw error;
  }
};

/**
 * Fetches multiple workout models based on an array of IDs.
 * @param treinoIds Workout model document IDs to fetch.
 * @returns Matching workout models.
 */
export const getTreinosModelosByIds = async (treinoIds: string[]): Promise<TreinoModelo[]> => {
  if (!treinoIds || treinoIds.length === 0) {
    return [];
  }
  const treinosRef = collection(db, 'treinosModelos');
  const q = query(treinosRef, where('__name__', 'in', treinoIds));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TreinoModelo));
};

/**
 * Adds a new workout to a workout plan (ficha).
 * @param fichaId ID of the ficha that should reference the new workout.
 * @param treinoData Workout data to create.
 * @param userId Owner ID to store on the new workout.
 * @returns ID of the created workout.
 */
export const addTreinoToFicha = async (fichaId: string, treinoData: Partial<Omit<Treino, 'id'>>, userId: string): Promise<string> => {
  const batch = writeBatch(db);
  const treinoRef = doc(collection(db, 'treinos'));
  const fichaRef = doc(db, 'fichas', fichaId);

  const fichaSnap = await getDoc(fichaRef);
  if (!fichaSnap.exists()) throw new Error("Ficha not found");

  const fichaData = fichaSnap.data();
  const existingTreinos = fichaData.treinos || [];

  batch.set(treinoRef, { ...treinoData, usuarioId: userId, fichaId: fichaId });
  batch.update(fichaRef, { treinos: [...existingTreinos, treinoRef.id] });

  await batch.commit();
  return treinoRef.id;
};

/**
 * Adds a new workout.
 * @param treinoData Workout data without the generated ID.
 * @param isSyncing true when replaying an offline operation to avoid re-queueing.
 * @returns Created Firestore ID, or a temporary ID when queued offline.
 */
export const addTreino = async (treinoData: Omit<Treino, 'id'>, isSyncing: boolean = false): Promise<string> => {
  const networkState = await NetInfo.fetch();
  const isOnline = (networkState.isConnected ?? true) && networkState.isInternetReachable !== false;
  const requestedId = (treinoData as Partial<Treino>).id;

  if (!isOnline && !isSyncing) {
    console.log('[TreinoService] Offline. Enfileirando addTreino.');
    const tempId = requestedId || `temp-treino-${Date.now()}`;
    const localTreino = { ...treinoData, id: tempId } as Treino;

    // Offline: Add to queue
    await queueAction('ADD_TREINO', { treinoData: localTreino });
    await upsertCachedTreino(localTreino.usuarioId, localTreino);

    if (localTreino.fichaId) {
      const cachedFicha = await updateCachedFicha(localTreino.fichaId, {}, localTreino.usuarioId);
      if (cachedFicha && !cachedFicha.treinos.includes(tempId)) {
        await updateCachedFicha(localTreino.fichaId, { treinos: [...cachedFicha.treinos, tempId] }, localTreino.usuarioId);
      }
    }

    return tempId;
  }

  const batch = writeBatch(db);
  const newTreinoRef = requestedId
    ? doc(db, 'treinos', requestedId)
    : doc(collection(db, 'treinos'));

  // Cria uma cópia dos dados para poder modificá-los
  const dataToSet = { ...treinoData, id: newTreinoRef.id };

  // Firestore não aceita 'undefined'. Se fichaId for undefined, removemos a chave do objeto.
  if (dataToSet.fichaId === undefined) {
    delete (dataToSet as Partial<Treino>).fichaId;
  }

  batch.set(newTreinoRef, dataToSet);

  // If fichaId is present, add the new treino ID to the ficha's list of treinos
  if (dataToSet.fichaId) {
    const fichaRef = doc(db, 'fichas', dataToSet.fichaId);
    batch.update(fichaRef, {
      treinos: arrayUnion(newTreinoRef.id)
    });
  }

  await batch.commit();
  await upsertCachedTreino(dataToSet.usuarioId, dataToSet as Treino);
  return newTreinoRef.id;

};

/**
 * Updates an existing workout.
 * @param treinoId ID of the workout to update.
 * @param treinoData Partial workout fields to persist.
 * @param isSyncing true when replaying an offline operation to avoid re-queueing.
 * @returns Promise resolved when the update is saved or queued.
 */
export const updateTreino = async (treinoId: string, treinoData: Partial<Omit<Treino, 'id'>>, isSyncing: boolean = false): Promise<void> => {
  const networkState = await NetInfo.fetch();
  const isOnline = (networkState.isConnected ?? true) && networkState.isInternetReachable !== false;

  if (!isOnline && !isSyncing) {
    console.log('[TreinoService] Offline. Enfileirando updateTreino.');
    await queueAction('UPDATE_TREINO', { treinoId, treinoData });
    await updateCachedTreino(treinoId, treinoData);
    return;
  }

  // Cria uma cópia dos dados para não modificar o objeto original
  const dataToUpdate = { ...treinoData };
  // O ID não deve ser parte dos dados de atualização no Firestore, então o removemos da cópia.
  delete (dataToUpdate as Partial<Treino>).id;

  // CORREÇÃO: Garante que `fichaId` nunca seja `undefined`.
  // O Firestore não aceita `undefined`, mas aceita `null` para representar um campo vazio.
  if ('fichaId' in dataToUpdate && dataToUpdate.fichaId === undefined) {
    (dataToUpdate as any).fichaId = null;
  }

  const treinoRef = doc(db, 'treinos', treinoId);
  await updateDoc(treinoRef, dataToUpdate);
  await updateCachedTreino(treinoId, treinoData);
};

/**
 * Updates the order of multiple 'unassigned' workouts.
 * @param treinoIds Ordered workout IDs; array position becomes the stored ordem.
 * @returns Promise resolved after the batch commit.
 */
export const updateTreinosOrdem = async (treinoIds: string[]): Promise<void> => {
  const networkState = await NetInfo.fetch();
  const isOnline = (networkState.isConnected ?? true) && networkState.isInternetReachable !== false;

  if (!isOnline) {
    await queueAction('UPDATE_TREINOS_ORDEM', { treinoIds });
    for (let index = 0; index < treinoIds.length; index++) {
      await updateCachedTreino(treinoIds[index], { ordem: index });
    }
    return;
  }

  const batch = writeBatch(db);
  treinoIds.forEach((treinoId, index) => {
    const treinoRef = doc(db, 'treinos', treinoId);
    batch.update(treinoRef, { ordem: index });
  });
  await batch.commit();
  for (let index = 0; index < treinoIds.length; index++) {
    await updateCachedTreino(treinoIds[index], { ordem: index });
  }
};

/**
 * Deletes a workout and removes its reference from the corresponding ficha.
 * @param treinoId ID of the workout to delete.
 * @param fichaId Optional ficha ID that should stop referencing the workout.
 * @returns Promise resolved after the batch commit.
 */
export const deleteTreino = async (treinoId: string, fichaId?: string): Promise<void> => {
  const batch = writeBatch(db);
  const treinoRef = doc(db, 'treinos', treinoId);

  // If a fichaId is provided, remove the treino from its list
  // If a fichaId is provided, remove the treino from its list
  if (fichaId) {
    const fichaRef = doc(db, 'fichas', fichaId);
    batch.update(fichaRef, {
      treinos: arrayRemove(treinoId)
    });
  }

  // Delete the treino document
  batch.delete(treinoRef);

  // Commit the batch
  await batch.commit();
};
