import { Treino } from './treino';

export interface Ficha {
  id: string;
  nome: string;
  dataExpiracao: Date;
  treinos: Treino[];
  dataCriacao: Date;
  usuarioId: string;
  opcoes: 'Programa de treinamento' | 'Criada por usuário' | 'Criada por personal';
}