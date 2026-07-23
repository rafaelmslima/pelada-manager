import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Field, PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { colors, fonts, radius, spacing } from '@/theme';

export default function ProfileScreen() {
  const { session, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = session?.user;
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!user) return null;

  const isPremium = user.plan === 'premium';
  const displayName = (name.trim() || user.name || user.email).trim();

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setFeedback('Informe seu nome.');
      return;
    }
    setFeedback(null);
    setSaving(true);
    try {
      await api.updateProfile(trimmed);
      await refresh();
      haptics.success();
      setFeedback('Perfil atualizado ✓');
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
        <Text style={styles.headerTitle}>Meu perfil</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.identity}>
        <PlayerAvatar name={displayName} size={72} />
        <Text style={styles.identityName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={[styles.planBadge, isPremium ? styles.planPremium : styles.planFree]}>
          <Ionicons name={isPremium ? 'star' : 'person'} size={13} color={isPremium ? colors.gold : colors.ink2} />
          <Text style={[styles.planText, isPremium && { color: colors.gold }]}>
            {isPremium ? 'Premium' : 'Plano grátis'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Dados da conta</Text>
        <Field label="Seu nome" value={name} onChangeText={setName} placeholder="Como você quer ser chamado" />
        <View>
          <Text style={styles.label}>E-mail</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        <PrimaryButton label="Salvar" onPress={save} loading={saving} />
      </View>

      <Text style={styles.hint}>Em breve: foto, telefone e vínculo com o seu perfil de jogador.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.extrabold },

  identity: { alignItems: 'center', gap: spacing.two },
  identityName: { color: colors.ink, fontSize: 22, fontFamily: fonts.extrabold },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
    borderRadius: radius.chip,
  },
  planFree: { backgroundColor: colors.raised },
  planPremium: { backgroundColor: colors.dark2 },
  planText: { color: colors.ink2, fontSize: 12, fontFamily: fonts.bold },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardMd,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.four,
    gap: spacing.three,
  },
  section: { color: colors.ink, fontSize: 16, fontFamily: fonts.extrabold },
  label: { color: colors.ink3, fontSize: 12, fontFamily: fonts.bold },
  value: { color: colors.ink, fontSize: 15, fontFamily: fonts.semibold },
  feedback: { color: colors.greenB, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },
});
