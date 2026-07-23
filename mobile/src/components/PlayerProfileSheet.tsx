import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { api } from '@/lib/api';
import { formatDateDisplay, formatPosition, whatsappLink } from '@/lib/format';
import type { PlayerProfile } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';

export function PlayerProfileSheet({
  visible,
  playerId,
  onClose,
}: {
  visible: boolean;
  playerId: number | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || playerId == null) return;
    setLoading(true);
    setProfile(null);
    api
      .playerProfile(playerId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, playerId]);

  const wa = profile?.player.whatsapp ? whatsappLink(profile.player.whatsapp) : '';

  return (
    <Sheet visible={visible} onClose={onClose} title={profile?.player.name ?? 'Perfil'}>
      {loading || !profile ? (
        <ActivityIndicator color={colors.ink} style={{ marginVertical: spacing.five }} />
      ) : (
        <>
          <Text style={styles.subtitle}>
            {formatPosition(profile.player.position)} · Nota {profile.player.rating}
          </Text>

          <View style={styles.stats}>
            <Stat label="Gols" value={profile.total_goals} />
            <Stat label="Assist." value={profile.total_assists} />
            <Stat label="Vitórias" value={profile.total_wins} />
            <Stat label="Peladas" value={profile.total_matches} />
            <Stat label="Time ★" value={profile.team_of_the_week_count} />
          </View>

          {wa ? (
            <TouchableOpacity style={styles.wa} onPress={() => Linking.openURL(wa)} activeOpacity={0.85}>
              <Text style={styles.waText}>Abrir WhatsApp</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.section}>Histórico</Text>
          {profile.history.length === 0 ? (
            <Text style={styles.empty}>Ainda sem partidas registradas.</Text>
          ) : (
            profile.history.map((item) => (
              <View key={item.match_id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{formatDateDisplay(item.date)}</Text>
                  <Text style={styles.historyTeam}>{item.team_name}</Text>
                </View>
                <Text style={styles.historyStat}>
                  {item.goals}G · {item.assists}A{item.was_in_team_of_the_week ? ' · ★' : ''}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.ink2, fontSize: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.two },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.raised,
    borderRadius: radius.cardSm,
    paddingVertical: spacing.three,
    alignItems: 'center',
  },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.ink3, fontSize: 11, fontWeight: '600' },
  wa: {
    backgroundColor: colors.greenBg,
    borderRadius: radius.btn,
    paddingVertical: spacing.three,
    alignItems: 'center',
  },
  waText: { color: colors.greenB, fontWeight: '700' },
  section: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: spacing.two },
  empty: { color: colors.ink3, fontSize: 13 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyDate: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  historyTeam: { color: colors.ink3, fontSize: 12 },
  historyStat: { color: colors.ink2, fontSize: 13, fontWeight: '700' },
});
