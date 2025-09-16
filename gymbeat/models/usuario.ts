import { Ficha } from './ficha';

export type UserRole = 'usuario' | 'administrador' | 'personal';

export interface Usuario {
  id: string;
  nome: string;
  dataNascimento: Date;
  altura: number; // em cm
  peso: number;   // em kg
  fichas: Ficha[];
  amizades: string[]; // Lista de IDs de outros usuários
  photoURL?: string;
  lastTrained?: Date; // Timestamp do último treino
}