export interface ExercicioModelo {
  id: string;
  nome: string;
  imagemUrl: string;
  grupoMuscular: string;
  tipo: string;
}

export interface Exercicio {
  modelo: ExercicioModelo;
  modeloId: string;
  series: number;
  repeticoes: string;
  peso?: number;
  // Outros campos como tempo de descanso, anotações, etc. podem ser adicionados aqui
}