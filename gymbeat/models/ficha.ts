import { Treino } from './treino';

export interface Ficha {
  id: string;
  nome: string;
  treinos: Treino[];
  dataCriacao: Date;
  usuarioId: string;
}