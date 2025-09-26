export interface FichaModelo {
  id: string;
  nome: string;
  dificuldade: string;
  sexo: 'Homem' | 'Mulher' | 'Ambos';
  tempo_ficha: string; // e.g., "2" months
  tipo: string;
  treinos: string[]; // Array of TreinoModelo IDs
  imagemUrl?: string;
}