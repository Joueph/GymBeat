import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { Projeto } from '../models/projeto';

const projetosCollection = collection(db, 'projetos');

/**
 * Cria um novo projeto no Firestore.
 * @param projetoData - Os dados do projeto a serem criados, sem o ID.
 * @returns O ID do novo projeto criado.
 */
export const createProjeto = async (projetoData: Omit<Projeto, 'id'>): Promise<string> => {
  const newProjetoRef = doc(projetosCollection);
  const newProjeto: Projeto = { ...projetoData, id: newProjetoRef.id };

  await setDoc(newProjetoRef, newProjeto);

  const userDocRef = doc(db, 'users', newProjeto.criadorId);
  await updateDoc(userDocRef, { projetos: arrayUnion(newProjeto.id) });

  return newProjeto.id;
};

/**
 * Busca um projeto específico pelo seu ID.
 * @param projetoId - O ID do projeto a ser buscado.
 * @returns O objeto do projeto ou null se não for encontrado.
 */
export const getProjetoById = async (projetoId: string): Promise<Projeto | null> => {
    const projetoDocRef = doc(db, 'projetos', projetoId);
    const docSnap = await getDoc(projetoDocRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Projeto;
    } else {
        console.warn("Nenhum projeto encontrado com o ID:", projetoId);
        return null;
    }
};

/**
 * Atualiza um projeto existente no Firestore.
 * @param projetoId - O ID do projeto a ser atualizado.
 * @param projetoData - Os dados do projeto a serem atualizados.
 */
export const updateProjeto = async (projetoId: string, projetoData: Partial<Projeto>): Promise<void> => {
    const projetoDocRef = doc(db, 'projetos', projetoId);
    await updateDoc(projetoDocRef, projetoData);
};
