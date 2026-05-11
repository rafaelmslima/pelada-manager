const playersList = document.querySelector("#playersList");
const authView = document.querySelector("#authView");
const appContent = document.querySelector("#appContent");
const loginTabButton = document.querySelector("#loginTabButton");
const registerTabButton = document.querySelector("#registerTabButton");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const logoutButton = document.querySelector("#logoutButton");
const peladaHeader = document.querySelector("#peladaHeader");
const playerForm = document.querySelector("#playerForm");
const formTitle = document.querySelector("#formTitle");
const cancelEditButton = document.querySelector("#cancelEditButton");
const generateTeamsButton = document.querySelector("#generateTeamsButton");
const saveMatchButton = document.querySelector("#saveMatchButton");
const teamsResult = document.querySelector("#teamsResult");
const message = document.querySelector("#message");
const totalPlayers = document.querySelector("#totalPlayers");
const activePlayers = document.querySelector("#activePlayers");
const homeView = document.querySelector("#homeView");
const managementView = document.querySelector("#managementView");
const historyView = document.querySelector("#historyView");
const rankingsView = document.querySelector("#rankingsView");
const shareView = document.querySelector("#shareView");
const homeNavButton = document.querySelector("#homeNavButton");
const managementNavButton = document.querySelector("#managementNavButton");
const historyNavButton = document.querySelector("#historyNavButton");
const rankingsNavButton = document.querySelector("#rankingsNavButton");
const profileNavButton = document.querySelector("#profileNavButton");
const shareNavButton = document.querySelector("#shareNavButton");
const refreshManagementButton = document.querySelector("#refreshManagementButton");
const refreshHistoryButton = document.querySelector("#refreshHistoryButton");
const refreshRankingsButton = document.querySelector("#refreshRankingsButton");
const backToHistoryButton = document.querySelector("#backToHistoryButton");
const printTeamsButton = document.querySelector("#printTeamsButton");
const matchesList = document.querySelector("#matchesList");
const matchDetails = document.querySelector("#matchDetails");
const rankingsEmptyState = document.querySelector("#rankingsEmptyState");
const rankingsContent = document.querySelector("#rankingsContent");
const shareContent = document.querySelector("#shareContent");
const managementSummary = document.querySelector("#managementSummary");
const managementList = document.querySelector("#managementList");
const profileModal = document.querySelector("#profileModal");
const profileTitle = document.querySelector("#profileTitle");
const profileContent = document.querySelector("#profileContent");
const mobileGenerateTeamsButton = document.querySelector("#mobileGenerateTeamsButton");
const mobileHistoryButton = document.querySelector("#mobileHistoryButton");
const mobileActivePlayers = document.querySelector("#mobileActivePlayers");
const mobileTotalPlayers = document.querySelector("#mobileTotalPlayers");
const mobilePlayersView = document.querySelector("#mobilePlayersView");
const mobilePlayersList = document.querySelector("#mobilePlayersList");
const mobilePlayersCount = document.querySelector("#mobilePlayersCount");
const mobilePlayersSearch = document.querySelector("#mobilePlayersSearch");
const mobileFilterTabs = document.querySelectorAll(".mobile-filter-tab");
const mobilePlayersBackButton = document.querySelector("#mobilePlayersBackButton");
const mobileAddPlayerFab = document.querySelector("#mobileAddPlayerFab");
const mobilePlayerModal = document.querySelector("#mobilePlayerModal");
const mobilePlayerForm = document.querySelector("#mobilePlayerForm");
const mobileHomeShell = document.querySelector(".mobile-home-shell");

let players = [];
let matches = [];
let rankings = null;
let currentTeams = [];
let collapsedMatchMonths = new Set();
let hasInitializedMatchMonths = false;
let mobilePlayersFilter = "all";
let mobilePlayersQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initializeAuth();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/service-worker.js").catch(() => {});
  });
}

loginTabButton?.addEventListener("click", () => switchAuthTab("login"));
registerTabButton?.addEventListener("click", () => switchAuthTab("register"));
loginForm?.addEventListener("submit", submitLogin);
registerForm?.addEventListener("submit", submitRegister);
logoutButton?.addEventListener("click", logout);

