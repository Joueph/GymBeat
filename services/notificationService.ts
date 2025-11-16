import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Verifica e solicita permissões de notificação se necessário.
 */
export const requestNotificationPermissionsIfNeeded = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus !== 'granted') {
      console.log('[Notification] Permissões não concedidas, solicitando...');
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('[Notification] Permissões de notificação foram negadas pelo usuário');
        return false;
      }
    }
    
    console.log('[Notification] Permissões de notificação ativas');
    return true;
  } catch (error) {
    console.error('[Notification] Erro ao verificar/solicitar permissões:', error);
    return false;
  }
};

/**
 * Agenda uma notificação local.
 * @param identifier Um ID único para a notificação (para poder cancelá-la depois).
 * @param title O título da notificação.
 * @param body O corpo da notificação.
 * @param trigger O gatilho para a notificação. Pode ser um horário diário ou um intervalo em segundos.
 */
export const scheduleNotification = async (
  identifier: string,
  title: string,
  body: string,
  trigger: { seconds: number; repeats?: false } | { hour: number; minute: number; repeats: true }
) => {
  try {
    // Verifica permissões antes de agendar
    const hasPermission = await requestNotificationPermissionsIfNeeded();
    if (!hasPermission) {
      console.warn('[Notification] Não é possível agendar notificação sem permissões');
      return;
    }

    const notificationTrigger: Notifications.NotificationTriggerInput = 'seconds' in trigger
      ? { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: trigger.seconds, repeats: trigger.repeats }
      : { type: SchedulableTriggerInputTypes.DAILY, hour: trigger.hour, minute: trigger.minute };

    console.log(`[Notification] Agendando notificação com trigger:`, {
      identifier,
      title,
      body,
      trigger: notificationTrigger,
    });

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        sound: 'default',
        // Garante que a notificação seja "Time-Sensitive" no iOS para timers
        ...(Platform.OS === 'ios' && {
          interruptionLevel: 'seconds' in trigger ? 'timeSensitive' : 'active',
        }),
      },
      trigger: notificationTrigger,
    });
    
    console.log(`[Notification] ✓ Notificação agendada com sucesso: ${identifier}`);
  } catch (error) {
    console.error(`[Notification] ✗ Erro ao agendar notificação ${identifier}:`, error);
    throw error;
  }
};

/**
 * Cancela uma notificação agendada pelo seu identificador.
 * @param identifier O ID da notificação a ser cancelada.
 */
export const cancelNotification = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`[Notification] ✓ Notificação cancelada: ${identifier}`);
  } catch (error) {
    console.error(`[Notification] Erro ao cancelar notificação ${identifier}:`, error);
  }
};