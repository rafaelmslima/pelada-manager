import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { formatPosition } from '@/lib/format';
import type { RankingPlayer, RankingsSummary } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

const MEDALS = [colors.gold, colors.silver, colors.bronze];

export default function RankingScreen() {
  const [data, setData] = useState<RankingsSummary | null>(null);

  const load = useCallback(() => {
    api.rankings().then(setData).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <Screen>
      <Text style={styles.title}>Ranking</Text>
      <RankingSection
        heading="Artilheiros"
        players={data?.scorers.players ?? []}
        metric={(p) => p.goals}
        unit="gols"
      />
      <RankingSection
        heading="Assistências"
        players={data?.assists.players ?? []}
        metric={(p) => p.assists}
        unit="assist."
      />
    </Screen>
  );
}

function RankingSection({
  heading,
  players,
  metric,
  unit,
}: {
  heading: string;
  players: RankingPlayer[];
  metric: (p: RankingPlayer) => number;
  unit: string;
}) {
  const podium = players.slice(0, 3);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>

      {players.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sem dados ainda. Registre estatísticas nas partidas.</Text>
        </View>
      ) : (
        <>
          {podium.length >= 2 && (
            <View style={styles.podium}>
              {/* Ordem visual: 2º, 1º, 3º */}
              {[podium[1], podium[0], podium[2]].map((p, idx) =>
                p ? (
                  <PodiumSpot key={p.player_id} player={p} place={idx === 1 ? 1 : idx === 0 ? 2 : 3} value={metric(p)} />
                ) : (
                  <View key={`empty-${idx}`} style={styles.podiumSpot} />
                ),
              )}
            </View>
          )}

          <View style={styles.list}>
            {players.map((p, index) => (
              <View key={p.player_id} style={styles.row}>
                <Text style={[styles.rank, index < 3 && { color: MEDALS[index] }]}>{index + 1}</Text>
                <PlayerAvatar name={p.name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatPosition(p.position)} · {p.matches_played} jogos
                  </Text>
                </View>
                <Text style={styles.rowValue}>
                  {metric(p)} <Text style={styles.rowUnit}>{unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function PodiumSpot({ player, place, value }: { player: RankingPlayer; place: number; value: number }) {
  const height = place === 1 ? 92 : place === 2 ? 72 : 56;
  return (
    <View style={styles.podiumSpot}>
      <PlayerAvatar name={player.name} size={place === 1 ? 56 : 44} />
      <Text style={styles.podiumName} numberOfLines={1}>
        {player.name.split(' ')[0]}
      </Text>
      <View style={[styles.pedestal, { height, borderColor: MEDALS[place - 1] }]}>
        <Text style={styles.podiumValue}>{value}</Text>
        <Text style={[styles.podiumPlace, { color: MEDALS[place - 1] }]}>{place}º</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.extrabold },
  section: { gap: spacing.three },
  heading: { color: colors.ink, fontSize: 18, fontFamily: fonts.extrabold },

  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
  },
  emptyText: { color: colors.ink3, fontSize: 13 },

  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.three,
    backgroundColor: colors.dark,
    borderRadius: radius.cardLg,
    padding: spacing.four,
  },
  podiumSpot: { flex: 1, alignItems: 'center', gap: spacing.one },
  podiumName: { color: colors.onDark, fontSize: 12, fontWeight: '700' },
  pedestal: {
    width: '100%',
    borderTopWidth: 3,
    backgroundColor: colors.dark2,
    borderTopLeftRadius: radius.badge,
    borderTopRightRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.half,
  },
  podiumValue: { color: colors.onDark, fontSize: 24, fontFamily: fonts.display },
  podiumPlace: { fontSize: 12, fontFamily: fonts.extrabold },

  list: { gap: spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
  },
  rank: { width: 20, textAlign: 'center', color: colors.ink3, fontWeight: '800', fontSize: 14 },
  rowName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: colors.ink3, fontSize: 12 },
  rowValue: { color: colors.ink, fontSize: 18, fontFamily: fonts.display },
  rowUnit: { color: colors.ink3, fontSize: 11, fontWeight: '600' },
});
