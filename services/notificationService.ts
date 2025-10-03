import * as Notifications from 'expo-notifications';

/**
 * Agenda uma notificação local diária.
 * @param identifier Um ID único para a notificação (para poder cancelá-la depois).
 * @param title O título da notificação.
 * @param body O corpo da notificação.
 * @param trigger O horário para disparar a notificação (ex: { hour: 9, minute: 0 }).
 */
export const scheduleNotification = async (
  identifier: string,
  title: string,
  body: string,
  trigger: { hour: number; minute: number }
) => {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: 'default', // Toca o som padrão
    },
    trigger: {
      hour: trigger.hour,
      minute: trigger.minute,
      repeats: true, // Explicitly set to repeat daily
      channelId: 'default', // Explicitly set the channel
    },
  });
};

/**
 * Cancela uma notificação agendada pelo seu identificador.
 * @param identifier O ID da notificação a ser cancelada.
 */
export const cancelNotification = async (identifier: string) => {
  await Notifications.cancelScheduledNotificationAsync(identifier);
};