// app\utils\volumeUtils.ts

import { Exercicio, Serie } from "@/models/exercicio";

interface SerieComStatus extends Serie {
    concluido?: boolean;
}

/**
 * Calcula a carga de uma única série, considerando todas as regras de negócio.
 * @param serie A série a ser calculada.
 * @param exercicio O exercício ao qual a série pertence.
 * @param userWeight O peso do usuário (necessário para exercícios de peso corporal).
 * @returns Um objeto contendo a carga total (`totalLoad`) e uma string descritiva do cálculo (`calculationString`).
 */
export const calculateLoadForSerie = (serie: Serie, exercicio: Exercicio, userWeight: number) => {
    if (!serie || !exercicio) {
        return { totalLoad: 0, calculationString: "Dados inválidos" };
    }

    const repsString = String(serie.repeticoes || '0');
    // Se for por tempo, conta como 1 repetição para o cálculo de volume.
    const reps = serie.isTimeBased
        ? 1
        : (repsString.match(/\d+/) ? parseInt(repsString.match(/\d+/)![0], 10) : 0);

    const pesoDaSerie = Number(serie.peso) || 0;
    let totalLoad = 0;
    let calculationString = '';

    if (reps > 0) {
        if (exercicio.modelo?.caracteristicas?.isPesoCorporal) {
            totalLoad = userWeight * reps;
            calculationString = `${userWeight}kg (PC) x ${reps} reps = ${Math.round(totalLoad)} kg`;
        } else {
            let pesoTotalDaRep = pesoDaSerie;
            let weightString = `${pesoDaSerie}kg`;

            if (exercicio.modelo?.caracteristicas?.isPesoBilateral) {
                pesoTotalDaRep *= 2;
                weightString = `(${pesoDaSerie}kg + ${pesoDaSerie}kg)`;
            }
            if (exercicio.modelo?.caracteristicas?.usaBarra) {
                const pesoBarra = Number(exercicio.pesoBarra) || 0;
                pesoTotalDaRep += pesoBarra;
                // Constrói a string de forma mais limpa
                const baseWeight = exercicio.modelo?.caracteristicas?.isPesoBilateral ? weightString.slice(1, -1) : `${pesoDaSerie}kg`;
                weightString = `(${baseWeight} + ${pesoBarra}kg Barra)`;
            }
            totalLoad = pesoTotalDaRep * reps;
            calculationString = `${weightString} x ${reps} reps = ${Math.round(totalLoad)} kg`;
        }
    } else {
        calculationString = "0 reps = 0 kg";
    }

    return { totalLoad, calculationString };
};

/**
 * Calcula o volume total para uma lista de exercícios.
 * @param exercicios A lista de exercícios.
 * @param userWeight O peso do usuário.
 * @param onlyCompleted Se deve considerar apenas as séries concluídas.
 * @returns O volume total de carga.
 */
export const calculateTotalVolume = (exercicios: Exercicio[], userWeight: number, onlyCompleted: boolean): number => {
    if (!exercicios || exercicios.length === 0) return 0;

    return exercicios.reduce((totalVolume, exercicio) => {
        if (!exercicio || !exercicio.series) return totalVolume;

        const seriesToCalculate = onlyCompleted
            ? (exercicio.series as SerieComStatus[]).filter(s => s?.concluido === true)
            : exercicio.series;

        const volumeDoExercicio = seriesToCalculate.reduce((totalSerie, serie) => totalSerie + calculateLoadForSerie(serie, exercicio, userWeight).totalLoad, 0);
        return totalVolume + volumeDoExercicio;
    }, 0);
};