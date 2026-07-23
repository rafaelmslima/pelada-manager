import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PeladaSwitcherSheet } from '@/components/PeladaSwitcherSheet';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ReminderSheet } from '@/components/ReminderSheet';
import { Screen } from '@/components/Screen';
import { ServerUrlField } from '@/components/ServerUrlField';
import { GhostButton } from '@/components/form';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, spacing } from '@/theme';

export default function ConfigScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  if (!session) return null;

  const isPremium = session.user.plan === 'premium';

  const displayName = session.user.name || session.user.email;

  return (
    <Screen>
      <Text style={styles.title}>Configurações</Text>

      <TouchableOpacity style={styles.profileRow} onPress={() => router.push('/perfil')} activeOpacity={0.7}>
        <PlayerAvatar name={displayName} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.profileSub} numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <View style={styles.peladaCard}>
        <Text style={styles.peladaLabel}>Pelada atual</Text>
        <Text style={styles.peladaName}>{session.pelada.name}</Text>
        {session.pelada.location ? <Text style={styles.peladaMeta}>{session.pelada.location}</Text> : null}
      </View>

      <TouchableOpacity style={styles.navRow} onPress={() => router.push('/pelada-config')} activeOpacity={0.7}>
        <Ionicons name="settings-outline" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Configurar pelada</Text>
          <Text style={styles.navSub}>Nome, local, horário, diária, mensalidade e vencimento</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navRow} onPress={() => router.push('/financeiro')} activeOpacity={0.7}>
        <Ionicons name="cash-outline" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Financeiro</Text>
          <Text style={styles.navSub}>Caixa, pagamentos, entradas e saídas</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navRow} onPress={() => setSwitcherOpen(true)} activeOpacity={0.7}>
        <Ionicons name="swap-horizontal" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Minhas peladas</Text>
          <Text style={styles.navSub}>Trocar, criar ou entrar em outra pelada</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navRow} onPress={() => setReminderOpen(true)} activeOpacity={0.7}>
        <Ionicons name="alarm-outline" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Lembrete da pelada</Text>
          <Text style={styles.navSub}>Agende um alerta no seu celular</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navRow} onPress={() => router.push('/premium')} activeOpacity={0.7}>
        <Ionicons name="star" size={22} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Premium {isPremium ? '✓' : ''}</Text>
          <Text style={styles.navSub}>
            {isPremium ? 'Plano ativo — obrigado!' : 'Várias peladas, financeiro e mais'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <PeladaSwitcherSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <ReminderSheet
        visible={reminderOpen}
        peladaName={session.pelada.name}
        defaultTime={session.pelada.match_time}
        onClose={() => setReminderOpen(false)}
      />

      <View style={styles.card}>
        <Text style={styles.section}>Conta</Text>
        <ServerUrlField />
        <GhostButton label="Sair da conta" tone="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.extrabold },
  peladaCard: {
    backgroundColor: colors.dark,
    borderRadius: radius.cardMd,
    padding: spacing.four,
    gap: spacing.one,
  },
  peladaLabel: { color: colors.onDark2, fontSize: 12, fontFamily: fonts.semibold },
  peladaName: { color: colors.onDark, fontSize: 22, fontFamily: fonts.extrabold },
  peladaMeta: { color: colors.onDark2, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  label: { color: colors.ink3, fontSize: 12, fontWeight: '700' },
  value: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
  },
  navTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  navSub: { color: colors.ink3, fontSize: 12 },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
  },
  profileName: { color: colors.ink, fontSize: 17, fontFamily: fonts.extrabold },
  profileSub: { color: colors.ink3, fontSize: 13 },
});
