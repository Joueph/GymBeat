export interface ExercicioModelo {
  id: string;
  nome: string;
  imagemUrl: string;
  grupoMuscular: string;
  tipo: string;

  // NOVO CAMPO ADICIONADO AQUI
  /**
   * Características especiais do exercício para cálculo de carga.
   */
  caracteristicas?: {
    /** Ex: Flexão, Barra Fixa. O peso do usuário é usado no cálculo. */
    isPesoCorporal?: boolean;
    /** Ex: Supino com Halteres, Rosca com Halteres. O peso é por mão (deve ser multiplicado por 2). */
    isPesoBilateral?: boolean;
    /** Ex: Supino Reto, Agachamento. O peso da barra (ex: 20kg) pode ser somado. */
    usaBarra?: boolean;
    // Você pode adicionar outros flags aqui no futuro
    // ex: isUnilateral?: boolean;
  };
}

export interface Serie {
  isWarmup?: boolean;
  concluido: boolean;
  id: string;
  repeticoes: string;
  peso?: number;
  type?: 'normal' | 'dropset';
  isTimeBased?: boolean; // Adicionado para diferenciar séries por tempo
}

export interface Exercicio {
  restTime: number;
  notes: string;
  modelo: ExercicioModelo;
  modeloId: string;
  series: Serie[];
  isBiSet?: boolean;
  pesoBarra?: number;
  // Outros campos como tempo de descanso, anotações, etc. podem ser adicionados aqui
}