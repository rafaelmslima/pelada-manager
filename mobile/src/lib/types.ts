// Tipos de domínio — espelham o backend FastAPI (mesmos nomes de campos).
// Mantidos em sincronia com frontend/src/types.ts (web).

export type Position = 'defesa' | 'meio' | 'ataque';
export type BillingType = 'mensalista' | 'diarista';
export type PresenceStatus = 'pending' | 'confirmed' | 'declined';

export type User = {
  id: number;
  email: string;
  created_at: string;
};

export type Pelada = {
  id: number;
  name: string;
  location: string;
  match_time: string;
  default_billing_type: BillingType;
  daily_fee: number;
  created_at: string;
};

export type FinanceEntry = {
  id: number;
  kind: 'income' | 'expense';
  amount: number;
  description: string;
  player_id: number | null;
  player_name: string | null;
  created_at: string;
};

export type MensalistaStatus = {
  player_id: number;
  name: string;
  has_paid: boolean;
};

export type FinanceOverview = {
  daily_fee: number;
  total_income: number;
  total_expense: number;
  balance: number;
  mensalistas: MensalistaStatus[];
  entries: FinanceEntry[];
};

export type AuthMe = {
  user: User;
  pelada: Pelada;
  server_time: string;
  // Preenchido apenas no login/register (Bearer token para o mobile).
  token?: string | null;
};

export type PeladaMembership = {
  id: number;
  name: string;
  location: string;
  match_time: string;
  role: string;
  is_active: boolean;
};

export type Player = {
  id: number;
  name: string;
  position: Position;
  rating: number;
  billing_type: BillingType;
  has_paid: boolean;
  whatsapp: string;
  is_active: boolean;
  presence: PresenceStatus;
  created_at: string;
};

export type ConfirmationLink = {
  token: string;
  path: string;
};

export type MatchRating = {
  player_id: number;
  score: number;
};

export type PlayerPayload = {
  name: string;
  position: Position;
  rating: number;
  billing_type: BillingType;
  has_paid: boolean;
  whatsapp: string;
  is_active: boolean;
};

export type TeamPlayer = {
  id: number;
  name: string;
  position: Position;
  rating: number;
};

export type TeamResult = {
  name: string;
  total_rating: number;
  average_rating: number;
  player_count: number;
  capacity: number;
  is_incomplete: boolean;
  players: TeamPlayer[];
};

export type TeamGenerateResponse = {
  players_per_team: number;
  selected_count: number;
  team_count: number;
  teams: TeamResult[];
  reserves: TeamPlayer[];
};

export type MatchListItem = {
  id: number;
  date: string;
  title: string;
  created_at: string;
  team_count: number;
  player_count: number;
};

export type MatchPlayer = {
  id: number;
  match_id: number;
  team_id: number;
  player_id: number;
  goals: number;
  assists: number;
  was_in_team_of_the_week: boolean;
  player: TeamPlayer;
};

export type MatchTeam = {
  id: number;
  match_id: number;
  name: string;
  total_rating: number;
  is_team_of_the_week: boolean;
  players: MatchPlayer[];
};

export type MatchRead = {
  id: number;
  date: string;
  title: string;
  created_at: string;
  teams: MatchTeam[];
};

export type RankingPlayer = {
  player_id: number;
  name: string;
  position: Position;
  rating: number;
  matches_played: number;
  goals: number;
  assists: number;
  goals_per_match: number;
  assists_per_match: number;
};

export type RankingsSummary = {
  scorers: { ranking_type: 'scorers'; players: RankingPlayer[] };
  assists: { ranking_type: 'assists'; players: RankingPlayer[] };
};

export type PlayerProfile = {
  player: Player;
  total_matches: number;
  total_goals: number;
  total_assists: number;
  average_goals: number;
  average_assists: number;
  team_of_the_week_count: number;
  history: Array<{
    match_id: number;
    date: string;
    title: string;
    team_name: string;
    goals: number;
    assists: number;
    was_in_team_of_the_week: boolean;
  }>;
};
