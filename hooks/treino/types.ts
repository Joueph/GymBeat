import { Treino } from '../../models/treino';

export const DIAS_SEMANA_ORDEM: { [key: string]: number } = {
    'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6
};

export interface Folder {
    id: string;
    type: 'ficha' | 'unassigned';
    nome: string;
    treinos: Treino[];
    fichaId?: string;
}

export interface DisplayItem {
    type: 'folder' | 'workout' | 'add_unassigned_workout_button';
    id: string;
    data: Folder | Treino | null;
    isExpanded?: boolean;
    isPrincipal?: boolean;
}
