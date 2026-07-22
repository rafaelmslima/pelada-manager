import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

// Como as notificações aparecem com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let currentToken: string | null = null;

function getProjectId(): string | undefined {
  // projectId fica em app.json -> expo.extra.eas.projectId (embutido no build).
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

/**
 * Pede permissão, obtém o Expo push token do device e registra no backend.
 * Totalmente defensivo: em emulador, sem permissão, ou sem o módulo nativo
 * (dev build antigo sem expo-notifications), apenas retorna null sem quebrar.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // emulador/simulador não recebe push real

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Pelada',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const projectId = getProjectId();
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = token;
    try {
      await api.registerDevice(token, Platform.OS);
    } catch {
      // registro no backend falhou (offline) — sem problema, tenta de novo no próximo login.
    }
    return token;
  } catch {
    return null;
  }
}

/** Remove o token deste device no backend (usado no logout). */
export async function unregisterCurrentDevice(): Promise<void> {
  if (!currentToken) return;
  try {
    await api.unregisterDevice(currentToken);
  } catch {
    // ignora
  }
  currentToken = null;
}
