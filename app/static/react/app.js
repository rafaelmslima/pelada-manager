const root = document.querySelector("#root");

const state = {
  session: null,
  players: [],
  matches: [],
  rankings: null,
  teams: null,
  shareMatch: null,
  view: "home",
  message: null,
};

const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M17 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M14.5 14.5A5 5 0 0 1 20.5 20"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4.5 8h15"/><path d="M6 5h12a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 7H4a3 3 0 0 0 3 3"/><path d="M17 7h3a3 3 0 0 1-3 3"/></svg>',
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.8L12 16l-1.6-4.8L6 9.4l4.4-1.6L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  money: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="M15 8.5c-.7-.7-1.8-1-3-1-1.6 0-2.7.7-2.7 1.8 0 2.8 5.4 1.1 5.4 4.2 0 1.1-1.1 2-2.8 2-1.2 0-2.5-.4-3.2-1.2"/><path d="M12 6v12"/></svg>',
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item) => item.msg).join(" ")
      : data?.detail;
    throw new Error(detail || "Nao foi possivel concluir a acao.");
  }
  return data;
}

const api = {
  me: () => requestJson("/api/auth/me"),
  login: (email, password) => postJson("/api/auth/login", { email, password }),
  register: (payload) => postJson("/api/auth/register", payload),
  resetPassword: (payload) => postJson("/api/auth/admin-reset-password", payload),
  logout: () => requestJson("/api/auth/logout", { method: "POST" }),
  updatePelada: (payload) => putJson("/api/auth/pelada", payload),
  players: () => requestJson("/api/players"),
  createPlayer: (payload) => postJson("/api/players", payload),
  updatePlayer: (id, payload) => putJson(`/api/players/${id}`, payload),
  deletePlayer: (id) => requestJson(`/api/players/${id}`, { method: "DELETE" }),
  togglePlayer: (id) => requestJson(`/api/players/${id}/toggle-active`, { method: "PATCH" }),
  generateTeams: (players_per_team) => postJson("/api/teams/generate", { players_per_team }),
  createMatch: (payload) => postJson("/api/matches", payload),
  matches: () => requestJson("/api/matches"),
  match: (id) => requestJson(`/api/matches/${id}`),
  deleteMatch: (id) => requestJson(`/api/matches/${id}`, { method: "DELETE" }),
  rankings: () => requestJson("/api/rankings/summary"),
};

