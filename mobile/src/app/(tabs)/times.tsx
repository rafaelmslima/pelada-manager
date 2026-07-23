import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { MatchStatsSheet } from '@/components/MatchStatsSheet';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { RatingSheet } from '@/components/RatingSheet';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { GhostButton, PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateDisplay, formatMonthLabel, formatPosition, formatRating } from '@/lib/format';
import type { MatchListItem, TeamPlayer, TeamResult } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

const SWIPE_THRESHOLD = 45;

/** Gera as chaves "YYYY-MM" de forma contínua do mês mais novo ao mais antigo (desc). */
function enumerateMonths(monthKeys: string[]): string[] {
  if (monthKeys.length === 0) return [];
  const sorted = [...monthKeys].sort();
  const [oy, om] = sorted[0].split('-').map(Number);
  let [y, m] = sorted[sorted.length - 1].split('-').map(Number);
  const result: string[] = [];
  while (y > oy || (y === oy && m >= om)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return result;
}

function recompute(team: TeamResult, players: TeamPlayer[]): TeamResult {
  const total = players.reduce((sum, p) => sum + p.rating, 0);
  return {
    ...team,
    players,
    total_rating: total,
    average_rating: players.length ? total / players.length : 0,
    player_count: players.length,
    is_incomplete: players.length < team.capacity,
  };
}

export default function TimesScreen() {
  const [perTeam, setPerTeam] = useState('5');
  const [teams, setTeams] = useState<TeamResult[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState<{ player: TeamPlayer; fromIndex: number } | null>(null);
  const [overdue, setOverdue] = useState<{ id: number; name: string }[]>([]);

  const router = useRouter();
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [statsMatchId, setStatsMatchId] = useState<number | null>(null);
  const [ratingMatchId, setRatingMatchId] = useState<number | null>(null);
  const [matchActions, setMatchActions] = useState<MatchListItem | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const loadMatches = useCallback(() => {
    api.listMatches().then(setMatches).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => loadMatches(), [loadMatches]));

  // Histórico agrupado por mês (client-side) + range contínuo de meses navegáveis.
  const matchesByMonth = useMemo(() => {
    const map: Record<string, MatchListItem[]> = {};
    for (const match of matches) {
      const key = match.date.slice(0, 7);
      (map[key] ||= []).push(match);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.date.localeCompare(a.date));
    }
    return map;
  }, [matches]);

  const monthKeys = useMemo(() => enumerateMonths(Object.keys(matchesByMonth)), [matchesByMonth]);

  // Mantém o mês selecionado válido: começa no mais recente e preserva a escolha entre reloads.
  useEffect(() => {
    setSelectedMonth((prev) => (prev && monthKeys.includes(prev) ? prev : (monthKeys[0] ?? null)));
  }, [monthKeys]);

  const monthIndex = selectedMonth ? monthKeys.indexOf(selectedMonth) : -1;
  const canGoNewer = monthIndex > 0;
  const canGoOlder = monthIndex >= 0 && monthIndex < monthKeys.length - 1;

  // delta: -1 = mês mais novo, +1 = mês mais antigo (monthKeys está em ordem decrescente).
  const changeMonth = useCallback(
    (delta: number) => {
      setSelectedMonth((prev) => {
        if (!prev) return prev;
        const next = monthKeys.indexOf(prev) + delta;
        if (next < 0 || next >= monthKeys.length) return prev;
        return monthKeys[next];
      });
    },
    [monthKeys],
  );

  const monthSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-14, 14])
        .onEnd((event) => {
          'worklet';
          if (event.translationX <= -SWIPE_THRESHOLD) runOnJS(changeMonth)(-1);
          else if (event.translationX >= SWIPE_THRESHOLD) runOnJS(changeMonth)(1);
        }),
    [changeMonth],
  );

  const monthMatches = selectedMonth ? matchesByMonth[selectedMonth] ?? [] : [];

  async function generate() {
    const value = Math.max(1, Math.min(30, parseInt(perTeam, 10) || 5));
    setPerTeam(String(value));
    setGenerating(true);
    try {
      const resp = await api.generateTeams(value);
      setTeams(resp.teams);
      setOverdue(resp.overdue_mensalistas);
      if (resp.overdue_mensalistas.length > 0) {
        const nomes = resp.overdue_mensalistas.map((m) => m.name).join(', ');
        Alert.alert(
          'Mensalidade atrasada',
          `${resp.overdue_mensalistas.length} mensalista(s) confirmado(s) estão com a mensalidade atrasada:\n\n${nomes}\n\nVocê decide se segue com o sorteio.`,
        );
      }
    } catch (err) {
      Alert.alert('Não foi possível gerar', err instanceof ApiError ? err.message : 'Erro.');
    } finally {
      setGenerating(false);
    }
  }

  function moveTo(toIndex: number) {
    if (!teams || !moving) return;
    const { player, fromIndex } = moving;
    setTeams(
      teams.map((team, i) => {
        if (i === fromIndex) return recompute(team, team.players.filter((p) => p.id !== player.id));
        if (i === toIndex) return recompute(team, [...team.players, player]);
        return team;
      }),
    );
    setMoving(null);
  }

  async function save() {
    if (!teams) return;
    if (teams.some((t) => t.players.length === 0)) {
      Alert.alert('Time vazio', 'Cada time precisa de ao menos um jogador para salvar.');
      return;
    }
    const iso = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      await api.createMatch({
        date: iso,
        title: `Pelada ${formatDate(iso)}`,
        teams: teams.map((t) => ({
          name: t.name,
          total_rating: t.total_rating,
          is_team_of_the_week: false,
          players: t.players.map((p) => ({ player_id: p.id, goals: 0, assists: 0 })),
        })),
      });
      setTeams(null);
      loadMatches();
      Alert.alert('Pronto', 'Pelada salva no histórico.');
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof ApiError ? err.message : 'Erro.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteMatch(match: MatchListItem) {
    Alert.alert('Excluir partida', `Remover "${match.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMatch(match.id);
            loadMatches();
          } catch {
            /* ignora */
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text style={styles.title}>Times</Text>

      {/* Gerador */}
      <View style={styles.generatorCard}>
        <Text style={styles.section}>Gerar times equilibrados</Text>
        <Text style={styles.sectionHint}>
          O sorteio balanceia por nota e posição usando os jogadores confirmados.
        </Text>
        <View style={styles.perTeamRow}>
          <Text style={styles.perTeamLabel}>Jogadores por time</Text>
          <TextInput
            style={styles.perTeamInput}
            value={perTeam}
            onChangeText={setPerTeam}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <PrimaryButton label="Gerar times" onPress={generate} loading={generating} />
        {teams && !generating && (
          <GhostButton label="Gerar novamente" onPress={generate} />
        )}
      </View>

      {/* Aviso de mensalistas atrasados no sorteio */}
      {teams && overdue.length > 0 && (
        <View style={styles.overdueBanner}>
          <Ionicons name="warning" size={18} color={colors.absT} />
          <Text style={styles.overdueText}>
            {overdue.length} mensalista(s) atrasado(s) no sorteio: {overdue.map((m) => m.name).join(', ')}
          </Text>
        </View>
      )}

      {/* Resultado */}
      {teams &&
        teams.map((team, index) => (
          <View key={index} style={styles.teamCard}>
            <View style={styles.teamHeader}>
              <Text style={styles.teamName}>
                {team.name}
                {team.is_incomplete ? ' · incompleto' : ''}
              </Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingBadgeText}>{formatRating(team.total_rating)}</Text>
              </View>
            </View>
            {team.players.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.teamPlayer}
                onPress={() => setMoving({ player: p, fromIndex: index })}
                activeOpacity={0.7}>
                <PlayerAvatar name={p.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamPlayerName}>{p.name}</Text>
                  <Text style={styles.teamPlayerMeta}>
                    {formatPosition(p.position)} · {formatRating(p.rating)}
                  </Text>
                </View>
                <Ionicons name="swap-horizontal" size={18} color={colors.ink4} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

      {teams && <PrimaryButton label="Salvar pelada no histórico" onPress={save} loading={saving} />}

      {/* Histórico mensal */}
      <Text style={styles.section}>Histórico</Text>
      {monthKeys.length === 0 ? (
        <Text style={styles.emptyHistory}>Nenhuma pelada salva ainda.</Text>
      ) : (
        <GestureDetector gesture={monthSwipe}>
          <View style={styles.monthBlock}>
            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={() => changeMonth(1)}
                disabled={!canGoOlder}
                hitSlop={10}
                style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={22} color={canGoOlder ? colors.ink : colors.border2} />
              </TouchableOpacity>
              <View style={styles.monthLabelBox}>
                <Text style={styles.monthLabel}>{selectedMonth ? formatMonthLabel(selectedMonth) : ''}</Text>
                <Text style={styles.monthCount}>
                  {monthMatches.length === 0
                    ? 'Nenhuma pelada'
                    : `${monthMatches.length} ${monthMatches.length === 1 ? 'pelada' : 'peladas'}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                disabled={!canGoNewer}
                hitSlop={10}
                style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={22} color={canGoNewer ? colors.ink : colors.border2} />
              </TouchableOpacity>
            </View>

            {monthMatches.length === 0 ? (
              <Text style={styles.emptyHistory}>Nenhuma pelada neste mês. Arraste para o lado para ver outros.</Text>
            ) : (
              monthMatches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => setMatchActions(match)}
                  activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchTitle}>{formatDateDisplay(match.date)}</Text>
                    <Text style={styles.matchMeta}>
                      {match.team_count} times · {match.player_count} jogadores
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </GestureDetector>
      )}

      {/* Sheet mover jogador */}
      <Sheet visible={moving != null} onClose={() => setMoving(null)} title={`Mover ${moving?.player.name ?? ''}`}>
        {teams?.map((team, i) =>
          moving && i === moving.fromIndex ? null : (
            <GhostButton key={i} label={`Para ${team.name}`} onPress={() => moveTo(i)} />
          ),
        )}
      </Sheet>

      {/* Ações da partida */}
      <Sheet
        visible={matchActions != null}
        onClose={() => setMatchActions(null)}
        title={matchActions ? formatDateDisplay(matchActions.date) : undefined}>
        {matchActions && (
          <>
            <GhostButton
              label="▶  Placar ao vivo"
              onPress={() => {
                const mid = matchActions.id;
                setMatchActions(null);
                router.push({ pathname: '/live/[matchId]', params: { matchId: String(mid) } });
              }}
            />
            <GhostButton
              label="Estatísticas (gols/assist.)"
              onPress={() => {
                setStatsMatchId(matchActions.id);
                setMatchActions(null);
              }}
            />
            <GhostButton
              label="⭐  Avaliar jogadores"
              onPress={() => {
                setRatingMatchId(matchActions.id);
                setMatchActions(null);
              }}
            />
            <GhostButton
              label="Excluir partida"
              tone="danger"
              onPress={() => {
                const match = matchActions;
                setMatchActions(null);
                confirmDeleteMatch(match);
              }}
            />
          </>
        )}
      </Sheet>

      <MatchStatsSheet
        visible={statsMatchId != null}
        matchId={statsMatchId}
        onClose={() => setStatsMatchId(null)}
        onSaved={loadMatches}
      />

      <RatingSheet
        visible={ratingMatchId != null}
        matchId={ratingMatchId}
        onClose={() => setRatingMatchId(null)}
        onSaved={loadMatches}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.extrabold },
  section: { color: colors.ink, fontSize: 18, fontFamily: fonts.extrabold },
  sectionHint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.absBg,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.abs,
    padding: spacing.three,
  },
  overdueText: { flex: 1, color: colors.absT, fontSize: 13, fontFamily: fonts.semibold },

  generatorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  perTeamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  perTeamLabel: { color: colors.ink2, fontSize: 14, fontWeight: '600' },
  perTeamInput: {
    backgroundColor: colors.page,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },

  teamCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
    gap: spacing.two,
  },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  ratingBadge: {
    backgroundColor: colors.dark,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.half,
    borderRadius: radius.badge,
  },
  ratingBadgeText: { color: colors.gold, fontSize: 14, fontFamily: fonts.display },
  teamPlayer: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  teamPlayerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  teamPlayerMeta: { color: colors.ink3, fontSize: 12 },

  emptyHistory: { color: colors.ink3, fontSize: 13 },
  monthBlock: { gap: spacing.three },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
  },
  monthLabelBox: { flex: 1, alignItems: 'center' },
  monthLabel: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  monthCount: { color: colors.ink3, fontSize: 12, marginTop: spacing.half },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
  },
  matchTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  matchMeta: { color: colors.ink3, fontSize: 12 },
  matchAction: { padding: spacing.two },
});
