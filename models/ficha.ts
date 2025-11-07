export interface Ficha {
  id: string;
  usuarioId: string;
  nome: string;
  treinos: string[]; // Array of Treino IDs
  dataExpiracao: Date;
  opcoes: string;
  ativa: boolean;
  imagemUrl?: string;
  dataCriacao?: Date;
}