function postJson(url, payload) {
  return requestJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

function putJson(url, payload) {
  return requestJson(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtPos(value) {
  return { defesa: "Defesa", meio: "Meio", ataque: "Ataque" }[value] || value;
}

function fmtBilling(value) {
  return { diarista: "Diarista", mensalista: "Mensalista" }[value] || "Diarista";
}

function fmtRating(value) {
  return Number(value || 0).toFixed(1).replace(".0", "");
}

function fmtDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function initials(name) {
  return String(name || "").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function flash(text, error = false) {
  state.message = { text, error };
  render();
  setTimeout(() => {
    state.message = null;
    render();
  }, 3800);
}

function setView(view) {
  state.view = view;
  if (view === "history") loadMatches();
  if (view === "rankings") loadRankings();
  render();
}

async function loadPlayers() {
  state.players = await api.players();
  render();
}

async function loadMatches() {
  try {
    state.matches = await api.matches();
    render();
  } catch (error) {
    flash(error.message, true);
  }
}

async function loadRankings() {
  try {
    state.rankings = await api.rankings();
    render();
  } catch (error) {
    flash(error.message, true);
  }
}

async function init() {
  root.innerHTML = `<main class="splash"><img src="/static/pelapan-logo.png" alt=""><strong>Carregando...</strong></main>`;
  try {
    state.session = await api.me();
    state.players = await api.players();
  } catch {
    state.session = null;
  }
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

function render() {
  if (!state.session) {
    root.innerHTML = authHtml();
    bindAuth();
    return;
  }

  root.innerHTML = `
    <div class="app-frame view-${state.view}">
      ${sidebarHtml()}
      <main class="app-main">
        ${headerHtml()}
        ${state.message ? `<div class="toast ${state.message.error ? "error" : ""}">${esc(state.message.text)}</div>` : ""}
        ${viewHtml()}
      </main>
      ${bottomNavHtml()}
    </div>
  `;
  bindApp();
}

function authHtml() {
  return `
    <main class="auth-page">
      <section class="auth-card">
        <img src="/static/pelapan-logo.png" alt="">
        <p class="eyebrow">Organize sua pelada</p>
        <h1>Pelada Manager</h1>
        <div class="segmented auth-segmented">
          <button class="active" data-auth-tab="login" type="button">Login</button>
          <button data-auth-tab="register" type="button">Cadastro</button>
          <button data-auth-tab="reset" type="button">Reset senha</button>
        </div>
        <form id="authForm" class="form-grid" data-mode="login">
          <div id="registerFields" class="hidden"></div>
          <label>Email<input name="email" type="email" required></label>
          <label>Senha<input name="password" type="password" required></label>
          <button class="primary-action">Entrar</button>
        </form>
      </section>
    </main>
  `;
}

function bindAuth() {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.authTab;
      document.querySelectorAll("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
      const form = document.querySelector("#authForm");
      form.dataset.mode = mode;
      const extraFields = document.querySelector("#registerFields");
      const passwordLabel = form.querySelector("label:nth-of-type(2)");
      if (mode === "register") {
        extraFields.innerHTML = `<label>Nome<input name="name" required minlength="2"></label><label>Nome da pelada<input name="pelada_name"></label>`;
        passwordLabel.innerHTML = `Senha<input name="password" type="password" minlength="6" required>`;
      } else if (mode === "reset") {
        extraFields.innerHTML = `<label>Codigo administrativo<input name="admin_secret" type="password" autocomplete="off" required></label>`;
        passwordLabel.innerHTML = `Nova senha<input name="password" type="password" minlength="6" required>`;
      } else {
        extraFields.innerHTML = "";
        passwordLabel.innerHTML = `Senha<input name="password" type="password" required>`;
      }
      form.querySelector("button.primary-action").textContent = mode === "register" ? "Criar conta" : mode === "reset" ? "Alterar senha" : "Entrar";
    });
  });

  document.querySelector("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (form.dataset.mode === "reset") {
        await api.resetPassword({
          email: data.get("email"),
          new_password: data.get("password"),
          admin_secret: data.get("admin_secret"),
        });
        flash("Senha alterada. Entre com a nova senha.");
        form.reset();
        return;
      }
      state.session =
        form.dataset.mode === "register"
          ? await api.register({
              name: data.get("name"),
              email: data.get("email"),
              password: data.get("password"),
              pelada_name: data.get("pelada_name") || null,
            })
          : await api.login(data.get("email"), data.get("password"));
      state.players = await api.players();
      state.view = "home";
      render();
    } catch (error) {
      flash(error.message, true);
    }
  });
}

function sidebarHtml() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <img src="/static/pelapan-logo.png" alt="">
        <strong>Pelada Manager</strong>
        <span>${esc(state.session.pelada.name)}</span>
      </div>
      <nav>${navButtonsHtml()}</nav>
      <button class="logout-button" data-action="logout" type="button">Sair</button>
    </aside>
  `;
}

function navButtonsHtml() {
  const items = [
    ["home", icons.home, "Hoje"],
    ["players", icons.users, "Jogadores"],
    ["history", icons.calendar, "Historico"],
    ["rankings", icons.trophy, "Ranking"],
    ["profile", icons.user, "Perfil"],
  ];
  return items.map(([view, icon, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}" type="button">${icon}${label}</button>`).join("");
}

function bottomNavHtml() {
  return `<nav class="bottom-nav">${navButtonsHtml()}</nav>`;
}

