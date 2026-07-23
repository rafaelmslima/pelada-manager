import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Sheet } from '@/components/Sheet';
import { PrimaryButton } from '@/components/form';
import { api } from '@/lib/api';
import { formatPosition, formatRating } from '@/lib/format';
import { cancelTimerAlarm, scheduleTimerAlarm } from '@/lib/matchTimer';
import type { MatchPlayer, MatchRead, MatchTeam, RoundsOverview } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

type BenchEntry = { mp: MatchPlayer; teamId: number; teamName: string };

function ratingSum(players: MatchPlayer[]): number {
  return players.reduce((total, mp) => total + mp.player.rating, 0);
}

/**
 * Escolhe `k` jogadores do banco para completar o time menor deixando a soma de
 * notas o mais próxima possível da do time maior (equilíbrio por rating).
 */
function chooseBalancing(bench: BenchEntry[], k: number, smallerBaseTotal: number, largerTotal: number): number[] {
  const pool = bench.slice();
  const chosen: number[] = [];
  let remainingIdeal = largerTotal - smallerBaseTotal;
  for (let stepsLeft = k; stepsLeft > 0 && pool.length > 0; stepsLeft -= 1) {
    const targetPer = remainingIdeal / stepsLeft;
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      const diff = Math.abs(pool[i].mp.player.rating - targetPer);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    chosen.push(picked.mp.player_id);
    remainingIdeal -= picked.mp.player.rating;
  }
  return chosen;
}

/** Sugere reforços do banco para o time com menos jogadores, até empatar o número. */
function suggestReinforcements(teamA: MatchTeam, teamB: MatchTeam, bench: BenchEntry[]): { aIds: number[]; bIds: number[] } {
  const diff = teamA.players.length - teamB.players.length;
  if (diff === 0 || bench.length === 0) return { aIds: [], bIds: [] };
  const k = Math.min(Math.abs(diff), bench.length);
  const totalA = ratingSum(teamA.players);
  const totalB = ratingSum(teamB.players);
  if (diff > 0) return { aIds: [], bIds: chooseBalancing(bench, k, totalB, totalA) };
  return { aIds: chooseBalancing(bench, k, totalA, totalB), bIds: [] };
}

type Stats = Record<number, { goals: number; assists: number }>;

// Estado persistido do confronto em andamento (salvo no backend para retomar).
type LiveBlob = {
  teamAId: number;
  teamBId: number;
  roundDurationSec: number;
  endsAt: number | null;
  pausedRemaining: number | null;
  running: boolean;
  stats: Stats;
  teamGoalsA: number;
  teamGoalsB: number;
  borrows: Record<number, number[]>;
};

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function remainingFromBlob(blob: LiveBlob, now: number): number {
  if (blob.running && blob.endsAt != null) return Math.max(0, blob.endsAt - now);
  if (blob.pausedRemaining != null) return blob.pausedRemaining;
  return blob.roundDurationSec * 1000;
}

/**
 * Sugere o próximo desafiante (rodízio "quem ganha fica"): o time que está
 * descansando (nem venceu, nem acabou de perder), priorizando quem jogou menos.
 * Se só sobrou o perdedor (ex.: 2 times), sugere ele mesmo para a revanche.
 */
function suggestNextChallenger(
  teams: MatchTeam[],
  overview: RoundsOverview | null,
  winnerId: number,
  loserId: number,
): number | null {
  const others = teams.filter((t) => t.id !== winnerId);
  if (others.length === 0) return null;
  const resting = others.filter((t) => t.id !== loserId);
  const pool = resting.length > 0 ? resting : others;
  const playedById = new Map((overview?.standings ?? []).map((s) => [s.team_id, s.played]));
  return pool
    .slice()
    .sort((a, b) => (playedById.get(a.id) ?? 0) - (playedById.get(b.id) ?? 0))[0].id;
}