homeNavButton.addEventListener("click", () => showView("home"));
managementNavButton.addEventListener("click", () => showView("management"));
historyNavButton.addEventListener("click", () => showView("history"));
rankingsNavButton.addEventListener("click", () => showView("rankings"));
profileNavButton?.addEventListener("click", logout);
shareNavButton.addEventListener("click", () => showView("share"));
refreshManagementButton.addEventListener("click", loadPlayers);
refreshHistoryButton.addEventListener("click", loadMatches);
refreshRankingsButton.addEventListener("click", loadRankings);
backToHistoryButton.addEventListener("click", () => showView("history"));
printTeamsButton.addEventListener("click", () => window.print());

playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const playerId = document.querySelector("#playerId").value;
  const existingPlayer = players.find((player) => String(player.id) === playerId);
  const payload = {
    name: document.querySelector("#name").value,
    position: document.querySelector("#position").value,
    rating: Number(document.querySelector("#rating").value),
    billing_type: document.querySelector("#billingType").value,
    has_paid: existingPlayer?.has_paid || false,
    whatsapp: document.querySelector("#whatsapp").value,
    is_active: document.querySelector("#isActive").checked,
  };

  const url = playerId ? `/api/players/${playerId}` : "/api/players";
  const method = playerId ? "PUT" : "POST";

  try {
    await requestJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    resetForm();
    await loadPlayers();
    showMessage(playerId ? "Jogador atualizado." : "Jogador cadastrado.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

cancelEditButton.addEventListener("click", resetForm);

generateTeamsButton.addEventListener("click", async () => {
  const playersPerTeam = Number(document.querySelector("#playersPerTeam").value);

  try {
    const result = await requestJson("/api/teams/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players_per_team: playersPerTeam }),
    });
    currentTeams = result.teams.map((team) => ({ ...team, players: [...team.players] }));
    renderTeams();
    saveMatchButton.classList.remove("hidden");
    showMessage("Times gerados com sucesso.");
  } catch (error) {
    currentTeams = [];
    teamsResult.innerHTML = "";
    saveMatchButton.classList.add("hidden");
    showMessage(error.message, true);
  }
});
mobileGenerateTeamsButton?.addEventListener("click", () => generateTeamsButton.click());
mobileHistoryButton?.addEventListener("click", () => showView("history"));
mobilePlayersBackButton?.addEventListener("click", () => showView("home"));
mobileAddPlayerFab?.addEventListener("click", () => mobilePlayerModal?.classList.remove("hidden"));
mobilePlayersSearch?.addEventListener("input", (event) => {
  mobilePlayersQuery = event.target.value || "";
  renderMobilePlayers();
});
mobileFilterTabs.forEach((button) => {
  button.addEventListener("click", () => {
    mobilePlayersFilter = button.dataset.filter || "all";
    mobileFilterTabs.forEach((item) => item.classList.toggle("active", item === button));
    renderMobilePlayers();
  });
});
mobilePlayerForm?.addEventListener("submit", submitMobilePlayer);

saveMatchButton.addEventListener("click", async () => {
  if (!currentTeams.length) {
    showMessage("Gere os times antes de salvar a pelada.", true);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const title = `Pelada ${formatDate(today)}`;
  const payload = {
    date: today,
    title,
    teams: currentTeams.map((team) => ({
      name: team.name,
      total_rating: calculateTeamRating(team),
      is_team_of_the_week: false,
      players: team.players.map((player) => ({
        player_id: player.id,
        goals: 0,
        assists: 0,
      })),
    })),
  };

  try {
    const match = await requestJson("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadMatches();
    showMessage("Pelada salva no historico.");
    renderShareMatch(match);
    showView("share");
  } catch (error) {
    showMessage(error.message, true);
  }
});

async function loadPlayers() {
  try {
    players = await requestJson("/api/players");
    renderPlayers();
    renderManagement();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadMatches() {
  try {
    matches = await requestJson("/api/matches");
    initializeCollapsedMatchMonths();
    renderMatches();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadRankings() {
  try {
    rankings = await requestJson("/api/rankings/summary");
    renderRankings(rankings);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && url !== "/api/auth/me") {
      showAuthView();
    }
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(" ")
      : data.detail || "Nao foi possivel concluir a acao.";
    throw new Error(detail);
  }

  return data;
}

async function initializeAuth() {
  try {
    const me = await requestJson("/api/auth/me");
    showAppView(me);
    loadPlayers();
  } catch {
    showAuthView();
  }
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  loginTabButton.classList.toggle("active", isLogin);
  registerTabButton.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
}

function showAuthView() {
  authView.classList.remove("hidden");
  appContent.classList.add("hidden");
}

function showAppView(me) {
  authView.classList.add("hidden");
  appContent.classList.remove("hidden");
  if (me?.pelada?.name && peladaHeader) {
    peladaHeader.textContent = me.pelada.name;
  }
}

async function submitLogin(event) {
  event.preventDefault();
  try {
    const me = await requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.querySelector("#loginEmail").value,
        password: document.querySelector("#loginPassword").value,
      }),
    });
    showAppView(me);
    loadPlayers();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function submitRegister(event) {
  event.preventDefault();
  try {
    const me = await requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.querySelector("#registerName").value,
        email: document.querySelector("#registerEmail").value,
        password: document.querySelector("#registerPassword").value,
        pelada_name: document.querySelector("#registerPeladaName").value || null,
      }),
    });
    showAppView(me);
    loadPlayers();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function logout() {
  await requestJson("/api/auth/logout", { method: "POST" });
  showAuthView();
}

function renderPlayers() {
  totalPlayers.textContent = players.length;
  activePlayers.textContent = players.filter((player) => player.is_active).length;
  if (mobileTotalPlayers) {
    mobileTotalPlayers.textContent = players.length;
  }
  if (mobileActivePlayers) {
    mobileActivePlayers.textContent = players.filter((player) => player.is_active).length;
  }
  renderMobilePlayers();

  if (!players.length) {
    playersList.innerHTML = '<div class="empty-state">Nenhum jogador cadastrado ainda.</div>';
    return;
  }

  playersList.innerHTML = players
    .map(
      (player) => `
        <article class="player-row ${player.is_active ? "active" : ""}">
          <input class="player-check" type="checkbox" ${player.is_active ? "checked" : ""} aria-label="Confirmar ${escapeHtml(player.name)}" onchange="togglePlayer(${player.id})" />
          <div class="player-main">
            <button class="link-button player-name" type="button" onclick="openPlayerProfile(${player.id})">${escapeHtml(player.name)}</button>
            <div class="player-meta">
              <span class="pill">${formatPosition(player.position)}</span>
              <span class="pill rating">Rating ${formatRating(player.rating)}</span>
              <span class="pill">${formatBillingType(player.billing_type)}</span>
              <span class="pill ${player.has_paid ? "success" : "pending"}">${player.has_paid ? "Pago" : "Pendente"}</span>
              <span class="pill">${player.is_active ? "Confirmado" : "Fora da lista"}</span>
            </div>
          </div>
          <div class="row-actions">
            <button class="ghost-button" type="button" onclick="startEdit(${player.id})">Editar</button>
            <button class="danger-button" type="button" onclick="deletePlayer(${player.id})">Excluir</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderMobilePlayers() {
  if (!mobilePlayersList || !mobilePlayersCount) return;
  mobilePlayersCount.textContent = players.length;

  const query = mobilePlayersQuery.trim().toLowerCase();
  const filtered = players.filter((player) => {
    const byFilter =
      mobilePlayersFilter === "all" ||
      (mobilePlayersFilter === "confirmed" && player.is_active) ||
      (mobilePlayersFilter === "pending" && !player.is_active);
    const bySearch = !query || player.name.toLowerCase().includes(query);
    return byFilter && bySearch;
  });

  if (!filtered.length) {
    mobilePlayersList.innerHTML = '<div class="empty-state">Nenhum jogador encontrado.</div>';
    return;
  }

  mobilePlayersList.innerHTML = filtered
    .map(
      (player) => `
      <article class="mobile-player-row">
        <div class="mobile-player-avatar">${escapeHtml(player.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</div>
        <div class="mobile-player-main">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${formatPosition(player.position)}</span>
          <small>⭐ ${formatRating(player.rating)}</small>
        </div>
        <button class="mobile-player-check ${player.is_active ? "checked" : ""}" type="button" onclick="togglePlayer(${player.id})">${player.is_active ? "✓" : ""}</button>
      </article>
    `,
    )
    .join("");
}

async function submitMobilePlayer(event) {
  event.preventDefault();
  const payload = {
    name: document.querySelector("#mobileName").value,
    position: document.querySelector("#mobilePosition").value,
    rating: Number(document.querySelector("#mobileRating").value),
    billing_type: document.querySelector("#mobileBillingType").value,
    has_paid: false,
    whatsapp: document.querySelector("#mobileWhatsapp").value,
    is_active: document.querySelector("#mobileIsActive").checked,
  };

  try {
    await requestJson("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    mobilePlayerForm.reset();
    document.querySelector("#mobileRating").value = 3;
    closeMobilePlayerModal();
    await loadPlayers();
    showMessage("Jogador cadastrado.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

window.closeMobilePlayerModal = () => {
  mobilePlayerModal?.classList.add("hidden");
};

function renderManagement() {
  if (!managementSummary || !managementList) {
    return;
  }

  const summary = calculateManagementSummary();
  managementSummary.innerHTML = `
    ${managementMetric("Jogadores", players.length)}
    ${managementMetric("Mensalistas pagos", summary.mensalistaPaid)}
    ${managementMetric("Mensalistas pendentes", summary.mensalistaPending)}
    ${managementMetric("Diaristas pagos", summary.diaristaPaid)}
    ${managementMetric("Diaristas pendentes", summary.diaristaPending)}
  `;

  if (!players.length) {
    managementList.innerHTML = '<div class="empty-state">Nenhum jogador cadastrado ainda.</div>';
    return;
  }

  managementList.innerHTML = `
    <div class="management-table-wrap">
      <table class="management-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th>Presenca</th>
            <th>Cobranca</th>
            <th>Pagamento</th>
            <th>WhatsApp</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(renderManagementRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderManagementRow(player) {
  return `
    <tr>
      <td>
        <button class="link-button strong-link" type="button" onclick="openPlayerProfile(${player.id})">${escapeHtml(player.name)}</button>
        <div class="table-subtext">${formatPosition(player.position)} - Rating ${formatRating(player.rating)}</div>
      </td>
      <td>
        <span class="pill ${player.is_active ? "success" : ""}">${player.is_active ? "Confirmado" : "Fora da lista"}</span>
      </td>
      <td>
        <select class="inline-select" onchange="updatePlayerFields(${player.id}, { billing_type: this.value })">
          <option value="diarista" ${player.billing_type === "diarista" ? "selected" : ""}>Diarista</option>
          <option value="mensalista" ${player.billing_type === "mensalista" ? "selected" : ""}>Mensalista</option>
        </select>
      </td>
      <td>
        <button class="${player.has_paid ? "primary-button" : "ghost-button"} compact-button" type="button" onclick="updatePlayerFields(${player.id}, { has_paid: ${!player.has_paid} })">
          ${player.has_paid ? "Pago" : "Pendente"}
        </button>
      </td>
      <td>${renderWhatsAppLink(player.whatsapp)}</td>
      <td>
        <button class="ghost-button compact-button" type="button" onclick="startEdit(${player.id})">Editar</button>
      </td>
    </tr>
  `;
}

function calculateManagementSummary() {
  return players.reduce(
    (summary, player) => {
      const billingType = player.billing_type || "diarista";
      const key = `${billingType}${player.has_paid ? "Paid" : "Pending"}`;
      summary[key] += 1;
      return summary;
    },
    {
      mensalistaPaid: 0,
      mensalistaPending: 0,
      diaristaPaid: 0,
      diaristaPending: 0,
    },
  );
}

function managementMetric(label, value) {
  return `
    <article class="metric-card management-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function renderWhatsAppLink(whatsapp) {
  const link = buildWhatsAppLink(whatsapp);
  if (!link) {
    return '<span class="muted-text">Nao informado</span>';
  }

  return `<a class="whatsapp-link" href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(whatsapp)}</a>`;
}

function renderTeams() {
  if (!currentTeams.length) {
    teamsResult.innerHTML = "";
    saveMatchButton.classList.add("hidden");
    return;
  }

  const teamsHtml = currentTeams
    .map(
      (team, teamIndex) => `
        <article class="team-card">
          <header>
            <div>
              <h3>${escapeHtml(team.name)}</h3>
              <div class="team-meta">
                <span class="pill">${team.players.length}/${team.capacity} jogadores</span>
                <span class="pill rating">Rating ${formatRating(calculateTeamRating(team))}</span>
                ${team.is_incomplete ? '<span class="pill incomplete">Incompleto</span>' : ""}
              </div>
            </div>
          </header>
          <div class="team-list">
            ${team.players
              .map(
                (player) => `
                  <div class="team-player generated-player">
                    <div>
                      <button class="link-button strong-link" type="button" onclick="openPlayerProfile(${player.id})">${escapeHtml(player.name)}</button>
                      <div class="team-meta">
                        <span class="pill">${formatPosition(player.position)}</span>
                        <span class="pill rating">${formatRating(player.rating)}</span>
                      </div>
                    </div>
                    <label class="compact-select">
                      Mover
                      <select onchange="moveGeneratedPlayer(${player.id}, ${teamIndex}, Number(this.value))">
                        ${currentTeams
                          .map(
                            (_, optionIndex) =>
                              `<option value="${optionIndex}" ${optionIndex === teamIndex ? "selected" : ""}>Time ${optionIndex + 1}</option>`,
                          )
                          .join("")}
                      </select>
                    </label>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");

  teamsResult.innerHTML = `<div class="teams-grid">${teamsHtml}</div>`;
}

function renderMatches() {
  if (!matches.length) {
    matchesList.innerHTML = '<div class="empty-state">Nenhuma pelada salva ainda.</div>';
    matchDetails.innerHTML = "";
    return;
  }

  const groupedMatches = matches.reduce((groups, match) => {
    const key = getMonthKey(match.date);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(match);
    return groups;
  }, new Map());

  matchesList.innerHTML = [...groupedMatches.entries()]
    .map(
      ([monthKey, monthMatches]) => `
        <section class="match-month-group">
          <button class="match-month-heading" type="button" onclick="toggleMatchMonth('${monthKey}')" aria-expanded="${!collapsedMatchMonths.has(monthKey)}">
            <span class="month-title">${formatMonthLabel(monthKey)}</span>
            <span class="month-meta">
              <span>${monthMatches.length} pelada${monthMatches.length === 1 ? "" : "s"}</span>
              <span class="month-chevron">${collapsedMatchMonths.has(monthKey) ? "+" : "-"}</span>
            </span>
          </button>
          <div class="match-month-list ${collapsedMatchMonths.has(monthKey) ? "hidden" : ""}">
            ${monthMatches.map(renderMatchRow).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function initializeCollapsedMatchMonths() {
  if (hasInitializedMatchMonths) {
    return;
  }

  collapsedMatchMonths = new Set(matches.map((match) => getMonthKey(match.date)));
  hasInitializedMatchMonths = true;
}

window.toggleMatchMonth = (monthKey) => {
  if (collapsedMatchMonths.has(monthKey)) {
    collapsedMatchMonths.delete(monthKey);
  } else {
    collapsedMatchMonths.add(monthKey);
  }
  renderMatches();
};

function renderMatchRow(match) {
  return `
    <article class="match-row">
      <div>
        <h3>${escapeHtml(match.title)}</h3>
        <div class="player-meta">
          <span class="pill">${formatDate(match.date)}</span>
          <span class="pill">${match.team_count} times</span>
          <span class="pill">${match.player_count} jogadores</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="secondary-button" type="button" onclick="openMatchDetails(${match.id})">Ver detalhes</button>
        <button class="ghost-button" type="button" onclick="openShareMatch(${match.id})">Print</button>
        <button class="danger-button" type="button" onclick="deleteMatch(${match.id})">Excluir</button>
      </div>
    </article>
  `;
}

function renderRankings(data) {
  const scorers = data.scorers.players;
  const assists = data.assists.players;
  const hasStats = scorers.length || assists.length;

  rankingsEmptyState.classList.toggle("hidden", hasStats);
  rankingsContent.innerHTML = hasStats
    ? `
      ${renderRankingSection("Artilheiros", "Gols", "Media gols", scorers, "goals", "goals_per_match")}
      ${renderRankingSection("Assistencias", "Assist.", "Media assist.", assists, "assists", "assists_per_match")}
    `
    : "";
}

function renderRankingSection(title, totalLabel, averageLabel, rows, totalField, averageField) {
  if (!rows.length) {
    return `
      <section class="ranking-section">
        <div class="ranking-heading">
          <h3>${title}</h3>
        </div>
        <div class="empty-state">Ainda nao ha dados para este ranking.</div>
      </section>
    `;
  }

  return `
    <section class="ranking-section">
      <div class="ranking-heading">
        <h3>${title}</h3>
        <span>${rows.length} jogadores</span>
      </div>
      <div class="ranking-table-wrap">
        <table class="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Posicao</th>
              <th>Rating</th>
              <th>Jogos</th>
              <th>${totalLabel}</th>
              <th>${averageLabel}</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (player, index) => `
                  <tr class="${index < 3 ? `top-rank top-${index + 1}` : ""}">
                    <td><span class="rank-badge">${index + 1}</span></td>
                    <td>
                      <button class="link-button strong-link" type="button" onclick="openPlayerProfile(${player.player_id})">${escapeHtml(player.name)}</button>
                    </td>
                    <td>${formatPosition(player.position)}</td>
                    <td>${formatRating(player.rating)}</td>
                    <td>${player.matches_played}</td>
                    <td><strong>${player[totalField]}</strong></td>
                    <td>${formatDecimal(player[averageField])}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function openMatchDetails(matchId) {
  try {
    const match = await requestJson(`/api/matches/${matchId}`);
    renderMatchDetails(match);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function renderMatchDetails(match) {
  const teamsHtml = match.teams
    .map(
      (team) => `
        <article class="team-card stats-card ${team.is_team_of_the_week ? "team-week" : ""}">
          <header>
            <div>
              <h3>${escapeHtml(team.name)}</h3>
              <div class="team-meta">
                <span class="pill rating">Rating ${formatRating(team.total_rating)}</span>
                ${team.is_team_of_the_week ? '<span class="pill success">Melhor time</span>' : ""}
              </div>
            </div>
            <label class="radio-row">
              <input type="radio" name="teamOfWeek" value="${team.id}" ${team.is_team_of_the_week ? "checked" : ""} />
              Melhor
            </label>
          </header>
          <div class="stats-list">
            ${team.players
              .map(
                (matchPlayer) => `
                  <div class="stats-player">
                    <button class="link-button strong-link" type="button" onclick="openPlayerProfile(${matchPlayer.player_id})">${escapeHtml(matchPlayer.player.name)}</button>
                    <label>
                      Gols
                      <input data-player-stat-id="${matchPlayer.id}" data-stat="goals" type="number" min="0" value="${matchPlayer.goals}" />
                    </label>
                    <label>
                      Assist.
                      <input data-player-stat-id="${matchPlayer.id}" data-stat="assists" type="number" min="0" value="${matchPlayer.assists}" />
                    </label>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");

  matchDetails.innerHTML = `
    <div class="details-heading">
      <div>
        <p class="eyebrow">Detalhes da pelada</p>
        <h2>${escapeHtml(match.title)}</h2>
        <p>${formatDate(match.date)}</p>
      </div>
      <div class="row-actions">
        <button class="ghost-button" type="button" onclick="openShareMatch(${match.id})">Ver para print</button>
        <button class="primary-button" type="button" onclick="saveMatchStats(${match.id})">Salvar estatisticas</button>
      </div>
    </div>
    <div class="teams-grid">${teamsHtml}</div>
  `;
}

window.openShareMatch = async (matchId) => {
  try {
    const match = await requestJson(`/api/matches/${matchId}`);
    renderShareMatch(match);
    showView("share");
  } catch (error) {
    showMessage(error.message, true);
  }
};

function renderShareMatch(match) {
  const teamsHtml = match.teams
    .map(
      (team) => `
        <article class="share-team ${team.is_team_of_the_week ? "team-week" : ""}">
          <header>
            <h3>${escapeHtml(team.name)}</h3>
            <span>${team.players.length} jogadores</span>
          </header>
          <ol>
            ${team.players
              .map(
                (matchPlayer) => `
                  <li>
                    <strong>${escapeHtml(matchPlayer.player.name)}</strong>
                    <span>${formatPosition(matchPlayer.player.position)}</span>
                  </li>
                `,
              )
              .join("")}
          </ol>
        </article>
      `,
    )
    .join("");

  shareNavButton.classList.remove("hidden");
  shareContent.innerHTML = `
    <div class="share-sheet">
      <header class="share-header">
        <div>
          <p>Pelada Manager</p>
          <h1>${escapeHtml(match.title)}</h1>
          <span>${formatDate(match.date)}</span>
        </div>
      </header>
      <div class="share-teams-grid">${teamsHtml}</div>
    </div>
  `;
}

window.saveMatchStats = async (matchId) => {
  const statInputs = [...document.querySelectorAll("[data-player-stat-id]")];
  const statsByPlayer = new Map();
  statInputs.forEach((input) => {
    const playerId = Number(input.dataset.playerStatId);
    const current = statsByPlayer.get(playerId) || { id: playerId, goals: 0, assists: 0 };
    current[input.dataset.stat] = Number(input.value);
    statsByPlayer.set(playerId, current);
  });

  const selectedTeam = document.querySelector('input[name="teamOfWeek"]:checked');
  const payload = {
    team_of_the_week_id: selectedTeam ? Number(selectedTeam.value) : null,
    players: [...statsByPlayer.values()],
  };

  try {
    const match = await requestJson(`/api/matches/${matchId}/stats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    renderMatchDetails(match);
    showMessage("Estatisticas salvas.");
  } catch (error) {
    showMessage(error.message, true);
  }
};

window.togglePlayer = async (playerId) => {
  try {
    await requestJson(`/api/players/${playerId}/toggle-active`, { method: "PATCH" });
    await loadPlayers();
  } catch (error) {
    showMessage(error.message, true);
  }
};

window.updatePlayerFields = async (playerId, changes) => {
  const player = players.find((item) => item.id === playerId);
  if (!player) return;

  const payload = {
    name: player.name,
    position: player.position,
    rating: Number(player.rating),
    billing_type: player.billing_type || "diarista",
    has_paid: Boolean(player.has_paid),
    whatsapp: player.whatsapp || "",
    is_active: Boolean(player.is_active),
    ...changes,
  };

  try {
    await requestJson(`/api/players/${playerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadPlayers();
    showMessage("Gestao atualizada.");
  } catch (error) {
    showMessage(error.message, true);
    renderManagement();
  }
};

window.startEdit = (playerId) => {
  const player = players.find((item) => item.id === playerId);
  if (!player) return;

  document.querySelector("#playerId").value = player.id;
  document.querySelector("#name").value = player.name;
  document.querySelector("#position").value = player.position;
  document.querySelector("#rating").value = player.rating;
  document.querySelector("#billingType").value = player.billing_type || "diarista";
  document.querySelector("#whatsapp").value = player.whatsapp || "";
  document.querySelector("#isActive").checked = player.is_active;
  formTitle.textContent = "Editar jogador";
  cancelEditButton.classList.remove("hidden");
  showView("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deletePlayer = async (playerId) => {
  const player = players.find((item) => item.id === playerId);
  const confirmed = window.confirm(`Excluir ${player?.name || "jogador"}?`);
  if (!confirmed) return;

  try {
    await requestJson(`/api/players/${playerId}`, { method: "DELETE" });
    await loadPlayers();
    currentTeams = [];
    teamsResult.innerHTML = "";
    saveMatchButton.classList.add("hidden");
    showMessage("Jogador excluido.");
  } catch (error) {
    showMessage(error.message, true);
  }
};

window.deleteMatch = async (matchId) => {
  const confirmed = window.confirm("Excluir esta pelada do historico?");
  if (!confirmed) return;

  try {
    await requestJson(`/api/matches/${matchId}`, { method: "DELETE" });
    await loadMatches();
    matchDetails.innerHTML = "";
    showMessage("Pelada excluida.");
  } catch (error) {
    showMessage(error.message, true);
  }
};

window.moveGeneratedPlayer = (playerId, fromTeamIndex, toTeamIndex) => {
  if (fromTeamIndex === toTeamIndex) return;

  const fromTeam = currentTeams[fromTeamIndex];
  const toTeam = currentTeams[toTeamIndex];
  const playerIndex = fromTeam.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0 || !toTeam) return;

  const [player] = fromTeam.players.splice(playerIndex, 1);
  toTeam.players.push(player);
  renderTeams();
};

window.openPlayerProfile = async (playerId) => {
  try {
    const profile = await requestJson(`/api/players/${playerId}/profile`);
    renderPlayerProfile(profile);
    profileModal.classList.remove("hidden");
  } catch (error) {
    showMessage(error.message, true);
  }
};

window.closeProfileModal = () => {
  profileModal.classList.add("hidden");
};

function renderPlayerProfile(profile) {
  profileTitle.textContent = profile.player.name;

  profileContent.innerHTML = `
    <div class="profile-summary">
      <div>
        <strong>${escapeHtml(profile.player.name)}</strong>
        <span>${formatPosition(profile.player.position)} - Rating ${formatRating(profile.player.rating)}</span>
        <span>${formatBillingType(profile.player.billing_type)} - ${profile.player.has_paid ? "Pago" : "Pendente"}${profile.player.whatsapp ? ` - WhatsApp ${escapeHtml(profile.player.whatsapp)}` : ""}</span>
      </div>
    </div>
    <div class="stats-grid">
      ${profileMetric("Gols", profile.total_goals)}
      ${profileMetric("Assistencias", profile.total_assists)}
      ${profileMetric("Peladas", profile.total_matches)}
      ${profileMetric("Media gols", formatDecimal(profile.average_goals))}
      ${profileMetric("Media assist.", formatDecimal(profile.average_assists))}
      ${profileMetric("Time da semana", profile.team_of_the_week_count)}
    </div>
    <div class="history-table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Time</th>
            <th>Gols</th>
            <th>Assist.</th>
            <th>Destaque</th>
          </tr>
        </thead>
        <tbody>
          ${
            profile.history.length
              ? profile.history
                  .map(
                    (item) => `
                      <tr class="${item.was_in_team_of_the_week ? "highlight-row" : ""}">
                        <td>${formatDate(item.date)}</td>
                        <td>${escapeHtml(item.team_name)}</td>
                        <td>${item.goals}</td>
                        <td>${item.assists}</td>
                        <td>${item.was_in_team_of_the_week ? "Time da semana" : "-"}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : '<tr><td colspan="5">Nenhuma pelada salva para este jogador.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
}

function profileMetric(label, value) {
  return `
    <div class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function showView(view) {
  const isMobile = window.matchMedia("(max-width: 860px)").matches;
  const isManagement = view === "management";
  const isHistory = view === "history";
  const isRankings = view === "rankings";
  const isShare = view === "share";
  const showMobilePlayers = isMobile && isManagement;
  homeView.classList.toggle("hidden", isManagement || isHistory || isRankings || isShare || showMobilePlayers);
  managementView.classList.toggle("hidden", !(isManagement && !showMobilePlayers));
  mobilePlayersView?.classList.toggle("hidden", !showMobilePlayers);
  mobileHomeShell?.classList.toggle("hidden", !isMobile || view !== "home");
  historyView.classList.toggle("hidden", !isHistory);
  rankingsView.classList.toggle("hidden", !isRankings);
  shareView.classList.toggle("hidden", !isShare);
  homeNavButton.classList.toggle("active", view === "home");
  managementNavButton.classList.toggle("active", isManagement);
  historyNavButton.classList.toggle("active", isHistory);
  rankingsNavButton.classList.toggle("active", isRankings);
  shareNavButton.classList.toggle("active", isShare);
  if (isManagement) {
    if (showMobilePlayers) {
      renderMobilePlayers();
    } else {
      renderManagement();
    }
  }
  if (isHistory) {
    loadMatches();
  }
  if (isRankings) {
    loadRankings();
  }
}

function resetForm() {
  playerForm.reset();
  document.querySelector("#playerId").value = "";
  document.querySelector("#rating").value = 3;
  document.querySelector("#billingType").value = "diarista";
  document.querySelector("#whatsapp").value = "";
  formTitle.textContent = "Novo jogador";
  cancelEditButton.classList.add("hidden");
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");

  window.clearTimeout(showMessage.timeout);
  showMessage.timeout = window.setTimeout(() => {
    message.classList.add("hidden");
  }, 4200);
}

function calculateTeamRating(team) {
  return team.players.reduce((sum, player) => sum + Number(player.rating), 0);
}

function formatPosition(position) {
  const labels = {
    defesa: "Defesa",
    meio: "Meio",
    ataque: "Ataque",
  };
  return labels[position] || position;
}

function formatBillingType(billingType) {
  const labels = {
    mensalista: "Mensalista",
    diarista: "Diarista",
  };
  return labels[billingType] || "Diarista";
}

function buildWhatsAppLink(whatsapp) {
  const digits = String(whatsapp || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  const phoneNumber = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phoneNumber}`;
}

function formatRating(rating) {
  return Number(rating).toFixed(1).replace(".0", "");
}

function formatDecimal(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function formatDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function getMonthKey(value) {
  return String(value).slice(0, 7);
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const labels = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Marco",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  return `${labels[month] || month} ${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
