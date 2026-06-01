import { IconChevronLeft, IconPrinter } from "@tabler/icons-react";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, formatPosition } from "../format";
import type { MatchRead } from "../types";

interface Props {
  match: MatchRead | null;
  onBack: () => void;
}

export function ShareView({ match, onBack }: Props) {
  if (!match) {
    return (
      <div className="px-5 pt-6">
        <EmptyState
          title="Nenhum print selecionado"
          text="Salve uma pelada ou escolha uma rodada no histórico."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Actions - hidden on print */}
      <div className="no-print flex items-center justify-between px-5 pt-5 pb-4">
        <button
          className="flex items-center gap-1 rounded-[10px] px-3 py-2 border font-jakarta text-[12px] font-bold active-scale transition-transform"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)", color: "var(--ink)" }}
          onClick={onBack}
          type="button"
        >
          <IconChevronLeft size={16} />
          Histórico
        </button>
        <button
          className="flex items-center gap-1 rounded-[10px] px-4 py-2 font-jakarta text-[12px] font-bold active-scale transition-transform"
          style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)" }}
          onClick={() => window.print()}
          type="button"
        >
          <IconPrinter size={16} />
          Imprimir
        </button>
      </div>

      {/* Print sheet */}
      <div
        className="mx-5 rounded-card-lg border overflow-hidden mb-6"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-start justify-between px-5 pt-5 pb-4 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--dark)" }}
        >
          <div>
            <p className="font-jakarta text-[10px] font-semibold" style={{ color: "var(--on-dark2)" }}>Pelapan</p>
            <h1 className="font-display text-[26px] leading-none" style={{ color: "var(--on-dark)" }}>{match.title}</h1>
            <span className="font-jakarta text-[11px]" style={{ color: "var(--on-dark2)" }}>{formatDate(match.date)}</span>
          </div>
          <span
            className="font-jakarta text-[11px] font-bold px-3 py-1 rounded-chip mt-1"
            style={{ backgroundColor: "var(--dark2)", color: "var(--green-m)" }}
          >
            {match.teams.length} times
          </span>
        </div>

        <div className="grid gap-[1px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {match.teams.map((team, index) => (
            <article key={team.id} className="border-r last:border-r-0" style={{ borderColor: "var(--border)" }}>
              <h2
                className="px-4 py-3 font-jakarta text-[12px] font-bold border-b"
                style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)", color: "var(--ink)" }}
              >
                Time {index + 1}: {team.name}
              </h2>
              <ol className="m-0 p-0 list-none">
                {team.players.map((p, pi) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 px-4 py-[9px] border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center font-jakarta text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: "var(--green-bg)", color: "var(--green-b)" }}
                    >
                      {pi + 1}
                    </span>
                    <strong className="font-jakarta text-[12px] font-bold text-[var(--ink)] flex-1 truncate">
                      {p.player.name}
                    </strong>
                    <small className="font-jakarta text-[10px] text-[var(--ink4)]">
                      {formatPosition(p.player.position)}
                    </small>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