export default function LiveMatchScreen() {
  const { matchId, resume } = useLocalSearchParams<{ matchId: string; resume?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = Number(matchId);

  const [match, setMatch] = useState<MatchRead | null>(null);
  const [overview, setOverview] = useState<RoundsOverview | null>(null);
  const [mode, setMode] = useState<'lobby' | 'playing'>('lobby');
  const [resenhaOpen, setResenhaOpen] = useState(false);

  // Seleção do confronto
  const [teamAId, setTeamAId] = useState<number | null>(null);
  const [teamBId, setTeamBId] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState('10');

  // Reforços (completar times com jogadores do banco). teamId -> player_ids emprestados.
  const [reinforceEnabled, setReinforceEnabled] = useState(false);
  const [borrows, setBorrows] = useState<Record<number, number[]>>({});
  const [reforcoSheet, setReforcoSheet] = useState<null | 'A' | 'B'>(null);

  // Confronto em andamento
  const [roundDurationSec, setRoundDurationSec] = useState(600);
  const [stats, setStats] = useState<Stats>({});
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [alarmId, setAlarmId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Gols avulsos (sem marcar quem fez) por lado.
  const [teamGoalsA, setTeamGoalsA] = useState(0);
  const [teamGoalsB, setTeamGoalsB] = useState(0);

  // Confronto em andamento carregado do backend (para retomar).
  const [pendingResume, setPendingResume] = useState<LiveBlob | null>(null);

  const loadOverview = useCallback(() => {
    api.getRounds(id).then(setOverview).catch(() => {});
  }, [id]);

  useEffect(() => {
    api
      .getMatch(id)
      .then((m) => {
        setMatch(m);
        if (m.live_state) {
          try {
            setPendingResume(JSON.parse(m.live_state) as LiveBlob);
          } catch {
            /* estado corrompido: ignora */
          }
        }
      })
      .catch(() => {});
    loadOverview();
  }, [id, loadOverview]);

  useEffect(() => {
    const active = running || (mode === 'lobby' && !!pendingResume?.running);
    if (!active) return;
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [running, mode, pendingResume]);

  useEffect(() => {
    if (running && endsAt != null && nowTick >= endsAt) {
      setRunning(false);
      setPausedRemaining(0);
    }
  }, [running, endsAt, nowTick]);

  const teamA = match?.teams.find((t) => t.id === teamAId) ?? null;
  const teamB = match?.teams.find((t) => t.id === teamBId) ?? null;

  // Índice de todos os jogadores da partida (resolve reforços vindos do banco).
  const mpByPlayerId = useMemo(() => {
    const map = new Map<number, BenchEntry>();
    match?.teams.forEach((t) => t.players.forEach((mp) => map.set(mp.player_id, { mp, teamId: t.id, teamName: t.name })));
    return map;
  }, [match]);

  // Banco = jogadores dos times que não estão neste confronto.
  const bench = useMemo<BenchEntry[]>(() => {
    if (!match || teamAId == null || teamBId == null) return [];
    return match.teams
      .filter((t) => t.id !== teamAId && t.id !== teamBId)
      .flatMap((t) => t.players.map((mp) => ({ mp, teamId: t.id, teamName: t.name })));
  }, [match, teamAId, teamBId]);

  const resolveBorrows = useCallback(
    (teamId: number | null): MatchPlayer[] =>
      (teamId != null ? borrows[teamId] ?? [] : [])
        .map((pid) => mpByPlayerId.get(pid)?.mp)
        .filter((mp): mp is MatchPlayer => mp != null),
    [borrows, mpByPlayerId],
  );

  // Elenco efetivo (base + reforços) — usado no placar e na persistência do confronto.
  const rosterA = useMemo(() => (teamA ? [...teamA.players, ...resolveBorrows(teamA.id)] : []), [teamA, resolveBorrows]);
  const rosterB = useMemo(() => (teamB ? [...teamB.players, ...resolveBorrows(teamB.id)] : []), [teamB, resolveBorrows]);

  const goalsA = rosterA.reduce((s, mp) => s + (stats[mp.player_id]?.goals ?? 0), 0) + teamGoalsA;
  const goalsB = rosterB.reduce((s, mp) => s + (stats[mp.player_id]?.goals ?? 0), 0) + teamGoalsB;

  const borrowedIds = useMemo(() => new Set(Object.values(borrows).flat()), [borrows]);
  const availableBench = useMemo(() => bench.filter((b) => !borrowedIds.has(b.mp.player_id)), [bench, borrowedIds]);

  // Melhor candidato para o lado aberto no sheet (equilíbrio por nota).
  const suggestedForSheet = useMemo(() => {
    if (!reforcoSheet) return null;
    const sideRoster = reforcoSheet === 'A' ? rosterA : rosterB;
    const otherRoster = reforcoSheet === 'A' ? rosterB : rosterA;
    const target = ratingSum(otherRoster) - ratingSum(sideRoster);
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const b of availableBench) {
      const diff = Math.abs(b.mp.player.rating - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = b.mp.player_id;
      }
    }
    return best;
  }, [reforcoSheet, rosterA, rosterB, availableBench]);

  // Auto-sugestão: recalcula os reforços só no lobby (não mexe num confronto em andamento).
  useEffect(() => {
    if (mode !== 'lobby') return;
    if (!reinforceEnabled || !match || teamAId == null || teamBId == null) {
      setBorrows({});
      return;
    }
    const a = match.teams.find((t) => t.id === teamAId);
    const b = match.teams.find((t) => t.id === teamBId);
    if (!a || !b) {
      setBorrows({});
      return;
    }
    const benchNow = match.teams
      .filter((t) => t.id !== teamAId && t.id !== teamBId)
      .flatMap((t) => t.players.map((mp) => ({ mp, teamId: t.id, teamName: t.name })));
    const { aIds, bIds } = suggestReinforcements(a, b, benchNow);
    setBorrows({ [teamAId]: aIds, [teamBId]: bIds });
  }, [mode, reinforceEnabled, teamAId, teamBId, match]);

  // Blob do confronto atual (persistência no backend).
  const buildBlob = useCallback((): LiveBlob | null => {
    if (teamAId == null || teamBId == null) return null;
    return { teamAId, teamBId, roundDurationSec, endsAt, pausedRemaining, running, stats, teamGoalsA, teamGoalsB, borrows };
  }, [teamAId, teamBId, roundDurationSec, endsAt, pausedRemaining, running, stats, teamGoalsA, teamGoalsB, borrows]);

  // Salva (debounced) o confronto enquanto está em andamento.
  useEffect(() => {
    if (mode !== 'playing') return;
    const blob = buildBlob();
    if (!blob) return;
    const t = setTimeout(() => api.saveLiveState(id, JSON.stringify(blob)).catch(() => {}), 700);
    return () => clearTimeout(t);
  }, [mode, buildBlob, id]);

  // Retoma um confronto salvo (card "em andamento" ou toque na notificação).
  const resumeConfronto = useCallback(
    (blob: LiveBlob) => {
      setTeamAId(blob.teamAId);
      setTeamBId(blob.teamBId);
      setRoundDurationSec(blob.roundDurationSec);
      setStats(blob.stats ?? {});
      setTeamGoalsA(blob.teamGoalsA ?? 0);
      setTeamGoalsB(blob.teamGoalsB ?? 0);
      setBorrows(blob.borrows ?? {});
      setPendingResume(null);
      const remaining =
        blob.running && blob.endsAt != null ? blob.endsAt - Date.now() : blob.pausedRemaining ?? blob.roundDurationSec * 1000;
      if (blob.running && blob.endsAt != null && remaining > 0) {
        setEndsAt(blob.endsAt);
        setPausedRemaining(null);
        setRunning(true);
        setNowTick(Date.now());
        scheduleTimerAlarm(remaining / 1000, '⏱ Fim do tempo!', 'Confronto em andamento', { matchId: id })
          .then(setAlarmId)
          .catch(() => {});
      } else {
        setEndsAt(null);
        setRunning(false);
        setPausedRemaining(Math.max(0, remaining));
      }
      setMode('playing');
    },
    [id],
  );

  // Cold start / toque na notificação com ?resume=1: entra direto no confronto.
  useEffect(() => {
    if (resume === '1' && pendingResume) resumeConfronto(pendingResume);
  }, [resume, pendingResume, resumeConfronto]);

  // Sair da tela durante o confronto: salva na hora e volta (retoma depois pelo card).
  function leavePlaying() {
    const blob = buildBlob();
    if (blob) api.saveLiveState(id, JSON.stringify(blob)).catch(() => {});
    router.back();
  }

  function addReforco(side: 'A' | 'B', playerId: number) {
    const teamId = side === 'A' ? teamAId : teamBId;
    if (teamId == null) return;
    setBorrows((prev) => {
      const cur = prev[teamId] ?? [];
      if (cur.includes(playerId)) return prev;
      return { ...prev, [teamId]: [...cur, playerId] };
    });
  }

  function removeReforco(teamId: number, playerId: number) {
    setBorrows((prev) => ({ ...prev, [teamId]: (prev[teamId] ?? []).filter((p) => p !== playerId) }));
  }

  const remainingMs = useMemo(() => {
    if (running && endsAt != null) return Math.max(0, endsAt - nowTick);
    if (pausedRemaining != null) return pausedRemaining;
    return roundDurationSec * 1000;
  }, [running, endsAt, nowTick, pausedRemaining, roundDurationSec]);
  const timeUp = mode === 'playing' && remainingMs <= 0;

  function bump(playerId: number, key: 'goals' | 'assists', delta: number) {
    setStats((prev) => {
      const cur = prev[playerId] ?? { goals: 0, assists: 0 };
      return { ...prev, [playerId]: { ...cur, [key]: Math.max(0, cur[key] + delta) } };
    });
  }

  async function startConfronto() {
    if (teamAId == null || teamBId == null || teamAId === teamBId) return;
    const secs = Math.max(1, parseInt(durationMin, 10) || 10) * 60;
    setPendingResume(null);
    setRoundDurationSec(secs);
    setStats({});
    setTeamGoalsA(0);
    setTeamGoalsB(0);
    const target = Date.now() + secs * 1000;
    setEndsAt(target);
    setPausedRemaining(null);
    setRunning(true);
    setNowTick(Date.now());
    setMode('playing');
    const aName = teamA?.name ?? 'Time A';
    const bName = teamB?.name ?? 'Time B';
    const newAlarm = await scheduleTimerAlarm(secs, '⏱ Fim do tempo!', `${aName} x ${bName}`, { matchId: id });
    setAlarmId(newAlarm);
  }

  async function togglePause() {
    if (running) {
      setPausedRemaining(endsAt != null ? Math.max(0, endsAt - Date.now()) : 0);
      setRunning(false);
      await cancelTimerAlarm(alarmId);
      setAlarmId(null);
    } else {
      const remaining = pausedRemaining ?? 0;
      if (remaining <= 0) return;
      const target = Date.now() + remaining;
      setEndsAt(target);
      setRunning(true);
      setNowTick(Date.now());
      const newAlarm = await scheduleTimerAlarm(remaining / 1000, '⏱ Fim do tempo!', `${teamA?.name} x ${teamB?.name}`, {
        matchId: id,
      });
      setAlarmId(newAlarm);
    }
  }

  async function finishConfronto() {
    if (teamAId == null || teamBId == null || !match) return;
    await cancelTimerAlarm(alarmId);
    setAlarmId(null);
    setRunning(false);

    const relevant = [...rosterA, ...rosterB];
    const payloadStats = relevant
      .map((mp) => ({ player_id: mp.player_id, ...(stats[mp.player_id] ?? { goals: 0, assists: 0 }) }))
      .filter((s) => s.goals > 0 || s.assists > 0);

    let nextOverview = overview;
    try {
      const resp = await api.createRound(id, {
        team_a_id: teamAId,
        team_b_id: teamBId,
        goals_a: goalsA,
        goals_b: goalsB,
        duration_seconds: roundDurationSec,
        stats: payloadStats,
        team_a_players: rosterA.map((mp) => mp.player_id),
        team_b_players: rosterB.map((mp) => mp.player_id),
      });
      setOverview(resp);
      nextOverview = resp;
    } catch {
      /* ignora; segue */
    }

    // Confronto encerrado: limpa o estado ao vivo pendente no backend.
    api.clearLiveState(id).catch(() => {});

    setStats({});
    setTeamGoalsA(0);
    setTeamGoalsB(0);
    setEndsAt(null);
    setPausedRemaining(null);

    if (goalsA === goalsB) {
      // Empate: sem "quem ganha fica" nem sugestão automática — o organizador escolhe.
      setTeamAId(null);
      setTeamBId(null);
    } else {
      // Quem ganha fica: vencedor vira Time A e o próximo desafiante já vem sugerido no Time B.
      const winner = goalsA > goalsB ? teamAId : teamBId;
      const loser = goalsA > goalsB ? teamBId : teamAId;
      setTeamAId(winner);
      setTeamBId(suggestNextChallenger(match.teams, nextOverview, winner, loser));
    }
    setMode('lobby');
  }

  function encerrarPelada() {
    setResenhaOpen(true);
  }

  // ---------- RENDER ----------
  if (!match) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.onDark} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (mode === 'lobby' ? router.back() : leavePlaying())} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'lobby' ? 'Ao vivo' : 'Confronto'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {mode === 'lobby' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.six }]}>
          {/* Confronto em andamento (retomar) */}
          {pendingResume && (
            <TouchableOpacity style={styles.resumeCard} onPress={() => resumeConfronto(pendingResume)} activeOpacity={0.85}>
              <View style={styles.resumeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeLabel}>Confronto em andamento</Text>
                <Text style={styles.resumeTeams} numberOfLines={1}>
                  {match.teams.find((t) => t.id === pendingResume.teamAId)?.name ?? 'Time A'} x{' '}
                  {match.teams.find((t) => t.id === pendingResume.teamBId)?.name ?? 'Time B'}
                </Text>
              </View>
              <Text style={styles.resumeTimer}>{mmss(remainingFromBlob(pendingResume, nowTick))}</Text>
              <Ionicons name="play-circle" size={30} color={colors.green} />
            </TouchableOpacity>
          )}

          {/* Seleção */}
          <Text style={styles.section}>Próximo confronto</Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Completar times</Text>
              <Text style={styles.toggleSub}>Sugere reforços do banco pra equilibrar os lados</Text>
            </View>
            <Switch
              value={reinforceEnabled}
              onValueChange={setReinforceEnabled}
              trackColor={{ true: colors.green, false: colors.dark3 }}
              thumbColor={colors.onDark}
            />
          </View>

          <TeamPicker label="Time A" teams={match.teams} selected={teamAId} disabledId={teamBId} onSelect={setTeamAId} />
          <View style={styles.vs}>
            <Text style={styles.vsText}>x</Text>
          </View>
          <TeamPicker label="Time B" teams={match.teams} selected={teamBId} disabledId={teamAId} onSelect={setTeamBId} />

          {reinforceEnabled && teamA && teamB && (
            <View style={styles.reforcoCard}>
              <View style={styles.reforcoHead}>
                <Text style={styles.reforcoTitle}>Reforços</Text>
                <Text style={styles.reforcoBalance}>
                  {rosterA.length} × {rosterB.length}
                </Text>
              </View>

              {bench.length === 0 ? (
                <Text style={styles.reforcoHint}>Sem banco: todos os times estão em quadra.</Text>
              ) : (
                <>
                  {borrowedIds.size === 0 ? (
                    <Text style={styles.reforcoHint}>
                      {rosterA.length === rosterB.length
                        ? 'Times iguais em número. Toque em completar se quiser reforçar.'
                        : 'Toque em completar para equilibrar os lados.'}
                    </Text>
                  ) : (
                    ([
                      ['A', teamA],
                      ['B', teamB],
                    ] as const).map(([, team]) =>
                      (borrows[team.id] ?? []).map((pid) => {
                        const info = mpByPlayerId.get(pid);
                        if (!info) return null;
                        return (
                          <View key={`${team.id}-${pid}`} style={styles.reforcoRow}>
                            <PlayerAvatar name={info.mp.player.name} size={24} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reforcoName} numberOfLines={1}>
                                {info.mp.player.name}
                              </Text>
                              <Text style={styles.reforcoOrigin} numberOfLines={1}>
                                → {team.name} · do {info.teamName}
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => removeReforco(team.id, pid)} hitSlop={8}>
                              <Ionicons name="close-circle" size={20} color={colors.onDark2} />
                            </TouchableOpacity>
                          </View>
                        );
                      }),
                    )
                  )}

                  <View style={styles.reforcoBtns}>
                    <TouchableOpacity style={styles.reforcoBtn} onPress={() => setReforcoSheet('A')} activeOpacity={0.85}>
                      <Ionicons name="add" size={16} color={colors.onDark} />
                      <Text style={styles.reforcoBtnText} numberOfLines={1}>
                        {teamA.name}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reforcoBtn} onPress={() => setReforcoSheet('B')} activeOpacity={0.85}>
                      <Ionicons name="add" size={16} color={colors.onDark} />
                      <Text style={styles.reforcoBtnText} numberOfLines={1}>
                        {teamB.name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Tempo da partida (min)</Text>
            <TextInput
              style={styles.durationInput}
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          <PrimaryButton label="▶  Iniciar confronto" onPress={startConfronto} />

          {/* Tabela do dia */}
          {overview && overview.standings.some((s) => s.played > 0) && (
            <>
              <Text style={styles.section}>Tabela do dia</Text>
              <StandingsTable overview={overview} />
            </>
          )}

          {/* Confrontos jogados */}
          {overview && overview.rounds.length > 0 && (
            <>
              <Text style={styles.section}>Confrontos ({overview.rounds.length})</Text>
              {overview.rounds
                .slice()
                .reverse()
                .map((r) => (
                  <View key={r.id} style={styles.roundRow}>
                    <Text style={styles.roundText} numberOfLines={1}>
                      {r.team_a_name} <Text style={styles.roundScore}>{r.goals_a} x {r.goals_b}</Text> {r.team_b_name}
                    </Text>
                  </View>
                ))}
            </>
          )}

          <TouchableOpacity style={styles.finish} onPress={encerrarPelada} activeOpacity={0.85}>
            <Text style={styles.finishText}>Encerrar pelada</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.six }]}>
          {/* Placar */}
          <View style={styles.scoreboard}>
            <View style={styles.scoreTeam}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {teamA?.name}
              </Text>
              <Text style={styles.scoreValue}>{goalsA}</Text>
              <View style={styles.quickGoalRow}>
                <TouchableOpacity
                  onPress={() => setTeamGoalsA((g) => Math.max(0, g - 1))}
                  hitSlop={6}
                  style={styles.quickGoalMinus}>
                  <Ionicons name="remove" size={16} color={colors.onDark} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTeamGoalsA((g) => g + 1)} style={styles.quickGoalAdd} activeOpacity={0.85}>
                  <Ionicons name="football" size={13} color={colors.onDark} />
                  <Text style={styles.quickGoalText}>Gol</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.scoreX}>x</Text>
            <View style={styles.scoreTeam}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {teamB?.name}
              </Text>
              <Text style={styles.scoreValue}>{goalsB}</Text>
              <View style={styles.quickGoalRow}>
                <TouchableOpacity
                  onPress={() => setTeamGoalsB((g) => Math.max(0, g - 1))}
                  hitSlop={6}
                  style={styles.quickGoalMinus}>
                  <Ionicons name="remove" size={16} color={colors.onDark} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTeamGoalsB((g) => g + 1)} style={styles.quickGoalAdd} activeOpacity={0.85}>
                  <Ionicons name="football" size={13} color={colors.onDark} />
                  <Text style={styles.quickGoalText}>Gol</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <Text style={styles.quickGoalHint}>Use “Gol” acima para marcar sem escolher o autor. Abaixo, atribua a um jogador.</Text>

          {/* Cronômetro */}
          <View style={styles.timerBox}>
            <Text style={[styles.timer, timeUp && { color: colors.abs }]}>{mmss(remainingMs)}</Text>
            {timeUp ? (
              <Text style={styles.timeUp}>Tempo esgotado!</Text>
            ) : (
              <TouchableOpacity style={styles.timerBtn} onPress={togglePause} activeOpacity={0.85}>
                <Ionicons name={running ? 'pause' : 'play'} size={20} color={colors.dark} />
              </TouchableOpacity>
            )}
          </View>

          {/* Jogadores dos 2 times */}
          {[
            { team: teamA, roster: rosterA },
            { team: teamB, roster: rosterB },
          ].map(({ team, roster }) =>
            team ? (
              <View key={team.id} style={styles.teamCard}>
                <Text style={styles.teamCardName}>{team.name}</Text>
                {roster.map((mp) => {
                  const s = stats[mp.player_id] ?? { goals: 0, assists: 0 };
                  const isReforco = (mpByPlayerId.get(mp.player_id)?.teamId ?? team.id) !== team.id;
                  return (
                    <View key={mp.id} style={styles.playerRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.playerNameRow}>
                          <Text style={styles.playerName} numberOfLines={1}>
                            {mp.player.name}
                          </Text>
                          {isReforco && <Text style={styles.reforcoTag}>reforço</Text>}
                        </View>
                        <Text style={styles.playerMeta}>
                          {s.goals}G · {s.assists}A
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.goalBtn} onPress={() => bump(mp.player_id, 'goals', 1)} activeOpacity={0.8}>
                        <Ionicons name="football" size={15} color={colors.onDark} />
                        <Text style={styles.goalBtnText}>Gol</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.assistBtn} onPress={() => bump(mp.player_id, 'assists', 1)} activeOpacity={0.8}>
                        <Text style={styles.assistBtnText}>+A</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => bump(mp.player_id, 'goals', -1)} hitSlop={6} style={styles.undo}>
                        <Ionicons name="remove-circle-outline" size={20} color={colors.onDark2} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null,
          )}

          <PrimaryButton label="Finalizar confronto" onPress={finishConfronto} />
        </ScrollView>
      )}

      {/* Escolher reforço */}
      <Sheet
        visible={reforcoSheet != null}
        onClose={() => setReforcoSheet(null)}
        title={`Reforço no ${(reforcoSheet === 'A' ? teamA?.name : teamB?.name) ?? 'time'}`}>
        {availableBench.length === 0 ? (
          <Text style={styles.reforcoHint}>Ninguém disponível no banco.</Text>
        ) : (
          availableBench.map((b) => {
            const suggested = b.mp.player_id === suggestedForSheet;
            return (
              <TouchableOpacity
                key={b.mp.id}
                style={styles.benchRow}
                onPress={() => reforcoSheet && addReforco(reforcoSheet, b.mp.player_id)}
                activeOpacity={0.8}>
                <PlayerAvatar name={b.mp.player.name} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.benchName} numberOfLines={1}>
                    {b.mp.player.name}
                  </Text>
                  <Text style={styles.benchMeta} numberOfLines={1}>
                    {formatPosition(b.mp.player.position)} · {formatRating(b.mp.player.rating)} · {b.teamName}
                  </Text>
                </View>
                {suggested && <Text style={styles.benchSuggest}>sugerido</Text>}
                <Ionicons name="add-circle" size={22} color={colors.green} />
              </TouchableOpacity>
            );
          })
        )}
        <PrimaryButton label="Concluir" onPress={() => setReforcoSheet(null)} />
      </Sheet>

      {/* Tela comemorativa de encerramento */}
      {resenhaOpen && (
        <CelebrationOverlay
          overview={overview}
          insets={insets}
          onClose={() => setResenhaOpen(false)}
          onFinish={async () => {
            await cancelTimerAlarm(alarmId);
            // As vitórias já foram creditadas por confronto; aqui apagamos os confrontos do banco.
            try {
              await api.clearLiveState(id);
              await api.clearRounds(id);
            } catch {
              /* segue mesmo assim */
            }
            setResenhaOpen(false);
            router.back();
          }}
        />
      )}
    </View>
  );
}

