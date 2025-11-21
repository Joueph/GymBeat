import { requireNativeModule } from 'expo-modules-core';

// Importa o módulo nativo. O nome deve corresponder ao que foi definido em `NotificationsLiveActivityModule.swift`.
const NotificationsLiveActivityModule = requireNativeModule('NotificationsLiveActivity');

/**
 * Inicia uma Live Activity com os dados do treino.
 * @returns O ID da atividade iniciada, ou null se não puder ser iniciada.
 */
export async function startActivity(exerciseName: string, currentSet: number, stateLabel: string): Promise<string | null> {
return await NotificationsLiveActivityModule.startActivity(
    exerciseName, 
    stateLabel,   // 2º argumento deve ser String
    currentSet    // 3º argumento deve ser Int
  );}

/**
 * Finaliza uma Live Activity específica.
 * @param activityId O ID da atividade a ser finalizada.
 */
export async function endActivity(activityId: string): Promise<void> {
  await NotificationsLiveActivityModule.endActivity(activityId);
}