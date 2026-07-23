import * as Notifications from 'expo-notifications';

/**
 * Lembretes locais (agendados no próprio device via expo-notifications).
 * Não dependem de servidor. Só disparam num build que tenha o expo-notifications
 * nativo (a partir do próximo `eas build`).
 */
export async function scheduleReminder(when: Date, title: string, body: string): Promise<boolean> {
  try {
    if (when.getTime() <= Date.now()) return false;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return false;
    } else if (!perm.granted) {
      return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
    return true;
  } catch {
    return false;
  }
}

export async function countScheduledReminders(): Promise<number> {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* ignora */
  }
}
