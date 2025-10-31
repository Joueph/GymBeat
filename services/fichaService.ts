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

/**
 * Fetches all workout plan models from the 'fichas_modelos' collection in Firestore.
 * This replaces reading from the local treinos.json file.
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
 */
  export const copyFichaModeloToUser = async (fichaModelo: FichaModelo, userId: string, treinosParaCopiar: TreinoModelo[]): Promise<string> => {
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
    // modeloId: fichaModelo.id, // Removed as it's not part of Ficha interface
  };

  batch.set(newFichaRef, newFichaData);

  // 4. Commit all writes in a single batch
  await batch.commit();

  return newFichaRef.id;
};

export const getFichaAtiva = async (userId: string): Promise<Ficha | null> => {
  const fichasRef = collection(db, 'fichas');
  const q = query(fichasRef, where('usuarioId', '==', userId), where('ativa', '==', true));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return null;
  }
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Ficha;
};

export const getFichasByUsuarioId = async (userId: string): Promise<Ficha[]> => {
  const fichasRef = collection(db, 'fichas');
  const q = query(fichasRef, where('usuarioId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ficha));
};

export const setFichaAtiva = async (userId: string, fichaId: string): Promise<Ficha | null> => {
  const batch = writeBatch(db);
  const fichasRef = collection(db, 'fichas');
  
  const q = query(fichasRef, where('usuarioId', '==', userId), where('ativa', '==', true));
  const activeFichasSnapshot = await getDocs(q);
  activeFichasSnapshot.forEach(doc => {
    batch.update(doc.ref, { ativa: false });
  });

  const newActiveFichaRef = doc(db, 'fichas', fichaId);
  batch.update(newActiveFichaRef, { ativa: true });

  await batch.commit();

  // ADICIONADO: Busca e retorna a ficha recém-ativada
  const docSnap = await getDoc(newActiveFichaRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Ficha;
  }
  return null; // Caso a ficha não seja encontrada
};

export const addFicha = async (fichaData: Omit<Ficha, 'id'>): Promise<string> => {
  const fichasRef = collection(db, 'fichas');
  const docRef = await addDoc(fichasRef, fichaData);
  return docRef.id;
};

export const getFichaById = async (fichaId: string): Promise<Ficha | null> => {
  const fichaRef = doc(db, 'fichas', fichaId);
  const docSnap = await getDoc(fichaRef);

  if (!docSnap.exists()) {
    console.log("Ficha document not found:", fichaId);
    return null;
  }

  return { id: docSnap.id, ...docSnap.data() } as Ficha;
};

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

  // 2. Mark all associated Treino documents for deletion
  treinoIds.forEach(treinoId => {
    const treinoRef = doc(db, 'treinos', treinoId);
    batch.delete(treinoRef);
  });

  // 3. Commit the batch
  await batch.commit();
};