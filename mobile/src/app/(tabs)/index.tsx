import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { greeting } from '@/lib/format';
import type { Player } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const { session } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);

  const load = useCallback(() => {
    api.listPlayers().then(setPlayers).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!session) return null;

  const pelada = session.pelada;
  const confirmed = players.filter((p) => p.is_active).length;
  const progress = players.length ? Math.round((confirmed / players.length) * 100) : 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}, dono da bola</Text>
        <Text style={styles.title}>{pelada.name}</Text>
        <Text style={styles.subtitle}>
          {[pelada.location, pelada.match_time].filter(Boolean).join(' · ') || 'Configure sua pelada'}
        </Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>Pelada ativa</Text>
        </View>
        <Text style={styles.counter}>
          {confirmed}
          <Text style={styles.counterTotal}> / {players.length}</Text>
        </Text>
        <Text style={styles.counterLabel}>confirmados para hoje</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <Text style={styles.note}>
        A geração de times foi para a aba <Text style={styles.noteStrong}>Times</Text>. Este painel vira o
        resumo do dia (próximos passos na Fase 2).
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.one },
  greeting: { color: colors.ink3, fontSize: 14, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.ink2, fontSize: 14 },

  heroCard: {
    backgroundColor: colors.dark,
    borderRadius: radius.cardLg,
    padding: spacing.five,
    gap: spacing.two,
  },
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
  counter: { color: colors.onDark, fontSize: 48, fontWeight: '800' },
  counterTotal: { color: colors.onDark2, fontSize: 24, fontWeight: '700' },
  counterLabel: { color: colors.onDark2, fontSize: 13 },
  progressTrack: {
    height: 8,
    backgroundColor: colors.dark2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.two,
  },
  progressFill: { height: 8, backgroundColor: colors.green, borderRadius: 4 },

  note: { color: colors.ink3, fontSize: 13, lineHeight: 19 },
  noteStrong: { color: colors.ink, fontWeight: '700' },
});