function headerHtml() {
  const active = state.players.filter((player) => player.is_active);
  const revenue = active.filter((player) => player.billing_type === "diarista").length * 20;
  return `
    <header class="top-summary">
      <div class="summary-title">
        <img src="/static/pelapan-logo.png" alt="">
        <div>
          <p class="eyebrow">Pelada de hoje</p>
          <h1>${esc(state.session.pelada.name)}</h1>
          <span>${esc(state.session.pelada.location || "Local nao informado")} - ${esc(state.session.pelada.match_time || "20:00")}</span>
        </div>
      </div>
      <div class="metric-strip">
        ${metricHtml(icons.users, active.length, "Confirmados")}
        ${metricHtml(icons.home, state.players.length, "Cadastrados")}
        ${metricHtml(icons.sparkles, state.teams?.team_count || 0, "Times")}
        ${metricHtml(icons.money, `R$ ${revenue}`, "Estimado")}
      </div>
    </header>
  `;
}

function metricHtml(icon, value, label) {
  return `<article class="metric">${icon}<strong>${esc(value)}</strong><span>${esc(label)}</span></article>`;
}

function viewHtml() {
  if (state.view === "players") return playersHtml();
  if (state.view === "history") return historyHtml();
  if (state.view === "rankings") return rankingsHtml();
  if (state.view === "profile") return profileHtml();
  if (state.view === "share") return shareHtml();
  return homeHtml();
}

function homeHtml() {
  const active = state.players.filter((player) => player.is_active);
  const pending = Math.max(state.players.length - active.length, 0);
  const revenue = active.filter((player) => player.billing_type === "diarista").length * 20;
  const vagas = Math.max(24, state.players.length);
  return `
    <section class="mobile-home-v2">
      <div class="mobile-stat-row">
        ${mobileStatHtml(icons.users, active.length, "Jogadores")}
        ${mobileStatHtml(icons.home, vagas, "Vagas")}
        ${mobileStatHtml(icons.money, `R$ ${revenue}`, "Arrecadado")}
        ${mobileStatHtml(icons.check, active.length ? "Jogo" : "Lista", active.length ? "Confirmado" : "Aberta")}
      </div>

      <section class="mobile-section">
        <h2>Sobre o jogo</h2>
        <article class="game-info-card">
          <div class="game-info-top">
            <div class="game-info-item">
              <span class="round-icon">${icons.calendar}</span>
              <div><small>Horario</small><strong>Hoje, ${esc(state.session.pelada.match_time || "20:00")}</strong></div>
            </div>
            <div class="game-info-item">
              <span class="round-icon">${icons.home}</span>
              <div><small>Local</small><strong>${esc(state.session.pelada.location || "Local a definir")}</strong><em>${esc(state.session.pelada.name)}</em></div>
            </div>
          </div>
          <div class="game-info-bottom">
            <div><span class="mini-round">${icons.users}</span><small>Vagas restantes</small><strong>${Math.max(vagas - active.length, 0)}</strong></div>
            <div><span class="mini-round success">${icons.check}</span><small>Confirmados</small><strong>${active.length}</strong></div>
            <div><span class="mini-round warning">${icons.calendar}</span><small>Pendentes</small><strong>${pending}</strong></div>
          </div>
        </article>
      </section>

      <section class="mobile-section">
        <article class="confirmed-card">
          <header><h2>Confirmados (${active.length})</h2><button data-view="players" type="button">Ver todos</button></header>
          <div class="avatar-strip">
            ${active.slice(0, 5).map((player) => `<span class="photo-avatar">${esc(initials(player.name))}<i>${icons.check}</i></span>`).join("")}
            ${active.length > 5 ? `<span class="more-avatar">+${active.length - 5}</span>` : ""}
            ${!active.length ? `<p>Ninguem confirmado ainda.</p>` : ""}
          </div>
        </article>
      </section>

      <section class="mobile-section">
        <article class="quick-card">
          <h2>Acoes rapidas</h2>
          <div class="quick-grid">
            <button data-view="players" type="button">${icons.check}<span>Confirmar<br>presenca</span></button>
            <button data-view="players" type="button">${icons.plus}<span>Convidar<br>amigos</span></button>
            <button data-view="players" type="button">${icons.users}<span>Ver<br>elenco</span></button>
            <button data-view="profile" type="button">${icons.money}<span>Registrar<br>pagamento</span></button>
          </div>
        </article>
      </section>

      <article class="notice-card">
        <span>${icons.calendar}</span>
        <div><strong>Avisos da pelada</strong><p>Leve documento com foto. Pagamento via PIX. Chegue com 15 min de antecedencia.</p></div>
      </article>

      <button class="mobile-confirm-button" data-view="players" type="button">${icons.home}<span>Confirmar presenca</span></button>
      <small class="confirm-hint">Confirme ate 18:30 de hoje</small>

      ${state.teams ? `<section class="mobile-section mobile-teams-after-generate">${teamsHtml(state.teams)}</section>` : ""}
    </section>

    <div class="screen-grid desktop-home">
      <section class="action-panel">
        <p class="eyebrow">Proximo jogo</p>
        <h2>${active.length} confirmados</h2>
        <p>${fmtBilling(state.session.pelada.default_billing_type)} - ${esc(state.session.pelada.location || "Local em aberto")}</p>
      <label>Jogadores por time<input id="playersPerTeam" type="number" min="1" max="30" value="5"></label>
        <button class="primary-action" data-action="generate" type="button">${icons.sparkles}Gerar times</button>
        ${state.teams ? `<button class="secondary-action" data-action="save-match" type="button">Salvar pelada</button>` : ""}
        <div class="quick-actions">
          <button data-view="players" type="button">${icons.users}Jogadores</button>
          <button data-view="history" type="button">${icons.calendar}Historico</button>
        </div>
      </section>
      <section class="teams-area">
        ${state.teams ? teamsHtml(state.teams) : emptyHtml("Times ainda nao gerados", "Confirme os jogadores e gere times equilibrados para a rodada.")}
      </section>
    </div>
  `;
}

