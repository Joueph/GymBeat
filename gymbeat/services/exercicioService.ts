import { db } from '../firebaseconfig';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { ExercicioModelo } from '../models/exercicio';

export const getExerciciosModelos = async (): Promise<ExercicioModelo[]> => {
  const exerciciosRef = collection(db, 'exerciciosModelos');
  const snapshot = await getDocs(exerciciosRef);
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExercicioModelo));
};

export const getExerciciosModelosByIds = async (ids: string[]): Promise<ExercicioModelo[]> => {
    if (!ids || ids.length === 0) {
        return [];
    }

    const exerciciosRef = collection(db, 'exerciciosModelos');
    // Firestore 'in' query is limited to 30 elements. For more, you'd need multiple queries.
    const q = query(exerciciosRef, where(documentId(), 'in', ids));
    const snapshot = await getDocs(q);

    const modelos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExercicioModelo));

    // Firestore 'in' query doesn't guarantee order. Let's re-order.
    const orderedModelos = ids.map(id => modelos.find(m => m.id === id)).filter(Boolean) as ExercicioModelo[];
    return orderedModelos;
};