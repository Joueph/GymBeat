import { addDoc, collection, doc, documentId, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Exercicio, ExercicioModelo } from '../models/exercicio';
import { Ficha } from '../models/ficha';
import { Treino } from '../models/treino';
import { TreinoModelo } from '../models/treinoModelo';

export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

/**
 * Helper function to resolve exercise models from DocumentReferences.
 * This is used by both TreinoModelo and user-specific Treino fetching.
 */
const resolveExercicios = async (exerciciosData: any[]): Promise<Exercicio[]> => {
  return await Promise.all(
    (exerciciosData || []).map(async (ex: any) => {
      // Check if ex.modelo is a DocumentReference (has a .get() method)
      if (ex.modelo && typeof ex.modelo.get === 'function') {
        const modeloDoc = await getDoc(ex.modelo);
        if (modeloDoc.exists()) {
          return {
            ...ex,
            modelo: { ...(modeloDoc.data() as ExercicioModelo), id: modeloDoc.id },
            series: ex.series || [], // Ensure series is an array, even if empty
          } as Exercicio;
        }
      }
      // Fallback if modelo reference is invalid or not found, or if it's already an object
      return {
        ...ex,
        modelo: ex.modelo || { id: ex.modeloId || 'unknown', nome: 'Exercício Desconhecido', grupoMuscular: '', dificuldade: '', equipamento: '', imagemUrl: '', instrucoes: [] },
        series: ex.series || [],
      } as Exercicio;
    })
  );
};

/**
 * Fetches workout plan models from Firestore by their IDs.
 * This is used to display details of a FichaModelo.
 */
export const getTreinosModelosByIds = async (ids: string[] = []): Promise<TreinoModelo[]> => {
  const validIds = ids.filter(id => typeof id === 'string' && id.trim().length > 0);
  if (validIds.length === 0) {
    console.warn("[getTreinosModelosByIds] Nenhum ID válido recebido:", ids);
    return [];
  }

  const treinosRef = collection(db, 'treinosModelos');
  const q = query(treinosRef, where(documentId(), 'in', validIds));
  const snapshot = await getDocs(q);

  return await Promise.all(snapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();
    const exerciciosComModelo = await resolveExercicios(data.exercicios);
    return {
      id: docSnap.id,
      ...data,
      exercicios: exerciciosComModelo,
    } as TreinoModelo;
  }));
};

/**
 * Fetches a single user-specific workout from Firestore by its ID.
 * Resolves exercise model references within the workout's exercises.
 */
export const getTreinoById = async (treinoId: string): Promise<Treino | null> => {
  const treinoRef = doc(db, 'treinos', treinoId);
  const docSnap = await getDoc(treinoRef);

  if (!docSnap.exists()) {
    console.log("Treino document not found:", treinoId);
    return null;
  }

  const data = docSnap.data() as Treino;
  const exerciciosComModelo = await resolveExercicios(data.exercicios);

  return { ...data, id: docSnap.id, exercicios: exerciciosComModelo } as Treino;
};

/**
 * Fetches user-specific workouts from Firestore by their IDs.
 * This is used to display the workouts of a user's active Ficha.
 */
export const getTreinosByIds = async (ids: string[]): Promise<Treino[]> => {
    // Filtra quaisquer valores undefined/null/strings vazias para evitar erros de consulta.
    const validIds = ids?.filter(id => typeof id === 'string' && id.length > 0);
    if (!validIds || validIds.length === 0) {
        return [];
    }
    const treinosRef = collection(db, 'treinos');
    const q = query(treinosRef, where(documentId(), 'in', validIds)); // Agora é seguro usar validIds
    const snapshot = await getDocs(q);

    const treinos = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const exerciciosComModelo = await resolveExercicios(data.exercicios);
        return {
            id: doc.id,
            ...data,
            exercicios: exerciciosComModelo,
        } as Treino;
    }));
    return treinos;
};

/**
 * Adds a new workout to a user's ficha.
 * @param fichaId The ID of the ficha to add the treino to.
 * @param treinoData The data for the new treino.
 * @param userId The ID of the user creating the treino.
 * @returns The ID of the newly created treino.
 */
export const addTreinoToFicha = async (fichaId: string, treinoData: Omit<Treino, 'id' | 'usuarioId'>, userId: string): Promise<string> => {
  // 1. Create the new treino document
  const treinosCollectionRef = collection(db, 'treinos');
  const newTreinoRef = await addDoc(treinosCollectionRef, {
    ...treinoData,
    usuarioId: userId,
  });

  // 2. Add the new treino's ID to the ficha's treinos array
  const fichaRef = doc(db, 'fichas', fichaId);
  const fichaSnap = await getDoc(fichaRef);

  if (fichaSnap.exists()) {
    const currentFicha = fichaSnap.data() as Ficha;
    const updatedTreinos = [...(currentFicha.treinos || []), newTreinoRef.id];
    await updateDoc(fichaRef, { treinos: updatedTreinos });
  } else {
    console.warn(`Ficha with ID ${fichaId} not found when trying to add treino.`);
  }
  return newTreinoRef.id;
};

/**
 * Updates an existing user-specific workout.
 * @param treinoId The ID of the treino to update.
 * @param data The partial data to update the treino with.
 */
export const updateTreino = async (treinoId: string, data: Partial<Omit<Treino, 'id' | 'usuarioId'>>): Promise<void> => {
  const treinoRef = doc(db, 'treinos', treinoId);
  await updateDoc(treinoRef, data);
};