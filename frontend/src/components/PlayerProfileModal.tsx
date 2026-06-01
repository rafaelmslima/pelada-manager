import { IconCalendar, IconSparkles, IconStar, IconTrophy, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { formatBillingType, formatDate, formatPosition, formatRating, whatsappLink } from "../format";
import type { PlayerProfile } from "../types";
import { PlayerAvatar } from "./ui/PlayerAvatar";

interface Props {
  profile: PlayerProfile;
  onClose: () => void;
}

function StatCard({ icon: Icon, label, value }: { icon: typeof IconStar; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--raised)] border border-[var(--border)] rounded-card-sm p-3 flex flex-col items-center gap-1">
      <Icon size={16} style={{ color: "var(--ink3)" }} />
      <span className="font-display text-[28px] text-[var(--ink)] leading-none">{value}</span>
      <span className="font-jakarta text-[10px] font-bold text-[var(--ink4)]">{label}</span>
    </div>
  );
}

export function PlayerProfileModal({ profile, onClose }: Props) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-[rgba(26,23,20,0.5)]" onClick={onClose} aria-label="Fechar" />

      <div
        className="relative bg-[var(--surface)] rounded-t-[24px] w-full max-w-[480px] mx-auto flex flex-col overflow-hidden"
        style={{ maxHeight: "88dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border2)]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <PlayerAvatar name={profile.player.name} size={48} />
          <div className="flex-1 min-w-0">
            <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]">Perfil do jogador</p>
            <h2 className="font-jakarta text-[17px] font-bold text-[var(--ink)] truncate">{profile.player.name}</h2>
            <p className="font-jakarta text-[11px] text-[var(--ink4)] mt-[2px]">
              {formatPosition(profile.player.position)} · Rating {formatRating(profile.player.rating)} · {formatBillingType(profile.player.billing_type)}
            </p>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--raised)] flex-shrink-0"
            onClick={onClose} type="button"
          >
            <IconX size={16} style={{ color: "var(--ink3)" }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <StatCard icon={IconStar} label="Gols" value={profile.total_goals} />
            <StatCard icon={IconSparkles} label="Assist." value={profile.total_assists} />
            <StatCard icon={IconCalendar} label="Peladas" value={profile.total_matches} />
            <StatCard icon={IconTrophy} label="Time ★" value={profile.team_of_the_week_count} />
          </div>

          {/* Links */}
          {profile.player.whatsapp && (
            <a
              href={whatsappLink(profile.player.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center mt-3 py-3 rounded-card-sm border border-[var(--border)] font-jakarta text-[12px] font-bold text-[var(--green-t)]"
              style={{ backgroundColor: "var(--green-bg)" }}
            >
              Abrir WhatsApp
            </a>
          )}

          {/* History */}
          <div className="mt-4">
            <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)] mb-3">Histórico</p>
            {profile.history.length ? (
              <div className="flex flex-col gap-[1px]">
                {profile.history.map((item) => (
                  <div
                    key={`${item.match_id}-${item.team_name}`}
                    className="grid gap-2 px-0 py-3 border-b border-[var(--border)] last:border-b-0 items-center"
                    style={{ gridTemplateColumns: "auto 1fr auto auto" }}
                  >
                    <strong className="font-jakarta text-[11px] font-bold text-[var(--ink)]">
                      {formatDate(item.date)}
                    </strong>
                    <span className="font-jakarta text-[11px] text-[var(--ink4)] truncate">{item.team_name}</span>
                    <span
                      className="font-jakarta text-[11px] font-bold px-2 py-[2px] rounded-badge"
                      style={{ backgroundColor: "var(--green-bg)", color: "var(--green-b)" }}
                    >
                      {item.goals}G
                    </span>
                    <span
                      className="font-jakarta text-[11px] font-bold px-2 py-[2px] rounded-badge"
                      style={{ backgroundColor: "var(--raised)", color: "var(--ink3)" }}
                    >
                      {item.assists}A
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-jakarta text-[12px] text-[var(--ink4)] text-center py-6">
                Sem histórico ainda
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
