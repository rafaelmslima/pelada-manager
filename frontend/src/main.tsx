import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";
import { BottomNav } from "./components/BottomNav";
import { PlayerProfileModal } from "./components/PlayerProfileModal";
import { AuthScreen } from "./screens/AuthScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { HistoryView } from "./views/HistoryView";
import { HomeView } from "./views/HomeView";
import { PlayersView } from "./views/PlayersView";
import { ProfileView } from "./views/ProfileView";
import { RankingsView } from "./views/RankingsView";
import { ShareView } from "./views/ShareView";
import type { AuthMe, MatchListItem, MatchRead, Player, PlayerProfile, RankingsSummary, TeamGenerateResponse } from "./types";
import { formatDate } from "./format";
import "./styles.css";

export type View = "home" | "players" | "history" | "rankings" | "profile" | "share";

function pathToView(pathname: string): View {
  const s = pathname.replace(/^\/+/, "").split("/")[0];
  if (s === "jogadores") return "players";
  if (s === "historico") return "history";
  if (s === "rankings") return "rankings";
  if (s === "perfil") return "profile";
  if (s === "print") return "share";
  return "home";
}

function viewToPath(view: View): string {
  return { home: "/", players: "/jogadores", history: "/historico", rankings: "/rankings", profile: "/perfil", share: "/print" }[view];
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
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const view = pathToView(location.pathname);
  const setView = useCallback((v: View) => navigate(viewToPath(v)), [navigate]);

  const flash = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { setSession(null); return; }
    flash(error instanceof Error ? error.message : "Não foi possível concluir a ação.", true);
  }, [flash]);

  const loadPlayers = useCallback(async () => {
    try { setPlayers(await api.listPlayers()); } catch (e) { handleError(e); }
  }, [handleError]);

  const loadMatches = useCallback(async () => {
    try { setMatches(await api.listMatches()); } catch (e) { handleError(e); }
  }, [handleError]);

  const loadRankings = useCallback(async () => {
    try { setRankings(await api.rankings()); } catch (e) { handleError(e); }
  }, [handleError]);

  useEffect(() => {
    api.me()
      .then((me) => { setSession(me); return api.listPlayers(); })
      .then(setPlayers)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  }, []);

  if (loading) return <LoadingScreen />;
  if (!session) return <AuthScreen onLogin={(me) => { setSession(me); loadPlayers(); }} onMessage={flash} />;

  const logout = async () => {
    await api.logout().catch(() => null);
    setSession(null);
    setPlayers([]);
    setTeams(null);
    setView("home");
  };

  const generateTeams = async (playersPerTeam: number) => {
    try {
      setTeams(await api.generateTeams(playersPerTeam));
      flash("Times gerados com sucesso.");
    } catch (error) {
      setTeams(null);
      handleError(error);
    }
  };

  const saveMatch = async () => {
    if (!teams?.teams.length) { flash("Gere os times antes de salvar a pelada.", true); return; }
    const today = new Date().toISOString().slice(0, 10);
    try {
      const match = await api.createMatch({
        date: today,
        title: `Pelada ${formatDate(today)}`,
        teams: teams.teams.map((t) => ({
          name: t.name,
          total_rating: t.total_rating,
          is_team_of_the_week: false,
          players: t.players.map((p) => ({ player_id: p.id, goals: 0, assists: 0 })),
        })),
      });
      setShareMatch(match);
      setView("share");
      loadMatches();
      flash("Pelada salva no histórico.");
    } catch (error) { handleError(error); }
  };

  const openProfile = async (id: number) => {
    try { setProfile(await api.playerProfile(id)); } catch (e) { handleError(e); }
  };

  const navBottom = view !== "share";

  return (
    <div
      className="flex flex-col mx-auto relative"
      style={{
        maxWidth: 480,
        minHeight: "100dvh",
        backgroundColor: "var(--page)",
        paddingBottom: navBottom ? "calc(64px + env(safe-area-inset-bottom))" : 0,
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-card-sm px-4 py-3 font-jakarta text-[12px] font-bold shadow-lg"
          style={{
            backgroundColor: toast.error ? "var(--abs-bg)" : "var(--green-bg)",
            color: toast.error ? "var(--abs-t)" : "var(--green-b)",
            maxWidth: "calc(min(480px, 100vw) - 40px)",
            width: "100%",
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Views */}
      {view === "home" && (
        <HomeView
          session={session}
          players={players}
          teams={teams}
          onGenerate={generateTeams}
          onSave={saveMatch}
          onTeamsChange={setTeams}
        />
      )}
      {view === "players" && (
        <PlayersView
          players={players}
          defaultBilling={session.pelada.default_billing_type}
          onPlayersChange={setPlayers}
          onError={handleError}
          onMessage={flash}
          onProfile={openProfile}
        />
      )}
      {view === "history" && (
        <HistoryView
          matches={matches}
          onReload={loadMatches}
          onShare={async (id) => {
            try { setShareMatch(await api.getMatch(id)); setView("share"); } catch (e) { handleError(e); }
          }}
          onDelete={async (id) => {
            if (!window.confirm("Excluir esta pelada do histórico?")) return;
            try { await api.deleteMatch(id); loadMatches(); flash("Pelada excluída."); } catch (e) { handleError(e); }
          }}
          onStatsSaved={() => { flash("Estatísticas salvas."); }}
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
      {view === "share" && (
        <ShareView
          match={shareMatch}
          onBack={() => { setView("history"); loadMatches(); }}
        />
      )}

      {/* Bottom Nav */}
      {navBottom && (
        <BottomNav
          view={view}
          setView={setView}
          preload={{ matches: loadMatches, rankings: loadRankings }}
        />
      )}

      {/* Player Profile Modal */}
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
