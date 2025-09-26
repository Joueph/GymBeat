import { Exercicio } from './exercicio';
import { Treino } from './treino';

export interface Log {
  id: string;
  treino: Treino;
  exercicios: Exercicio[];
  exerciciosFeitos: Exercicio[];
  horarioInicio: Date;
  horarioFim: Date;
  usuarioId: string;
}