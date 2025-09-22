import { Exercicio } from './exercicio';
import { DiaSemana } from './treino';

export interface TreinoModelo {
  id: string;
  nome: string;
  diasSemana: DiaSemana[];
  intervalo: {
    min: number;
    seg: number;
  };
  exercicios: Exercicio[];
}