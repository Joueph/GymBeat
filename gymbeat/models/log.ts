import { Treino } from './treino';
import { ExercicioNoTreino } from './exercicio';

export interface Log {
  id: string;
  treino: Treino;
  exercicios: ExercicioNoTreino[];
  exerciciosFeitos: ExercicioNoTreino[];
  horarioInicio: Date;
  horarioFim: Date;
  usuarioId: string;
}