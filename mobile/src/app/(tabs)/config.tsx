import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PeladaSwitcherSheet } from '@/components/PeladaSwitcherSheet';
import { Screen } from '@/components/Screen';
import { ServerUrlField } from '@/components/ServerUrlField';
import { Field, GhostButton, PrimaryButton, Segmented } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { BillingType } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

export default function ConfigScreen() {
  const { session, signOut, refresh } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(session?.pelada.name ?? '');
  const [location, setLocation] = useState(session?.pelada.location ?? '');
  const [matchTime, setMatchTime] = useState(session?.pelada.match_time ?? '20:00');
  const [billing, setBilling] = useState<BillingType>(session?.pelada.default_billing_type ?? 'diarista');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (!session) return null;

  async function savePelada() {
    setFeedback(null);
    setSaving(true);
    try {
      await api.updatePelada({
        name: name.trim(),
        location: location.trim(),
        match_time: matchTime.trim() || '20:00',
        default_billing_type: billing,
      });
      await refresh();
      setFeedback('Pelada atualizada ✓');
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Configurações</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Sua pelada</Text>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Nome da pelada" />
        <Field label="Local" value={location} onChangeText={setLocation} placeholder="Onde vocês jogam" />
        <Field
          label="Horário (HH:MM)"
          value={matchTime}
          onChangeText={setMatchTime}
          placeholder="20:00"
          keyboardType="numbers-and-punctuation"
        />
        <Segmented<BillingType>
          label="Cobrança padrão"
          value={billing}
          onChange={setBilling}
          options={[
            { value: 'diarista', label: 'Diarista' },
            { value: 'mensalista', label: 'Mensalista' },
          ]}
        />
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        <PrimaryButton label="Salvar pelada" onPress={savePelada} loading={saving} />
      </View>

      <TouchableOpacity style={styles.navRow} onPress={() => setSwitcherOpen(true)} activeOpacity={0.7}>
        <Ionicons name="swap-horizontal" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Minhas peladas</Text>
          <Text style={styles.navSub}>Trocar, criar ou entrar em outra pelada</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navRow} onPress={() => router.push('/financeiro')} activeOpacity={0.7}>
        <Ionicons name="cash-outline" size={22} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Financeiro</Text>
          <Text style={styles.navSub}>Caixa, diária, entradas/saídas e mensalistas</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
      </TouchableOpacity>

      <PeladaSwitcherSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      <View style={styles.card}>
        <Text style={styles.section}>Conta</Text>
        <View>
          <Text style={styles.label}>E-mail</Text>
          <Text style={styles.value}>{session.user.email}</Text>
        </View>
        <ServerUrlField />
        <GhostButton label="Sair da conta" tone="danger" onPress={signOut} />
      </View>

      <Text style={styles.hint}>
        Criar/entrar em várias peladas e perfil chegam nas próximas fases.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 28, fontFamily: fonts.extrabold },
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
  feedback: { color: colors.greenB, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },
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
});
