import { Treino } from './treino';

export interface Ficha {
  id: string;
  nome: string;
  dataExpiracao: Date;
  treinos: string[]; // Alterado para ser uma lista de IDs de treinos
  dataCriacao: Date;
  usuarioId: string;
  opcoes: 'Programa de treinamento' | 'Criada por usuário' | 'Criada por personal';
  ativa: boolean; // <-- ADICIONE ESTA LINHA
  imagemUrl?: string; // URL da imagem associada à ficha
}