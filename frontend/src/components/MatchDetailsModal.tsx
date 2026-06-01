import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDate } from "../format";
import type { MatchRead } from "../types";

interface Props {
  match: MatchRead;
  onClose: () => void;
  onSaved: (match: MatchRead) => void;
  onError: (error: unknown) => void;
}

export function MatchDetailsModal({ match, onClose, onSaved, onError }: Props) {
  const [teamOfWeek, setTeamOfWeek] = useState<number | null>(
    match.teams.find((t) => t.is_team_of_the_week)?.id || null
  );
  const [stats, setStats] = useState(
    () =>
      new Map<number, { id: number; goals: number; assists: number }>(
        match.teams.flatMap((t) =>
          t.players.map((p) => [p.id, { id: p.id, goals: p.goals, assists: p.assists }])
        )
      )
  );

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    setTeamOfWeek(match.teams.find((t) => t.is_team_of_the_week)?.id || null);
    setStats(
      new Map(
        match.teams.flatMap((t) =>
          t.players.map((p) => [p.id, { id: p.id, goals: p.goals, assists: p.assists }])
        )
      )
    );
  }, [match]);

  const updateStat = (id: number, field: "goals" | "assists", value: number) => {
    const next = new Map(stats);
    next.set(id, { ...(next.get(id) || { id, goals: 0, assists: 0 }), [field]: value });
    setStats(next);
  };

  const save = async () => {
    try {
      onSaved(
        await api.updateMatchStats(match.id, {
          team_of_the_week_id: teamOfWeek,
          players: [...stats.values()],
        })
      );
      onClose();
    } catch (error) {
      onError(error);
    }
  };

  const inputCls = "w-full bg-[var(--surface)] border border-[var(--border)] rounded-[8px] px-2 py-2 font-jakarta text-[13px] text-[var(--ink)] text-center outline-none focus:border-[var(--dark)]";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-[rgba(26,23,20,0.5)]" onClick={onClose} aria-label="Fechar" />

      <div
        className="relative bg-[var(--surface)] rounded-t-[24px] w-full max-w-[480px] mx-auto flex flex-col overflow-hidden"
        style={{ maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border2)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Detalhes</p>
            <h2 className="font-jakarta text-[15px] font-bold text-[var(--ink)]">{match.title}</h2>
            <span className="font-jakarta text-[11px] text-[var(--ink4)]">{formatDate(match.date)}</span>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--raised)]"
            onClick={onClose} type="button"
          >
            <IconX size={16} style={{ color: "var(--ink3)" }} />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {match.teams.map((team) => (
            <div key={team.id} className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-jakarta text-[13px] font-bold text-[var(--ink)]">{team.name}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="week"
                    checked={teamOfWeek === team.id}
                    onChange={() => setTeamOfWeek(team.id)}
                    style={{ accentColor: "var(--dark)" }}
                  />
                  <span className="font-jakarta text-[11px] font-semibold text-[var(--ink3)]">Melhor time</span>
                </label>
              </div>

              <div className="bg-[var(--raised)] border border-[var(--border)] rounded-card-sm overflow-hidden">
                {team.players.map((item) => {
                  const cur = stats.get(item.id) || { id: item.id, goals: 0, assists: 0 };
                  return (
                    <div
                      key={item.id}
                      className="grid items-center gap-2 px-3 py-2 border-b border-[var(--border)] last:border-b-0"
                      style={{ gridTemplateColumns: "1fr 72px 72px" }}
                    >
                      <strong className="font-jakarta text-[12px] font-bold text-[var(--ink)] truncate">
                        {item.player.name}
                      </strong>
                      <label className="flex flex-col gap-1">
                        <span className="font-jakarta text-[9px] font-bold uppercase text-[var(--ink4)]">Gols</span>
                        <input
                          className={inputCls}
                          type="number"
                          min={0}
                          value={cur.goals}
                          onChange={(e) => updateStat(item.id, "goals", Number(e.target.value))}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-jakarta text-[9px] font-bold uppercase text-[var(--ink4)]">Assist.</span>
                        <input
                          className={inputCls}
                          type="number"
                          min={0}
                          value={cur.assists}
                          onChange={(e) => updateStat(item.id, "assists", Number(e.target.value))}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="px-5 pt-3 pb-3 border-t border-[var(--border)] flex-shrink-0">
          <button
            className="w-full rounded-btn py-4 font-jakarta text-[13px] font-bold active-scale transition-transform"
            style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)" }}
            onClick={save}
            type="button"
          >
            Salvar estatísticas
          </button>
        </div>
      </div>
    </div>
  );
}
