import { ReactNode } from 'react';
import { Exercicio } from './exercicio';
import { Treino } from './treino';

export interface Log {
  status: string;
  observacoes: any;
  nomeTreino: ReactNode;
  id: string;
  usuarioId: string;
  treino: Treino;
  exercicios: Exercicio[];
  exerciciosFeitos: Exercicio[];
  horarioInicio: any; // Idealmente, um tipo mais específico como Date ou Timestamp
  horarioFim?: any;
  lastInterval?: number | null; // Adicione esta linha
  cargaAcumulada?: number;
  fichaId?: string; // add this
}
