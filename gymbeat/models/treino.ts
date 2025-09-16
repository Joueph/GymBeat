import { ExercicioNoTreino } from './exercicio';
import { Log } from './log';

export interface Treino {
  id: string;
  nome: string;
  diasSemana: ('seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom')[];
  exercicios: ExercicioNoTreino[];
  usuarioId: string;
  dataCriacao: Date;
  intervalo: {
    min: number;
    seg: number;
  };
  logs: Log[];
}