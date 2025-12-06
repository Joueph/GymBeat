import { requireNativeModule } from 'expo-modules-core';

// Importa o módulo nativo. O nome deve corresponder ao que foi definido em `NotificationsLiveActivityModule.swift`.
const NotificationsLiveActivityModule = requireNativeModule('NotificationsLiveActivity');

/**
 * Inicia uma Live Activity com os dados do treino.
 * @param timestamp O timestamp de quando o timer (descanso) deve terminar. Se for 0 ou nulo, indica modo de exercício sem timer.
 * @param exerciseName O nome do exercício atual.
 * @param currentSet A série atual.
 * @param totalSets O total de séries para o exercício.
 * @param weight O peso utilizado na série.
 * @param reps As repetições da série.
 * @param dropsetCount A contagem de dropsets.
 * @returns O ID da atividade iniciada, ou null se não puder ser iniciada.
 */
export async function startActivity(
  timestamp: number | null,
  exerciseName: string,
  currentSet: number,
  totalSets: number,
  weight: string,
  reps: string,
  dropsetCount: number
): Promise<string | null> {
  return await NotificationsLiveActivityModule.startActivity(
    timestamp, exerciseName, currentSet, totalSets, weight, reps, dropsetCount
  );
}

/**
 * Finaliza uma Live Activity específica.
 * @param activityId O ID da atividade a ser finalizada.
 */
export async function endActivity(activityId: string): Promise<void> {
  await NotificationsLiveActivityModule.endActivity(activityId);
}