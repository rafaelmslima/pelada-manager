import { useRouter, useSegments } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { api, ApiError } from './api';
import { setApiBaseUrlOverride } from './config';
import { clearToken, getApiUrl, saveToken } from './storage';
import type { AuthMe } from './types';

type AuthContextValue = {
  session: AuthMe | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { name: string; email: string; password: string; pelada_name: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
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

      const me = await api.me();
      setSession(me);
    } catch (error) {
      // 401 => sem sessão válida; qualquer outro erro também cai como deslogado.
      if (!(error instanceof ApiError)) {
        // erro de rede: mantém deslogado, o usuário pode tentar logar de novo.
      }
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

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

  useProtectedRoute(session, loading);

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
