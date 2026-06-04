// services/fichaService.ts

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Ficha } from '../models/ficha';
import { FichaModelo } from '../models/fichaModelo';
import { TreinoModelo } from '../models/treinoModelo';
import { cacheUserFichas, getCachedFichaAtiva, getCachedUserFichas } from './offlineCacheService';

/**
 * Fetches all workout plan models from the 'fichas_modelos' collection in Firestore.
 * This replaces reading from the local treinos.json file.
 * @returns Available ficha templates with normalized treino ID arrays.
 */
export const getFichasModelos = async (): Promise<FichaModelo[]> => {
  const snapshot = await getDocs(collection(db, "fichasModelos"));

  if (snapshot.empty) {
    console.log("No model workout sheets found in 'fichasModelos' collection.");
    return [];
  }

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      treinos: Array.isArray(data.treinos) ? data.treinos : [], // mantém como string[]
    } as FichaModelo;
  });
};

/**
 * Copies a FichaModelo and its associated TreinoModelos to a user-specific Ficha and Treinos.
 * @param fichaModelo Template ficha used as the source of the user ficha.
 * @param userId User ID that will own the copied ficha and treinos.
 * @param treinosParaCopiar Customized treino templates to create under the new ficha.
 * @returns IDs for the created ficha and treino documents.
 */
export const copyFichaModeloToUser = async (fichaModelo: FichaModelo, userId: string, treinosParaCopiar: TreinoModelo[]): Promise<{ fichaId: string; treinoIds: string[] }> => {
  const batch = writeBatch(db);
  const newTreinoRefs: any[] = [];

  // 1. NÃO buscamos mais os modelos. Usamos 'treinosParaCopiar' que já veio customizado.
  if (treinosParaCopiar.length > 0) {

    // 2. Itera sobre os treinos customizados passados como parâmetro
    for (const treinoCustomizado of treinosParaCopiar) {
      const newTreinoRef = doc(collection(db, 'treinos'));

      const newTreinoData = {
        nome: treinoCustomizado.nome,
        diasSemana: treinoCustomizado.diasSemana, // <-- CORRIGIDO: Usa os dias customizados
        exercicios: (treinoCustomizado.exercicios as any[]).map((ex, exIndex) => {
          // Gera array de séries com base no número de séries do modelo
          // Usamos 'ex.series' e 'ex.repeticoes' que vêm do TreinoModelo
          const seriesArray = Array.from({ length: Number((ex as any).series) || 0 }, (_, i) => ({
            id: `set-${Date.now()}-${i}`,
            peso: 0,
            repeticoes: (ex as any).repeticoes || '',
          }));

          return {
            ...ex,
            modelo: (ex as any).modelo, // mantém referência ao modelo
            series: seriesArray, // substitui o número por o array de mapas
            anotacoes: '', // adiciona campo vazio
          };
        }),
        usuarioId: userId,
        modeloId: treinoCustomizado.id, // Usa o ID do modelo original
      };

      batch.set(newTreinoRef, newTreinoData);
      newTreinoRefs.push(newTreinoRef); // Store the full reference
    }
  }
  // 3. Create the new user-specific Ficha document
  const newFichaRef = doc(collection(db, 'fichas'));
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 2);

  const newFichaData: Omit<Ficha, 'id'> = {
    usuarioId: userId,
    nome: fichaModelo.nome,
    treinos: newTreinoRefs.map(ref => ref.id), // Store IDs in the user's ficha
    dataExpiracao: Timestamp.fromDate(expirationDate) as any,
    opcoes: 'Programa de treinamento',
    ativa: false,
    imagemUrl: fichaModelo.imagemUrl || '',
    dataCriacao: Timestamp.now() as any,
    // modeloId: fichaModelo.id, // Removed as it's not part of Ficha interface
  };

  batch.set(newFichaRef, newFichaData);

  // 3.5. Update each new treino with the new ficha's ID
  newTreinoRefs.forEach(treinoRef => {
    batch.update(treinoRef, { fichaId: newFichaRef.id });
  });

  // 4. Commit all writes in a single batch
  await batch.commit();

  return { fichaId: newFichaRef.id, treinoIds: newTreinoRefs.map(ref => ref.id) };
};

/**
 * Busca a ficha ativa de um usuario, com fallback para o cache offline.
 * @param userId ID do usuario dono da ficha.
 * @returns A ficha ativa, ou null quando nenhuma ficha ativa for encontrada.
 */
export const getFichaAtiva = async (userId: string): Promise<Ficha | null> => {
  try {
    const fichasRef = collection(db, 'fichas');
    const q = query(fichasRef, where('usuarioId', '==', userId), where('ativa', '==', true));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Assume there's only one active ficha per user
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Ficha;
  } catch (error) {
    console.error('[FichaService] Erro ao buscar ficha ativa:', error);
    // Fallback: tenta recuperar do cache se offline
    const cachedFicha = await getCachedFichaAtiva();
    if (cachedFicha) {
      console.log('[FichaService] Usando ficha ativa em cache (offline)');
      return cachedFicha;
    }
    return null;
  }
};

/**
 * Busca todas as fichas de um usuario e atualiza o cache local.
 * @param userId ID do usuario dono das fichas.
 * @returns Lista de fichas do usuario, ou a lista em cache quando o Firestore falhar.
 */
