import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  documentId,
} from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Treino, DiaSemana } from '../models/treino';
import { TreinoModelo } from '@/models/treinoModelo';

const treinosCollection = collection(db, 'treinos');
const treinosModelosCollection = collection(db, 'treinosModelos');

export const getTreinoById = async (treinoId: string): Promise<Treino | null> => {
    try {
        const docRef = doc(db, 'treinos', treinoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Treino;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar treino por ID: ', error);
        throw error;
    }
};

export const getTreinosByIds = async (treinoIds: string[]): Promise<Treino[]> => {
    if (!treinoIds || treinoIds.length === 0) {
        return [];
    }
    try {
        const q = query(treinosCollection, where(documentId(), 'in', treinoIds));
        const querySnapshot = await getDocs(q);
        const treinos: Treino[] = [];
        querySnapshot.forEach((doc) => {
            treinos.push({ id: doc.id, ...doc.data() } as Treino);
        });
        return treinos;
    } catch (error) {
        console.error('Erro ao buscar treinos por IDs: ', error);
        throw error;
    }
};

export const getTreinosModelosByIds = async (treinoIds: string[]): Promise<TreinoModelo[]> => {
    if (!treinoIds || treinoIds.length === 0) {
        return [];
    }
    try {
        const q = query(treinosModelosCollection, where(documentId(), 'in', treinoIds));
        const querySnapshot = await getDocs(q);
        const treinos: TreinoModelo[] = [];
        querySnapshot.forEach((doc) => {
            treinos.push({ id: doc.id, ...doc.data() } as TreinoModelo);
        });

        // Sort the results to match the order of the original treinoIds array
        const sortedTreinos = treinoIds
            .map(id => treinos.find(t => t.id === id))
            .filter((t): t is TreinoModelo => t !== undefined);

        return sortedTreinos;
    } catch (error) {
        console.error('Erro ao buscar treinos modelos por IDs: ', error);
        throw error;
    }
};

export const addTreinoToFicha = async (fichaId: string, treinoData: Omit<Treino, 'id' | 'usuarioId'>, usuarioId: string) => {
  try {
    const docRef = await addDoc(treinosCollection, {
      ...treinoData,
      usuarioId,
      dataCriacao: serverTimestamp(),
      logs: [],
    });

    const fichaRef = doc(db, 'fichas', fichaId);
    await updateDoc(fichaRef, {
      treinos: arrayUnion(docRef.id)
    });

    console.log('Treino adicionado com ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar treino: ', error);
    throw error;
  }
};

export const updateTreino = async (treinoId: string, treinoData: Partial<Treino>) => {
    try {
        const treinoRef = doc(db, 'treinos', treinoId);
        await updateDoc(treinoRef, treinoData);
        console.log('Treino atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar treino: ', error);
        throw error;
    }
};

export const getTreinosByUsuarioId = async (usuarioId: string): Promise<Treino[]> => {
  try {
    const q = query(treinosCollection, where('usuarioId', '==', usuarioId));
    const querySnapshot = await getDocs(q);

    const treinos: Treino[] = [];
    querySnapshot.forEach((doc) => {
      treinos.push({ id: doc.id, ...doc.data() } as Treino);
    });

    return treinos;
  } catch (error) {
    console.error('Erro ao buscar treinos: ', error);
    throw error;
  }
};