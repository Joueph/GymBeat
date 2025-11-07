// services/treinoService.ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Exercicio, ExercicioModelo } from '../models/exercicio'; // Import Exercicio and ExercicioModelo
import { Treino } from '../models/treino';
import { TreinoModelo } from '../models/treinoModelo';

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

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
 */
export const getTreinoById = async (treinoId: string): Promise<Treino | null> => {
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
    return treinoData; // Return the fully populated Treino object
  }
  return null;
};

/**
 * Fetches multiple workouts based on an array of IDs.
 */
export const getTreinosByIds = async (treinoIds: string[]): Promise<Treino[]> => {
  if (!treinoIds || treinoIds.length === 0) {
    return [];
  }
  const treinosRef = collection(db, 'treinos');
  const q = query(treinosRef, where('__name__', 'in', treinoIds));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Treino));
};

/**
 * Fetches all workouts for a given user ID.
 */
export const getTreinosByUsuarioId = async (userId: string): Promise<Treino[]> => {
  const treinosRef = collection(db, 'treinos');
  const q = query(treinosRef, where('usuarioId', '==', userId), orderBy('ordem'));
  const querySnapshot = await getDocs(q);
  const treinos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Treino));
  
  // Fallback sort in case 'ordem' is not defined for some documents
  treinos.sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity));
  
  return treinos;
};

/**
 * Fetches multiple workout models based on an array of IDs.
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
 */
export const addTreino = async (treinoData: Omit<Treino, 'id'>): Promise<string> => {
  const batch = writeBatch(db);
  const newTreinoRef = doc(collection(db, 'treinos'));

  // Cria uma cópia dos dados para poder modificá-los
  const dataToSet = { ...treinoData, id: newTreinoRef.id };

  // Firestore não aceita 'undefined'. Se fichaId for undefined, removemos a chave do objeto.
  if (dataToSet.fichaId === undefined) {
    delete (dataToSet as Partial<Treino>).fichaId;
  }
  batch.set(newTreinoRef, dataToSet);
  await batch.commit();
  return newTreinoRef.id;

};

/**
 * Updates an existing workout.
 */
export const updateTreino = async (treinoId: string, treinoData: Partial<Omit<Treino, 'id'>>): Promise<void> => {
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
};

/**
 * Updates the order of multiple 'unassigned' workouts.
 */
export const updateTreinosOrdem = async (treinoIds: string[]): Promise<void> => {
  const batch = writeBatch(db);
  treinoIds.forEach((treinoId, index) => {
    const treinoRef = doc(db, 'treinos', treinoId);
    batch.update(treinoRef, { ordem: index });
  });
  await batch.commit();
};

/**
 * Deletes a workout and removes its reference from the corresponding ficha.
 */
export const deleteTreino = async (treinoId: string, fichaId: string): Promise<void> => {
  // This is a simplified version. A robust implementation would use a transaction or batch write
  // to also remove the treinoId from the 'treinos' array in the corresponding 'ficha' document.
  const treinoRef = doc(db, 'treinos', treinoId);
  await deleteDoc(treinoRef);
};