import React, { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleUserRound,
  Home,
  ListFilter,
  LogOut,
  Medal,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UsersRound,
  X
} from "lucide-react";
import { api, ApiError } from "./api";
import { formatBillingType, formatDate, formatPosition, formatRating, initials, whatsappLink } from "./format";
import type {
  AuthMe,
  BillingType,
  MatchListItem,
  MatchRead,
  Player,
  PlayerPayload,
  PlayerProfile,
  Position,
  RankingPlayer,
  RankingsSummary,
  TeamGenerateResponse,
  TeamResult
} from "./types";
import "./styles.css";

type View = "home" | "players" | "history" | "rankings" | "profile" | "share";
type PlayerFilter = "all" | "confirmed" | "pending";

const emptyPlayer: PlayerPayload = {
  name: "",
  position: "meio",
  rating: 3,
  billing_type: "diarista",
  has_paid: false,
  whatsapp: "",
  is_active: false
};

function pathToView(pathname: string): View {
  const segment = pathname.replace(/^\/+/, "").split("/")[0];
  if (segment === "jogadores") return "players";
  if (segment === "historico") return "history";
  if (segment === "rankings") return "rankings";
  if (segment === "perfil") return "profile";
  if (segment === "print") return "share";
  return "home";
}

function viewToPath(view: View) {
  return {
    home: "/",
    players: "/jogadores",
    history: "/historico",
    rankings: "/rankings",
    profile: "/perfil",
    share: "/print"
  }[view];
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthMe | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [rankings, setRankings] = useState<RankingsSummary | null>(null);
  const [teams, setTeams] = useState<TeamGenerateResponse | null>(null);
  const [shareMatch, setShareMatch] = useState<MatchRead | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchRead | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const view = pathToView(location.pathname);
  const setView = (nextView: View) => navigate(viewToPath(nextView));

  const flash = (text: string, error = false) => {
    setMessage({ text, error });
    window.setTimeout(() => setMessage(null), 4200);
  };

  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setSession(null);
      setView("home");
      return;
    }
    flash(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.", true);
  };

  const loadPlayers = async () => {
    try {
      setPlayers(await api.listPlayers());
    } catch (error) {
      handleError(error);
    }
  };

  const loadMatches = async () => {
    try {
      setMatches(await api.listMatches());
    } catch (error) {
      handleError(error);
    }
  };

  const loadRankings = async () => {
    try {
      setRankings(await api.rankings());
    } catch (error) {
      handleError(error);
    }
  };

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setSession(me);
        return api.listPlayers();
      })
      .then(setPlayers)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <AuthScreen
        onLogin={(me) => {
          setSession(me);
          loadPlayers();
        }}
        onMessage={flash}
      />
    );
  }

  const activePlayers = players.filter((player) => player.is_active);
  const revenue = activePlayers.filter((player) => player.billing_type === "diarista").length * 20;

  const logout = async () => {
    await api.logout().catch(() => null);
    setSession(null);
    setPlayers([]);
    setTeams(null);
    setView("home");
  };

  const generateTeams = async (playersPerTeam: number) => {
    try {
      const result = await api.generateTeams(playersPerTeam);
      setTeams(result);
      setView("home");
      flash("Times gerados com sucesso.");
    } catch (error) {
      setTeams(null);
      handleError(error);
    }
  };

  const saveMatch = async () => {
    if (!teams?.teams.length) {
      flash("Gere os times antes de salvar a pelada.", true);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    try {
      const match = await api.createMatch({
        date: today,
        title: `Pelada ${formatDate(today)}`,
        teams: teams.teams.map((team) => ({
          name: team.name,
          total_rating: team.total_rating,
          is_team_of_the_week: false,
          players: team.players.map((player) => ({ player_id: player.id, goals: 0, assists: 0 }))
        }))
      });
      setShareMatch(match);
      setView("share");
      loadMatches();
      flash("Pelada salva no historico.");
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="app-frame">
      <Sidebar session={session} view={view} setView={setView} onLogout={logout} />
      <main className="app-main">
        <Header session={session} active={activePlayers.length} total={players.length} revenue={revenue} teams={teams?.team_count || 0} />
        {message && <div className={`toast ${message.error ? "error" : ""}`}>{message.text}</div>}

        {view === "home" && (
          <HomeView
            session={session}
            players={players}
            teams={teams}
            onGenerate={generateTeams}
            onSave={saveMatch}
            onPlayers={() => setView("players")}
            onHistory={() => {
              setView("history");
              loadMatches();
            }}
          />
        )}
        {view === "players" && (
          <PlayersView
            players={players}
            defaultBilling={session.pelada.default_billing_type}
            onPlayersChange={setPlayers}
            onError={handleError}
            onMessage={flash}
            onProfile={async (id) => {
              try {
                setProfile(await api.playerProfile(id));
              } catch (error) {
                handleError(error);
              }
            }}
          />
        )}
        {view === "history" && (
          <HistoryView
            matches={matches}
            selectedMatch={selectedMatch}
            onReload={loadMatches}
            onOpen={async (id) => {
              try {
                setSelectedMatch(await api.getMatch(id));
              } catch (error) {
                handleError(error);
              }
            }}
            onShare={async (id) => {
              try {
                setShareMatch(await api.getMatch(id));
                setView("share");
              } catch (error) {
                handleError(error);
              }
            }}
            onDelete={async (id) => {
              if (!window.confirm("Excluir esta pelada do historico?")) return;
              try {
                await api.deleteMatch(id);
                setSelectedMatch(null);
                loadMatches();
                flash("Pelada excluida.");
              } catch (error) {
                handleError(error);
              }
            }}
            onStatsSaved={(match) => {
              setSelectedMatch(match);
              flash("Estatisticas salvas.");
            }}
            onError={handleError}
          />
        )}
        {view === "rankings" && <RankingsView rankings={rankings} onReload={loadRankings} />}
        {view === "profile" && (
          <ProfileView
            session={session}
            onSession={setSession}
            onMessage={flash}
            onError={handleError}
            onLogout={logout}
          />
        )}
        {view === "share" && <ShareView match={shareMatch} onBack={() => setView("history")} />}
      </main>
      <BottomNav view={view} setView={setView} preload={{ matches: loadMatches, rankings: loadRankings }} />
      {profile && <PlayerProfileModal profile={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src="/static/pelapan-logo.png" alt="Pelada Manager" />
      <strong>Carregando sua pelada...</strong>
    </div>
  );
}

function AuthScreen({ onLogin, onMessage }: { onLogin: (me: AuthMe) => void; onMessage: (text: string, error?: boolean) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      if (mode === "reset") {
        await api.resetPassword({
          email: String(form.get("email")),
          new_password: String(form.get("password")),
          admin_secret: String(form.get("admin_secret"))
        });
        event.currentTarget.reset();
        onMessage("Senha alterada. Entre com a nova senha.");
        return;
      }
      const me =
        mode === "login"
          ? await api.login(String(form.get("email")), String(form.get("password")))
          : await api.register({
              name: String(form.get("name")),
              email: String(form.get("email")),
              password: String(form.get("password")),
              pelada_name: String(form.get("pelada_name") || "") || null
            });
      onLogin(me);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Nao foi possivel entrar.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img src="/static/pelapan-logo.png" alt="" />
        <p className="eyebrow">Organize sua pelada</p>
        <h1>Pelada Manager</h1>
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Cadastro
          </button>
          <button className={mode === "reset" ? "active" : ""} onClick={() => setMode("reset")} type="button">
            Reset senha
          </button>
        </div>
        <form className="form-grid" onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>
                Nome
                <input name="name" required minLength={2} />
              </label>
              <label>
                Nome da pelada
                <input name="pelada_name" placeholder="Ex: Quinta Society" />
              </label>
            </>
          )}
          {mode === "reset" && (
            <label>
              Codigo administrativo
              <input name="admin_secret" type="password" autoComplete="off" required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            {mode === "reset" ? "Nova senha" : "Senha"}
            <input name="password" type="password" minLength={mode === "login" ? 1 : 6} required />
          </label>
          <button className="primary-action" disabled={busy}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Alterar senha"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ session, view, setView, onLogout }: { session: AuthMe; view: View; setView: (view: View) => void; onLogout: () => void }) {
  const items: Array<[View, React.ElementType, string]> = [
    ["home", Home, "Hoje"],
    ["players", UsersRound, "Jogadores"],
    ["history", CalendarDays, "Historico"],
    ["rankings", Trophy, "Ranking"],
    ["profile", CircleUserRound, "Perfil"]
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/static/pelapan-logo.png" alt="" />
        <div>
          <strong>Pelada Manager</strong>
          <span>{session.pelada.name}</span>
        </div>
      </div>
      <nav>
        {items.map(([key, Icon, label]) => (
          <button className={view === key ? "active" : ""} key={key} onClick={() => setView(key)} type="button">
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
      <button className="logout-button" onClick={onLogout} type="button">
        <LogOut size={18} />
        Sair
      </button>
    </aside>
  );
}

function BottomNav({ view, setView, preload }: { view: View; setView: (view: View) => void; preload: { matches: () => void; rankings: () => void } }) {
  const items: Array<[View, React.ElementType, string]> = [
    ["home", Home, "Inicio"],
    ["players", UsersRound, "Jogadores"],
    ["history", CalendarDays, "Historico"],
    ["rankings", Trophy, "Ranking"],
    ["profile", CircleUserRound, "Perfil"]
  ];
  return (
    <nav className="bottom-nav">
      {items.map(([key, Icon, label]) => (
        <button
          className={view === key ? "active" : ""}
          key={key}
          onClick={() => {
            setView(key);
            if (key === "history") preload.matches();
            if (key === "rankings") preload.rankings();
          }}
          type="button"
        >
          <Icon size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Header({ session, active, total, revenue, teams }: { session: AuthMe; active: number; total: number; revenue: number; teams: number }) {
  return (
    <header className="top-summary">
      <div className="summary-title">
        <img src="/static/pelapan-logo.png" alt="" />
        <div>
          <p className="eyebrow">Pelada de hoje</p>
          <h1>{session.pelada.name}</h1>
          <span>
            {session.pelada.location || "Local nao informado"} - {session.pelada.match_time || "20:00"}
          </span>
        </div>
      </div>
      <div className="metric-strip">
        <Metric icon={UsersRound} label="Confirmados" value={active} />
        <Metric icon={ShieldCheck} label="Jogadores" value={total} />
        <Metric icon={Sparkles} label="Times" value={teams} />
        <Metric icon={Banknote} label="Arrecadacao" value={`R$ ${revenue}`} />
      </div>
    </header>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <article className="metric">
      <Icon size={19} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function HomeView({
  session,
  players,
  teams,
  onGenerate,
  onSave,
  onPlayers,
  onHistory
}: {
  session: AuthMe;
  players: Player[];
  teams: TeamGenerateResponse | null;
  onGenerate: (playersPerTeam: number) => void;
  onSave: () => void;
  onPlayers: () => void;
  onHistory: () => void;
}) {
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const active = players.filter((player) => player.is_active);
  return (
    <div className="screen-grid">
      <section className="action-panel">
        <div>
          <p className="eyebrow">Proximo jogo</p>
          <h2>{active.length} confirmados</h2>
          <p>
            {formatBillingType(session.pelada.default_billing_type)} - {session.pelada.location || "Local em aberto"}
          </p>
        </div>
        <label className="compact-field">
          Jogadores por time
          <input min={1} max={30} type="number" value={playersPerTeam} onChange={(event) => setPlayersPerTeam(Number(event.target.value))} />
        </label>
        <button className="primary-action" onClick={() => onGenerate(playersPerTeam)} type="button">
          <Sparkles size={19} />
          Gerar times
        </button>
        {teams && (
          <button className="secondary-action" onClick={onSave} type="button">
            Salvar pelada
          </button>
        )}
        <div className="quick-actions">
          <button onClick={onPlayers} type="button">
            <UsersRound size={18} />
            Jogadores
          </button>
          <button onClick={onHistory} type="button">
            <CalendarDays size={18} />
            Historico
          </button>
        </div>
      </section>
      <section className="teams-area">
        {teams ? <TeamsResult teams={teams.teams} reserves={teams.reserves} /> : <EmptyState title="Times ainda nao gerados" text="Confirme os jogadores e gere times equilibrados para a rodada." />}
      </section>
    </div>
  );
}

function PlayersView({
  players,
  defaultBilling,
  onPlayersChange,
  onError,
  onMessage,
  onProfile
}: {
  players: Player[];
  defaultBilling: BillingType;
  onPlayersChange: React.Dispatch<React.SetStateAction<Player[]>>;
  onError: (error: unknown) => void;
  onMessage: (text: string, error?: boolean) => void;
  onProfile: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [editing, setEditing] = useState<Player | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPlayerIds, setPendingPlayerIds] = useState<Set<number>>(() => new Set());
  const [deactivatingAll, setDeactivatingAll] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const activeCount = useMemo(() => players.reduce((total, player) => total + Number(player.is_active), 0), [players]);
  const normalizedQuery = useMemo(() => deferredQuery.trim().toLowerCase(), [deferredQuery]);
  const filtered = useMemo(() => players.filter((player) => {
    const matchesFilter = filter === "all" || (filter === "confirmed" && player.is_active) || (filter === "pending" && !player.is_active);
    return matchesFilter && player.name.toLowerCase().includes(normalizedQuery);
  }), [filter, normalizedQuery, players]);

  const sortPlayers = (items: Player[]) => [...items].sort((first, second) => first.name.localeCompare(second.name));

  const setPlayerPending = useCallback((playerId: number, isPending: boolean) => {
    setPendingPlayerIds((current) => {
      const next = new Set(current);
      if (isPending) {
        next.add(playerId);
      } else {
        next.delete(playerId);
      }
      return next;
    });
  }, []);

  const togglePlayer = useCallback(
    async (player: Player) => {
      if (pendingPlayerIds.has(player.id) || deactivatingAll) return;
      const previousActive = player.is_active;
      setPlayerPending(player.id, true);
      onPlayersChange((current) =>
        current.map((item) => (item.id === player.id ? { ...item, is_active: !previousActive } : item))
      );
      try {
        const updatedPlayer = await api.togglePlayer(player.id);
        onPlayersChange((current) => current.map((item) => (item.id === updatedPlayer.id ? updatedPlayer : item)));
      } catch (error) {
        onPlayersChange((current) =>
          current.map((item) => (item.id === player.id ? { ...item, is_active: previousActive } : item))
        );
        onError(error);
      } finally {
        setPlayerPending(player.id, false);
      }
    },
    [deactivatingAll, onError, onPlayersChange, pendingPlayerIds, setPlayerPending]
  );

  const deactivateAllPlayers = useCallback(async () => {
    if (!activeCount || deactivatingAll) return;
    const activeIds = new Set(players.filter((player) => player.is_active).map((player) => player.id));
    setDeactivatingAll(true);
    onPlayersChange((current) => current.map((player) => (activeIds.has(player.id) ? { ...player, is_active: false } : player)));
    try {
      const updatedPlayers = await api.deactivateAllPlayers();
      onPlayersChange(updatedPlayers);
      onMessage("Todos os jogadores foram desmarcados.");
    } catch (error) {
      onPlayersChange((current) => current.map((player) => (activeIds.has(player.id) ? { ...player, is_active: true } : player)));
      onError(error);
    } finally {
      setDeactivatingAll(false);
    }
  }, [activeCount, deactivatingAll, onError, onMessage, onPlayersChange, players]);

  const savePlayer = async (payload: PlayerPayload) => {
    try {
      const savedPlayer = editing ? await api.updatePlayer(editing.id, payload) : await api.createPlayer(payload);
      onPlayersChange((current) =>
        editing
          ? current.map((player) => (player.id === savedPlayer.id ? savedPlayer : player))
          : sortPlayers([...current, savedPlayer])
      );
      if (editing) {
        setEditing(null);
      }
      setSheetOpen(false);
      onMessage(editing ? "Jogador atualizado." : "Jogador cadastrado.");
    } catch (error) {
      onError(error);
    }
  };

  return (
    <section className="view-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Elenco</p>
          <h2>Jogadores</h2>
        </div>
        <button className="primary-action compact" onClick={() => setSheetOpen(true)} type="button">
          <Plus size={18} />
          Novo
        </button>
      </div>
      <label className="search-field">
        <Search size={18} />
        <input placeholder="Buscar jogador..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="chip-row">
        {(["all", "confirmed", "pending"] as PlayerFilter[]).map((item) => (
          <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)} type="button">
            {item === "all" ? "Todos" : item === "confirmed" ? "Confirmados" : "Pendentes"}
          </button>
        ))}
        <button
          className="clear-selection"
          disabled={!activeCount || deactivatingAll}
          onClick={deactivateAllPlayers}
          type="button"
        >
          Desmarcar todos
        </button>
      </div>
      <div className="player-list">
        {filtered.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isPending={pendingPlayerIds.has(player.id) || deactivatingAll}
            onDelete={async () => {
              if (!window.confirm(`Excluir ${player.name}?`)) return;
              try {
                await api.deletePlayer(player.id);
                onPlayersChange((current) => current.filter((item) => item.id !== player.id));
                onMessage("Jogador excluido.");
              } catch (error) {
                onError(error);
              }
            }}
            onEdit={() => {
              setEditing(player);
              setSheetOpen(true);
            }}
            onProfile={onProfile}
            onToggle={() => togglePlayer(player)}
          />
        ))}
      </div>
      {!filtered.length && <EmptyState title="Nenhum jogador encontrado" text="Ajuste a busca ou cadastre um novo jogador." />}
      <button className="fab" onClick={() => setSheetOpen(true)} type="button" aria-label="Adicionar jogador">
        <Plus />
      </button>
      {sheetOpen && (
        <PlayerSheet
          player={editing}
          defaultBilling={defaultBilling}
          onClose={() => {
            setSheetOpen(false);
            setEditing(null);
          }}
          onSave={savePlayer}
        />
      )}
    </section>
  );
}

const PlayerCard = React.memo(
  function PlayerCard({
    player,
    isPending,
    onDelete,
    onEdit,
    onProfile,
    onToggle
  }: {
    player: Player;
    isPending: boolean;
    onDelete: () => void;
    onEdit: () => void;
    onProfile: (id: number) => void;
    onToggle: () => void;
  }) {
    return (
      <article className="player-card">
        <button className="avatar" onClick={() => onProfile(player.id)} type="button">
          {initials(player.name)}
        </button>
        <div className="player-body">
          <button className="text-button" onClick={() => onProfile(player.id)} type="button">
            {player.name}
          </button>
          <div className="meta-line">
            <span>{formatPosition(player.position)}</span>
            <span>Rating {formatRating(player.rating)}</span>
            <span>{formatBillingType(player.billing_type)}</span>
            <span className={player.has_paid ? "good" : "warn"}>{player.has_paid ? "Pago" : "Pendente"}</span>
          </div>
        </div>
        <button
          className={`check-button ${player.is_active ? "checked" : ""}`}
          disabled={isPending}
          onClick={onToggle}
          type="button"
          aria-label={player.is_active ? "Remover confirmacao" : "Confirmar jogador"}
        >
          {player.is_active && <Check size={17} />}
        </button>
        <div className="card-actions">
          <button onClick={onEdit} type="button">
            Editar
          </button>
          <button className="danger-text" onClick={onDelete} type="button">
            Excluir
          </button>
        </div>
      </article>
    );
  },
  (previous, next) => previous.player === next.player && previous.isPending === next.isPending
);

function PlayerSheet({ player, defaultBilling, onClose, onSave }: { player: Player | null; defaultBilling: BillingType; onClose: () => void; onSave: (payload: PlayerPayload) => void }) {
  const base = player || { ...emptyPlayer, billing_type: defaultBilling };
  const [payload, setPayload] = useState<PlayerPayload>({
    name: base.name,
    position: base.position as Position,
    rating: Number(base.rating),
    billing_type: base.billing_type as BillingType,
    has_paid: Boolean(base.has_paid),
    whatsapp: base.whatsapp || "",
    is_active: Boolean(base.is_active)
  });

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Fechar" />
      <form
        className="sheet"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(payload);
        }}
      >
        <header>
          <h2>{player ? "Editar jogador" : "Novo jogador"}</h2>
          <button onClick={onClose} type="button" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <label>
          Nome
          <input value={payload.name} required maxLength={120} onChange={(event) => setPayload({ ...payload, name: event.target.value })} />
        </label>
        <div className="form-pair">
          <label>
            Posicao
            <select value={payload.position} onChange={(event) => setPayload({ ...payload, position: event.target.value as Position })}>
              <option value="defesa">Defesa</option>
              <option value="meio">Meio</option>
              <option value="ataque">Ataque</option>
            </select>
          </label>
          <label>
            Rating
            <input min={0} max={5} step={0.1} type="number" value={payload.rating} onChange={(event) => setPayload({ ...payload, rating: Number(event.target.value) })} />
          </label>
        </div>
        <div className="form-pair">
          <label>
            Cobranca
            <select value={payload.billing_type} onChange={(event) => setPayload({ ...payload, billing_type: event.target.value as BillingType })}>
              <option value="diarista">Diarista</option>
              <option value="mensalista">Mensalista</option>
            </select>
          </label>
          <label>
            WhatsApp
            <input value={payload.whatsapp} maxLength={30} onChange={(event) => setPayload({ ...payload, whatsapp: event.target.value })} />
          </label>
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={payload.is_active} onChange={(event) => setPayload({ ...payload, is_active: event.target.checked })} />
          Confirmado para hoje
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={payload.has_paid} onChange={(event) => setPayload({ ...payload, has_paid: event.target.checked })} />
          Pagamento em dia
        </label>
        <button className="primary-action">Salvar jogador</button>
      </form>
    </div>
  );
}

function TeamsResult({ teams, reserves }: { teams: TeamResult[]; reserves: TeamResult["players"] }) {
  return (
    <div className="teams-grid">
      {teams.map((team, index) => (
        <article className="team-card" key={`${team.name}-${index}`}>
          <header>
            <div>
              <span>Time {index + 1}</span>
              <h3>{team.name}</h3>
            </div>
            <strong>{formatRating(team.total_rating)}</strong>
          </header>
          <ol>
            {team.players.map((player) => (
              <li key={player.id}>
                <span className="mini-avatar">{initials(player.name)}</span>
                <div>
                  <strong>{player.name}</strong>
                  <small>
                    {formatPosition(player.position)} - Rating {formatRating(player.rating)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </article>
      ))}
      {!!reserves.length && (
        <article className="team-card reserves">
          <header>
            <div>
              <span>Banco</span>
              <h3>Reservas</h3>
            </div>
          </header>
          <ol>
            {reserves.map((player) => (
              <li key={player.id}>
                <span className="mini-avatar">{initials(player.name)}</span>
                <div>
                  <strong>{player.name}</strong>
                  <small>{formatPosition(player.position)}</small>
                </div>
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}

function HistoryView({
  matches,
  selectedMatch,
  onReload,
  onOpen,
  onShare,
  onDelete,
  onStatsSaved,
  onError
}: {
  matches: MatchListItem[];
  selectedMatch: MatchRead | null;
  onReload: () => void;
  onOpen: (id: number) => void;
  onShare: (id: number) => void;
  onDelete: (id: number) => void;
  onStatsSaved: (match: MatchRead) => void;
  onError: (error: unknown) => void;
}) {
  useEffect(() => {
    onReload();
  }, []);

  return (
    <section className="history-layout">
      <div className="view-stack">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Rodadas</p>
            <h2>Historico</h2>
          </div>
          <button className="icon-action" onClick={onReload} type="button" aria-label="Atualizar">
            <RefreshCcw size={18} />
          </button>
        </div>
        {matches.map((match) => (
          <article className="match-card" key={match.id}>
            <div>
              <h3>{match.title}</h3>
              <p>
                {formatDate(match.date)} - {match.team_count} times - {match.player_count} jogadores
              </p>
            </div>
            <div className="row-actions">
              <button onClick={() => onOpen(match.id)} type="button">Detalhes</button>
              <button onClick={() => onShare(match.id)} type="button">Print</button>
              <button className="danger-text" onClick={() => onDelete(match.id)} type="button">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {!matches.length && <EmptyState title="Sem peladas salvas" text="Depois de gerar e salvar times, o historico aparece aqui." />}
      </div>
      <div className="view-stack">
        {selectedMatch ? <MatchDetails match={selectedMatch} onSaved={onStatsSaved} onError={onError} /> : <EmptyState title="Selecione uma pelada" text="Abra uma rodada para editar gols, assistencias e time da semana." />}
      </div>
    </section>
  );
}

function MatchDetails({ match, onSaved, onError }: { match: MatchRead; onSaved: (match: MatchRead) => void; onError: (error: unknown) => void }) {
  const [teamOfWeek, setTeamOfWeek] = useState<number | null>(match.teams.find((team) => team.is_team_of_the_week)?.id || null);
  const [stats, setStats] = useState(
    () =>
      new Map<number, { id: number; goals: number; assists: number }>(
        match.teams.flatMap((team) =>
          team.players.map((player) => [player.id, { id: player.id, goals: player.goals, assists: player.assists }] as [number, { id: number; goals: number; assists: number }]),
        ),
      ),
  );

  useEffect(() => {
    setTeamOfWeek(match.teams.find((team) => team.is_team_of_the_week)?.id || null);
    setStats(
      new Map<number, { id: number; goals: number; assists: number }>(
        match.teams.flatMap((team) =>
          team.players.map((player) => [player.id, { id: player.id, goals: player.goals, assists: player.assists }] as [number, { id: number; goals: number; assists: number }]),
        ),
      ),
    );
  }, [match]);

  const updateStat = (id: number, field: "goals" | "assists", value: number) => {
    const next = new Map(stats);
    next.set(id, { ...(next.get(id) || { id, goals: 0, assists: 0 }), [field]: value });
    setStats(next);
  };

  return (
    <section className="details-panel">
      <header>
        <div>
          <p className="eyebrow">Detalhes</p>
          <h2>{match.title}</h2>
          <span>{formatDate(match.date)}</span>
        </div>
        <button
          className="primary-action compact"
          onClick={async () => {
            try {
              onSaved(await api.updateMatchStats(match.id, { team_of_the_week_id: teamOfWeek, players: [...stats.values()] }));
            } catch (error) {
              onError(error);
            }
          }}
          type="button"
        >
          Salvar
        </button>
      </header>
      <div className="teams-grid">
        {match.teams.map((team) => (
          <article className="team-card" key={team.id}>
            <header>
              <div>
                <span>Time</span>
                <h3>{team.name}</h3>
              </div>
              <label className="radio-chip">
                <input type="radio" name="week" checked={teamOfWeek === team.id} onChange={() => setTeamOfWeek(team.id)} />
                Melhor
              </label>
            </header>
            <div className="stats-list">
              {team.players.map((item) => {
                const current = stats.get(item.id) || { id: item.id, goals: 0, assists: 0 };
                return (
                  <div className="stat-row" key={item.id}>
                    <strong>{item.player.name}</strong>
                    <label>
                      Gols
                      <input type="number" min={0} value={current.goals} onChange={(event) => updateStat(item.id, "goals", Number(event.target.value))} />
                    </label>
                    <label>
                      Assist.
                      <input type="number" min={0} value={current.assists} onChange={(event) => updateStat(item.id, "assists", Number(event.target.value))} />
                    </label>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankingsView({ rankings, onReload }: { rankings: RankingsSummary | null; onReload: () => void }) {
  useEffect(() => {
    onReload();
  }, []);
  return (
    <section className="view-stack">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Performance</p>
          <h2>Rankings</h2>
        </div>
        <button className="icon-action" onClick={onReload} type="button" aria-label="Atualizar">
          <RefreshCcw size={18} />
        </button>
      </div>
      {rankings ? (
        <div className="ranking-grid">
          <RankingTable title="Artilheiros" label="Gols" players={rankings.scorers.players} field="goals" />
          <RankingTable title="Assistencias" label="Assist." players={rankings.assists.players} field="assists" />
        </div>
      ) : (
        <EmptyState title="Ranking ainda vazio" text="Salve estatisticas no historico para montar a tabela." />
      )}
    </section>
  );
}

function RankingTable({ title, label, players, field }: { title: string; label: string; players: RankingPlayer[]; field: "goals" | "assists" }) {
  return (
    <article className="ranking-card">
      <header>
        <h3>{title}</h3>
        <Medal size={20} />
      </header>
      {players.length ? (
        <div className="ranking-list">
          {players.map((player, index) => (
            <div className="ranking-row" key={player.player_id}>
              <span className="rank">{index + 1}</span>
              <div>
                <strong>{player.name}</strong>
                <small>
                  {formatPosition(player.position)} - {player.matches_played} jogos
                </small>
              </div>
              <strong>{player[field]}</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={`Sem ${label.toLowerCase()}`} text="Ainda nao ha estatisticas suficientes." />
      )}
    </article>
  );
}

function ProfileView({ session, onSession, onMessage, onError, onLogout }: { session: AuthMe; onSession: (me: AuthMe) => void; onMessage: (text: string) => void; onError: (error: unknown) => void; onLogout: () => void }) {
  const [name, setName] = useState(session.pelada.name);
  const [location, setLocation] = useState(session.pelada.location || "");
  const [time, setTime] = useState(session.pelada.match_time || "20:00");
  const [billing, setBilling] = useState<BillingType>(session.pelada.default_billing_type || "diarista");

  return (
    <section className="profile-panel">
      <div>
        <p className="eyebrow">Configuracoes</p>
        <h2>Perfil da pelada</h2>
      </div>
      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const me = await api.updatePelada({ name, location, match_time: time, default_billing_type: billing });
            onSession(me);
            onMessage("Configuracoes salvas.");
          } catch (error) {
            onError(error);
          }
        }}
      >
        <label>
          Nome da pelada
          <input value={name} required maxLength={120} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Local
          <input value={location} maxLength={160} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <div className="form-pair">
          <label>
            Horario
            <input value={time} maxLength={20} onChange={(event) => setTime(event.target.value)} />
          </label>
          <label>
            Cobranca padrao
            <select value={billing} onChange={(event) => setBilling(event.target.value as BillingType)}>
              <option value="diarista">Diarista</option>
              <option value="mensalista">Mensalista</option>
            </select>
          </label>
        </div>
        <button className="primary-action">Salvar configuracoes</button>
      </form>
      <button className="danger-action" onClick={onLogout} type="button">
        <LogOut size={18} />
        Sair da conta
      </button>
    </section>
  );
}

function ShareView({ match, onBack }: { match: MatchRead | null; onBack: () => void }) {
  if (!match) {
    return <EmptyState title="Nenhum print selecionado" text="Salve uma pelada ou escolha uma rodada no historico." />;
  }

  return (
    <section className="share-screen">
      <div className="toolbar no-print">
        <button className="secondary-action compact" onClick={onBack} type="button">
          <ChevronLeft size={18} />
          Historico
        </button>
        <button className="primary-action compact" onClick={() => window.print()} type="button">
          <Printer size={18} />
          Imprimir
        </button>
      </div>
      <div className="share-sheet">
        <header>
          <div>
            <p>Pelada Manager</p>
            <h1>{match.title}</h1>
            <span>{formatDate(match.date)}</span>
          </div>
          <strong>{match.teams.length} times</strong>
        </header>
        <div className="share-team-grid">
          {match.teams.map((team, index) => (
            <article key={team.id}>
              <h2>
                Time {index + 1}: {team.name}
              </h2>
              <ol>
                {team.players.map((player, playerIndex) => (
                  <li key={player.id}>
                    <span>{playerIndex + 1}</span>
                    <strong>{player.player.name}</strong>
                    <small>{formatPosition(player.player.position)}</small>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerProfileModal({ profile, onClose }: { profile: PlayerProfile; onClose: () => void }) {
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Fechar" />
      <section className="profile-modal">
        <header>
          <div>
            <p className="eyebrow">Perfil do jogador</p>
            <h2>{profile.player.name}</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="profile-metrics">
          <Metric icon={Star} label="Gols" value={profile.total_goals} />
          <Metric icon={Sparkles} label="Assist." value={profile.total_assists} />
          <Metric icon={CalendarDays} label="Peladas" value={profile.total_matches} />
          <Metric icon={Trophy} label="Time semana" value={profile.team_of_the_week_count} />
        </div>
        <div className="meta-line">
          <span>{formatPosition(profile.player.position)}</span>
          <span>Rating {formatRating(profile.player.rating)}</span>
          <span>{formatBillingType(profile.player.billing_type)}</span>
          {profile.player.whatsapp && (
            <a href={whatsappLink(profile.player.whatsapp)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
        <div className="history-table">
          {profile.history.length ? (
            profile.history.map((item) => (
              <div key={`${item.match_id}-${item.team_name}`}>
                <strong>{formatDate(item.date)}</strong>
                <span>{item.team_name}</span>
                <span>{item.goals} G</span>
                <span>{item.assists} A</span>
              </div>
            ))
          ) : (
            <EmptyState title="Sem historico" text="Este jogador ainda nao aparece em peladas salvas." />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <ListFilter size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
