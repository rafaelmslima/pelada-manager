import React from "react";
import { PlayerAvatar } from "./ui/PlayerAvatar";
import { formatPosition, formatRating } from "../format";
import type { Player } from "../types";

interface Props {
  player: Player;
  isPending: boolean;
  onTap: () => void;
  onToggle: (e: React.MouseEvent) => void;
}

export const PlayerCard = React.memo(
  function PlayerCard({ player, isPending, onTap, onToggle }: Props) {
    const posLabel = formatPosition(player.position);
    const stars = Math.round(player.rating);

    return (
      <button
        className="w-full flex items-center gap-3 px-5 py-[10px] border-b border-[var(--border)] text-left active-scale transition-transform"
        onClick={onTap}
        type="button"
      >
        <div className="relative flex-shrink-0">
          <PlayerAvatar name={player.name} size={40} />
          <span
            className="absolute bottom-0 right-0 w-[9px] h-[9px] rounded-full border-2 border-[var(--surface)]"
            style={{ backgroundColor: player.is_active ? "var(--conf)" : "var(--pend)" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-jakarta text-[13px] font-bold text-[var(--ink)] truncate">{player.name}</p>
          <div className="flex items-center gap-[5px] mt-[2px]">
            <span
              className="font-jakarta text-[9px] font-bold uppercase rounded-[4px] px-[5px] py-[1px] bg-[var(--raised)] text-[var(--ink3)]"
            >
              {posLabel}
            </span>
            <span className="font-jakarta text-[10px] text-[var(--ink4)]">· {formatRating(player.rating)}</span>
            <span className="font-jakarta text-[10px] text-[var(--ink4)]">
              {"★".repeat(stars)}{"☆".repeat(Math.max(0, 5 - stars))}
            </span>
          </div>
        </div>

        <button
          className="flex-shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-full border-2 transition-colors active-scale"
          style={{
            borderColor: player.is_active ? "var(--conf)" : "var(--border2)",
            backgroundColor: player.is_active ? "var(--conf)" : "transparent",
          }}
          disabled={isPending}
          onClick={onToggle}
          type="button"
          aria-label={player.is_active ? "Remover confirmação" : "Confirmar jogador"}
        >
          {player.is_active && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </button>
    );
  },
  (prev, next) => prev.player === next.player && prev.isPending === next.isPending
);
