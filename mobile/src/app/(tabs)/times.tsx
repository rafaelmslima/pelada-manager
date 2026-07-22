import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MatchStatsSheet } from '@/components/MatchStatsSheet';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { GhostButton, PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateDisplay, formatPosition, formatRating } from '@/lib/format';
import type { MatchListItem, TeamPlayer, TeamResult } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';

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

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [statsMatchId, setStatsMatchId] = useState<number | null>(null);

  const loadMatches = useCallback(() => {
    api.listMatches().then(setMatches).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => loadMatches(), [loadMatches]));

  async function generate() {
    const value = Math.max(1, Math.min(30, parseInt(perTeam, 10) || 5));
    setPerTeam(String(value));
    setGenerating(true);
    try {
      const resp = await api.generateTeams(value);
      setTeams(resp.teams);
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

      {/* Histórico */}
      <Text style={styles.section}>Histórico</Text>
      {matches.length === 0 ? (
        <Text style={styles.emptyHistory}>Nenhuma pelada salva ainda.</Text>
      ) : (
        matches.map((match) => (
          <View key={match.id} style={styles.matchCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>{formatDateDisplay(match.date)}</Text>
              <Text style={styles.matchMeta}>
                {match.team_count} times · {match.player_count} jogadores
              </Text>
            </View>
            <TouchableOpacity onPress={() => setStatsMatchId(match.id)} style={styles.matchAction} hitSlop={6}>
              <Ionicons name="stats-chart" size={18} color={colors.ink2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDeleteMatch(match)} style={styles.matchAction} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.absT} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Sheet mover jogador */}
      <Sheet visible={moving != null} onClose={() => setMoving(null)} title={`Mover ${moving?.player.name ?? ''}`}>
        {teams?.map((team, i) =>
          moving && i === moving.fromIndex ? null : (
            <GhostButton key={i} label={`Para ${team.name}`} onPress={() => moveTo(i)} />
          ),
        )}
      </Sheet>

      <MatchStatsSheet
        visible={statsMatchId != null}
        matchId={statsMatchId}
        onClose={() => setStatsMatchId(null)}
        onSaved={loadMatches}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  sectionHint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },

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
  ratingBadgeText: { color: colors.gold, fontSize: 13, fontWeight: '800' },
  teamPlayer: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  teamPlayerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  teamPlayerMeta: { color: colors.ink3, fontSize: 12 },

  emptyHistory: { color: colors.ink3, fontSize: 13 },
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
