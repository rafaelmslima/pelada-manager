import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';
import { PrimaryButton } from '@/components/form';
import { api } from '@/lib/api';
import { cancelTimerAlarm, scheduleTimerAlarm } from '@/lib/matchTimer';
import type { MatchRead, MatchTeam, RoundsOverview } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

type Stats = Record<number, { goals: number; assists: number }>;

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function LiveMatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
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

  // Confronto em andamento
  const [roundDurationSec, setRoundDurationSec] = useState(600);
  const [stats, setStats] = useState<Stats>({});
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [alarmId, setAlarmId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const loadOverview = useCallback(() => {
    api.getRounds(id).then(setOverview).catch(() => {});
  }, [id]);

  useEffect(() => {
    api.getMatch(id).then(setMatch).catch(() => {});
    loadOverview();
  }, [id, loadOverview]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && endsAt != null && nowTick >= endsAt) {
      setRunning(false);
      setPausedRemaining(0);
    }
  }, [running, endsAt, nowTick]);

  const teamA = match?.teams.find((t) => t.id === teamAId) ?? null;
  const teamB = match?.teams.find((t) => t.id === teamBId) ?? null;

  const goalsFor = useCallback(
    (team: MatchTeam | null) => (team ? team.players.reduce((s, mp) => s + (stats[mp.player_id]?.goals ?? 0), 0) : 0),
    [stats],
  );
  const goalsA = goalsFor(teamA);
  const goalsB = goalsFor(teamB);

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
    setRoundDurationSec(secs);
    setStats({});
    const target = Date.now() + secs * 1000;
    setEndsAt(target);
    setPausedRemaining(null);
    setRunning(true);
    setNowTick(Date.now());
    setMode('playing');
    const aName = teamA?.name ?? 'Time A';
    const bName = teamB?.name ?? 'Time B';
    const newAlarm = await scheduleTimerAlarm(secs, '⏱ Fim do tempo!', `${aName} x ${bName}`);
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
      const newAlarm = await scheduleTimerAlarm(remaining / 1000, '⏱ Fim do tempo!', `${teamA?.name} x ${teamB?.name}`);
      setAlarmId(newAlarm);
    }
  }

  async function finishConfronto() {
    if (teamAId == null || teamBId == null) return;
    await cancelTimerAlarm(alarmId);
    setAlarmId(null);
    setRunning(false);

    const relevant = [...(teamA?.players ?? []), ...(teamB?.players ?? [])];
    const payloadStats = relevant
      .map((mp) => ({ player_id: mp.player_id, ...(stats[mp.player_id] ?? { goals: 0, assists: 0 }) }))
      .filter((s) => s.goals > 0 || s.assists > 0);

    try {
      const resp = await api.createRound(id, {
        team_a_id: teamAId,
        team_b_id: teamBId,
        goals_a: goalsA,
        goals_b: goalsB,
        duration_seconds: roundDurationSec,
        stats: payloadStats,
      });
      setOverview(resp);
    } catch {
      /* ignora; segue */
    }

    // Quem ganha fica: vencedor vira Time A do próximo.
    const winner = goalsA > goalsB ? teamAId : goalsA < goalsB ? teamBId : teamAId;
    setStats({});
    setEndsAt(null);
    setPausedRemaining(null);
    setTeamAId(winner);
    setTeamBId(null);
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
        {mode === 'lobby' ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.onDark} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <Text style={styles.headerTitle}>{mode === 'lobby' ? 'Ao vivo' : 'Confronto'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {mode === 'lobby' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.six }]}>
          {/* Seleção */}
          <Text style={styles.section}>Próximo confronto</Text>
          <TeamPicker label="Time A" teams={match.teams} selected={teamAId} disabledId={teamBId} onSelect={setTeamAId} />
          <View style={styles.vs}>
            <Text style={styles.vsText}>x</Text>
          </View>
          <TeamPicker label="Time B" teams={match.teams} selected={teamBId} disabledId={teamAId} onSelect={setTeamBId} />

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
            </View>
            <Text style={styles.scoreX}>x</Text>
            <View style={styles.scoreTeam}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {teamB?.name}
              </Text>
              <Text style={styles.scoreValue}>{goalsB}</Text>
            </View>
          </View>

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
          {[teamA, teamB].map((team) =>
            team ? (
              <View key={team.id} style={styles.teamCard}>
                <Text style={styles.teamCardName}>{team.name}</Text>
                {team.players.map((mp) => {
                  const s = stats[mp.player_id] ?? { goals: 0, assists: 0 };
                  return (
                    <View key={mp.id} style={styles.playerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {mp.player.name}
                        </Text>
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

      {/* Resenha */}
      <Sheet visible={resenhaOpen} onClose={() => setResenhaOpen(false)} title="Resenha da pelada">
        <View style={styles.resenha}>
          <ResenhaItem
            icon="trophy"
            label="Campeão do dia"
            value={overview?.champion ? overview.champion.name : '—'}
            color={colors.gold}
          />
          <ResenhaItem
            icon="football"
            label="Artilheiro do dia"
            value={overview?.top_scorer ? `${overview.top_scorer.name} (${overview.top_scorer.goals})` : '—'}
            color={colors.green}
          />
          <ResenhaItem icon="repeat" label="Confrontos" value={String(overview?.rounds.length ?? 0)} color={colors.ink2} />
        </View>
        <PrimaryButton
          label="Encerrar e voltar"
          onPress={() => {
            setResenhaOpen(false);
            router.back();
          }}
        />
      </Sheet>
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

function ResenhaItem({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.resenhaItem}>
      <Ionicons name={icon} size={22} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={styles.resenhaLabel}>{label}</Text>
        <Text style={styles.resenhaValue}>{value}</Text>
      </View>
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
  vs: { alignItems: 'center' },
  vsText: { color: colors.onDark2, fontSize: 16, fontFamily: fonts.display },

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

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark2,
    borderRadius: radius.cardMd,
    padding: spacing.four,
  },
  scoreTeam: { flex: 1, alignItems: 'center', gap: spacing.one },
  scoreName: { color: colors.onDark, fontSize: 14, fontFamily: fonts.bold },
  scoreValue: { color: colors.green, fontSize: 48, fontFamily: fonts.display },
  scoreX: { color: colors.onDark2, fontSize: 20, fontFamily: fonts.display, paddingHorizontal: spacing.two },

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
  playerName: { color: colors.onDark, fontSize: 14, fontFamily: fonts.semibold },
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

  // Resenha
  resenha: { gap: spacing.two, marginBottom: spacing.two },
  resenhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.raised,
    borderRadius: radius.cardSm,
    padding: spacing.three,
  },
  resenhaLabel: { color: colors.ink3, fontSize: 12, fontFamily: fonts.bold },
  resenhaValue: { color: colors.ink, fontSize: 16, fontFamily: fonts.bold },
});