function mobileStatHtml(icon, value, label) {
  return `<article class="mobile-stat">${icon}<strong>${esc(value)}</strong><span>${esc(label)}</span></article>`;
}

function teamsHtml(result) {
  return `
    <div class="teams-grid">
      ${result.teams
        .map(
          (team, index) => `
          <article class="team-card">
            <header><div><span>Time ${index + 1}</span><h3>${esc(team.name)}</h3></div><strong>${fmtRating(team.total_rating)}</strong></header>
            <ol>${team.players
              .map(
                (player) => `
                  <li><span class="mini-avatar">${esc(initials(player.name))}</span><div><strong>${esc(player.name)}</strong><small>${fmtPos(player.position)} - Rating ${fmtRating(player.rating)}</small></div></li>
                `,
              )
              .join("")}</ol>
          </article>
        `,
        )
        .join("")}
    </div>
  `;
}

function playersHtml() {
  return `
    <section class="view-stack players-view">
      <div class="toolbar"><div><p class="eyebrow">Elenco</p><h2>Jogadores</h2></div><button class="primary-action compact" data-action="open-player-form" type="button">${icons.plus}Novo</button></div>
      <label class="search-field">${icons.users}<input id="playerSearch" placeholder="Buscar jogador..."></label>
      <div class="chip-row">
        <button class="active" data-filter="all" type="button">Todos</button>
        <button data-filter="confirmed" type="button">Confirmados</button>
        <button data-filter="pending" type="button">Pendentes</button>
      </div>
      <div id="playersContainer" class="player-list">${playerCardsHtml(state.players)}</div>
      <button class="fab" data-action="open-player-form" type="button">${icons.plus}</button>
    </section>
  `;
}

