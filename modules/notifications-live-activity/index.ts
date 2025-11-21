import { requireNativeModule } from 'expo-modules-core';

// Importa o módulo nativo. O nome deve corresponder ao que foi definido em `NotificationsLiveActivityModule.swift`.
const NotificationsLiveActivityModule = requireNativeModule('NotificationsLiveActivity');

/**
 * Inicia uma Live Activity com os dados do treino.
 * @returns O ID da atividade iniciada, ou null se não puder ser iniciada.
 */
export async function startActivity(deadline: number, exerciseName: string, statelabel: string, currentSet: number, totalSets: number): Promise<string | null> {
return await NotificationsLiveActivityModule.startActivity(
    deadline,
    exerciseName, 
    statelabel,
    currentSet,
    totalSets
  );}

/**
 * Finaliza uma Live Activity específica.
 * @param activityId O ID da atividade a ser finalizada.
 */
export async function endActivity(activityId: string): Promise<void> {
  await NotificationsLiveActivityModule.endActivity(activityId);
}