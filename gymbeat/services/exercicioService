import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { ExercicioModelo } from '../models/exercicio';

const exerciciosCollection = collection(db, 'exerciciosModelos');

/**
 * Adiciona um novo modelo de exercício à coleção geral de exercícios.
 * @param exercicioData - Dados do exercício modelo.
 */
export const addExercicioModelo = async (exercicioData: Omit<ExercicioModelo, 'id'>) => {
  try {
    const docRef = await addDoc(exerciciosCollection, exercicioData);
    console.log('Modelo de exercício adicionado com o ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar modelo de exercício: ', error);
    throw error;
  }
};

/**
 * Busca todos os modelos de exercícios disponíveis.
 */
export const getAllExercicioModelos = async (): Promise<ExercicioModelo[]> => {
  try {
    const querySnapshot = await getDocs(exerciciosCollection);
    const exercicios: ExercicioModelo[] = [];
    querySnapshot.forEach((doc) => {
      exercicios.push({ id: doc.id, ...doc.data() } as ExercicioModelo);
    });
    return exercicios;
  } catch (error) {
    console.error('Erro ao buscar modelos de exercícios: ', error);
    throw error;
  }
};