function playerCardsHtml(players) {
  if (!players.length) return emptyHtml("Nenhum jogador encontrado", "Cadastre o primeiro jogador da sua pelada.");
  return players
    .map(
      (player) => `
        <article class="player-card">
          <span class="avatar">${esc(initials(player.name))}</span>
          <div class="player-body">
            <strong>${esc(player.name)}</strong>
            <div class="meta-line">
              <span>${fmtPos(player.position)}</span>
              <span>Rating ${fmtRating(player.rating)}</span>
              <span>${fmtBilling(player.billing_type)}</span>
              <span class="${player.has_paid ? "good" : "warn"}">${player.has_paid ? "Pago" : "Pendente"}</span>
            </div>
          </div>
          <button class="check-button ${player.is_active ? "checked" : ""}" data-toggle-player="${player.id}" type="button">${player.is_active ? icons.check : ""}</button>
          <div class="card-actions">
            <button data-edit-player="${player.id}" type="button">Editar</button>
            <button class="danger-text" data-delete-player="${player.id}" type="button">Excluir</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function historyHtml() {
  return `
    <section class="view-stack">
      <div class="toolbar"><div><p class="eyebrow">Rodadas</p><h2>Historico</h2></div><button class="secondary-action compact" data-action="reload-matches" type="button">Atualizar</button></div>
      ${state.matches.length ? state.matches.map(matchCardHtml).join("") : emptyHtml("Sem peladas salvas", "Depois de gerar e salvar times, o historico aparece aqui.")}
    </section>
  `;
}

function matchCardHtml(match) {
  return `
    <article class="match-card">
      <div><h3>${esc(match.title)}</h3><p>${fmtDate(match.date)} - ${match.team_count} times - ${match.player_count} jogadores</p></div>
      <div class="row-actions">
        <button data-share-match="${match.id}" type="button">Print</button>
        <button class="danger-text" data-delete-match="${match.id}" type="button">Excluir</button>
      </div>
    </article>
  `;
}

function rankingsHtml() {
  if (!state.rankings) return `<section class="view-stack">${emptyHtml("Ranking ainda vazio", "Salve estatisticas no historico para montar a tabela.")}</section>`;
  return `
    <section class="view-stack">
      <div class="toolbar"><div><p class="eyebrow">Performance</p><h2>Rankings</h2></div><button class="secondary-action compact" data-action="reload-rankings" type="button">Atualizar</button></div>
      <div class="ranking-grid">
        ${rankingCardHtml("Artilheiros", state.rankings.scorers.players, "goals")}
        ${rankingCardHtml("Assistencias", state.rankings.assists.players, "assists")}
      </div>
    </section>
  `;
}

function rankingCardHtml(title, players, field) {
  return `
    <article class="ranking-card">
      <header><h3>${esc(title)}</h3>${icons.trophy}</header>
      ${players.length ? players.map((player, index) => `<div class="ranking-row"><span class="rank">${index + 1}</span><div><strong>${esc(player.name)}</strong><small>${fmtPos(player.position)} - ${player.matches_played} jogos</small></div><strong>${player[field]}</strong></div>`).join("") : emptyHtml("Sem dados", "Ainda nao ha estatisticas suficientes.")}
    </article>
  `;
}

function profileHtml() {
  const pelada = state.session.pelada;
  return `
    <section class="profile-panel">
      <p class="eyebrow">Configuracoes</p>
      <h2>Perfil da pelada</h2>
      <form id="profileForm" class="form-grid">
        <label>Nome da pelada<input name="name" value="${esc(pelada.name)}" required></label>
        <label>Local<input name="location" value="${esc(pelada.location || "")}"></label>
        <div class="form-pair">
          <label>Horario<input name="match_time" value="${esc(pelada.match_time || "20:00")}"></label>
          <label>Cobranca padrao<select name="default_billing_type"><option value="diarista" ${pelada.default_billing_type === "diarista" ? "selected" : ""}>Diarista</option><option value="mensalista" ${pelada.default_billing_type === "mensalista" ? "selected" : ""}>Mensalista</option></select></label>
        </div>
        <button class="primary-action">Salvar configuracoes</button>
      </form>
      <button class="danger-action" data-action="logout" type="button">Sair da conta</button>
    </section>
  `;
}

function shareHtml() {
  if (!state.shareMatch) return emptyHtml("Nenhum print selecionado", "Salve uma pelada ou escolha uma rodada no historico.");
  return `
    <section class="share-screen">
      <div class="toolbar no-print"><button class="secondary-action compact" data-view="history" type="button">Historico</button><button class="primary-action compact" data-action="print" type="button">Imprimir</button></div>
      <div class="share-sheet">
        <header><div><p>Pelada Manager</p><h1>${esc(state.shareMatch.title)}</h1><span>${fmtDate(state.shareMatch.date)}</span></div><strong>${state.shareMatch.teams.length} times</strong></header>
        <div class="share-team-grid">
          ${state.shareMatch.teams
            .map(
              (team, index) => `
                <article><h2>Time ${index + 1}: ${esc(team.name)}</h2><ol>${team.players.map((item, itemIndex) => `<li><span>${itemIndex + 1}</span><strong>${esc(item.player.name)}</strong><small>${fmtPos(item.player.position)}</small></li>`).join("")}</ol></article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function emptyHtml(title, text) {
  return `<div class="empty-state">${icons.home}<strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
}

function playerFormHtml(player = null) {
  const payload = player || { name: "", position: "meio", rating: 3, billing_type: state.session.pelada.default_billing_type || "diarista", has_paid: false, whatsapp: "", is_active: false };
  return `
    <div class="modal-layer">
      <button class="modal-backdrop" data-action="close-modal" type="button"></button>
      <form id="playerForm" class="sheet" data-player-id="${player?.id || ""}">
        <header><h2>${player ? "Editar jogador" : "Novo jogador"}</h2><button data-action="close-modal" type="button">x</button></header>
        <label>Nome<input name="name" value="${esc(payload.name)}" required maxlength="120"></label>
        <div class="form-pair">
          <label>Posicao<select name="position"><option value="defesa" ${payload.position === "defesa" ? "selected" : ""}>Defesa</option><option value="meio" ${payload.position === "meio" ? "selected" : ""}>Meio</option><option value="ataque" ${payload.position === "ataque" ? "selected" : ""}>Ataque</option></select></label>
          <label>Rating<input name="rating" type="number" min="0" max="5" step="0.1" value="${payload.rating}"></label>
        </div>
        <div class="form-pair">
          <label>Cobranca<select name="billing_type"><option value="diarista" ${payload.billing_type === "diarista" ? "selected" : ""}>Diarista</option><option value="mensalista" ${payload.billing_type === "mensalista" ? "selected" : ""}>Mensalista</option></select></label>
          <label>WhatsApp<input name="whatsapp" value="${esc(payload.whatsapp || "")}" maxlength="30"></label>
        </div>
        <label class="switch-row"><input name="is_active" type="checkbox" ${payload.is_active ? "checked" : ""}>Confirmado para hoje</label>
        <label class="switch-row"><input name="has_paid" type="checkbox" ${payload.has_paid ? "checked" : ""}>Pagamento em dia</label>
        <button class="primary-action">Salvar jogador</button>
      </form>
    </div>
  `;
}

function bindApp() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-action='logout']").forEach((button) => button.addEventListener("click", logout));
  document.querySelector("[data-action='generate']")?.addEventListener("click", generateTeams);
  document.querySelector("[data-action='save-match']")?.addEventListener("click", saveMatch);
  document.querySelector("[data-action='reload-matches']")?.addEventListener("click", loadMatches);
  document.querySelector("[data-action='reload-rankings']")?.addEventListener("click", loadRankings);
  document.querySelector("[data-action='print']")?.addEventListener("click", () => window.print());
  document.querySelectorAll("[data-action='open-player-form']").forEach((button) => button.addEventListener("click", () => openPlayerForm()));
  document.querySelectorAll("[data-toggle-player]").forEach((button) => button.addEventListener("click", () => togglePlayer(Number(button.dataset.togglePlayer))));
  document.querySelectorAll("[data-edit-player]").forEach((button) => button.addEventListener("click", () => openPlayerForm(Number(button.dataset.editPlayer))));
  document.querySelectorAll("[data-delete-player]").forEach((button) => button.addEventListener("click", () => deletePlayer(Number(button.dataset.deletePlayer))));
  document.querySelectorAll("[data-share-match]").forEach((button) => button.addEventListener("click", () => shareMatch(Number(button.dataset.shareMatch))));
  document.querySelectorAll("[data-delete-match]").forEach((button) => button.addEventListener("click", () => deleteMatch(Number(button.dataset.deleteMatch))));
  document.querySelector("#profileForm")?.addEventListener("submit", saveProfile);
  bindPlayerFilters();
}

function bindPlayerFilters() {
  const search = document.querySelector("#playerSearch");
  if (!search) return;
  let filter = "all";
  const refresh = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = state.players.filter((player) => {
      const byFilter = filter === "all" || (filter === "confirmed" && player.is_active) || (filter === "pending" && !player.is_active);
      return byFilter && player.name.toLowerCase().includes(query);
    });
    document.querySelector("#playersContainer").innerHTML = playerCardsHtml(filtered);
    bindApp();
  };
  search.addEventListener("input", refresh);
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      refresh();
    });
  });
}

