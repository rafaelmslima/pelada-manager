import React, { useEffect, useMemo, useState } from "https://esm.sh/react@19.0.0";
import { createRoot } from "https://esm.sh/react-dom@19.0.0/client";
import {
  Banknote,
  CalendarDays,
  Check,
  CircleUserRound,
  Home,
  ListFilter,
  LogOut,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trophy,
  UsersRound,
  X,
} from "https://esm.sh/lucide-react@0.468.0?deps=react@19.0.0";

const h = React.createElement;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item) => item.msg).join(" ")
      : data?.detail;
    const error = new Error(detail || "Nao foi possivel concluir a acao.");
    error.status = response.status;
    throw error;
  }
  return data;
}

const api = {
  me: () => requestJson("/api/auth/me"),
  login: (email, password) =>
    requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  register: (payload) =>
    requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  logout: () => requestJson("/api/auth/logout", { method: "POST" }),
  updatePelada: (payload) =>
    requestJson("/api/auth/pelada", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  players: () => requestJson("/api/players"),
  createPlayer: (payload) =>
    requestJson("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updatePlayer: (id, payload) =>
    requestJson(`/api/players/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deletePlayer: (id) => requestJson(`/api/players/${id}`, { method: "DELETE" }),
  togglePlayer: (id) => requestJson(`/api/players/${id}/toggle-active`, { method: "PATCH" }),
  generateTeams: (players_per_team) =>
    requestJson("/api/teams/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players_per_team }),
    }),
  createMatch: (payload) =>
    requestJson("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  matches: () => requestJson("/api/matches"),
  match: (id) => requestJson(`/api/matches/${id}`),
  deleteMatch: (id) => requestJson(`/api/matches/${id}`, { method: "DELETE" }),
  rankings: () => requestJson("/api/rankings/summary"),
};

function formatPosition(value) {
  return { defesa: "Defesa", meio: "Meio", ataque: "Ataque" }[value] || value;
}

function formatBilling(value) {
  return { diarista: "Diarista", mensalista: "Mensalista" }[value] || value || "Diarista";
}

function formatRating(value) {
  return Number(value || 0).toFixed(1).replace(".0", "");
}

function formatDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function App() {
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rankings, setRankings] = useState(null);
  const [teams, setTeams] = useState(null);
  const [shareMatch, setShareMatch] = useState(null);
  const [view, setView] = useState("home");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const flash = (text, error = false) => {
    setMessage({ text, error });
    window.setTimeout(() => setMessage(null), 3800);
  };

  const handleError = (error) => {
    if (error.status === 401) {
      setSession(null);
      return;
    }
    flash(error.message || "Nao foi possivel concluir a acao.", true);
  };

  const reloadPlayers = () => api.players().then(setPlayers).catch(handleError);
  const reloadMatches = () => api.matches().then(setMatches).catch(handleError);
  const reloadRankings = () => api.rankings().then(setRankings).catch(handleError);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setSession(me);
        return api.players();
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

  if (loading) return h("main", { className: "splash" }, h("img", { src: "/static/pelapan-logo.png", alt: "" }), h("strong", null, "Carregando..."));
  if (!session) return h(AuthScreen, { onLogin: (me) => { setSession(me); reloadPlayers(); }, flash });

  const active = players.filter((player) => player.is_active);
  const revenue = active.filter((player) => player.billing_type === "diarista").length * 20;

  const logout = async () => {
    await api.logout().catch(() => null);
    setSession(null);
    setView("home");
  };

  return h(
    "div",
    { className: "app-frame" },
    h(Sidebar, { session, view, setView, logout, reloadMatches, reloadRankings }),
    h(
      "main",
      { className: "app-main" },
      h(Header, { session, active: active.length, total: players.length, revenue, teams: teams?.team_count || 0 }),
      message && h("div", { className: `toast ${message.error ? "error" : ""}` }, message.text),
      view === "home" &&
        h(HomeView, {
          session,
          players,
          teams,
          setTeams,
          setShareMatch,
          setView,
          reloadMatches,
          flash,
          handleError,
        }),
      view === "players" && h(PlayersView, { players, reloadPlayers, flash, handleError, defaultBilling: session.pelada.default_billing_type }),
      view === "history" && h(HistoryView, { matches, reloadMatches, setShareMatch, setView, flash, handleError }),
      view === "rankings" && h(RankingsView, { rankings, reloadRankings }),
      view === "profile" && h(ProfileView, { session, setSession, flash, handleError, logout }),
      view === "share" && h(ShareView, { match: shareMatch, setView }),
    ),
    h(BottomNav, { view, setView, reloadMatches, reloadRankings }),
  );
}

function AuthScreen({ onLogin, flash }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const me =
        mode === "login"
          ? await api.login(form.get("email"), form.get("password"))
          : await api.register({
              name: form.get("name"),
              email: form.get("email"),
              password: form.get("password"),
              pelada_name: form.get("pelada_name") || null,
            });
      onLogin(me);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  return h(
    "main",
    { className: "auth-page" },
    h(
      "section",
      { className: "auth-card" },
      h("img", { src: "/static/pelapan-logo.png", alt: "" }),
      h("p", { className: "eyebrow" }, "Organize sua pelada"),
      h("h1", null, "Pelada Manager"),
      h(
        "div",
        { className: "segmented" },
        h("button", { className: mode === "login" ? "active" : "", onClick: () => setMode("login"), type: "button" }, "Login"),
        h("button", { className: mode === "register" ? "active" : "", onClick: () => setMode("register"), type: "button" }, "Cadastro"),
      ),
      h(
        "form",
        { className: "form-grid", onSubmit: submit },
        mode === "register" && h(React.Fragment, null, h(Field, { label: "Nome", name: "name", required: true }), h(Field, { label: "Nome da pelada", name: "pelada_name" })),
        h(Field, { label: "Email", name: "email", type: "email", required: true }),
        h(Field, { label: "Senha", name: "password", type: "password", required: true }),
        h("button", { className: "primary-action", disabled: busy }, busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"),
      ),
    ),
  );
}

function Sidebar({ session, view, setView, logout, reloadMatches, reloadRankings }) {
  const items = [
    ["home", Home, "Hoje"],
    ["players", UsersRound, "Jogadores"],
    ["history", CalendarDays, "Historico"],
    ["rankings", Trophy, "Ranking"],
    ["profile", CircleUserRound, "Perfil"],
  ];
  return h(
    "aside",
    { className: "sidebar" },
    h("div", { className: "brand" }, h("img", { src: "/static/pelapan-logo.png", alt: "" }), h("strong", null, "Pelada Manager"), h("span", null, session.pelada.name)),
    h(
      "nav",
      null,
      items.map(([key, Icon, label]) =>
        h(
          "button",
          {
            key,
            className: view === key ? "active" : "",
            onClick: () => {
              setView(key);
              if (key === "history") reloadMatches();
              if (key === "rankings") reloadRankings();
            },
            type: "button",
          },
          h(Icon, { size: 20 }),
          label,
        ),
      ),
    ),
    h("button", { className: "logout-button", onClick: logout, type: "button" }, h(LogOut, { size: 18 }), "Sair"),
  );
}

function Header({ session, active, total, revenue, teams }) {
  return h(
    "header",
    { className: "top-summary" },
    h("div", { className: "summary-title" }, h("img", { src: "/static/pelapan-logo.png", alt: "" }), h("div", null, h("p", { className: "eyebrow" }, "Pelada de hoje"), h("h1", null, session.pelada.name), h("span", null, `${session.pelada.location || "Local nao informado"} - ${session.pelada.match_time || "20:00"}`))),
    h(
      "div",
      { className: "metric-strip" },
      h(Metric, { icon: UsersRound, label: "Confirmados", value: active }),
      h(Metric, { icon: ListFilter, label: "Jogadores", value: total }),
      h(Metric, { icon: Sparkles, label: "Times", value: teams }),
      h(Metric, { icon: Banknote, label: "Arrecadacao", value: `R$ ${revenue}` }),
    ),
  );
}

function Metric({ icon: Icon, label, value }) {
  return h("article", { className: "metric" }, h(Icon, { size: 19 }), h("strong", null, value), h("span", null, label));
}

function HomeView({ session, players, teams, setTeams, setShareMatch, setView, reloadMatches, flash, handleError }) {
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const active = players.filter((player) => player.is_active);

  async function generate() {
    try {
      setTeams(await api.generateTeams(Number(playersPerTeam)));
      flash("Times gerados com sucesso.");
    } catch (error) {
      setTeams(null);
      handleError(error);
    }
  }

  async function saveMatch() {
    if (!teams?.teams?.length) return flash("Gere os times antes de salvar a pelada.", true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const match = await api.createMatch({
        date: today,
        title: `Pelada ${formatDate(today)}`,
        teams: teams.teams.map((team) => ({
          name: team.name,
          total_rating: team.total_rating,
          is_team_of_the_week: false,
          players: team.players.map((player) => ({ player_id: player.id, goals: 0, assists: 0 })),
        })),
      });
      setShareMatch(match);
      setView("share");
      reloadMatches();
      flash("Pelada salva no historico.");
    } catch (error) {
      handleError(error);
    }
  }

  return h(
    "div",
    { className: "screen-grid" },
    h(
      "section",
      { className: "action-panel" },
      h("p", { className: "eyebrow" }, "Proximo jogo"),
      h("h2", null, `${active.length} confirmados`),
      h("p", null, `${formatBilling(session.pelada.default_billing_type)} - ${session.pelada.location || "Local em aberto"}`),
      h("label", null, "Jogadores por time", h("input", { type: "number", min: 1, max: 30, value: playersPerTeam, onChange: (event) => setPlayersPerTeam(event.target.value) })),
      h("button", { className: "primary-action", onClick: generate, type: "button" }, h(Sparkles, { size: 19 }), "Gerar times"),
      teams && h("button", { className: "secondary-action", onClick: saveMatch, type: "button" }, "Salvar pelada"),
      h("div", { className: "quick-actions" }, h("button", { onClick: () => setView("players"), type: "button" }, h(UsersRound, { size: 18 }), "Jogadores"), h("button", { onClick: () => { reloadMatches(); setView("history"); }, type: "button" }, h(CalendarDays, { size: 18 }), "Historico")),
    ),
    h("section", { className: "teams-area" }, teams ? h(TeamsResult, { teams }) : h(EmptyState, { title: "Times ainda nao gerados", text: "Confirme os jogadores e gere times equilibrados para a rodada." })),
  );
}

function PlayersView({ players, reloadPlayers, flash, handleError, defaultBilling }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const filtered = useMemo(
    () =>
      players.filter((player) => {
        const byFilter = filter === "all" || (filter === "confirmed" && player.is_active) || (filter === "pending" && !player.is_active);
        return byFilter && player.name.toLowerCase().includes(query.trim().toLowerCase());
      }),
    [players, query, filter],
  );

  async function savePlayer(payload) {
    try {
      editing ? await api.updatePlayer(editing.id, payload) : await api.createPlayer(payload);
      setSheetOpen(false);
      setEditing(null);
      reloadPlayers();
      flash(editing ? "Jogador atualizado." : "Jogador cadastrado.");
    } catch (error) {
      handleError(error);
    }
  }

  return h(
    "section",
    { className: "view-stack" },
    h("div", { className: "toolbar" }, h("div", null, h("p", { className: "eyebrow" }, "Elenco"), h("h2", null, "Jogadores")), h("button", { className: "primary-action compact", onClick: () => setSheetOpen(true), type: "button" }, h(Plus, { size: 18 }), "Novo")),
    h("label", { className: "search-field" }, h(Search, { size: 18 }), h("input", { placeholder: "Buscar jogador...", value: query, onChange: (event) => setQuery(event.target.value) })),
    h("div", { className: "chip-row" }, ["all", "confirmed", "pending"].map((item) => h("button", { key: item, className: filter === item ? "active" : "", onClick: () => setFilter(item), type: "button" }, item === "all" ? "Todos" : item === "confirmed" ? "Confirmados" : "Pendentes"))),
    h(
      "div",
      { className: "player-list" },
      filtered.map((player) =>
        h(
          "article",
          { className: "player-card", key: player.id },
          h("span", { className: "avatar" }, initials(player.name)),
          h("div", { className: "player-body" }, h("strong", null, player.name), h("div", { className: "meta-line" }, h("span", null, formatPosition(player.position)), h("span", null, `Rating ${formatRating(player.rating)}`), h("span", null, formatBilling(player.billing_type)), h("span", { className: player.has_paid ? "good" : "warn" }, player.has_paid ? "Pago" : "Pendente"))),
          h("button", { className: `check-button ${player.is_active ? "checked" : ""}`, onClick: async () => { try { await api.togglePlayer(player.id); reloadPlayers(); } catch (error) { handleError(error); } }, type: "button" }, player.is_active && h(Check, { size: 17 })),
          h("div", { className: "card-actions" }, h("button", { onClick: () => { setEditing(player); setSheetOpen(true); }, type: "button" }, "Editar"), h("button", { className: "danger-text", onClick: async () => { if (!window.confirm(`Excluir ${player.name}?`)) return; try { await api.deletePlayer(player.id); reloadPlayers(); flash("Jogador excluido."); } catch (error) { handleError(error); } }, type: "button" }, "Excluir")),
        ),
      ),
    ),
    !filtered.length && h(EmptyState, { title: "Nenhum jogador encontrado", text: "Ajuste a busca ou cadastre um novo jogador." }),
    h("button", { className: "fab", onClick: () => setSheetOpen(true), type: "button" }, h(Plus, null)),
    sheetOpen && h(PlayerSheet, { player: editing, defaultBilling, onClose: () => { setSheetOpen(false); setEditing(null); }, onSave: savePlayer }),
  );
}

function PlayerSheet({ player, defaultBilling, onClose, onSave }) {
  const [payload, setPayload] = useState({
    name: player?.name || "",
    position: player?.position || "meio",
    rating: Number(player?.rating || 3),
    billing_type: player?.billing_type || defaultBilling || "diarista",
    has_paid: Boolean(player?.has_paid),
    whatsapp: player?.whatsapp || "",
    is_active: Boolean(player?.is_active),
  });
  const update = (key, value) => setPayload((current) => ({ ...current, [key]: value }));

  return h(
    "div",
    { className: "modal-layer" },
    h("button", { className: "modal-backdrop", onClick: onClose, type: "button" }),
    h(
      "form",
      { className: "sheet", onSubmit: (event) => { event.preventDefault(); onSave(payload); } },
      h("header", null, h("h2", null, player ? "Editar jogador" : "Novo jogador"), h("button", { onClick: onClose, type: "button" }, h(X, { size: 20 }))),
      h("label", null, "Nome", h("input", { value: payload.name, required: true, maxLength: 120, onChange: (event) => update("name", event.target.value) })),
      h("div", { className: "form-pair" }, h("label", null, "Posicao", h("select", { value: payload.position, onChange: (event) => update("position", event.target.value) }, h("option", { value: "defesa" }, "Defesa"), h("option", { value: "meio" }, "Meio"), h("option", { value: "ataque" }, "Ataque"))), h("label", null, "Rating", h("input", { type: "number", min: 0, max: 5, step: 0.1, value: payload.rating, onChange: (event) => update("rating", Number(event.target.value)) }))),
      h("div", { className: "form-pair" }, h("label", null, "Cobranca", h("select", { value: payload.billing_type, onChange: (event) => update("billing_type", event.target.value) }, h("option", { value: "diarista" }, "Diarista"), h("option", { value: "mensalista" }, "Mensalista"))), h("label", null, "WhatsApp", h("input", { value: payload.whatsapp, maxLength: 30, onChange: (event) => update("whatsapp", event.target.value) }))),
      h("label", { className: "switch-row" }, h("input", { type: "checkbox", checked: payload.is_active, onChange: (event) => update("is_active", event.target.checked) }), "Confirmado para hoje"),
      h("label", { className: "switch-row" }, h("input", { type: "checkbox", checked: payload.has_paid, onChange: (event) => update("has_paid", event.target.checked) }), "Pagamento em dia"),
      h("button", { className: "primary-action" }, "Salvar jogador"),
    ),
  );
}

function TeamsResult({ teams }) {
  return h(
    "div",
    { className: "teams-grid" },
    teams.teams.map((team, index) =>
      h("article", { className: "team-card", key: `${team.name}-${index}` }, h("header", null, h("div", null, h("span", null, `Time ${index + 1}`), h("h3", null, team.name)), h("strong", null, formatRating(team.total_rating))), h("ol", null, team.players.map((player) => h("li", { key: player.id }, h("span", { className: "mini-avatar" }, initials(player.name)), h("div", null, h("strong", null, player.name), h("small", null, `${formatPosition(player.position)} - Rating ${formatRating(player.rating)}`)))))),
    ),
  );
}

function HistoryView({ matches, reloadMatches, setShareMatch, setView, flash, handleError }) {
  useEffect(() => { reloadMatches(); }, []);
  return h(
    "section",
    { className: "view-stack" },
    h("div", { className: "toolbar" }, h("div", null, h("p", { className: "eyebrow" }, "Rodadas"), h("h2", null, "Historico")), h("button", { className: "secondary-action compact", onClick: reloadMatches, type: "button" }, "Atualizar")),
    matches.map((match) =>
      h("article", { className: "match-card", key: match.id }, h("div", null, h("h3", null, match.title), h("p", null, `${formatDate(match.date)} - ${match.team_count} times - ${match.player_count} jogadores`)), h("div", { className: "row-actions" }, h("button", { onClick: async () => { try { setShareMatch(await api.match(match.id)); setView("share"); } catch (error) { handleError(error); } }, type: "button" }, "Print"), h("button", { className: "danger-text", onClick: async () => { if (!window.confirm("Excluir esta pelada?")) return; try { await api.deleteMatch(match.id); reloadMatches(); flash("Pelada excluida."); } catch (error) { handleError(error); } }, type: "button" }, "Excluir"))),
    ),
    !matches.length && h(EmptyState, { title: "Sem peladas salvas", text: "Depois de gerar e salvar times, o historico aparece aqui." }),
  );
}

function RankingsView({ rankings, reloadRankings }) {
  useEffect(() => { reloadRankings(); }, []);
  return h("section", { className: "view-stack" }, h("div", { className: "toolbar" }, h("div", null, h("p", { className: "eyebrow" }, "Performance"), h("h2", null, "Rankings")), h("button", { className: "secondary-action compact", onClick: reloadRankings, type: "button" }, "Atualizar")), rankings ? h("div", { className: "ranking-grid" }, h(RankingCard, { title: "Artilheiros", players: rankings.scorers.players, field: "goals" }), h(RankingCard, { title: "Assistencias", players: rankings.assists.players, field: "assists" })) : h(EmptyState, { title: "Ranking ainda vazio", text: "Salve estatisticas no historico para montar a tabela." }));
}

function RankingCard({ title, players, field }) {
  return h("article", { className: "ranking-card" }, h("header", null, h("h3", null, title), h(Trophy, { size: 20 })), players.length ? h("div", { className: "ranking-list" }, players.map((player, index) => h("div", { className: "ranking-row", key: player.player_id }, h("span", { className: "rank" }, index + 1), h("div", null, h("strong", null, player.name), h("small", null, `${formatPosition(player.position)} - ${player.matches_played} jogos`)), h("strong", null, player[field])))) : h(EmptyState, { title: "Sem dados", text: "Ainda nao ha estatisticas suficientes." }));
}

function ProfileView({ session, setSession, flash, handleError, logout }) {
  const [name, setName] = useState(session.pelada.name);
  const [location, setLocation] = useState(session.pelada.location || "");
  const [time, setTime] = useState(session.pelada.match_time || "20:00");
  const [billing, setBilling] = useState(session.pelada.default_billing_type || "diarista");
  return h("section", { className: "profile-panel" }, h("p", { className: "eyebrow" }, "Configuracoes"), h("h2", null, "Perfil da pelada"), h("form", { className: "form-grid", onSubmit: async (event) => { event.preventDefault(); try { const me = await api.updatePelada({ name, location, match_time: time, default_billing_type: billing }); setSession(me); flash("Configuracoes salvas."); } catch (error) { handleError(error); } } }, h("label", null, "Nome da pelada", h("input", { value: name, required: true, onChange: (event) => setName(event.target.value) })), h("label", null, "Local", h("input", { value: location, onChange: (event) => setLocation(event.target.value) })), h("div", { className: "form-pair" }, h("label", null, "Horario", h("input", { value: time, onChange: (event) => setTime(event.target.value) })), h("label", null, "Cobranca padrao", h("select", { value: billing, onChange: (event) => setBilling(event.target.value) }, h("option", { value: "diarista" }, "Diarista"), h("option", { value: "mensalista" }, "Mensalista")))), h("button", { className: "primary-action" }, "Salvar configuracoes")), h("button", { className: "danger-action", onClick: logout, type: "button" }, h(LogOut, { size: 18 }), "Sair da conta"));
}

function ShareView({ match, setView }) {
  if (!match) return h(EmptyState, { title: "Nenhum print selecionado", text: "Salve uma pelada ou escolha uma rodada no historico." });
  return h("section", { className: "share-screen" }, h("div", { className: "toolbar no-print" }, h("button", { className: "secondary-action compact", onClick: () => setView("history"), type: "button" }, "Historico"), h("button", { className: "primary-action compact", onClick: () => window.print(), type: "button" }, h(Printer, { size: 18 }), "Imprimir")), h("div", { className: "share-sheet" }, h("header", null, h("div", null, h("p", null, "Pelada Manager"), h("h1", null, match.title), h("span", null, formatDate(match.date))), h("strong", null, `${match.teams.length} times`)), h("div", { className: "share-team-grid" }, match.teams.map((team, index) => h("article", { key: team.id }, h("h2", null, `Time ${index + 1}: ${team.name}`), h("ol", null, team.players.map((player, playerIndex) => h("li", { key: player.id }, h("span", null, playerIndex + 1), h("strong", null, player.player.name), h("small", null, formatPosition(player.player.position)))))))));
}

function BottomNav({ view, setView, reloadMatches, reloadRankings }) {
  const items = [
    ["home", Home, "Inicio"],
    ["players", UsersRound, "Jogadores"],
    ["history", CalendarDays, "Historico"],
    ["rankings", Trophy, "Ranking"],
    ["profile", CircleUserRound, "Perfil"],
  ];
  return h("nav", { className: "bottom-nav" }, items.map(([key, Icon, label]) => h("button", { key, className: view === key ? "active" : "", onClick: () => { setView(key); if (key === "history") reloadMatches(); if (key === "rankings") reloadRankings(); }, type: "button" }, h(Icon, { size: 21 }), h("span", null, label))));
}

function Field({ label, ...props }) {
  return h("label", null, label, h("input", props));
}

function EmptyState({ title, text }) {
  return h("div", { className: "empty-state" }, h(ListFilter, { size: 24 }), h("strong", null, title), h("span", null, text));
}

createRoot(document.getElementById("root")).render(h(App));
