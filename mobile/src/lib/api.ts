import { getApiBaseUrl } from './config';
import { getToken } from './storage';
import type {
  AuthMe,
  BillingStatus,
  ConfirmationLink,
  FinanceOverview,
  MatchListItem,
  MatchRating,
  MatchRead,
  Pelada,
  RoundCreatePayload,
  RoundsOverview,
  PeladaMembership,
  Player,
  PlayerPayload,
  PlayerProfile,
  RankingsSummary,
  TeamGenerateResponse,
} from './types';

type RequestOptions = RequestInit & { json?: unknown };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const init: RequestInit = { ...options, headers };

  // Auth por token (mobile): o backend também aceita cookie (web), mas aqui
  // enviamos sempre o Bearer quando houver token salvo no device.
  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.json);
  }

  // Timeout para não travar em servidor inalcançável (URL errada / offline).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique a URL e a conexão.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(' ')
      : data?.detail;
    throw new ApiError(detail || 'Não foi possível concluir a ação.', response.status);
  }

  return data as T;
}

export const api = {
  me: () => request<AuthMe>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<AuthMe>('/api/auth/login', { method: 'POST', json: { email, password } }),
  resetPassword: (payload: { email: string; new_password: string; admin_secret: string }) =>
    request<{ ok: boolean }>('/api/auth/admin-reset-password', { method: 'POST', json: payload }),
  register: (payload: { name: string; email: string; password: string; pelada_name: string | null }) =>
    request<AuthMe>('/api/auth/register', { method: 'POST', json: payload }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  updatePelada: (payload: Pick<Pelada, 'name' | 'location' | 'match_time' | 'default_billing_type'>) =>
    request<AuthMe>('/api/auth/pelada', { method: 'PUT', json: payload }),

  listPeladas: () => request<PeladaMembership[]>('/api/peladas'),
  createPelada: (payload: { name: string; location?: string; match_time?: string }) =>
    request<AuthMe>('/api/peladas', { method: 'POST', json: payload }),
  selectPelada: (id: number) => request<AuthMe>(`/api/peladas/${id}/select`, { method: 'POST' }),
  joinPelada: (invite_code: string) =>
    request<AuthMe>('/api/peladas/join', { method: 'POST', json: { invite_code } }),
  getInviteCode: () => request<{ invite_code: string }>('/api/peladas/invite-code'),

  billingStatus: () => request<BillingStatus>('/api/billing/status'),
  activatePremium: (code: string) =>
    request<AuthMe>('/api/billing/activate', { method: 'POST', json: { code } }),

  listPlayers: () => request<Player[]>('/api/players'),
  createPlayer: (payload: PlayerPayload) => request<Player>('/api/players', { method: 'POST', json: payload }),
  updatePlayer: (id: number, payload: PlayerPayload) =>
    request<Player>(`/api/players/${id}`, { method: 'PUT', json: payload }),
  deletePlayer: (id: number) => request<void>(`/api/players/${id}`, { method: 'DELETE' }),
  togglePlayer: (id: number) => request<Player>(`/api/players/${id}/toggle-active`, { method: 'PATCH' }),
  togglePlayerPaid: (id: number) => request<Player>(`/api/players/${id}/toggle-paid`, { method: 'PATCH' }),
  togglePlayerMonthly: (id: number) => request<Player>(`/api/players/${id}/toggle-monthly`, { method: 'PATCH' }),
  deactivateAllPlayers: () => request<Player[]>('/api/players/deactivate-all', { method: 'PATCH' }),
  playerProfile: (id: number) => request<PlayerProfile>(`/api/players/${id}/profile`),

  generateTeams: (players_per_team: number) =>
    request<TeamGenerateResponse>('/api/teams/generate', { method: 'POST', json: { players_per_team } }),

  listMatches: () => request<MatchListItem[]>('/api/matches'),
  getMatch: (id: number) => request<MatchRead>(`/api/matches/${id}`),
  createMatch: (payload: unknown) => request<MatchRead>('/api/matches', { method: 'POST', json: payload }),
  deleteMatch: (id: number) => request<void>(`/api/matches/${id}`, { method: 'DELETE' }),
  updateMatchStats: (id: number, payload: unknown) =>
    request<MatchRead>(`/api/matches/${id}/stats`, { method: 'PUT', json: payload }),
  matchEvent: (matchId: number, matchPlayerId: number, goals_delta: number, assists_delta: number) =>
    request<MatchRead>(`/api/matches/${matchId}/players/${matchPlayerId}/event`, {
      method: 'POST',
      json: { goals_delta, assists_delta },
    }),
  getRounds: (matchId: number) => request<RoundsOverview>(`/api/matches/${matchId}/rounds`),
  createRound: (matchId: number, payload: RoundCreatePayload) =>
    request<RoundsOverview>(`/api/matches/${matchId}/rounds`, { method: 'POST', json: payload }),
  getMatchRatings: (matchId: number) => request<MatchRating[]>(`/api/matches/${matchId}/ratings`),
  saveMatchRatings: (matchId: number, ratings: MatchRating[]) =>
    request<MatchRead>(`/api/matches/${matchId}/ratings`, { method: 'POST', json: { ratings } }),

  rankings: () => request<RankingsSummary>('/api/rankings/summary'),

  confirmationLink: () => request<ConfirmationLink>('/api/peladas/confirmation-link', { method: 'POST' }),
  rotateConfirmationLink: () =>
    request<ConfirmationLink>('/api/peladas/confirmation-link/rotate', { method: 'POST' }),

  registerDevice: (token: string, platform: string) =>
    request<{ ok: boolean }>('/api/devices', { method: 'POST', json: { token, platform } }),
  unregisterDevice: (token: string) =>
    request<{ ok: boolean }>('/api/devices', { method: 'DELETE', json: { token } }),

  getFinance: () => request<FinanceOverview>('/api/finance'),
  setFinanceSettings: (settings: { daily_fee: number; monthly_fee: number; monthly_due_day: number }) =>
    request<FinanceOverview>('/api/finance/settings', { method: 'PUT', json: settings }),
  addFinanceEntry: (entry: {
    kind: 'income' | 'expense';
    amount: number;
    description: string;
    player_id?: number | null;
  }) => request<FinanceOverview>('/api/finance', { method: 'POST', json: entry }),
  collectDaily: () => request<FinanceOverview>('/api/finance/collect-daily', { method: 'POST' }),
  deleteFinanceEntry: (id: number) => request<FinanceOverview>(`/api/finance/${id}`, { method: 'DELETE' }),
};
