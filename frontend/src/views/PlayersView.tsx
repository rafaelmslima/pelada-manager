import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { PlayerCard } from "../components/PlayerCard";
import { PlayerCardSheet } from "../components/PlayerCardSheet";
import { PlayerSheet } from "../components/PlayerSheet";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../api";
import type { BillingType, Player, PlayerPayload, PlayerProfile } from "../types";

type Filter = "all" | "confirmed" | "pending";

interface Props {
  players: Player[];
  defaultBilling: BillingType;
  onPlayersChange: React.Dispatch<React.SetStateAction<Player[]>>;
  onError: (error: unknown) => void;
  onMessage: (text: string, error?: boolean) => void;
  onProfile: (id: number) => void;
}

export function PlayersView({ players, defaultBilling, onPlayersChange, onError, onMessage, onProfile }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Player | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cardSheet, setCardSheet] = useState<Player | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [deactivatingAll, setDeactivatingAll] = useState(false);
  const deferred = useDeferredValue(query);

  const activeCount = useMemo(() => players.filter((p) => p.is_active).length, [players]);
  const pendingCount = useMemo(() => players.filter((p) => !p.is_active).length, [players]);

  const normalized = useMemo(() => deferred.trim().toLowerCase(), [deferred]);
  const filtered = useMemo(
    () =>
      [...players]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((p) => {
          const matchFilter =
            filter === "all" || (filter === "confirmed" && p.is_active) || (filter === "pending" && !p.is_active);
          return matchFilter && p.name.toLowerCase().includes(normalized);
        }),
    [players, filter, normalized]
  );

  const setPending = useCallback((id: number, val: boolean) => {
    setPendingIds((cur) => { const s = new Set(cur); val ? s.add(id) : s.delete(id); return s; });
  }, []);

  const togglePlayer = useCallback(async (player: Player) => {
    if (pendingIds.has(player.id) || deactivatingAll) return;
    const prev = player.is_active;
    setPending(player.id, true);
    onPlayersChange((cur) => cur.map((p) => p.id === player.id ? { ...p, is_active: !prev } : p));
    try {
      const updated = await api.togglePlayer(player.id);
      onPlayersChange((cur) => cur.map((p) => p.id === updated.id ? updated : p));
    } catch (error) {
      onPlayersChange((cur) => cur.map((p) => p.id === player.id ? { ...p, is_active: prev } : p));
      onError(error);
    } finally { setPending(player.id, false); }
  }, [deactivatingAll, onError, onPlayersChange, pendingIds, setPending]);

  const deactivateAll = useCallback(async () => {
    if (!activeCount || deactivatingAll) return;
    const ids = new Set(players.filter((p) => p.is_active).map((p) => p.id));
    setDeactivatingAll(true);
    onPlayersChange((cur) => cur.map((p) => ids.has(p.id) ? { ...p, is_active: false } : p));
    try {
      onPlayersChange(await api.deactivateAllPlayers());
      onMessage("Todos desmarcados.");
    } catch {
      onPlayersChange((cur) => cur.map((p) => ids.has(p.id) ? { ...p, is_active: true } : p));
    } finally { setDeactivatingAll(false); }
  }, [activeCount, deactivatingAll, onMessage, onPlayersChange, players]);

  const savePlayer = async (payload: PlayerPayload) => {
    try {
      const saved = editing ? await api.updatePlayer(editing.id, payload) : await api.createPlayer(payload);
      onPlayersChange((cur) =>
        editing
          ? cur.map((p) => p.id === saved.id ? saved : p)
          : [...cur, saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSheetOpen(false);
      setEditing(null);
      onMessage(editing ? "Jogador atualizado." : "Jogador cadastrado.");
    } catch (error) { onError(error); }
  };

  const deletePlayer = async (player: Player) => {
    try {
      await api.deletePlayer(player.id);
      onPlayersChange((cur) => cur.filter((p) => p.id !== player.id));
      onMessage("Jogador excluído.");
    } catch (error) { onError(error); }
  };

  const FILTERS: Array<[Filter, string]> = [["all", "Todos"], ["confirmed", "Confirmados"], ["pending", "Pendentes"]];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between px-5 pt-6 pb-3">
        <div>
          <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Elenco</p>
          <h1 className="font-display text-[34px] text-[var(--ink)] leading-none">{players.length} jogadores</h1>
        </div>
        <button
          className="flex items-center gap-1 rounded-[10px] px-3 py-2 font-jakarta text-[12px] font-bold active-scale transition-transform"
          style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)" }}
          onClick={() => { setEditing(null); setSheetOpen(true); }}
          type="button"
        >
          <IconPlus size={14} />
          Novo
        </button>
      </div>

      {/* Search bar */}
      <div
        className="flex items-center gap-2 mx-5 rounded-input px-[14px] py-[10px] mb-3 border"
        style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
      >
        <IconSearch size={14} style={{ color: "#C8C0B0" }} />
        <input
          className="flex-1 font-jakarta text-[12px] text-[var(--ink)] placeholder:text-[#C8C0B0] bg-transparent"
          placeholder="Buscar jogador..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            className="flex-shrink-0 px-[14px] py-[6px] rounded-chip font-jakarta text-[11px] font-bold border transition-colors"
            style={{
              backgroundColor: filter === key ? "var(--dark)" : "var(--raised)",
              color: filter === key ? "var(--on-dark)" : "var(--ink4)",
              borderColor: filter === key ? "var(--dark)" : "var(--border)",
            }}
            onClick={() => setFilter(key)}
            type="button"
          >
            {label}
          </button>
        ))}
        <button
          className="flex-shrink-0 ml-auto px-[14px] py-[6px] rounded-chip font-jakarta text-[11px] font-bold border transition-opacity"
          style={{
            backgroundColor: "var(--abs-bg)",
            color: "var(--danger)",
            borderColor: "var(--border)",
            opacity: !activeCount || deactivatingAll ? 0.5 : 1,
          }}
          disabled={!activeCount || deactivatingAll}
          onClick={deactivateAll}
          type="button"
        >
          Desmarcar todos
        </button>
      </div>

      {/* Status bar */}
      <div className="flex gap-2 px-5 mb-3">
        {[
          { label: "Conf.", count: activeCount, bg: "var(--conf-bg)", color: "var(--conf-t)", dot: "var(--conf)" },
          { label: "Pend.", count: pendingCount, bg: "var(--pend-bg)", color: "var(--pend-t)", dot: "var(--pend)" },
        ].map(({ label, count, bg, color, dot }) => (
          <div
            key={label}
            className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-[8px] font-jakarta text-[10px] font-bold"
            style={{ backgroundColor: bg, color }}
          >
            <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: dot }} />
            {count} {label}
          </div>
        ))}
      </div>

      {/* Player list */}
      <div className="flex flex-col bg-[var(--surface)]">
        {filtered.length ? (
          filtered.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isPending={pendingIds.has(player.id) || deactivatingAll}
              onTap={() => setCardSheet(player)}
              onToggle={(e) => { e.stopPropagation(); togglePlayer(player); }}
            />
          ))
        ) : (
          <div className="mx-5 mt-4">
            <EmptyState title="Nenhum jogador encontrado" text="Ajuste a busca ou cadastre um novo jogador." />
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed right-5 bottom-[90px] w-14 h-14 rounded-full flex items-center justify-center shadow-lg active-scale transition-transform z-30"
        style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)", boxShadow: "0 8px 24px rgba(26,23,20,0.3)" }}
        onClick={() => { setEditing(null); setSheetOpen(true); }}
        type="button"
        aria-label="Adicionar jogador"
      >
        <IconPlus size={22} />
      </button>

      {/* Modals */}
      {cardSheet && (
        <PlayerCardSheet
          player={cardSheet}
          isPending={pendingIds.has(cardSheet.id) || deactivatingAll}
          onClose={() => setCardSheet(null)}
          onToggle={() => togglePlayer(cardSheet)}
          onEdit={() => { setEditing(cardSheet); setSheetOpen(true); }}
          onDelete={() => deletePlayer(cardSheet)}
          onProfile={() => onProfile(cardSheet.id)}
        />
      )}
      {sheetOpen && (
        <PlayerSheet
          player={editing}
          defaultBilling={defaultBilling}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
          onSave={savePlayer}
        />
      )}
    </div>
  );
}
