import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, spacing } from '@/theme';
import { TouchableOpacity } from 'react-native';

const BENEFITS = [
  { icon: 'people' as const, text: 'Gerencie várias peladas' },
  { icon: 'cash' as const, text: 'Financeiro completo (caixa, diárias, mensalistas)' },
  { icon: 'football' as const, text: 'Placar ao vivo e avaliação pós-jogo' },
  { icon: 'notifications' as const, text: 'Lembretes automáticos da pelada' },
  { icon: 'infinite' as const, text: 'Jogadores ilimitados' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, applyAuth } = useAuth();
  const isPremium = session?.user.plan === 'premium';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const me = await api.activatePremium(code.trim());
      applyAuth(me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível ativar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + spacing.two, paddingHorizontal: spacing.four, paddingBottom: insets.bottom + spacing.six, gap: spacing.four }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.hero}>
        <Ionicons name="star" size={30} color={colors.gold} />
        <Text style={styles.heroTitle}>Pelapan Premium</Text>
        <Text style={styles.heroSub}>
          {isPremium ? 'Você é Premium 🎉 Aproveite tudo sem limites.' : 'Leve sua pelada para o próximo nível.'}
        </Text>
        <View style={[styles.planBadge, isPremium ? styles.planPremium : styles.planFree]}>
          <Text style={[styles.planText, { color: isPremium ? colors.gold : colors.ink2 }]}>
            Plano atual: {isPremium ? 'Premium' : 'Grátis'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefit}>
            <Ionicons name={b.icon} size={20} color={isPremium ? colors.green : colors.ink3} />
            <Text style={styles.benefitText}>{b.text}</Text>
            {isPremium && <Ionicons name="checkmark-circle" size={18} color={colors.conf} />}
          </View>
        ))}
      </View>

      {!isPremium && (
        <>
          <View style={styles.card}>
            <Text style={styles.section}>Tenho um código</Text>
            <Field label="Código de ativação" value={code} onChangeText={setCode} placeholder="Cole seu código" autoCapitalize="characters" />
            {error && <Text style={styles.error}>{error}</Text>}
            <PrimaryButton
              label="Ativar Premium"
              loading={busy}
              onPress={() => code.trim() && activate()}
            />
          </View>
          <Text style={styles.soon}>Assinatura direto no app chega em breve.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.extrabold },

  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.cardLg,
    padding: spacing.five,
    alignItems: 'center',
    gap: spacing.two,
  },
  heroTitle: { color: colors.onDark, fontSize: 28, fontFamily: fonts.display, letterSpacing: 1 },
  heroSub: { color: colors.onDark2, fontSize: 14, textAlign: 'center', fontFamily: fonts.regular },
  planBadge: { paddingHorizontal: spacing.three, paddingVertical: spacing.one, borderRadius: radius.chip, marginTop: spacing.two },
  planFree: { backgroundColor: colors.dark2 },
  planPremium: { backgroundColor: colors.dark2 },
  planText: { fontSize: 12, fontFamily: fonts.bold },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  benefitText: { flex: 1, color: colors.ink, fontSize: 14, fontFamily: fonts.medium },
  error: { color: colors.absT, fontSize: 13 },
  soon: { color: colors.ink3, fontSize: 13, textAlign: 'center', fontFamily: fonts.regular },
});
