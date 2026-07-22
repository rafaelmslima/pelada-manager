import { Platform } from 'react-native';

/**
 * URL base da API (backend FastAPI).
 *
 * Precedência: override salvo no app (tela de login/config) > `EXPO_PUBLIC_API_URL`
 * (embutida no bundle pelo Expo) > localhost do host em desenvolvimento.
 *
 * O override in-app permite testar contra o backend do Railway sem rebuild/env:
 * basta colar a URL na tela de login (seção "Servidor") ou em Configurações.
 */
function devDefaultBaseUrl(): string {
  // Emulador Android acessa o host da máquina via 10.0.2.2; iOS/web via localhost.
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
}

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export const DEFAULT_API_BASE_URL = normalize(process.env.EXPO_PUBLIC_API_URL?.trim() || devDefaultBaseUrl());

let overrideBaseUrl: string | null = null;

export function setApiBaseUrlOverride(url: string | null): void {
  overrideBaseUrl = url && url.trim() ? normalize(url) : null;
}

export function getApiBaseUrlOverride(): string | null {
  return overrideBaseUrl;
}

export function getApiBaseUrl(): string {
  return overrideBaseUrl || DEFAULT_API_BASE_URL;
}
