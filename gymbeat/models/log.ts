import { Treino } from './treino';
import { Exercicio } from './exercicio';

export interface Log {
  id: string;
  treino: Treino;
  exercicios: Exercicio[];
  exerciciosFeitos: Exercicio[];
  horarioInicio: Date;
  horarioFim: Date;
  usuarioId: string;
}