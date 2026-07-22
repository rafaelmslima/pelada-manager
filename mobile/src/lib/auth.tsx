import { useRouter, useSegments } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api } from './api';
import { setApiBaseUrlOverride } from './config';
import { registerForPushNotifications, unregisterCurrentDevice } from './push';
import { clearToken, getApiUrl, getToken, saveToken } from './storage';
import type { AuthMe } from './types';

type AuthContextValue = {
  session: AuthMe | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { name: string; email: string; password: string; pelada_name: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  applyAuth: (me: AuthMe) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}

/**
 * Redireciona entre a área logada (tabs) e a tela de login conforme a sessão.
 */
function useProtectedRoute(session: AuthMe | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      // Aplica a URL da API salva no app (override) antes de qualquer chamada.
      const savedUrl = await getApiUrl();
      if (savedUrl) setApiBaseUrlOverride(savedUrl);

      // Sem token salvo => vai direto pro login. Evita chamar api.me() e ficar
      // pendurado num servidor inalcançável (ex.: URL padrão num device físico).
      const token = await getToken();
      if (!token) {
        setSession(null);
        return;
      }

      const me = await api.me();
      setSession(me);
    } catch {
      // 401 ou erro de rede => deslogado; o usuário loga (e ajusta o servidor) na tela de login.
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Quando há sessão, registra o device para push (best-effort, não bloqueia).
  useEffect(() => {
    if (session) {
      registerForPushNotifications();
    }
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const me = await api.login(email, password);
    if (me.token) await saveToken(me.token);
    setSession(me);
  }, []);

  const signUp = useCallback(
    async (payload: { name: string; email: string; password: string; pelada_name: string | null }) => {
      const me = await api.register(payload);
      if (me.token) await saveToken(me.token);
      setSession(me);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await unregisterCurrentDevice();
    try {
      await api.logout();
    } catch {
      // ignora falha de rede no logout — limpamos o token localmente de qualquer forma.
    }
    await clearToken();
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api.me();
    setSession(me);
  }, []);

  const applyAuth = useCallback((me: AuthMe) => {
    // Mantém o token atual; endpoints de troca de pelada não reenviam token.
    setSession((prev) => ({ ...me, token: prev?.token ?? me.token }));
  }, []);

  useProtectedRoute(session, loading);

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut, refresh, applyAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
