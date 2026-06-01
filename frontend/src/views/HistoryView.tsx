import { IconEye, IconPrinter, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { MatchDetailsModal } from "../components/MatchDetailsModal";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../api";
import { formatDateDisplay } from "../format";
import type { MatchListItem, MatchRead } from "../types";

interface Props {
  matches: MatchListItem[];
  onReload: () => void;
  onShare: (id: number) => void;
  onDelete: (id: number) => void;
  onStatsSaved: (match: MatchRead) => void;
  onError: (error: unknown) => void;
}

export function HistoryView({ matches, onReload, onShare, onDelete, onStatsSaved, onError }: Props) {
  const [detailMatch, setDetailMatch] = useState<MatchRead | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => { onReload(); }, []);

  const openDetails = async (id: number) => {
    setLoadingId(id);
    try {
      setDetailMatch(await api.getMatch(id));
    } catch (error) {
      onError(error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between px-5 pt-6 pb-4">
        <div>
          <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Rodadas</p>
          <h1 className="font-display text-[34px] text-[var(--ink)] leading-none">Histórico</h1>
          <p className="font-jakarta text-[11px] text-[var(--ink4)] mt-1">{matches.length} rodadas registradas</p>
        </div>
        <button
          className="w-10 h-10 rounded-card-sm flex items-center justify-center border active-scale transition-transform"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
          onClick={onReload}
          type="button"
          aria-label="Atualizar"
        >
          <IconRefresh size={18} style={{ color: "var(--ink3)" }} />
        </button>
      </div>

      {/* Match list */}
      <div className="flex flex-col gap-2 px-5 pb-4">
        {matches.length ? (
          matches.map((match, i) => (
            <article
              key={match.id}
              className="rounded-card-md border overflow-hidden"
              style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between px-4 pt-4 pb-3">
                <div>
                  <h2 className="font-display text-[20px] text-[var(--ink)] leading-none">
                    {formatDateDisplay(match.date)}
                  </h2>
                  <p className="font-jakarta text-[10px] text-[var(--ink4)] mt-1">
                    {match.team_count} times · {match.player_count} jogadores
                  </p>
                </div>
                {i === 0 && (
                  <span
                    className="font-jakarta text-[9px] font-bold uppercase px-2 py-1 rounded-badge"
                    style={{ backgroundColor: "var(--green-bg)", color: "var(--green-b)" }}
                  >
                    Recente
                  </span>
                )}
              </div>

              {/* Actions */}
              <div
                className="flex border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  className="flex-1 flex items-center justify-center gap-[5px] py-[11px] border-r font-jakarta text-[11px] font-bold active-scale transition-transform"
                  style={{ borderColor: "var(--border)", color: "var(--ink2)" }}
                  onClick={() => openDetails(match.id)}
                  disabled={loadingId === match.id}
                  type="button"
                >
                  <IconEye size={14} />
                  {loadingId === match.id ? "..." : "Detalhes"}
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-[5px] py-[11px] border-r font-jakarta text-[11px] font-bold active-scale transition-transform"
                  style={{ borderColor: "var(--border)", color: "var(--ink2)" }}
                  onClick={() => onShare(match.id)}
                  type="button"
                >
                  <IconPrinter size={14} />
                  Print
                </button>
                <button
                  className="flex items-center justify-center px-4 py-[11px] active-scale transition-transform"
                  style={{ color: "var(--danger)" }}
                  onClick={() => onDelete(match.id)}
                  type="button"
                  aria-label="Excluir"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="Sem peladas salvas"
            text="Depois de gerar e salvar times, o histórico aparece aqui."
          />
        )}
      </div>

      {detailMatch && (
        <MatchDetailsModal
          match={detailMatch}
          onClose={() => setDetailMatch(null)}
          onSaved={(m) => { onStatsSaved(m); setDetailMatch(m); }}
          onError={onError}
        />
      )}
    </div>
  );
}
