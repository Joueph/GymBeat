import { Log } from './log';

export interface MetaProjeto {
  tipo: 'diasPorSemana' | 'semanasCompletas';
  valor: number; // Ex: 5 (dias) ou 4 (semanas)
  condicao?: number; // Ex: 3 (vezes por semana para a meta de 'semanasCompletas')
}

export interface FotoGaleria {
  url: string;
  usuarioId: string;
  data: Date;
}

export interface Projeto {
  id: string;
  criadorId: string;
  titulo: string;
  descricao: string;
  fotoCapa?: string;
  participantes: string[]; // Array de IDs de usuários
  dataCriacao: Date;
  meta: MetaProjeto;
  semanasSeguidas: number;
  galeriaFotos?: FotoGaleria[];
  logsTreinos?: Log[];
}