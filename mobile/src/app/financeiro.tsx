import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [entrySheet, setEntrySheet] = useState<'income' | 'expense' | null>(null);

  const load = useCallback(() => {
    api
      .getFinance()
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function toggleDiarista(playerId: number) {
    try {
      await api.togglePlayerDaily(playerId);
      load();
    } catch {
      /* ignora */
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

  const diaristas = data?.diaristas ?? [];
  const mensalistas = data?.mensalistas ?? [];
  const hasPayers = diaristas.length > 0 || mensalistas.length > 0;
  const feeMissing = data && ((diaristas.length > 0 && data.daily_fee <= 0) || (mensalistas.length > 0 && data.monthly_fee <= 0));

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

      {feeMissing ? (
        <TouchableOpacity style={styles.warnBanner} onPress={() => router.push('/pelada-config')} activeOpacity={0.8}>
          <Ionicons name="alert-circle" size={18} color={colors.absT} />
          <Text style={styles.warnText}>Defina os valores em Configurar pelada para o caixa atualizar sozinho.</Text>
        </TouchableOpacity>
      ) : null}

      {/* Pagamentos */}
      <View style={styles.card}>
        <Text style={styles.section}>Pagamentos</Text>
        <Text style={styles.hint}>
          Toque num jogador para marcar/desmarcar o pagamento. O caixa é atualizado automaticamente com o valor da
          pelada.
        </Text>

        {!hasPayers ? (
          <Text style={styles.empty}>Confirme jogadores no sorteio para cobrar aqui.</Text>
        ) : null}

        {diaristas.length > 0 ? (
          <>
            <Text style={styles.subhead}>Diaristas de hoje</Text>
            {diaristas.map((d) => (
              <TouchableOpacity
                key={`d-${d.player_id}`}
                style={styles.payRow}
                onPress={() => toggleDiarista(d.player_id)}
                activeOpacity={0.7}>
                <Text style={styles.payName}>{d.name}</Text>
                <View style={[styles.badge, { backgroundColor: d.paid ? colors.confBg : colors.pendBg }]}>
                  <Text style={[styles.badgeText, { color: d.paid ? colors.confT : colors.pendT }]}>
                    {d.paid ? 'Pago' : 'Pendente'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {mensalistas.length > 0 ? (
          <>
            <Text style={styles.subhead}>Mensalistas</Text>
            {mensalistas.map((m) => {
              const label = m.up_to_date ? 'Em dia' : m.overdue ? 'Atrasado' : 'Pendente';
              const color = m.up_to_date ? colors.confT : m.overdue ? colors.absT : colors.pendT;
              const bg = m.up_to_date ? colors.confBg : m.overdue ? colors.absBg : colors.pendBg;
              return (
                <TouchableOpacity
                  key={`m-${m.player_id}`}
                  style={styles.payRow}
                  onPress={() => toggleMensalista(m.player_id)}
                  activeOpacity={0.7}>
                  <Text style={styles.payName}>{m.name}</Text>
                  <View style={[styles.badge, { backgroundColor: bg }]}>
                    <Text style={[styles.badgeText, { color }]}>{label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
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

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.absBg,
    borderRadius: radius.cardSm,
    padding: spacing.three,
  },
  warnText: { color: colors.absT, fontSize: 12, flex: 1, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  subhead: { color: colors.ink3, fontSize: 12, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.one },
  hint: { color: colors.ink3, fontSize: 12, lineHeight: 16 },
  actionsRow: { flexDirection: 'row', gap: spacing.three },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: spacing.three, paddingVertical: spacing.one, borderRadius: radius.chip },
  badgeText: { fontSize: 12, fontWeight: '700' },

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