function CelebrationOverlay({
  overview,
  insets,
  onClose,
  onFinish,
}: {
  overview: RoundsOverview | null;
  insets: { top: number; bottom: number };
  onClose: () => void;
  onFinish: () => Promise<void>;
}) {
  const champion = overview?.champion ?? null;
  const topScorer = overview?.top_scorer ?? null;
  const roundsCount = overview?.rounds.length ?? 0;
  const standings = overview?.standings ?? [];
  const hasPlay = standings.some((s) => s.played > 0);

  const [finishing, setFinishing] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start();
  }, [pop]);

  return (
    <View style={[styles.celebOverlay, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.celebClose} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={26} color={colors.onDark2} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[styles.celebContent, { paddingBottom: insets.bottom + spacing.six }]}>
        <Text style={styles.celebEmoji}>🎉🏆🎉</Text>
        <Text style={styles.celebTitle}>Pelada encerrada!</Text>
        <Text style={styles.celebSub}>Os destaques do dia</Text>

        {/* Campeão */}
        <Animated.View style={[styles.champCard, { opacity: pop, transform: [{ scale: pop }] }]}>
          <Text style={styles.champTrophy}>🏆</Text>
          <Text style={styles.champLabel}>Campeão do dia</Text>
          <Text style={styles.champName} numberOfLines={1}>
            {champion ? champion.name : '—'}
          </Text>
          {champion && (
            <Text style={styles.champRecord}>
              {champion.wins}V · {champion.draws}E · {champion.losses}D · {champion.points} pts
            </Text>
          )}
        </Animated.View>

        {/* Artilheiro */}
        <View style={styles.scorerCard}>
          <Text style={styles.scorerBall}>⚽</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scorerLabel}>Artilheiro do dia</Text>
            <Text style={styles.scorerName} numberOfLines={1}>
              {topScorer ? topScorer.name : '—'}
            </Text>
          </View>
          {topScorer && (
            <View style={styles.scorerBadge}>
              <Text style={styles.scorerGoals}>{topScorer.goals}</Text>
              <Text style={styles.scorerGoalsLabel}>{topScorer.goals === 1 ? 'gol' : 'gols'}</Text>
            </View>
          )}
        </View>

        {/* Classificação */}
        <Text style={styles.celebSection}>Classificação final</Text>
        {overview && hasPlay ? (
          <StandingsTable overview={overview} />
        ) : (
          <Text style={styles.celebEmpty}>Nenhum confronto foi jogado hoje.</Text>
        )}

        <Text style={styles.celebFooter}>
          {roundsCount} {roundsCount === 1 ? 'confronto disputado' : 'confrontos disputados'}
        </Text>

        <PrimaryButton
          label="Encerrar e voltar"
          loading={finishing}
          onPress={async () => {
            setFinishing(true);
            await onFinish();
          }}
        />
      </ScrollView>
    </View>
  );
}

