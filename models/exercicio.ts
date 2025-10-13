export interface ExercicioModelo {
  id: string;
  nome: string;
  imagemUrl: string;
  grupoMuscular: string;
  tipo: string;
}

export interface Serie {
  id: string;
  repeticoes: string;
  peso?: number;
  type?: 'normal' | 'dropset';
}

export interface Exercicio {
  modelo: ExercicioModelo;
  modeloId: string;
  series: Serie[];
  isBiSet?: boolean;
  // Outros campos como tempo de descanso, anotações, etc. podem ser adicionados aqui
}