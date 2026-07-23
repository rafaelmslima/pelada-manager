import { Platform } from 'react-native';

/**
 * URL base da API (backend FastAPI).
 *
 * Precedência: override salvo no app (só dev/depuração) > `EXPO_PUBLIC_API_URL`
 * (embutida no build) > backend de produção (Railway) em builds release > localhost em dev.
 *
 * Em produção o app aponta sozinho para o Railway — o usuário não precisa configurar nada.
 */
const PRODUCTION_API_BASE_URL = 'https://pelapan.up.railway.app';

function devDefaultBaseUrl(): string {
  // Emulador Android acessa o host da máquina via 10.0.2.2; iOS/web via localhost.
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
}

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function defaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;
  // __DEV__ = rodando no Metro (dev). Build release aponta pro backend real.
  return __DEV__ ? devDefaultBaseUrl() : PRODUCTION_API_BASE_URL;
}

export const DEFAULT_API_BASE_URL = normalize(defaultBaseUrl());

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