function TeamPicker({
  label,
  teams,
  selected,
  disabledId,
  onSelect,
}: {
  label: string;
  teams: MatchTeam[];
  selected: number | null;
  disabledId: number | null;
  onSelect: (id: number) => void;
}) {
  const team = teams.find((t) => t.id === selected) ?? null;
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chips}>
        {teams.map((t) => {
          const active = t.id === selected;
          const disabled = t.id === disabledId;
          return (
            <TouchableOpacity
              key={t.id}
              disabled={disabled}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
              onPress={() => onSelect(t.id)}
              activeOpacity={0.8}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {team && (
        <View style={styles.roster}>
          {team.players.length === 0 ? (
            <Text style={styles.rosterEmpty}>Sem jogadores neste time.</Text>
          ) : (
            team.players.map((mp) => (
              <View key={mp.id} style={styles.rosterRow}>
                <PlayerAvatar name={mp.player.name} size={26} />
                <Text style={styles.rosterName} numberOfLines={1}>
                  {mp.player.name}
                </Text>
                <Text style={styles.rosterMeta}>
                  {formatPosition(mp.player.position)} · {formatRating(mp.player.rating)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function StandingsTable({ overview }: { overview: RoundsOverview }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text style={[styles.thTeam, styles.thText]}>Time</Text>
        <Text style={styles.thText}>P</Text>
        <Text style={styles.thText}>V</Text>
        <Text style={styles.thText}>E</Text>
        <Text style={styles.thText}>D</Text>
        <Text style={styles.thText}>SG</Text>
      </View>
      {overview.standings.map((s, i) => (
        <View key={s.team_id} style={styles.tableRow}>
          <Text style={[styles.thTeam, styles.tdTeam]} numberOfLines={1}>
            {i + 1}. {s.name}
          </Text>
          <Text style={styles.tdStrong}>{s.points}</Text>
          <Text style={styles.td}>{s.wins}</Text>
          <Text style={styles.td}>{s.draws}</Text>
          <Text style={styles.td}>{s.losses}</Text>
          <Text style={styles.td}>{s.goals_for - s.goals_against}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.dark },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
  },
  headerTitle: { color: colors.onDark, fontSize: 16, fontFamily: fonts.bold },
  content: { paddingHorizontal: spacing.four, paddingTop: spacing.two, gap: spacing.three },
  section: { color: colors.onDark, fontSize: 16, fontFamily: fonts.extrabold, marginTop: spacing.two },

  // Pickers
  pickerBlock: { gap: spacing.two },
  pickerLabel: { color: colors.onDark2, fontSize: 12, fontFamily: fonts.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.two },
  chip: { paddingHorizontal: spacing.three, paddingVertical: spacing.two, borderRadius: radius.chip, backgroundColor: colors.dark2 },
  chipActive: { backgroundColor: colors.green },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: colors.onDark, fontSize: 13, fontFamily: fonts.semibold },
  chipTextActive: { color: colors.onDark },

  roster: {
    backgroundColor: colors.dark2,
    borderRadius: radius.cardSm,
    padding: spacing.three,
    gap: spacing.two,
    marginTop: spacing.one,
  },
  rosterEmpty: { color: colors.onDark2, fontSize: 13, fontFamily: fonts.medium },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  rosterName: { flex: 1, color: colors.onDark, fontSize: 13, fontFamily: fonts.semibold },
  rosterMeta: { color: colors.onDark2, fontSize: 12, fontFamily: fonts.medium },

  vs: { alignItems: 'center' },
  vsText: { color: colors.onDark2, fontSize: 16, fontFamily: fonts.display },

  // Toggle de reforços
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.dark2,
    borderRadius: radius.cardSm,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
  },
  toggleTitle: { color: colors.onDark, fontSize: 14, fontFamily: fonts.bold },
  toggleSub: { color: colors.onDark2, fontSize: 12, marginTop: 2 },

  // Card de reforços
  reforcoCard: {
    backgroundColor: colors.dark2,
    borderRadius: radius.cardSm,
    padding: spacing.three,
    gap: spacing.two,
  },
  reforcoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reforcoTitle: { color: colors.onDark, fontSize: 14, fontFamily: fonts.extrabold },
  reforcoBalance: { color: colors.green, fontSize: 15, fontFamily: fonts.display },
  reforcoHint: { color: colors.onDark2, fontSize: 12, lineHeight: 16 },
  reforcoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  reforcoName: { color: colors.onDark, fontSize: 13, fontFamily: fonts.semibold },
  reforcoOrigin: { color: colors.onDark2, fontSize: 11 },
  reforcoBtns: { flexDirection: 'row', gap: spacing.two, marginTop: spacing.one },
  reforcoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    backgroundColor: colors.dark3,
    borderRadius: radius.btn,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.two,
  },
  reforcoBtnText: { color: colors.onDark, fontSize: 13, fontFamily: fonts.bold },
  reforcoTag: {
    color: colors.green,
    fontSize: 10,
    fontFamily: fonts.bold,
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing.two,
    paddingVertical: 1,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },

  // Sheet do banco
  benchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.three, paddingVertical: spacing.two },
  benchName: { color: colors.ink, fontSize: 14, fontFamily: fonts.semibold },
  benchMeta: { color: colors.ink3, fontSize: 12 },
  benchSuggest: { color: colors.greenB, fontSize: 11, fontFamily: fonts.bold },

  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.one },
  durationLabel: { color: colors.onDark, fontSize: 14, fontFamily: fonts.semibold },
  durationInput: {
    backgroundColor: colors.dark2,
    borderRadius: radius.input,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    color: colors.onDark,
    fontSize: 16,
    fontFamily: fonts.bold,
    minWidth: 64,
    textAlign: 'center',
  },

  // Tabela
  table: { backgroundColor: colors.dark2, borderRadius: radius.cardSm, padding: spacing.two },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.one },
  tableHead: { borderBottomWidth: 1, borderBottomColor: colors.dark3, marginBottom: spacing.one },
  thTeam: { flex: 1, textAlign: 'left' },
  thText: { color: colors.onDark2, fontSize: 12, fontFamily: fonts.bold, width: 26, textAlign: 'center' },
  tdTeam: { color: colors.onDark, fontSize: 13, fontFamily: fonts.semibold },
  td: { color: colors.onDark2, fontSize: 13, width: 26, textAlign: 'center', fontFamily: fonts.regular },
  tdStrong: { color: colors.green, fontSize: 13, width: 26, textAlign: 'center', fontFamily: fonts.bold },

  roundRow: { backgroundColor: colors.dark2, borderRadius: radius.cardSm, paddingHorizontal: spacing.three, paddingVertical: spacing.two },
  roundText: { color: colors.onDark, fontSize: 13, fontFamily: fonts.medium },
  roundScore: { color: colors.green, fontFamily: fonts.display, fontSize: 15 },

  finish: {
    backgroundColor: colors.absBg,
    borderRadius: radius.btn,
    paddingVertical: spacing.four,
    alignItems: 'center',
    marginTop: spacing.four,
  },
  finishText: { color: colors.absT, fontFamily: fonts.bold, fontSize: 15 },

  // Confronto em andamento (retomar)
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.dark2,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.green,
    padding: spacing.three,
  },
  resumeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  resumeLabel: { color: colors.green, fontSize: 12, fontFamily: fonts.bold },
  resumeTeams: { color: colors.onDark, fontSize: 15, fontFamily: fonts.extrabold },
  resumeTimer: { color: colors.onDark, fontSize: 18, fontFamily: fonts.display, letterSpacing: 1 },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.dark2,
    borderRadius: radius.cardMd,
    padding: spacing.four,
  },
  scoreTeam: { flex: 1, alignItems: 'center', gap: spacing.one },
  scoreName: { color: colors.onDark, fontSize: 14, fontFamily: fonts.bold },
  scoreValue: { color: colors.green, fontSize: 48, fontFamily: fonts.display },
  scoreX: { color: colors.onDark2, fontSize: 20, fontFamily: fonts.display, paddingHorizontal: spacing.two, marginTop: spacing.four },
  quickGoalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two, marginTop: spacing.one },
  quickGoalMinus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.dark3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGoalAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    backgroundColor: colors.green,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
    borderRadius: radius.btn,
  },
  quickGoalText: { color: colors.onDark, fontFamily: fonts.bold, fontSize: 13 },
  quickGoalHint: { color: colors.onDark2, fontSize: 11, textAlign: 'center', marginTop: -spacing.one },

  timerBox: { alignItems: 'center', gap: spacing.two, paddingVertical: spacing.two },
  timer: { color: colors.onDark, fontSize: 60, fontFamily: fonts.display, letterSpacing: 2 },
  timeUp: { color: colors.abs, fontSize: 14, fontFamily: fonts.bold },
  timerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  teamCard: { backgroundColor: colors.dark2, borderRadius: radius.cardMd, padding: spacing.three, gap: spacing.two },
  teamCardName: { color: colors.onDark, fontSize: 15, fontFamily: fonts.extrabold },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  playerName: { color: colors.onDark, fontSize: 14, fontFamily: fonts.semibold, flexShrink: 1 },
  playerMeta: { color: colors.onDark2, fontSize: 12 },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    backgroundColor: colors.green,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    borderRadius: radius.btn,
  },
  goalBtnText: { color: colors.onDark, fontFamily: fonts.bold, fontSize: 13 },
  assistBtn: { backgroundColor: colors.dark3, paddingHorizontal: spacing.three, paddingVertical: spacing.two, borderRadius: radius.btn },
  assistBtnText: { color: colors.onDark, fontFamily: fonts.bold, fontSize: 13 },
  undo: { paddingHorizontal: spacing.one },

  // Tela comemorativa
  celebOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
    zIndex: 20,
  },
  celebClose: { position: 'absolute', right: spacing.four, top: spacing.four, zIndex: 2, padding: spacing.one },
  celebContent: { paddingHorizontal: spacing.four, paddingTop: spacing.four, gap: spacing.three, alignItems: 'stretch' },
  celebEmoji: { fontSize: 34, textAlign: 'center', marginTop: spacing.two },
  celebTitle: { color: colors.onDark, fontSize: 28, fontFamily: fonts.display, textAlign: 'center', letterSpacing: 1 },
  celebSub: { color: colors.onDark2, fontSize: 14, textAlign: 'center', marginBottom: spacing.two },

  champCard: {
    backgroundColor: colors.dark2,
    borderRadius: radius.cardLg,
    borderWidth: 2,
    borderColor: colors.gold,
    paddingVertical: spacing.five,
    paddingHorizontal: spacing.four,
    alignItems: 'center',
    gap: spacing.one,
  },
  champTrophy: { fontSize: 52 },
  champLabel: { color: colors.gold, fontSize: 13, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
  champName: { color: colors.onDark, fontSize: 30, fontFamily: fonts.extrabold, textAlign: 'center' },
  champRecord: { color: colors.onDark2, fontSize: 14, fontFamily: fonts.semibold },

  scorerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.dark2,
    borderRadius: radius.cardMd,
    padding: spacing.four,
  },
  scorerBall: { fontSize: 32 },
  scorerLabel: { color: colors.green, fontSize: 12, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  scorerName: { color: colors.onDark, fontSize: 20, fontFamily: fonts.extrabold },
  scorerBadge: { alignItems: 'center', backgroundColor: colors.dark3, borderRadius: radius.cardSm, paddingHorizontal: spacing.three, paddingVertical: spacing.two },
  scorerGoals: { color: colors.green, fontSize: 24, fontFamily: fonts.display },
  scorerGoalsLabel: { color: colors.onDark2, fontSize: 11, fontFamily: fonts.semibold },

  celebSection: { color: colors.onDark, fontSize: 16, fontFamily: fonts.extrabold, marginTop: spacing.two },
  celebEmpty: { color: colors.onDark2, fontSize: 13 },
  celebFooter: { color: colors.onDark2, fontSize: 13, textAlign: 'center', marginVertical: spacing.two },
});
