import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { StarRating } from '@/components/StarRating';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PrimaryButton } from '@/components/form';
import { api } from '@/lib/api';
import type { MatchRead } from '@/lib/types';
import { colors, spacing } from '@/theme';

export function RatingSheet({
  visible,
  matchId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  matchId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [match, setMatch] = useState<MatchRead | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || matchId == null) return;
    setLoading(true);
    setMatch(null);
    Promise.all([api.getMatch(matchId), api.getMatchRatings(matchId)])
      .then(([m, ratings]) => {
        setMatch(m);
        const map: Record<number, number> = {};
        ratings.forEach((r) => {
          map[r.player_id] = r.score;
        });
        setScores(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, matchId]);

  async function save() {
    if (matchId == null) return;
    const ratings = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .map(([player_id, score]) => ({ player_id: Number(player_id), score }));
    setSaving(true);
    try {
      await api.saveMatchRatings(matchId, ratings);
      onSaved?.();
      onClose();
    } catch {
      /* mantém aberto */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Avaliar jogadores">
      {loading || !match ? (
        <ActivityIndicator color={colors.ink} style={{ marginVertical: spacing.five }} />
      ) : (
        <>
          <Text style={styles.hint}>
            A nota vira a média das avaliações e ajusta a nota do jogador — melhorando o sorteio ao longo do tempo.
          </Text>
          {match.teams.flatMap((team) =>
            team.players.map((mp) => (
              <View key={mp.id} style={styles.row}>
                <PlayerAvatar name={mp.player.name} size={36} />
                <Text style={styles.name} numberOfLines={1}>
                  {mp.player.name}
                </Text>
                <StarRating
                  value={scores[mp.player_id] ?? 0}
                  onChange={(v) => setScores((prev) => ({ ...prev, [mp.player_id]: v }))}
                />
              </View>
            )),
          )}
          <PrimaryButton label="Salvar avaliações" onPress={save} loading={saving} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  name: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
});
