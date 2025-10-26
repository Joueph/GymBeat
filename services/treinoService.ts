import { addDoc, collection, deleteDoc, doc, documentId, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Exercicio, ExercicioModelo } from '../models/exercicio';
import { Ficha } from '../models/ficha';
import { Treino } from '../models/treino';
import { TreinoModelo } from '../models/treinoModelo';

export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

// Objeto de fallback para garantir que 'caracteristicas' sempre exista
const defaultModelo = (id: string): ExercicioModelo => ({
  id: id || 'unknown',
  nome: 'Exercício Desconhecido',
  grupoMuscular: '',
  imagemUrl: '',
  caracteristicas: { isPesoBilateral: false, isPesoCorporal: false, usaBarra: false },
  tipo: ''
});

/**
 * Helper function to resolve exercise models from DocumentReferences.
 * This is used by both TreinoModelo and user-specific Treino fetching.
 */
const resolveExercicios = async (exerciciosData: any[]): Promise<Exercicio[]> => {
  return Promise.all(
    (exerciciosData || []).map(async (exData: any) => {
      // 1. Determina o ID do modelo, seja de uma referência ou de um campo 'modeloId'
      // exData.modelo?.path checa se é uma DocumentReference
      const modeloId = exData.modeloId || (exData.modelo?.path ? exData.modelo.id : null);

      if (!modeloId) {
        console.warn("Exercício sem modeloId ou referência de modelo válida.", exData);
        // Retorna o objeto antigo (em cache) se for tudo o que temos
        return {
          ...exData,
          modelo: exData.modelo?.nome ? exData.modelo : defaultModelo('unknown'), // Evita usar a DocumentReference aqui
          modeloId: exData.modelo?.id || 'unknown',
        } as Exercicio;
      }

      // 2. Com o ID, busca os dados mais recentes do modelo
      try {
        // !!! IMPORTANTE: Confirme se 'exerciciosModelos' é o nome da sua coleção.
        const modeloRef = doc(db, 'exerciciosModelos', modeloId);
        const modeloDoc = await getDoc(modeloRef);

        if (modeloDoc.exists()) {
          // 3. Encontrado! Mescla os dados do treino (exData) com o modelo ATUALIZADO.
          const modeloData = modeloDoc.data() as ExercicioModelo;
          return {
            ...exData,
            modelo: { ...modeloData, id: modeloDoc.id }, // Usa o modelo novo
            modeloId: modeloDoc.id,
          } as Exercicio;
        } else {
          // 4. Não encontrado. Usa o objeto antigo (exData.modelo) como fallback, se existir e for um objeto.
          console.warn(`Modelo de exercício com ID ${modeloId} não encontrado. Usando dados em cache (podem estar desatualizados).`);
          return {
            ...exData,
            modelo: (exData.modelo && !exData.modelo.path) ? exData.modelo : defaultModelo(modeloId),
            modeloId: modeloId,
          } as Exercicio;
        }
      } catch (error) {
        console.error(`Erro ao buscar modelo de exercício: ${error}`, exData);
        return {
          ...exData,
          modelo: (exData.modelo && !exData.modelo.path) ? exData.modelo : defaultModelo(modeloId),
          modeloId: modeloId,
        } as Exercicio;
      }
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

  const treinos = await Promise.all(snapshot.docs.map(async (doc) => {
    const data = doc.data();
    // Mesmo para modelos, os exercícios podem ter referências que precisam ser resolvidas.
    const exerciciosComModelo = await resolveExercicios(data.exercicios);
    return {
      id: doc.id,
      ...data,
      exercicios: exerciciosComModelo,
    } as TreinoModelo;
  }));
  return treinos;
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
    const dataToUpdate: { [key: string]: any } = { ...data };

    // Garante que o objeto 'modelo' NÃO seja salvo de volta no documento 'treino',
    // apenas o 'modeloId' é necessário, pois o 'modelo' será resolvido no carregamento.
    if (dataToUpdate.exercicios) {
        dataToUpdate.exercicios = dataToUpdate.exercicios.map((ex: Exercicio) => {
            // Cria uma cópia do exercício para não modificar o objeto original
            const exCopy: { [key: string]: any } = { ...ex };
            
            // Garante que modeloId esteja presente
            if (!exCopy.modeloId && exCopy.modelo?.id) {
              exCopy.modeloId = exCopy.modelo.id;
            }

            // Remove o objeto 'modelo' aninhado antes de salvar
            delete exCopy.modelo; 

            return exCopy;
        });
    }
    const treinoRef = doc(db, 'treinos', treinoId);
    await updateDoc(treinoRef, dataToUpdate);
};

/**
 * Deletes a user-specific workout and removes its reference from the corresponding ficha.
 * @param treinoId The ID of the treino to delete.
 * @param fichaId The ID of the ficha that contains the treino.
 */
export const deleteTreino = async (treinoId: string, fichaId: string): Promise<void> => {
  // 1. Delete the treino document itself
  const treinoRef = doc(db, 'treinos', treinoId);
  await deleteDoc(treinoRef);

  // 2. Remove the treino's ID from the ficha's 'treinos' array
  const fichaRef = doc(db, 'fichas', fichaId);
  const fichaSnap = await getDoc(fichaRef);

  if (fichaSnap.exists()) {
    const fichaData = fichaSnap.data() as Ficha;
    const updatedTreinos = (fichaData.treinos || []).filter(id => id !== treinoId);
    await updateDoc(fichaRef, { treinos: updatedTreinos });
  }
};
