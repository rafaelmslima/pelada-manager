import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayerFormSheet } from '@/components/PlayerFormSheet';
import { PlayerProfileSheet } from '@/components/PlayerProfileSheet';
import { Sheet } from '@/components/Sheet';
import { GhostButton } from '@/components/form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPosition, formatRating } from '@/lib/format';
import type { Player } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';

type Filter = 'todos' | 'conf' | 'pend';

export default function JogadoresScreen() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);

  const load = useCallback(() => {
    api.listPlayers().then(setPlayers).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((p) => {
      if (filter === 'conf' && !p.is_active) return false;
      if (filter === 'pend' && p.is_active) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [players, search, filter]);

  const confirmed = players.filter((p) => p.is_active).length;

  async function toggle(player: Player) {
    // Otimista: atualiza local e reverte se falhar.
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, is_active: !p.is_active } : p)));
    try {
      await api.togglePlayer(player.id);
    } catch {
      setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, is_active: player.is_active } : p)));
    }
  }

  function confirmDelete(player: Player) {
    setSelected(null);
    Alert.alert('Excluir jogador', `Remover ${player.name}? Não é possível se ele tiver histórico.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePlayer(player.id);
            load();
          } catch (err) {
            Alert.alert('Não foi possível excluir', err instanceof Error ? err.message : 'Erro.');
          }
        },
      },
    ]);
  }

  async function deactivateAll() {
    try {
      const updated = await api.deactivateAllPlayers();
      setPlayers(updated);
    } catch {
      /* ignora */
    }
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: insets.top + spacing.four, paddingHorizontal: spacing.four, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.three, marginBottom: spacing.three }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Elenco</Text>
                <Text style={styles.subtitle}>
                  {players.length} jogadores · {confirmed} confirmados
                </Text>
              </View>
              <TouchableOpacity style={styles.newBtn} onPress={() => { setEditing(null); setFormVisible(true); }} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color={colors.onDark} />
                <Text style={styles.newBtnText}>Novo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.ink3} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar jogador"
                placeholderTextColor={colors.ink4}
              />
            </View>

            <View style={styles.chips}>
              <Chip label="Todos" active={filter === 'todos'} onPress={() => setFilter('todos')} />
              <Chip label="Confirmados" active={filter === 'conf'} onPress={() => setFilter('conf')} />
              <Chip label="Pendentes" active={filter === 'pend'} onPress={() => setFilter('pend')} />
            </View>
            {confirmed > 0 && (
              <GhostButton label="Desmarcar todos" tone="danger" onPress={deactivateAll} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PlayerRow player={item} onToggle={() => toggle(item)} onPress={() => setSelected(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="football" size={30} color={colors.ink4} />
            <Text style={styles.emptyText}>Nenhum jogador aqui ainda.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + spacing.four }]}
        onPress={() => { setEditing(null); setFormVisible(true); }}
        activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.onDark} />
      </TouchableOpacity>

      <PlayerFormSheet
        visible={formVisible}
        player={editing}
        defaultBilling={session?.pelada.default_billing_type ?? 'diarista'}
        onClose={() => setFormVisible(false)}
        onSaved={load}
      />

      <PlayerProfileSheet visible={profileId != null} playerId={profileId} onClose={() => setProfileId(null)} />

      <Sheet visible={selected != null} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <>
            <Text style={styles.actionMeta}>
              {formatPosition(selected.position)} · Nota {formatRating(selected.rating)} ·{' '}
              {selected.is_active ? 'Confirmado' : 'Pendente'}
            </Text>
            <GhostButton
              label={selected.is_active ? 'Remover confirmação' : 'Confirmar presença'}
              onPress={() => { toggle(selected); setSelected(null); }}
            />
            <GhostButton label="Ver perfil completo" onPress={() => { setProfileId(selected.id); setSelected(null); }} />
            <GhostButton label="Editar jogador" onPress={() => { setEditing(selected); setSelected(null); setFormVisible(true); }} />
            <GhostButton label="Excluir jogador" tone="danger" onPress={() => confirmDelete(selected)} />
          </>
        )}
      </Sheet>
    </View>
  );
}

function PlayerRow({ player, onToggle, onPress }: { player: Player; onToggle: () => void; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <PlayerAvatar name={player.name} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{player.name}</Text>
        <Text style={styles.rowMeta}>
          {formatPosition(player.position)} · Nota {formatRating(player.rating)}
        </Text>
      </View>
      <TouchableOpacity onPress={onToggle} hitSlop={8} activeOpacity={0.7}>
        <View style={[styles.check, player.is_active && styles.checkActive]}>
          {player.is_active && <Ionicons name="checkmark" size={16} color={colors.onDark} />}
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.ink3, fontSize: 13 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    backgroundColor: colors.dark,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    borderRadius: radius.btn,
  },
  newBtnText: { color: colors.onDark, fontWeight: '700', fontSize: 13 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: spacing.one },

  chips: { flexDirection: 'row', gap: spacing.two },
  chip: {
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    borderRadius: radius.chip,
    backgroundColor: colors.raised,
  },
  chipActive: { backgroundColor: colors.dark },
  chipText: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.onDark },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.three,
    marginBottom: spacing.two,
  },
  rowName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.ink3, fontSize: 12 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.conf, borderColor: colors.conf },

  empty: { alignItems: 'center', gap: spacing.two, paddingVertical: spacing.six },
  emptyText: { color: colors.ink3, fontSize: 14 },

  fab: {
    position: 'absolute',
    right: spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  actionMeta: { color: colors.ink2, fontSize: 14, marginBottom: spacing.one },
});
