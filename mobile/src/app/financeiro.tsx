import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';
import { Field, GhostButton, PrimaryButton } from '@/components/form';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { FinanceOverview } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

export default function FinanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<FinanceOverview | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [monthlyInput, setMonthlyInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('10');
  const [entrySheet, setEntrySheet] = useState<'income' | 'expense' | null>(null);

  const load = useCallback(() => {
    api
      .getFinance()
      .then((overview) => {
        setData(overview);
        setFeeInput(overview.daily_fee ? String(overview.daily_fee) : '');
        setMonthlyInput(overview.monthly_fee ? String(overview.monthly_fee) : '');
        setDueDayInput(String(overview.monthly_due_day || 10));
      })
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function saveSettings() {
    try {
      setData(
        await api.setFinanceSettings({
          daily_fee: Math.max(0, Number(feeInput.replace(',', '.')) || 0),
          monthly_fee: Math.max(0, Number(monthlyInput.replace(',', '.')) || 0),
          monthly_due_day: Math.min(28, Math.max(1, parseInt(dueDayInput, 10) || 10)),
        }),
      );
    } catch {
      /* ignora */
    }
  }

  async function collectDaily() {
    try {
      setData(await api.collectDaily());
    } catch (err) {
      Alert.alert('Não foi possível cobrar', err instanceof Error ? err.message : 'Erro.');
    }
  }

  async function toggleMensalista(playerId: number) {
    try {
      await api.togglePlayerMonthly(playerId);
      load();
    } catch {
      /* ignora */
    }
  }

  function confirmDeleteEntry(id: number) {
    Alert.alert('Excluir lançamento', 'Remover este lançamento do caixa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            setData(await api.deleteFinanceEntry(id));
          } catch {
            /* ignora */
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + spacing.two, paddingHorizontal: spacing.four, paddingBottom: insets.bottom + spacing.six, gap: spacing.four }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financeiro</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Caixa */}
      <View style={styles.caixaCard}>
        <Text style={styles.caixaLabel}>Caixa da pelada</Text>
        <Text style={styles.caixaValue}>{formatMoney(data?.balance ?? 0)}</Text>
        <View style={styles.caixaRow}>
          <Text style={styles.caixaIn}>↑ {formatMoney(data?.total_income ?? 0)}</Text>
          <Text style={styles.caixaOut}>↓ {formatMoney(data?.total_expense ?? 0)}</Text>
        </View>
      </View>

      {/* Valores */}
      <View style={styles.card}>
        <Text style={styles.section}>Valores</Text>
        <View style={styles.valuesRow}>
          <View style={styles.valueField}>
            <Text style={styles.valueLabel}>Diária (R$)</Text>
            <TextInput
              style={styles.feeInput}
              value={feeInput}
              onChangeText={setFeeInput}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.ink4}
            />
          </View>
          <View style={styles.valueField}>
            <Text style={styles.valueLabel}>Mensalidade (R$)</Text>
            <TextInput
              style={styles.feeInput}
              value={monthlyInput}
              onChangeText={setMonthlyInput}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.ink4}
            />
          </View>
          <View style={{ width: 90 }}>
            <Text style={styles.valueLabel}>Vence dia</Text>
            <TextInput
              style={styles.feeInput}
              value={dueDayInput}
              onChangeText={setDueDayInput}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="10"
              placeholderTextColor={colors.ink4}
            />
          </View>
        </View>
        <GhostButton label="Salvar valores" onPress={saveSettings} />
        <PrimaryButton label="Cobrar diária dos confirmados" onPress={collectDaily} />
      </View>

      {/* Ações rápidas */}
      <View style={styles.actionsRow}>
        <View style={{ flex: 1 }}>
          <GhostButton label="+ Entrada" onPress={() => setEntrySheet('income')} />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label="− Saída" tone="danger" onPress={() => setEntrySheet('expense')} />
        </View>
      </View>

      {/* Mensalistas */}
      {data && data.mensalistas.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.section}>Mensalistas</Text>
          <Text style={styles.mensHint}>
            Todo início de mês voltam para pendente. Toque para marcar o pagamento do mês.
          </Text>
          {data.mensalistas.map((m) => {
            const label = m.up_to_date ? 'Em dia' : m.overdue ? 'Atrasado' : 'Pendente';
            const color = m.up_to_date ? colors.confT : m.overdue ? colors.absT : colors.pendT;
            const bg = m.up_to_date ? colors.confBg : m.overdue ? colors.absBg : colors.pendBg;
            return (
              <TouchableOpacity
                key={m.player_id}
                style={styles.mensRow}
                onPress={() => toggleMensalista(m.player_id)}
                activeOpacity={0.7}>
                <Text style={styles.mensName}>{m.name}</Text>
                <View style={[styles.mensBadge, { backgroundColor: bg }]}>
                  <Text style={[styles.mensBadgeText, { color }]}>{label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Extrato */}
      <Text style={styles.section}>Extrato</Text>
      {!data || data.entries.length === 0 ? (
        <Text style={styles.empty}>Nenhum lançamento ainda.</Text>
      ) : (
        data.entries.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={[styles.entryDot, { backgroundColor: e.kind === 'income' ? colors.conf : colors.abs }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.entryDesc}>{e.description || (e.kind === 'income' ? 'Entrada' : 'Saída')}</Text>
              {e.player_name ? <Text style={styles.entryMeta}>{e.player_name}</Text> : null}
            </View>
            <Text style={[styles.entryAmount, { color: e.kind === 'income' ? colors.greenB : colors.absT }]}>
              {e.kind === 'income' ? '+' : '−'} {formatMoney(e.amount)}
            </Text>
            <TouchableOpacity onPress={() => confirmDeleteEntry(e.id)} hitSlop={6} style={{ marginLeft: spacing.two }}>
              <Ionicons name="trash-outline" size={16} color={colors.ink4} />
            </TouchableOpacity>
          </View>
        ))
      )}

      <EntrySheet
        kind={entrySheet}
        onClose={() => setEntrySheet(null)}
        onSaved={(overview) => {
          setData(overview);
          setEntrySheet(null);
        }}
      />
    </ScrollView>
  );
}

function EntrySheet({
  kind,
  onClose,
  onSaved,
}: {
  kind: 'income' | 'expense' | null;
  onClose: () => void;
  onSaved: (overview: FinanceOverview) => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (kind) {
      setAmount('');
      setDescription('');
    }
  }, [kind]);

  async function save() {
    if (!kind) return;
    const value = Number(amount.replace(',', '.')) || 0;
    if (value <= 0) return;
    setSaving(true);
    try {
      const overview = await api.addFinanceEntry({ kind, amount: value, description: description.trim() });
      onSaved(overview);
    } catch {
      /* ignora */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={kind != null} onClose={onClose} title={kind === 'expense' ? 'Nova saída' : 'Nova entrada'}>
      <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <Field
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        placeholder={kind === 'expense' ? 'Ex.: aluguel da quadra' : 'Ex.: diária avulsa'}
      />
      <PrimaryButton label="Salvar" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.extrabold },

  caixaCard: { backgroundColor: colors.dark, borderRadius: radius.cardLg, padding: spacing.five, gap: spacing.one },
  caixaLabel: { color: colors.onDark2, fontSize: 13, fontFamily: fonts.semibold },
  caixaValue: { color: colors.onDark, fontSize: 46, fontFamily: fonts.display },
  caixaRow: { flexDirection: 'row', gap: spacing.four, marginTop: spacing.two },
  caixaIn: { color: colors.green, fontSize: 14, fontWeight: '700' },
  caixaOut: { color: colors.danger, fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  valuesRow: { flexDirection: 'row', gap: spacing.two },
  valueField: { flex: 1, gap: spacing.one },
  valueLabel: { color: colors.ink3, fontSize: 11, fontFamily: fonts.bold },
  feeInput: {
    backgroundColor: colors.page,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: spacing.two,
    paddingVertical: spacing.three,
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: spacing.three },
  mensHint: { color: colors.ink3, fontSize: 12, lineHeight: 16 },

  mensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mensName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  mensBadge: { paddingHorizontal: spacing.three, paddingVertical: spacing.one, borderRadius: radius.chip },
  paidBadge: { backgroundColor: colors.confBg },
  dueBadge: { backgroundColor: colors.absBg },
  mensBadgeText: { fontSize: 12, fontWeight: '700' },

  empty: { color: colors.ink3, fontSize: 13 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
  },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  entryDesc: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  entryMeta: { color: colors.ink3, fontSize: 12 },
  entryAmount: { fontSize: 14, fontWeight: '800' },
});
