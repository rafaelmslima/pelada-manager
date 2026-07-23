import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ConvocarButton } from '@/components/ConvocarButton';
import { PeladaSwitcherSheet } from '@/components/PeladaSwitcherSheet';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney, greeting } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import type { FinanceOverview, Player, RankingsSummary } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

type StatItem = { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; path: string };

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rankings, setRankings] = useState<RankingsSummary | null>(null);
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const load = useCallback(() => {
    api.listPlayers().then(setPlayers).catch(() => {});
    api.rankings().then(setRankings).catch(() => {});
    api.getFinance().then(setFinance).catch(() => setFinance(null));
    api.listMatches().then((m) => setMatchCount(m.length)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!session) return null;

  function go(path: string) {
    haptics.select();
    router.push(path as never);
  }

  const pelada = session.pelada;
  const firstName = session.user.name?.trim().split(' ')[0];
  const confirmed = players.filter((p) => p.presence === 'confirmed').length;
  const declined = players.filter((p) => p.presence === 'declined').length;
  const pending = players.length - confirmed - declined;
  const progress = players.length ? Math.round((confirmed / players.length) * 100) : 0;

  const topScorer = rankings?.scorers.players[0];
  const topAssister = rankings?.assists.players[0];
  const overdueCount = finance?.mensalistas.filter((m) => m.overdue).length ?? 0;

  const stats: StatItem[] = [
    ...(finance ? [{ label: 'Caixa', value: formatMoney(finance.balance), icon: 'wallet' as const, path: '/financeiro' }] : []),
    { label: 'Elenco', value: String(players.length), icon: 'people', path: '/jogadores' },
    { label: 'Peladas', value: String(matchCount), icon: 'calendar', path: '/times' },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {greeting()}, {firstName || 'dono da bola'} 👋
        </Text>
        <TouchableOpacity style={styles.titleRow} onPress={() => setSwitcherOpen(true)} activeOpacity={0.7}>
          <Text style={styles.title}>{pelada.name}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.ink3} />
        </TouchableOpacity>
        <Text style={styles.subtitle}>
          {[pelada.location, pelada.match_time].filter(Boolean).join(' · ') || 'Configure sua pelada'}
        </Text>
      </View>

      <PeladaSwitcherSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      {/* Presença de hoje */}
      <TouchableOpacity style={styles.heroCard} activeOpacity={0.9} onPress={() => go('/jogadores')}>
        <View style={styles.chip}>
          <View style={styles.chipDot} />
          <Text style={styles.chipText}>Presença de hoje</Text>
        </View>
        <Text style={styles.counter}>
          {confirmed}
          <Text style={styles.counterTotal}> / {players.length}</Text>
        </Text>
        <Text style={styles.counterLabel}>confirmados · {progress}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.breakdown}>
          <Breakdown color={colors.conf} label="Confirmados" value={confirmed} />
          <Breakdown color={colors.pend} label="Pendentes" value={pending} />
          <Breakdown color={colors.abs} label="Não vão" value={declined} />
        </View>
      </TouchableOpacity>

      <ConvocarButton peladaName={pelada.name} />

      {/* Pendência: mensalistas atrasados */}
      {overdueCount > 0 && (
        <TouchableOpacity style={styles.alert} onPress={() => go('/financeiro')} activeOpacity={0.85}>
          <Ionicons name="alert-circle" size={20} color={colors.absT} />
          <Text style={styles.alertText}>
            {overdueCount} mensalista{overdueCount > 1 ? 's' : ''} com pagamento atrasado
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.absT} />
        </TouchableOpacity>
      )}

      {/* Mini indicadores */}
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <TouchableOpacity key={s.label} style={styles.statCard} onPress={() => go(s.path)} activeOpacity={0.85}>
            <Ionicons name={s.icon} size={18} color={colors.ink3} />
            <Text style={styles.statValue} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ações rápidas */}
      <View style={styles.actionsRow}>
        <QuickAction icon="shirt" label="Gerar times" onPress={() => go('/times')} />
        <QuickAction icon="podium" label="Ranking" onPress={() => go('/ranking')} />
      </View>

      {/* Destaques */}
      {(topScorer || topAssister) && (
        <>
          <Text style={styles.sectionTitle}>Destaques</Text>
          <View style={styles.hlRow}>
            {topScorer && (
              <HighlightCard
                icon="football"
                iconColor={colors.gold}
                label="Artilheiro"
                name={topScorer.name}
                value={`${topScorer.goals} ${topScorer.goals === 1 ? 'gol' : 'gols'}`}
              />
            )}
            {topAssister && topAssister.assists > 0 && (
              <HighlightCard
                icon="sparkles"
                iconColor={colors.green}
                label="Garçom"
                name={topAssister.name}
                value={`${topAssister.assists} assist.`}
              />
            )}
          </View>
        </>
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

function HighlightCard({
  icon,
  iconColor,
  label,
  name,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <View style={styles.hlCard}>
      <View style={styles.hlHead}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={styles.hlLabel}>{label}</Text>
      </View>
      <Text style={styles.hlName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.hlValue}>{value}</Text>
    </View>
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

  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.absBg,
    borderRadius: radius.cardMd,
    padding: spacing.four,
  },
  alertText: { flex: 1, color: colors.absT, fontSize: 13, fontFamily: fonts.bold },

  statsRow: { flexDirection: 'row', gap: spacing.three },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.four,
    paddingHorizontal: spacing.two,
    alignItems: 'center',
    gap: spacing.one,
  },
  statValue: { color: colors.ink, fontSize: 20, fontFamily: fonts.extrabold },
  statLabel: { color: colors.ink3, fontSize: 11, fontFamily: fonts.semibold },

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

  sectionTitle: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold, marginTop: spacing.one },
  hlRow: { flexDirection: 'row', gap: spacing.three },
  hlCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.one,
  },
  hlHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  hlLabel: { color: colors.ink3, fontSize: 12, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  hlName: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold, marginTop: spacing.one },
  hlValue: { color: colors.ink2, fontSize: 13, fontFamily: fonts.semibold },
});
