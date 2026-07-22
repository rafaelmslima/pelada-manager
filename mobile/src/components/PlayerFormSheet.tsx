import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Field, PrimaryButton, Segmented, SwitchRow } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import type { BillingType, Player, PlayerPayload, Position } from '@/lib/types';
import { colors } from '@/theme';

const EMPTY = {
  name: '',
  position: 'meio' as Position,
  rating: '3',
  billing_type: 'diarista' as BillingType,
  whatsapp: '',
  is_active: false,
  has_paid: false,
};

export function PlayerFormSheet({
  visible,
  player,
  defaultBilling,
  onClose,
  onSaved,
}: {
  visible: boolean;
  player: Player | null;
  defaultBilling: BillingType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (player) {
      setForm({
        name: player.name,
        position: player.position,
        rating: String(player.rating),
        billing_type: player.billing_type,
        whatsapp: player.whatsapp,
        is_active: player.is_active,
        has_paid: player.has_paid,
      });
    } else {
      setForm({ ...EMPTY, billing_type: defaultBilling });
    }
  }, [visible, player, defaultBilling]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      setError('Informe o nome do jogador.');
      return;
    }
    const rating = Math.max(0, Math.min(5, Number(form.rating.replace(',', '.')) || 0));
    const payload: PlayerPayload = {
      name,
      position: form.position,
      rating,
      billing_type: form.billing_type,
      has_paid: form.has_paid,
      whatsapp: form.whatsapp.trim(),
      is_active: form.is_active,
    };
    setSaving(true);
    setError(null);
    try {
      if (player) {
        await api.updatePlayer(player.id, payload);
      } else {
        await api.createPlayer(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={player ? 'Editar jogador' : 'Novo jogador'}>
      <Field label="Nome" value={form.name} onChangeText={(v) => update('name', v)} placeholder="Ex.: João" />
      <Segmented<Position>
        label="Posição"
        value={form.position}
        onChange={(v) => update('position', v)}
        options={[
          { value: 'defesa', label: 'Defesa' },
          { value: 'meio', label: 'Meio' },
          { value: 'ataque', label: 'Ataque' },
        ]}
      />
      <Field
        label="Nota (0 a 5)"
        value={form.rating}
        onChangeText={(v) => update('rating', v)}
        placeholder="3.0"
        keyboardType="decimal-pad"
      />
      <Segmented<BillingType>
        label="Cobrança"
        value={form.billing_type}
        onChange={(v) => update('billing_type', v)}
        options={[
          { value: 'diarista', label: 'Diarista' },
          { value: 'mensalista', label: 'Mensalista' },
        ]}
      />
      <Field
        label="WhatsApp (opcional)"
        value={form.whatsapp}
        onChangeText={(v) => update('whatsapp', v)}
        placeholder="(11) 90000-0000"
        keyboardType="phone-pad"
      />
      <SwitchRow label="Confirmado para hoje" value={form.is_active} onValueChange={(v) => update('is_active', v)} />
      <SwitchRow label="Pagamento em dia" value={form.has_paid} onValueChange={(v) => update('has_paid', v)} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={player ? 'Salvar alterações' : 'Adicionar jogador'} onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.absT, fontSize: 13 },
});
