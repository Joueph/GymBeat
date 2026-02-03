import { Serie } from "@/models/exercicio";

export interface SerieEdit extends Serie {
    id: string;
    type: 'normal' | 'dropset';
    isWarmup?: boolean;
}

export const formatRestTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0 && remainingSeconds > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return minutes > 0 ? `${minutes} min` : `${remainingSeconds} seg`;
};

export const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const calculateDuration = (start: any, end: any): string => {
    if (!start || !end) return '-';
    const startDate = start.toDate ? start.toDate() : new Date(start);
    const endDate = end.toDate ? end.toDate() : new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins} min`;
};

export const cascadeUpdate = (series: SerieEdit[], index: number, field: keyof SerieEdit, oldValue: any): SerieEdit[] => {
    const newSeries = [...series];
    const newValue = newSeries[index][field];

    for (let i = index + 1; i < newSeries.length; i++) {
        // Look for values that match the *old* value of the changed set
        // Using loose equality (==) for safety with number/string mix, though typed strict is better
        if (newSeries[i][field] == oldValue) {
            newSeries[i] = { ...newSeries[i], [field]: newValue };
        } else {
            break;
        }
    }
    return newSeries;
};
