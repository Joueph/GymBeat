import { Ficha } from './ficha';

export type UserRole = 'usuario' | 'administrador' | 'personal';

export interface Usuario {
  uid(uid: any): unknown;
  settings: any;
  id: string;
  email: string;
  nome: string;
  nome_lowercase?: string;
  dataNascimento?: Date;
  altura?: number; // em cm
  historicoPeso?: { valor: number; data: Date }[]; // Histórico de pesos
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  nivel?: 'Iniciante' | 'Intermediário' | 'Avançado';
  fichas?: Ficha[];
// --- ADICIONE ESTES CAMPOS ---
  objetivoPrincipal?: string | null;
  localTreino?: string | null;
  possuiEquipamentosCasa?: boolean | null;
  problemasParaTreinar?: string[];
  amizades?: { [key: string]: boolean };
  solicitacoesRecebidas?: string[]; // Mantido para uma transição segura, mas a nova lógica usa o mapa 'amizades'.
  projetos?: string[]; // IDs dos projetos que o usuário participa
  photoURL?: string;
  lastTrained?: Date; // Timestamp do último treino
  isPro?: boolean; // Indica se o usuário é PRO
  hasTrainedToday?: boolean;
  streakGoal?: number; // Meta de treinos por semana para a sequência (streak)
  weeksStreakGoal?: number; // Meta de semanas seguidas de treino
  workoutScreenType?: 'simplified' | 'complete'; // New field for workout screen type
}
