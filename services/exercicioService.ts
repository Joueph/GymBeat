import { addDoc, collection, DocumentSnapshot, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';
import { ExercicioModelo } from '../models/exercicio';

const EXERCICIOS_PAGE_SIZE = 20; // Define a default page size

export const createExercicioModelo = async (exercicioData: Omit<ExercicioModelo, 'id' | 'isCustom' | 'userId'> & { imagemUrl?: string }): Promise<ExercicioModelo> => {
	const user = auth.currentUser;
	if (!user) {
	  throw new Error("Usuário não autenticado.");
	}
  
	const exercicioRef = collection(db, 'exerciciosModelos');
	const newExercicioData = {
	  ...exercicioData,
	  userId: user.uid,
	  isCustom: true,
	  nome_lowercase: exercicioData.nome.toLowerCase(),
	  imagemUrl: exercicioData.imagemUrl || '', // Ensure imagemUrl is always a string
	  tipo: exercicioData.tipo || 'força', // Ensure tipo is always a string, default to 'força'
	};
  
	const docRef = await addDoc(exercicioRef, newExercicioData);
  
	return {
	  id: docRef.id,
	  ...newExercicioData,
	} as ExercicioModelo;
  };

export const getTodosGruposMusculares = async (): Promise<string[]> => {
  try {
    const q = query(collection(db, 'exerciciosModelos'));
    const querySnapshot = await getDocs(q);
    
    const grupos = new Set<string>();
    querySnapshot.forEach((doc) => {
      const data = doc.data() as ExercicioModelo;
      if (data.grupoMuscular) {
        grupos.add(data.grupoMuscular);
      }
    });

    // Retorna os grupos ordenados alfabeticamente
    return Array.from(grupos).sort();
  } catch (error) {
    console.error("Erro ao buscar todos os grupos musculares: ", error);
    throw error;
  }
};

export const getExerciciosModelos = async (params: { lastVisibleDoc?: DocumentSnapshot | null, limit?: number, searchTerm?: string, grupoMuscular?: string | null }): Promise<{ exercicios: ExercicioModelo[], lastVisibleDoc: DocumentSnapshot | null }> => {
  const { lastVisibleDoc, limit: queryLimit = EXERCICIOS_PAGE_SIZE, searchTerm, grupoMuscular } = params;
  const exerciciosRef = collection(db, 'exerciciosModelos');

  let q = query(exerciciosRef);

  // Apply search term if present
  if (searchTerm) {
    // Firestore does not support full-text search. This is a prefix search.
    // For more advanced search, a dedicated search service (e.g., Algolia, ElasticSearch) would be needed.
    // Ensure 'nome' field is indexed in Firestore for this query to work efficiently.
    q = query(q, where('nome', '>=', searchTerm), where('nome', '<=', searchTerm + '\uf8ff'));
  }

  // Apply muscle group filter if present
  if (grupoMuscular) {
    q = query(q, where('grupoMuscular', '==', grupoMuscular));
  }

  // Always order for consistent pagination. 'nome' is a good candidate.
  q = query(q, orderBy('nome')); // A ordenação principal continua sendo por nome

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