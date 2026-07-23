import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, PrimaryButton, Segmented } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { BillingType } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

function parseMoney(value: string): number {
  return Math.max(0, Number(value.replace(',', '.')) || 0);
}

export default function PeladaConfigScreen() {
  const { session, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const pelada = session?.pelada;

  const [name, setName] = useState(pelada?.name ?? '');
  const [location, setLocation] = useState(pelada?.location ?? '');
  const [matchTime, setMatchTime] = useState(pelada?.match_time ?? '20:00');
  const [billing, setBilling] = useState<BillingType>(pelada?.default_billing_type ?? 'diarista');
  const [dailyFee, setDailyFee] = useState(pelada?.daily_fee ? String(pelada.daily_fee) : '');
  const [monthlyFee, setMonthlyFee] = useState(pelada?.monthly_fee ? String(pelada.monthly_fee) : '');
  const [dueDay, setDueDay] = useState(String(pelada?.monthly_due_day || 10));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!pelada) return null;

  async function save() {
    setFeedback(null);
    setSaving(true);
    try {
      await api.updatePelada({
        name: name.trim(),
        location: location.trim(),
        match_time: matchTime.trim() || '20:00',
        default_billing_type: billing,
        daily_fee: parseMoney(dailyFee),
        monthly_fee: parseMoney(monthlyFee),
        monthly_due_day: Math.min(28, Math.max(1, parseInt(dueDay, 10) || 10)),
      });
      await refresh();
      setFeedback('Pelada atualizada ✓');
      setTimeout(() => router.back(), 700);
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: insets.top + spacing.two,
        paddingHorizontal: spacing.four,
        paddingBottom: insets.bottom + spacing.six,
        gap: spacing.four,
      }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurar pelada</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Informações</Text>
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
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Valores</Text>
        <Text style={styles.hint}>
          Usados no Financeiro: ao confirmar um pagamento, o caixa é atualizado automaticamente com estes valores.
        </Text>
        <View style={styles.valuesRow}>
          <View style={styles.valueField}>
            <Field label="Diária (R$)" value={dailyFee} onChangeText={setDailyFee} keyboardType="decimal-pad" placeholder="0,00" />
          </View>
          <View style={styles.valueField}>
            <Field
              label="Mensalidade (R$)"
              value={monthlyFee}
              onChangeText={setMonthlyFee}
              keyboardType="decimal-pad"
              placeholder="0,00"
            />
          </View>
        </View>
        <Field
          label="Dia de vencimento da mensalidade"
          value={dueDay}
          onChangeText={setDueDay}
          keyboardType="number-pad"
          placeholder="10"
        />
        <Text style={styles.hint}>
          Mensalistas voltam para “pendente” todo início de mês. Passado o dia de vencimento sem pagar, o sorteio avisa
          quem está atrasado.
        </Text>
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <PrimaryButton label="Salvar pelada" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.extrabold },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  hint: { color: colors.ink3, fontSize: 12, lineHeight: 16 },
  valuesRow: { flexDirection: 'row', gap: spacing.three },
  valueField: { flex: 1 },
  feedback: { color: colors.greenB, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