export const getFichasByUsuarioId = async (userId: string): Promise<Ficha[]> => {
  try {
    const fichasRef = collection(db, 'fichas');
    const q = query(fichasRef, where('usuarioId', '==', userId));
    const querySnapshot = await getDocs(q);
    const fichas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ficha));

    // Atualiza cache
    cacheUserFichas(userId, fichas);

    return fichas;
  } catch (error) {
    console.error('[FichaService] Erro ao buscar fichas:', error);
    // Fallback offline
    const cached = await getCachedUserFichas(userId);
    if (cached && cached.length > 0) {
      console.log('[FichaService] Usando fichas em cache (offline)');
      return cached;
    }
    throw error; // Ou retornar array vazio se preferir não quebrar a UI
  }
};

/**
 * Define qual ficha esta ativa para um usuario e desativa fichas ativas anteriores.
 * @param userId ID do usuario dono das fichas.
 * @param fichaId ID da ficha que deve ficar ativa, ou null para apenas desativar.
 * @param previousFichaId ID conhecido da ficha ativa anterior usado como fallback.
 * @returns A ficha recem-ativada, ou null quando nenhuma ficha for ativada.
 */
export const setFichaAtiva = async (userId: string, fichaId: string | null, previousFichaId?: string): Promise<Ficha | null> => {
  const batch = writeBatch(db);
  const fichasRef = collection(db, 'fichas');

  // Deactivate currently active fichas found by query
  const q = query(fichasRef, where('usuarioId', '==', userId), where('ativa', '==', true));
  const activeFichasSnapshot = await getDocs(q);

  const fichasToDeactivate = new Set<string>();

  activeFichasSnapshot.forEach(doc => {
    fichasToDeactivate.add(doc.id);
  });

  // Also ensure the known previous active ficha is deactivated (fallback)
  if (previousFichaId) {
    fichasToDeactivate.add(previousFichaId);
  }

  fichasToDeactivate.forEach(id => {
    // Avoid checking the one we are about to activate (optimization, though overwrite handles it)
    if (id !== fichaId) {
      const ref = doc(db, 'fichas', id);
      batch.update(ref, { ativa: false });
    }
  });

  if (fichaId) {
    const newActiveFichaRef = doc(db, 'fichas', fichaId);
    batch.update(newActiveFichaRef, { ativa: true });
    await batch.commit();

    // ADICIONADO: Busca e retorna a ficha recém-ativada
    const docSnap = await getDoc(newActiveFichaRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Ficha;
    }
    return null; // Caso a ficha não seja encontrada
  } else {
    // Se fichaId for null, apenas commitamos as desativações
    await batch.commit();
    return null;
  }
};

/**
 * Cria uma ficha no Firestore.
 * @param fichaData Dados da ficha sem o ID gerado pelo Firestore.
 * @returns ID da ficha criada.
 */
export const addFicha = async (fichaData: Omit<Ficha, 'id'>): Promise<string> => {
  const fichasRef = collection(db, 'fichas');
  const docRef = await addDoc(fichasRef, fichaData);
  return docRef.id;
};

/**
 * Busca uma ficha pelo ID, com fallback para a ficha ativa em cache.
 * @param fichaId ID da ficha desejada.
 * @returns A ficha encontrada, ou null quando ela nao existir ou nao houver fallback valido.
 */
export const getFichaById = async (fichaId: string): Promise<Ficha | null> => {
  try {
    const fichaRef = doc(db, 'fichas', fichaId);
    const docSnap = await getDoc(fichaRef);

    if (!docSnap.exists()) {
      console.log("Ficha document not found:", fichaId);
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Ficha;
  } catch (error) {
    console.error('[FichaService] Erro ao buscar ficha:', error);
    // Fallback: tenta recuperar do cache se offline
    const cachedFicha = await getCachedFichaAtiva();
    if (cachedFicha && cachedFicha.id === fichaId) {
      console.log('[FichaService] Usando ficha em cache (offline)');
      return cachedFicha;
    }
    return null;
  }
};

/**
 * Atualiza campos de uma ficha existente.
 * @param fichaId ID da ficha a atualizar.
 * @param data Campos parciais que serao enviados ao Firestore.
 * @returns Promise resolvida quando o update for concluido.
 */
export const updateFicha = async (fichaId: string, data: Partial<Omit<Ficha, 'id'>>): Promise<void> => {
  const fichaRef = doc(db, 'fichas', fichaId);
  await updateDoc(fichaRef, data);
};

/**
 * Deletes a Ficha and all its associated Treino documents.
 * @param fichaId The ID of the Ficha to delete.
 * @param treinoIds An array of IDs of the Treinos to delete.
 */
export const deleteFicha = async (fichaId: string, treinoIds: string[]): Promise<void> => {
  const batch = writeBatch(db);

  // 1. Mark the Ficha document for deletion
  const fichaRef = doc(db, 'fichas', fichaId);
  batch.delete(fichaRef);

  // 2. Disassociate all associated Treino documents by setting fichaId to null
  treinoIds.forEach(treinoId => {
    const treinoRef = doc(db, 'treinos', treinoId);
    batch.update(treinoRef, { fichaId: null });
  });

  // 3. Commit the batch
  await batch.commit();
};
