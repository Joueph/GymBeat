import { Exercicio, Serie } from '@/models/exercicio';

export interface SerieEdit extends Serie {
    id: string;
    type: 'normal' | 'dropset';
    concluido: boolean;
    isWarmup?: boolean;
}

export interface LoggedExercise extends Exercicio {
    notes: string;
    restTime: number;
    machineName?: string; // For display
}
