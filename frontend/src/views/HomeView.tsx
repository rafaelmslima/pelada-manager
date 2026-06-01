import { IconCash, IconLayoutColumns, IconMapPin, IconSparkles, IconUsers } from "@tabler/icons-react";
import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { TeamsResult } from "../components/TeamsResult";
import { formatBillingType, greeting } from "../format";
import type { AuthMe, Player, TeamGenerateResponse, TeamResult } from "../types";

interface Props {
  session: AuthMe;
  players: Player[];
  teams: TeamGenerateResponse | null;
  onGenerate: (playersPerTeam: number) => void;
  onSave: () => void;
  onTeamsChange: (teams: TeamGenerateResponse) => void;
}

export function HomeView({ session, players, teams, onGenerate, onSave, onTeamsChange }: Props) {
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const active = players.filter((p) => p.is_active);
  const revenue = active.filter((p) => p.billing_type === "diarista").length * 20;
  const progress = players.length ? (active.length / players.length) * 100 : 0;
  const safe = Math.min(30, Math.max(1, Number.isFinite(playersPerTeam) ? playersPerTeam : 5));

  return (
    <div className="flex flex-col">
      {/* Hero text */}
      <div className="px-5 pt-6 pb-3">
        <p className="font-jakarta text-[11px] font-semibold text-[var(--ink4)]">
          {greeting()}, dono da bola
        </p>
        <h1 className="font-display text-[38px] text-[var(--ink)] leading-none">{session.pelada.name}</h1>
        {(session.pelada.location || session.pelada.match_time) && (
          <div className="flex items-center gap-1 mt-1">
            <IconMapPin size={12} style={{ color: "var(--ink4)" }} />
            <span className="font-jakarta text-[11px] font-semibold text-[var(--ink4)]">
              {session.pelada.location && <>{session.pelada.location}</>}
              {session.pelada.location && session.pelada.match_time && " · "}
              {session.pelada.match_time && (
                <span style={{ color: "var(--green-t)" }} className="font-bold">
                  {session.pelada.match_time}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Hero card */}
      <div className="mx-5 rounded-card-lg p-5 mb-4" style={{ backgroundColor: "var(--dark)" }}>
        {/* Status chip */}
        <div
          className="flex items-center gap-2 rounded-chip px-[10px] py-1 w-fit mb-4"
          style={{ backgroundColor: "var(--dark2)" }}
        >
          <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: "var(--green)" }} />
          <span className="font-jakarta text-[10px] font-bold" style={{ color: "var(--green-m)" }}>
            Pelada ativa
          </span>
        </div>

        {/* Counter */}
        <div className="flex items-end gap-1 mb-1">
          <span className="font-display text-[52px] leading-none" style={{ color: "var(--on-dark)" }}>
            {active.length}
          </span>
          <span className="font-display text-[20px] leading-none mb-[6px]" style={{ color: "#4A4540" }}>
            /{players.length}
          </span>
        </div>
        <p className="font-jakarta text-[11px] mb-3" style={{ color: "#6A6058" }}>
          confirmados para hoje
        </p>

        {/* Progress bar */}
        <div className="h-[3px] rounded-full mb-4" style={{ backgroundColor: "var(--dark2)" }}>
          <div
            className="h-full rounded-full transition-all duration-600"
            style={{ width: `${progress}%`, backgroundColor: "var(--green)" }}
          />
        </div>

        {/* Jogadores por time input */}
        <div className="flex items-center gap-3 mb-3">
          <label className="font-jakarta text-[11px] font-semibold flex-shrink-0" style={{ color: "#6A6058" }}>
            Jogadores/time
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={playersPerTeam}
            onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
            onBlur={() => setPlayersPerTeam(safe)}
            className="w-16 bg-[var(--dark2)] text-center rounded-[8px] px-2 py-1 font-jakarta text-[13px] font-bold outline-none"
            style={{ color: "var(--on-dark)", border: "1px solid var(--dark3)" }}
          />
        </div>

        {/* CTA Button */}
        <button
          className="w-full rounded-btn py-4 font-jakarta text-[13px] font-bold flex items-center justify-center gap-2 active-scale transition-transform"
          style={{ backgroundColor: "var(--green)", color: "#0D1F0D" }}
          onClick={() => onGenerate(safe)}
          type="button"
        >
          <IconSparkles size={18} />
          Gerar times equilibrados
        </button>

        {teams && (
          <button
            className="w-full mt-2 rounded-btn py-3 font-jakarta text-[12px] font-bold active-scale transition-transform border"
            style={{ backgroundColor: "transparent", color: "var(--on-dark)", borderColor: "var(--dark2)" }}
            onClick={onSave}
            type="button"
          >
            Salvar pelada no histórico
          </button>
        )}
      </div>

      {/* Sub cards */}
      <div className="grid grid-cols-2 gap-2 px-5 mb-4">
        <div
          className="rounded-card-sm px-[14px] py-[12px] border"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
        >
          <IconLayoutColumns size={14} style={{ color: "#C8C0B0" }} className="mb-1" />
          <span className="font-display text-[26px] text-[var(--ink)] leading-none block">
            {teams?.team_count || 0}
          </span>
          <p className="font-jakarta text-[10px] text-[var(--ink4)] mt-1">Times gerados</p>
        </div>
        <div
          className="rounded-card-sm px-[14px] py-[12px] border"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
        >
          <IconCash size={14} style={{ color: "#C8C0B0" }} className="mb-1" />
          <span className="font-display text-[22px] text-[var(--ink)] leading-none block">
            R${revenue}
          </span>
          <p className="font-jakarta text-[10px] text-[var(--ink4)] mt-1">Arrecadado</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 mb-4">
        <p className="font-jakarta text-[12px] font-extrabold text-[var(--ink)] mb-2">Ações rápidas</p>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-card-sm border p-[14px] flex flex-col gap-[6px]"
            style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
          >
            <IconUsers size={18} style={{ color: "var(--green-m)" }} />
            <p className="font-jakarta text-[12px] font-bold text-[var(--ink)]">Jogadores</p>
            <p className="font-jakarta text-[10px] text-[var(--ink4)]">{players.length} no elenco</p>
          </div>
          <div
            className="rounded-card-sm border p-[14px] flex flex-col gap-[6px]"
            style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
          >
            <IconSparkles size={18} style={{ color: "var(--green-m)" }} />
            <p className="font-jakarta text-[12px] font-bold text-[var(--ink)]">
              {formatBillingType(session.pelada.default_billing_type)}
            </p>
            <p className="font-jakarta text-[10px] text-[var(--ink4)]">Cobrança padrão</p>
          </div>
        </div>
      </div>

      {/* Teams area */}
      {teams ? (
        <TeamsResult
          teams={teams.teams}
          onTeamsChange={(updated: TeamResult[]) => onTeamsChange({ ...teams, teams: updated })}
        />
      ) : (
        <div className="px-5 mb-4">
          <EmptyState
            title="Times ainda não gerados"
            text="Confirme os jogadores e gere times equilibrados para a rodada."
          />
        </div>
      )}
    </div>
  );
}