async function logout() {
  await api.logout().catch(() => null);
  state.session = null;
  state.players = [];
  state.teams = null;
  render();
}

async function generateTeams() {
  try {
    state.teams = await api.generateTeams(Number(document.querySelector("#playersPerTeam").value || 5));
    flash("Times gerados com sucesso.");
  } catch (error) {
    state.teams = null;
    flash(error.message, true);
  }
}

async function saveMatch() {
  if (!state.teams?.teams?.length) return flash("Gere os times antes de salvar a pelada.", true);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const match = await api.createMatch({
      date: today,
      title: `Pelada ${fmtDate(today)}`,
      teams: state.teams.teams.map((team) => ({
        name: team.name,
        total_rating: team.total_rating,
        is_team_of_the_week: false,
        players: team.players.map((player) => ({ player_id: player.id, goals: 0, assists: 0 })),
      })),
    });
    state.shareMatch = match;
    state.view = "share";
    await loadMatches();
    flash("Pelada salva no historico.");
  } catch (error) {
    flash(error.message, true);
  }
}

function openPlayerForm(id = null) {
  const player = id ? state.players.find((item) => item.id === id) : null;
  document.body.insertAdjacentHTML("beforeend", playerFormHtml(player));
  document.querySelectorAll("[data-action='close-modal']").forEach((button) => button.addEventListener("click", closeModal));
  document.querySelector("#playerForm").addEventListener("submit", savePlayer);
}

