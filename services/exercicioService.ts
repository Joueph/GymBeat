import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { auth, db } from '../firebaseconfig';
import { ExercicioModelo } from '../models/exercicio';

const EXERCICIOS_CACHE_KEY = 'exercicios_cache';
const LAST_SYNC_KEY = 'exercicios_last_sync';
const EXERCICIOS_PAGE_SIZE = 20;

/**
 * Cria um modelo de exercicio customizado para o usuario autenticado.
 * @param exercicioData Dados do exercicio sem os campos gerados pelo sistema.
 * @returns O modelo criado, incluindo o ID gerado pelo Firestore.
 */
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

  const newModel: ExercicioModelo = {
    id: docRef.id,
    ...newExercicioData,
  } as ExercicioModelo;

  // Update local cache immediately
  try {
    const cached = await AsyncStorage.getItem(EXERCICIOS_CACHE_KEY);
    const currentExercises: ExercicioModelo[] = cached ? JSON.parse(cached) : [];
    const updatedExercises = [...currentExercises, newModel];
    await AsyncStorage.setItem(EXERCICIOS_CACHE_KEY, JSON.stringify(updatedExercises));
  } catch (e) {
    console.error("Failed to update local cache after creation", e);
  }

  return newModel;
};

/**
 * Sincroniza todos os modelos de exercicio do Firestore para o cache local.
 * @returns Promise resolvida quando o cache e a data da ultima sincronizacao forem salvos.
 */
export const syncExercicios = async (): Promise<void> => {
  try {
    console.log("Starting exercise sync...");
    const q = query(collection(db, 'exerciciosModelos'), orderBy('nome'));
    const snapshot = await getDocs(q);

    const exercicios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExercicioModelo));

    await AsyncStorage.setItem(EXERCICIOS_CACHE_KEY, JSON.stringify(exercicios));
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    console.log(`Synced ${exercicios.length} exercises.`);
  } catch (error) {
    console.error("Error syncing exercises:", error);
    throw error;
  }
};

/**
 * Le do cache local todos os grupos musculares disponiveis nos modelos de exercicio.
 * @returns Lista alfabetica de grupos musculares encontrados no cache.
 */
export const getTodosGruposMusculares = async (): Promise<string[]> => {
  try {
    const cached = await AsyncStorage.getItem(EXERCICIOS_CACHE_KEY);
    let exercises: ExercicioModelo[] = [];

    if (cached) {
      exercises = JSON.parse(cached);
    } else {
      // Fallback or trigger sync? 
      // For now, if empty, we might want to try to sync or just return empty
      // Ideally the initial sync should have happened.
      // Let's try to sync if cache is totally empty?
      // But doing it here might be slow. Let's assume sync is managed elsewhere or acceptable to match existing logic if needed.
      // Actually, let's keep it safe: if empty, return empty (sync should happen in background)
    }

    const grupos = new Set<string>();
    exercises.forEach((data) => {
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

/**
 * Busca modelos de exercicio no cache local com filtros, busca fuzzy e paginacao por offset.
 * @param params Opcoes de paginacao, termo de busca e filtro por grupo muscular.
 * @returns Exercicios da pagina solicitada e o proximo offset, ou null quando nao ha mais paginas.
 */
export const getExerciciosModelos = async (params: { lastVisibleDoc?: any | null, limit?: number, searchTerm?: string, grupoMuscular?: string | null }): Promise<{ exercicios: ExercicioModelo[], lastVisibleDoc: number | null }> => {
  const { lastVisibleDoc = 0, limit: queryLimit = EXERCICIOS_PAGE_SIZE, searchTerm, grupoMuscular } = params;

  try {
    const cached = await AsyncStorage.getItem(EXERCICIOS_CACHE_KEY);
    let exercises: ExercicioModelo[] = cached ? JSON.parse(cached) : [];

    if (exercises.length === 0) {
      // Attempt basic sync if nothing is there yet? 
      // Or just wait for the background process. 
      // If we return empty, the user sees nothing.
      // Let's trigger a sync if it's completely empty and return the result?
      await syncExercicios();
      const newCached = await AsyncStorage.getItem(EXERCICIOS_CACHE_KEY);
      exercises = newCached ? JSON.parse(newCached) : [];
    }

    // Filter in memory
    let filtered = exercises;

    if (grupoMuscular) {
      filtered = filtered.filter(e => e.grupoMuscular === grupoMuscular);
    }

    if (searchTerm) {
      const fuse = new Fuse(filtered, {
        keys: ['nome', 'aliases'],
        threshold: 0.3, // Adjust fuzziness threshold as needed (0.0 = exact match, 1.0 = match anything)
      });
      const results = fuse.search(searchTerm);
      filtered = results.map(result => result.item);
    } else {
      // Sort by nome only if no search term (Fuse returns results sorted by relevance)
      filtered.sort((a, b) => a.nome.localeCompare(b.nome));
    }


    // Pagination
    // lastVisibleDoc here will be treated as the OFFSET index
    const startIndex = typeof lastVisibleDoc === 'number' ? lastVisibleDoc : 0;
    const sliced = filtered.slice(startIndex, startIndex + queryLimit);

    const newNextIndex = startIndex + queryLimit;
    const actualNextIndex = newNextIndex < filtered.length ? newNextIndex : null;

    return { exercicios: sliced, lastVisibleDoc: actualNextIndex };

  } catch (error) {
    console.error("Error fetching exercises from cache:", error);
    return { exercicios: [], lastVisibleDoc: null };
  }
};
