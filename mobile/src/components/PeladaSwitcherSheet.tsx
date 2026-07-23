import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Field, GhostButton, PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PeladaMembership } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

type Mode = 'list' | 'create' | 'join';

export function PeladaSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { applyAuth } = useAuth();
  const router = useRouter();
  const [peladas, setPeladas] = useState<PeladaMembership[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.listPeladas().then(setPeladas).catch(() => {});
    api.getInviteCode().then((r) => setInviteCode(r.invite_code)).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      setMode('list');
      setName('');
      setCode('');
      setError(null);
      load();
    }
  }, [visible, load]);

  async function run(action: () => Promise<{ user: unknown }>) {
    setBusy(true);
    setError(null);
    try {
      const me = await action();
      applyAuth(me as Parameters<typeof applyAuth>[0]);
      onClose();
    } catch (err) {
      // 402 = limite do plano gratuito -> leva para a tela Premium.
      if (err instanceof ApiError && err.status === 402) {
        onClose();
        router.push('/premium');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }

  function shareInvite() {
    if (!inviteCode) return;
    Share.share({ message: `Entre na minha pelada no Pelapan com o código: ${inviteCode}` }).catch(() => {});
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Minhas peladas">
      {mode === 'list' && (
        <>
          {peladas.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.row, p.is_active && styles.rowActive]}
              onPress={() => (p.is_active ? onClose() : run(() => api.selectPelada(p.id)))}
              activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>{p.role === 'owner' ? 'Dono' : 'Participante'}</Text>
              </View>
              {p.is_active ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.conf} />
              ) : (
                <Ionicons name="ellipse-outline" size={22} color={colors.ink4} />
              )}
            </TouchableOpacity>
          ))}

          {inviteCode && (
            <TouchableOpacity style={styles.invite} onPress={shareInvite} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={18} color={colors.ink2} />
              <Text style={styles.inviteText}>
                Convite da pelada ativa: <Text style={styles.inviteCode}>{inviteCode}</Text>
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <GhostButton label="+ Criar pelada" onPress={() => setMode('create')} />
            </View>
            <View style={{ flex: 1 }}>
              <GhostButton label="Entrar por código" onPress={() => setMode('join')} />
            </View>
          </View>
        </>
      )}

      {mode === 'create' && (
        <>
          <Field label="Nome da nova pelada" value={name} onChangeText={setName} placeholder="Ex.: Pelada de sábado" />
          {error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton
            label="Criar e entrar"
            loading={busy}
            onPress={() => name.trim().length >= 2 && run(() => api.createPelada({ name: name.trim() }))}
          />
          <GhostButton label="Voltar" onPress={() => setMode('list')} />
        </>
      )}

      {mode === 'join' && (
        <>
          <Field
            label="Código de convite"
            value={code}
            onChangeText={setCode}
            placeholder="Cole o código"
            autoCapitalize="none"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton
            label="Entrar na pelada"
            loading={busy}
            onPress={() => code.trim() && run(() => api.joinPelada(code.trim()))}
          />
          <GhostButton label="Voltar" onPress={() => setMode('list')} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.raised,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
  },
  rowActive: { borderColor: colors.conf },
  name: { color: colors.ink, fontSize: 15, fontFamily: fonts.bold },
  meta: { color: colors.ink3, fontSize: 12, fontFamily: fonts.regular },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    paddingVertical: spacing.two,
  },
  inviteText: { color: colors.ink2, fontSize: 13, flex: 1 },
  inviteCode: { color: colors.ink, fontFamily: fonts.bold },
  actions: { flexDirection: 'row', gap: spacing.three, marginTop: spacing.one },
  error: { color: colors.absT, fontSize: 13 },
});
