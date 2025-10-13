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
  /**
   * ALTERADO: 'amizades' agora é um mapa (objeto) de IDs de usuário para um valor booleano.
   * - true: Amizade confirmada por ambos.
   * - false: Pedido de amizade recebido e pendente de aceitação.
   * Se um usuário A envia um pedido para B:
   * - No documento de A: amizades: { [B.id]: true }
   * - No documento de B: amizades: { [A.id]: false }
   */
  amizades?: { [key: string]: boolean };
  solicitacoesRecebidas?: string[]; // Mantido para uma transição segura, mas a nova lógica usa o mapa 'amizades'.
  projetos?: string[]; // IDs dos projetos que o usuário participa
  photoURL?: string;
  lastTrained?: Date; // Timestamp do último treino
  isPro?: boolean; // Indica se o usuário é PRO
  hasTrainedToday?: boolean;
  streakGoal?: number; // Meta de treinos por semana para a sequência (streak)
  weeksStreakGoal?: number; // Meta de semanas seguidas de treino
}
