export interface ExercicioModelo {
  id: string;
  nome: string;
  imagemUrl?: string; // GIF, Webp, ou Webm
  grupoMuscular: string;
  tipo: 'Academia' | 'Calistenia' | 'Em casa' | 'Crossfit';
}

export interface ExercicioNoTreino {
  modelo: ExercicioModelo;
  repeticoes: string; // Para suportar formatos como (10;8)(10;8)(10;8)
  pesos: string;      // Para suportar formatos como (10;8)(10;8)(10;8)
  series: number;
}