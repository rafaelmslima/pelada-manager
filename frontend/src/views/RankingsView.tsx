import { IconRefresh } from "@tabler/icons-react";
import { useEffect } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { PlayerAvatar } from "../components/ui/PlayerAvatar";
import { formatPosition } from "../format";
import type { RankingPlayer, RankingsSummary } from "../types";

interface Props {
  rankings: RankingsSummary | null;
  onReload: () => void;
}

function PodiumSpot({
  player,
  rank,
  avatarSize,
  pedestalHeight,
  label,
}: {
  player: RankingPlayer;
  rank: 1 | 2 | 3;
  avatarSize: number;
  pedestalHeight: number;
  label: string;
}) {
  const borderColor = rank === 1 ? "var(--gold)" : "#5A5048";
  const textColor = rank === 1 ? "var(--gold)" : "var(--on-dark2)";
  const pedestalBg = rank === 1 ? "var(--dark2)" : "var(--dark3)";

  return (
    <div className="flex flex-col items-center" style={{ zIndex: rank === 1 ? 2 : 1 }}>
      {rank === 1 && (
        <span
          className="font-display text-[11px] tracking-[1px] mb-1"
          style={{ color: "var(--gold)" }}
        >
          {label}
        </span>
      )}
      <div
        className="rounded-full overflow-hidden border-2"
        style={{ borderColor, width: avatarSize, height: avatarSize }}
      >
        <PlayerAvatar name={player.name} size={avatarSize} />
      </div>
      <p className="font-jakarta text-[10px] mt-1 text-center max-w-[64px] truncate" style={{ color: "#C8C0B0" }}>
        {player.name.split(" ")[0]}
      </p>
      <p className="font-display text-[16px]" style={{ color: textColor }}>
        {player.goals || player.assists}
      </p>
      <div
        className="rounded-t-[8px]"
        style={{ width: avatarSize + 8, height: pedestalHeight, backgroundColor: pedestalBg }}
      />
    </div>
  );
}

function RankingRow({ player, rank, field }: { player: RankingPlayer; rank: number; field: "goals" | "assists" }) {
  const rankColors: Record<number, string> = { 1: "var(--gold)", 2: "var(--silver)", 3: "var(--bronze)" };
  const valueColor = rank <= 3 ? "var(--green-t)" : "var(--ink4)";

  return (
    <div
      className="flex items-center gap-[10px] py-[9px] border-b border-[var(--border)] last:border-b-0"
    >
      <span
        className="font-display text-[18px] w-5 text-center flex-shrink-0"
        style={{ color: rankColors[rank] || "#D4C8B8" }}
      >
        {rank}
      </span>
      <PlayerAvatar name={player.name} size={34} />
      <div className="flex-1 min-w-0">
        <p className="font-jakarta text-[13px] font-bold text-[var(--ink)] truncate">{player.name}</p>
        <p className="font-jakarta text-[10px] text-[var(--ink4)]">
          {formatPosition(player.position)} · {player.matches_played} jogos
        </p>
      </div>
      <span className="font-display text-[22px] flex-shrink-0" style={{ color: valueColor }}>
        {player[field]}
      </span>
    </div>
  );
}

function RankingSection({
  title,
  label,
  players,
  field,
}: {
  title: string;
  label: string;
  players: RankingPlayer[];
  field: "goals" | "assists";
}) {
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div>
      {/* Dark hero */}
      <div className="rounded-card-lg px-5 pt-6 pb-0 mb-0" style={{ backgroundColor: "var(--dark)" }}>
        <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#6A6058" }}>
          Performance
        </p>
        <h2 className="font-display text-[32px] tracking-[1px] mb-6" style={{ color: "var(--on-dark)" }}>
          {title}
        </h2>

        {/* Podium */}
        {top3.length >= 2 && (
          <div className="flex items-end justify-center gap-[-4px]">
            {top3[1] && (
              <div style={{ marginRight: -4 }}>
                <PodiumSpot player={top3[1]} rank={2} avatarSize={38} pedestalHeight={36} label="" />
              </div>
            )}
            {top3[0] && (
              <PodiumSpot player={top3[0]} rank={1} avatarSize={50} pedestalHeight={54} label={label} />
            )}
            {top3[2] && (
              <div style={{ marginLeft: -4 }}>
                <PodiumSpot player={top3[2]} rank={3} avatarSize={34} pedestalHeight={28} label="" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full list */}
      <div className="px-5 pt-4 pb-4">
        <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)] mb-3">
          Classificação completa
        </p>
        {players.length ? (
          players.map((p, i) => (
            <RankingRow key={p.player_id} player={p} rank={i + 1} field={field} />
          ))
        ) : (
          <EmptyState title={`Sem ${label.toLowerCase()}`} text="Sem estatísticas suficientes ainda." />
        )}
      </div>
    </div>
  );
}

export function RankingsView({ rankings, onReload }: Props) {
  useEffect(() => { onReload(); }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-end justify-between px-5 pt-6 pb-3">
        <div>
          <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Performance</p>
          <h1 className="font-display text-[34px] text-[var(--ink)] leading-none">Rankings</h1>
        </div>
        <button
          className="w-10 h-10 rounded-card-sm flex items-center justify-center border active-scale"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
          onClick={onReload}
          type="button"
          aria-label="Atualizar"
        >
          <IconRefresh size={18} style={{ color: "var(--ink3)" }} />
        </button>
      </div>

      {rankings ? (
        <div className="flex flex-col gap-6 px-5 pb-6">
          <RankingSection title="Artilheiros" label="Artilheiro" players={rankings.scorers.players} field="goals" />
          <RankingSection title="Assistências" label="Assistente" players={rankings.assists.players} field="assists" />
        </div>
      ) : (
        <div className="px-5 pb-4">
          <EmptyState
            title="Ranking ainda vazio"
            text="Salve estatísticas no histórico para montar a tabela."
          />
        </div>
      )}
    </div>
  );
}
