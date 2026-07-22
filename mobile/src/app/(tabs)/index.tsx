import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ConvocarButton } from '@/components/ConvocarButton';
import { PeladaSwitcherSheet } from '@/components/PeladaSwitcherSheet';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { greeting } from '@/lib/format';
import type { Player, RankingsSummary } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rankings, setRankings] = useState<RankingsSummary | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const load = useCallback(() => {
    api.listPlayers().then(setPlayers).catch(() => {});
    api.rankings().then(setRankings).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!session) return null;

  const pelada = session.pelada;
  const confirmed = players.filter((p) => p.presence === 'confirmed').length;
  const declined = players.filter((p) => p.presence === 'declined').length;
  const pending = players.length - confirmed - declined;
  const progress = players.length ? Math.round((confirmed / players.length) * 100) : 0;
  const topScorer = rankings?.scorers.players[0];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}, dono da bola</Text>
        <TouchableOpacity style={styles.titleRow} onPress={() => setSwitcherOpen(true)} activeOpacity={0.7}>
          <Text style={styles.title}>{pelada.name}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.ink3} />
        </TouchableOpacity>
        <Text style={styles.subtitle}>
          {[pelada.location, pelada.match_time].filter(Boolean).join(' · ') || 'Configure sua pelada'}
        </Text>
      </View>

      <PeladaSwitcherSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      <View style={styles.heroCard}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>Presença de hoje</Text>
        </View>
        <Text style={styles.counter}>
          {confirmed}
          <Text style={styles.counterTotal}> / {players.length}</Text>
        </Text>
        <Text style={styles.counterLabel}>confirmados</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.breakdown}>
          <Breakdown color={colors.conf} label="Confirmados" value={confirmed} />
          <Breakdown color={colors.pend} label="Pendentes" value={pending} />
          <Breakdown color={colors.abs} label="Não vão" value={declined} />
        </View>
      </View>

      <ConvocarButton peladaName={pelada.name} />

      <View style={styles.actionsRow}>
        <QuickAction icon="shirt" label="Gerar times" onPress={() => router.push('/times')} />
        <QuickAction icon="people" label="Jogadores" onPress={() => router.push('/jogadores')} />
      </View>

      {topScorer && (
        <View style={styles.highlight}>
          <Ionicons name="football" size={22} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightLabel}>Artilheiro</Text>
            <Text style={styles.highlightName}>{topScorer.name}</Text>
          </View>
          <Text style={styles.highlightValue}>{topScorer.goals} gols</Text>
        </View>
      )}
    </Screen>
  );
}

function Breakdown({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.breakItem}>
      <View style={[styles.breakDot, { backgroundColor: color }]} />
      <Text style={styles.breakValue}>{value}</Text>
      <Text style={styles.breakLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={22} color={colors.ink} />
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.one },
  greeting: { color: colors.ink3, fontSize: 14, fontFamily: fonts.semibold },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  title: { color: colors.ink, fontSize: 30, fontFamily: fonts.extrabold },
  subtitle: { color: colors.ink2, fontSize: 14, fontFamily: fonts.regular },

  heroCard: { backgroundColor: colors.dark, borderRadius: radius.cardLg, padding: spacing.five, gap: spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    alignSelf: 'flex-start',
    backgroundColor: colors.dark2,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
    borderRadius: radius.chip,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  chipText: { color: colors.onDark, fontSize: 12, fontWeight: '600' },
  counter: { color: colors.onDark, fontSize: 54, fontFamily: fonts.display },
  counterTotal: { color: colors.onDark2, fontSize: 26, fontFamily: fonts.display },
  counterLabel: { color: colors.onDark2, fontSize: 13 },
  progressTrack: { height: 8, backgroundColor: colors.dark2, borderRadius: 4, overflow: 'hidden', marginTop: spacing.two },
  progressFill: { height: 8, backgroundColor: colors.green, borderRadius: 4 },
  breakdown: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.three },
  breakItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.one },
  breakDot: { width: 8, height: 8, borderRadius: 4 },
  breakValue: { color: colors.onDark, fontSize: 14, fontWeight: '800' },
  breakLabel: { color: colors.onDark2, fontSize: 11 },

  actionsRow: { flexDirection: 'row', gap: spacing.three },
  quick: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.four,
    alignItems: 'center',
    gap: spacing.two,
  },
  quickLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },

  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
  },
  highlightLabel: { color: colors.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  highlightName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  highlightValue: { color: colors.ink2, fontSize: 14, fontWeight: '700' },
});
