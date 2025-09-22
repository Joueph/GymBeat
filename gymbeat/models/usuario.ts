import { Ficha } from './ficha';

export type UserRole = 'usuario' | 'administrador' | 'personal';

export interface Usuario {
  id: string;
  nome: string;
  dataNascimento?: Date;
  altura?: number; // em cm
  peso?: number;   // em kg
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  nivel?: 'Iniciante' | 'Intermediário' | 'Avançado';
  fichas?: Ficha[];
  amizades?: string[]; // Lista de IDs de outros usuários
  photoURL?: string;
  lastTrained?: Date; // Timestamp do último treino
  isPro?: boolean; // Indica se o usuário é PRO
  hasTrainedToday?: boolean;
  streakGoal?: number; // Meta de treinos por semana para a sequência (streak)
}