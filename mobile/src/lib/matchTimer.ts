import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Alarme de fim de tempo do confronto. Agenda uma notificação local que dispara
 * com som + vibração mesmo com a tela apagada / app em segundo plano.
 * Requer o expo-notifications nativo (build a partir da Fase 2).
 */

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android' && !channelReady) {
    await Notifications.setNotificationChannelAsync('match-timer', {
      name: 'Cronômetro da partida',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 500, 300, 500],
      enableVibrate: true,
    });
    channelReady = true;
  }
}

export async function scheduleTimerAlarm(
  secondsFromNow: number,
  title: string,
  body: string,
): Promise<string | null> {
  try {
    if (secondsFromNow <= 0) return null;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) return null;
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return null;
    }
    await ensureChannel();
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        channelId: 'match-timer',
      },
    });
  } catch {
    return null;
  }
}

export async function cancelTimerAlarm(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignora */
  }
}
