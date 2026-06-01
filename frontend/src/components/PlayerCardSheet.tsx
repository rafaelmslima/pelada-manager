import { IconCheck, IconEdit, IconTrash, IconUser } from "@tabler/icons-react";
import { useEffect } from "react";
import { formatBillingType, formatPosition, formatRating } from "../format";
import type { Player } from "../types";
import { PlayerAvatar } from "./ui/PlayerAvatar";

interface Props {
  player: Player;
  isPending: boolean;
  onClose: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onProfile: () => void;
}

export function PlayerCardSheet({ player, isPending, onClose, onToggle, onEdit, onDelete, onProfile }: Props) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-[rgba(26,23,20,0.5)]" onClick={onClose} aria-label="Fechar" />

      <div
        className="relative bg-[var(--surface)] rounded-t-[24px] w-full max-w-[480px] mx-auto overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border2)]" />
        </div>

        {/* Player info */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <PlayerAvatar name={player.name} size={50} />
          <div className="flex-1 min-w-0">
            <p className="font-jakarta text-[15px] font-bold text-[var(--ink)] truncate">{player.name}</p>
            <p className="font-jakarta text-[11px] text-[var(--ink4)] mt-[2px]">
              {formatPosition(player.position)} · Rating {formatRating(player.rating)} · {formatBillingType(player.billing_type)}
            </p>
          </div>
          <span
            className="font-jakarta text-[9px] font-bold px-2 py-1 rounded-badge"
            style={{
              backgroundColor: player.is_active ? "var(--conf-bg)" : "var(--pend-bg)",
              color: player.is_active ? "var(--conf-t)" : "var(--pend-t)",
            }}
          >
            {player.is_active ? "Confirmado" : "Pendente"}
          </span>
        </div>

        {/* Toggle confirmation */}
        <button
          className="w-full flex items-center justify-center gap-2 mx-auto my-4 rounded-btn font-jakarta text-[13px] font-bold py-4 active-scale transition-transform"
          style={{
            backgroundColor: player.is_active ? "var(--raised)" : "var(--dark)",
            color: player.is_active ? "var(--ink)" : "var(--on-dark)",
            maxWidth: "calc(100% - 40px)",
          }}
          disabled={isPending}
          onClick={() => { onToggle(); onClose(); }}
          type="button"
        >
          <IconCheck size={16} />
          {player.is_active ? "Remover confirmação" : "Confirmar para hoje"}
        </button>

        {/* Action list */}
        <div className="border-t border-[var(--border)]">
          <button
            className="w-full flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] active-scale transition-transform"
            onClick={() => { onProfile(); onClose(); }}
            type="button"
          >
            <div className="w-8 h-8 rounded-card-sm flex items-center justify-center bg-[var(--raised)]">
              <IconUser size={16} style={{ color: "var(--ink3)" }} />
            </div>
            <span className="font-jakarta text-[13px] font-bold text-[var(--ink)]">Ver perfil completo</span>
          </button>

          <button
            className="w-full flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] active-scale transition-transform"
            onClick={() => { onEdit(); onClose(); }}
            type="button"
          >
            <div className="w-8 h-8 rounded-card-sm flex items-center justify-center bg-[var(--raised)]">
              <IconEdit size={16} style={{ color: "var(--ink3)" }} />
            </div>
            <span className="font-jakarta text-[13px] font-bold text-[var(--ink)]">Editar jogador</span>
          </button>

          <button
            className="w-full flex items-center gap-3 px-5 py-4 active-scale transition-transform"
            onClick={() => {
              if (!window.confirm(`Excluir ${player.name}?`)) return;
              onDelete();
              onClose();
            }}
            type="button"
          >
            <div className="w-8 h-8 rounded-card-sm flex items-center justify-center" style={{ backgroundColor: "var(--abs-bg)" }}>
              <IconTrash size={16} style={{ color: "var(--danger)" }} />
            </div>
            <span className="font-jakarta text-[13px] font-bold" style={{ color: "var(--danger)" }}>Excluir jogador</span>
          </button>
        </div>
      </div>
    </div>
  );
}
