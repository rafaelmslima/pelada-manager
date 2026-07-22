import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'pelada_session_token';
const API_URL_KEY = 'pelada_api_base_url';

// Armazenamento seguro do device (Keychain/Keystore) no mobile; localStorage na web.
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// --- Token de sessão ---
export const saveToken = (token: string) => setItem(TOKEN_KEY, token);
export const getToken = () => getItem(TOKEN_KEY);
export const clearToken = () => removeItem(TOKEN_KEY);

// --- URL da API (override in-app) ---
export const saveApiUrl = (url: string) => setItem(API_URL_KEY, url);
export const getApiUrl = () => getItem(API_URL_KEY);
export const clearApiUrl = () => removeItem(API_URL_KEY);
