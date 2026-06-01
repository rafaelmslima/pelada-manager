import { formatPosition, formatRating, initials, avatarColor } from "../format";
import type { TeamResult } from "../types";

function movePlayerBetweenTeams(teams: TeamResult[], playerId: number, targetTeamIndex: number): TeamResult[] {
  const sourceTeamIndex = teams.findIndex((t) => t.players.some((p) => p.id === playerId));
  if (sourceTeamIndex < 0 || sourceTeamIndex === targetTeamIndex || !teams[targetTeamIndex]) return teams;

  let moving = null as typeof teams[0]["players"][0] | null;
  const next = teams.map((team, i) => {
    if (i !== sourceTeamIndex) return { ...team, players: [...team.players] };
    const players = team.players.filter((p) => { if (p.id === playerId) { moving = p; return false; } return true; });
    return { ...team, players };
  });
  if (!moving) return teams;
  next[targetTeamIndex] = { ...next[targetTeamIndex], players: [...next[targetTeamIndex].players, moving] };
  return next.map((team) => {
    const total = Number(team.players.reduce((s, p) => s + Number(p.rating), 0).toFixed(2));
    return { ...team, total_rating: total, average_rating: team.players.length ? Number((total / team.players.length).toFixed(2)) : 0, player_count: team.players.length, is_incomplete: team.players.length < team.capacity };
  });
}

interface Props {
  teams: TeamResult[];
  onTeamsChange: (teams: TeamResult[]) => void;
}

export function TeamsResult({ teams, onTeamsChange }: Props) {
  return (
    <div className="flex flex-col gap-3 px-5 pb-4">
      <div className="pt-5 pb-2">
        <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Ajustes finais</p>
        <h2 className="font-display text-[28px] text-[var(--ink)] mt-1">Times Gerados</h2>
      </div>

      <div className="flex flex-col gap-3">
        {teams.map((team, index) => (
          <article
            key={`${team.name}-${index}`}
            className="bg-[var(--raised)] border border-[var(--border)] rounded-card-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
              <div>
                <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">
                  Time {index + 1}
                </p>
                <h3 className="font-jakarta text-[14px] font-bold text-[var(--ink)]">{team.name}</h3>
              </div>
              <div
                className="flex items-center justify-center min-w-[44px] h-[36px] rounded-chip px-3 font-display text-[20px]"
                style={{ backgroundColor: "var(--raised)", color: "var(--gold)" }}
              >
                {formatRating(team.total_rating)}
              </div>
            </div>

            <ol className="list-none m-0 p-0">
              {team.players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center gap-3 px-4 py-[10px] border-b border-[var(--border)] last:border-b-0"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-jakarta text-[11px] font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(player.name) }}
                  >
                    {initials(player.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="font-jakarta text-[12px] font-bold text-[var(--ink)] block truncate">{player.name}</strong>
                    <small className="font-jakarta text-[10px] text-[var(--ink4)]">
                      {formatPosition(player.position)} · {formatRating(player.rating)}
                    </small>
                  </div>
                  <label className="flex flex-col gap-1 text-[var(--ink4)]">
                    <span className="font-jakarta text-[9px] font-bold uppercase">Mover</span>
                    <select
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] px-2 py-1 font-jakarta text-[11px] font-semibold text-[var(--ink)] outline-none"
                      value={index}
                      onChange={(e) => onTeamsChange(movePlayerBetweenTeams(teams, player.id, Number(e.target.value)))}
                    >
                      {teams.map((t, ti) => (
                        <option key={ti} value={ti}>Time {ti + 1}</option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
              {!team.players.length && (
                <li className="py-4 text-center font-jakarta text-[12px] text-[var(--ink4)]">
                  Time sem jogadores
                </li>
              )}
            </ol>
          </article>
        ))}
      </div>
    </div>
  );
}