function closeModal() {
  document.querySelector(".modal-layer")?.remove();
}

async function savePlayer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    position: data.get("position"),
    rating: Number(data.get("rating")),
    billing_type: data.get("billing_type"),
    has_paid: data.get("has_paid") === "on",
    whatsapp: data.get("whatsapp") || "",
    is_active: data.get("is_active") === "on",
  };
  try {
    const id = form.dataset.playerId;
    id ? await api.updatePlayer(Number(id), payload) : await api.createPlayer(payload);
    closeModal();
    await loadPlayers();
    flash(id ? "Jogador atualizado." : "Jogador cadastrado.");
  } catch (error) {
    flash(error.message, true);
  }
}

async function togglePlayer(id) {
  try {
    await api.togglePlayer(id);
    await loadPlayers();
  } catch (error) {
    flash(error.message, true);
  }
}

async function deletePlayer(id) {
  const player = state.players.find((item) => item.id === id);
  if (!window.confirm(`Excluir ${player?.name || "jogador"}?`)) return;
  try {
    await api.deletePlayer(id);
    await loadPlayers();
    flash("Jogador excluido.");
  } catch (error) {
    flash(error.message, true);
  }
}

async function shareMatch(id) {
  try {
    state.shareMatch = await api.match(id);
    state.view = "share";
    render();
  } catch (error) {
    flash(error.message, true);
  }
}

async function deleteMatch(id) {
  if (!window.confirm("Excluir esta pelada?")) return;
  try {
    await api.deleteMatch(id);
    await loadMatches();
    flash("Pelada excluida.");
  } catch (error) {
    flash(error.message, true);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    state.session = await api.updatePelada({
      name: data.get("name"),
      location: data.get("location") || "",
      match_time: data.get("match_time") || "20:00",
      default_billing_type: data.get("default_billing_type"),
    });
    flash("Configuracoes salvas.");
  } catch (error) {
    flash(error.message, true);
  }
}

init();
