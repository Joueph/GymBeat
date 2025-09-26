import { collection, DocumentSnapshot, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ExercicioModelo } from '../models/exercicio';

const EXERCICIOS_PAGE_SIZE = 20; // Define a default page size

export const getExerciciosModelos = async (params: { lastVisibleDoc?: DocumentSnapshot | null, limit?: number, searchTerm?: string }): Promise<{ exercicios: ExercicioModelo[], lastVisibleDoc: DocumentSnapshot | null }> => {
  const { lastVisibleDoc, limit: queryLimit = EXERCICIOS_PAGE_SIZE, searchTerm } = params;
  const exerciciosRef = collection(db, 'exerciciosModelos');

  let q = query(exerciciosRef);

  // Apply search term if present
  if (searchTerm) {
    // Firestore does not support full-text search. This is a prefix search.
    // For more advanced search, a dedicated search service (e.g., Algolia, ElasticSearch) would be needed.
    // Ensure 'nome' field is indexed in Firestore for this query to work efficiently.
    q = query(q, where('nome', '>=', searchTerm), where('nome', '<=', searchTerm + '\uf8ff'));
  }

  // Always order for consistent pagination. 'nome' is a good candidate.
  q = query(q, orderBy('nome'));

  // Apply startAfter for pagination
  if (lastVisibleDoc) {
    q = query(q, startAfter(lastVisibleDoc));
  }

  // Apply limit
  q = query(q, limit(queryLimit));

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return { exercicios: [], lastVisibleDoc: null };
  }

  const exercicios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExercicioModelo));
  const newLastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

  return { exercicios, lastVisibleDoc: newLastVisibleDoc };
};