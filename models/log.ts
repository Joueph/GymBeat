import { Exercicio } from './exercicio';
import { Treino } from './treino';

export interface Log {
  id: string;
  usuarioId: string;
  treino: Treino;
  exercicios: Exercicio[];
  exerciciosFeitos: Exercicio[];
  horarioInicio: any; // Idealmente, um tipo mais específico como Date ou Timestamp
  horarioFim?: any;
  lastInterval?: number | null; // Adicione esta linha
}
