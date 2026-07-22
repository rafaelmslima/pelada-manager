import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ServerUrlField } from '@/components/ServerUrlField';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing } from '@/theme';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [peladaName, setPeladaName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showServer, setShowServer] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          pelada_name: peladaName.trim() || null,
        });
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Falha de conexão. Verifique a rede e a URL da API.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.six }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>Pelapan</Text>
          <Text style={styles.brandSubtitle}>Organize sua pelada de verdade.</Text>
        </View>

        <View style={styles.tabs}>
          <ModeTab label="Entrar" active={!isRegister} onPress={() => setMode('login')} />
          <ModeTab label="Cadastrar" active={isRegister} onPress={() => setMode('register')} />
        </View>

        <View style={styles.card}>
          {isRegister && (
            <Field label="Seu nome" value={name} onChangeText={setName} placeholder="Ex.: João" />
          )}
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            secureTextEntry
          />
          {isRegister && (
            <Field
              label="Nome da pelada (opcional)"
              value={peladaName}
              onChangeText={setPeladaName}
              placeholder="Ex.: Pelada de quinta"
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submit, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}>
            {submitting ? (
              <ActivityIndicator color={colors.onDark} />
            ) : (
              <Text style={styles.submitText}>{isRegister ? 'Criar conta' : 'Entrar'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setShowServer((v) => !v)} activeOpacity={0.7}>
          <Text style={styles.serverToggle}>{showServer ? 'Ocultar servidor' : 'Configurar servidor'}</Text>
        </TouchableOpacity>
        {showServer && (
          <View style={styles.card}>
            <ServerUrlField />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.ink4} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: spacing.four, paddingBottom: spacing.six, gap: spacing.five },
  brand: { alignItems: 'center', gap: spacing.one },
  brandTitle: { color: colors.ink, fontSize: 40, fontWeight: '800' },
  brandSubtitle: { color: colors.ink2, fontSize: 14 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.raised,
    borderRadius: radius.chip,
    padding: spacing.half,
  },
  tab: { flex: 1, paddingVertical: spacing.three, alignItems: 'center', borderRadius: radius.chip },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.ink3, fontWeight: '600' },
  tabTextActive: { color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.five,
    gap: spacing.four,
  },
  field: { gap: spacing.one },
  fieldLabel: { color: colors.ink3, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
    color: colors.ink,
    fontSize: 15,
  },
  error: { color: colors.absT, fontSize: 13 },
  submit: {
    backgroundColor: colors.dark,
    borderRadius: radius.btn,
    paddingVertical: spacing.four,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.onDark, fontSize: 15, fontWeight: '700' },
  serverToggle: { color: colors.ink3, fontSize: 13, textAlign: 'center', fontWeight: '600' },
});
