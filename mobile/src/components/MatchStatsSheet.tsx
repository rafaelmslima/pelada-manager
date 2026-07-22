import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { PrimaryButton } from '@/components/form';
import { api } from '@/lib/api';
import type { MatchRead } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';

type Stat = { goals: number; assists: number };

export function MatchStatsSheet({
  visible,
  matchId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  matchId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [match, setMatch] = useState<MatchRead | null>(null);
  const [stats, setStats] = useState<Record<number, Stat>>({});
  const [totw, setTotw] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || matchId == null) return;
    setLoading(true);
    setMatch(null);
    api
      .getMatch(matchId)
      .then((data) => {
        setMatch(data);
        const map: Record<number, Stat> = {};
        let best: number | null = null;
        data.teams.forEach((team) => {
          if (team.is_team_of_the_week) best = team.id;
          team.players.forEach((mp) => {
            map[mp.id] = { goals: mp.goals, assists: mp.assists };
          });
        });
        setStats(map);
        setTotw(best);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, matchId]);

  function bump(mpId: number, key: keyof Stat, delta: number) {
    setStats((prev) => {
      const cur = prev[mpId] ?? { goals: 0, assists: 0 };
      return { ...prev, [mpId]: { ...cur, [key]: Math.max(0, cur[key] + delta) } };
    });
  }

  async function save() {
    if (matchId == null) return;
    setSaving(true);
    try {
      await api.updateMatchStats(matchId, {
        team_of_the_week_id: totw,
        players: Object.entries(stats).map(([id, v]) => ({ id: Number(id), goals: v.goals, assists: v.assists })),
      });
      onSaved();
      onClose();
    } catch {
      /* mantém aberto em caso de erro */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Estatísticas da partida">
      {loading || !match ? (
        <ActivityIndicator color={colors.ink} style={{ marginVertical: spacing.five }} />
      ) : (
        <>
          {match.teams.map((team) => (
            <View key={team.id} style={styles.team}>
              <TouchableOpacity style={styles.teamHeader} onPress={() => setTotw(team.id)} activeOpacity={0.8}>
                <Text style={styles.teamName}>{team.name}</Text>
                <View style={styles.best}>
                  <Ionicons
                    name={totw === team.id ? 'star' : 'star-outline'}
                    size={16}
                    color={totw === team.id ? colors.gold : colors.ink4}
                  />
                  <Text style={[styles.bestText, totw === team.id && { color: colors.gold }]}>Melhor time</Text>
                </View>
              </TouchableOpacity>

              {team.players.map((mp) => {
                const s = stats[mp.id] ?? { goals: 0, assists: 0 };
                return (
                  <View key={mp.id} style={styles.playerRow}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {mp.player.name}
                    </Text>
                    <Stepper label="G" value={s.goals} onChange={(d) => bump(mp.id, 'goals', d)} />
                    <Stepper label="A" value={s.assists} onChange={(d) => bump(mp.id, 'assists', d)} />
                  </View>
                );
              })}
            </View>
          ))}
          <PrimaryButton label="Salvar estatísticas" onPress={save} loading={saving} />
        </>
      )}
    </Sheet>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (delta: number) => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={() => onChange(-1)} hitSlop={6} style={styles.stepBtn}>
        <Ionicons name="remove" size={16} color={colors.ink} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>
        {value}
        <Text style={styles.stepLabel}>{label}</Text>
      </Text>
      <TouchableOpacity onPress={() => onChange(1)} hitSlop={6} style={styles.stepBtn}>
        <Ionicons name="add" size={16} color={colors.ink} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  team: {
    backgroundColor: colors.raised,
    borderRadius: radius.cardSm,
    padding: spacing.three,
    gap: spacing.two,
  },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  best: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  bestText: { color: colors.ink4, fontSize: 12, fontWeight: '600' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  playerName: { flex: 1, color: colors.ink2, fontSize: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.one,
  },
  stepBtn: { padding: spacing.half },
  stepValue: { color: colors.ink, fontSize: 15, fontWeight: '800', minWidth: 26, textAlign: 'center' },
  stepLabel: { color: colors.ink3, fontSize: 11, fontWeight: '600' },
});
