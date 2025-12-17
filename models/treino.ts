import { Exercicio } from './exercicio';

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

export interface Treino {
  descricao: string;
  ordem: number;
  id: string;
  usuarioId: string;
  nome: string;
  diasSemana: DiaSemana[];
  intervalo: {
    min: number;
    seg: number;
  };
  exercicios: Exercicio[];
  fichaId?: string | null; // Adicionado para rastrear a qual ficha o treino pertence
}