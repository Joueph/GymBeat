import { Ficha } from './ficha';

export type UserRole = 'usuario' | 'administrador' | 'personal';

export interface Usuario {
  settings: any;
  id: string;
  email: string;
  nome: string;
  nome_lowercase?: string;
  dataNascimento?: Date;
  altura?: number; // em cm
  peso?: number;   // em kg
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  nivel?: 'Iniciante' | 'Intermediário' | 'Avançado';
  fichas?: Ficha[];
  amizades?: string[]; // Lista de IDs de outros usuários
  solicitacoesRecebidas?: string[]; // IDs de usuários que enviaram pedido
  photoURL?: string;
  lastTrained?: Date; // Timestamp do último treino
  isPro?: boolean; // Indica se o usuário é PRO
  hasTrainedToday?: boolean;
  streakGoal?: number; // Meta de treinos por semana para a sequência (streak)
  weeksStreakGoal?: number; // Meta de semanas seguidas de treino
}