import { IconCalendar, IconHome, IconTrophy, IconUser, IconUsers } from "@tabler/icons-react";
import type { View } from "../main";

interface Props {
  view: View;
  setView: (v: View) => void;
  preload: { matches: () => void; rankings: () => void };
}

const ITEMS: Array<[View, typeof IconHome, string]> = [
  ["home", IconHome, "Início"],
  ["players", IconUsers, "Jogadores"],
  ["history", IconCalendar, "Histórico"],
  ["rankings", IconTrophy, "Ranking"],
  ["profile", IconUser, "Perfil"],
];

export function BottomNav({ view, setView, preload }: Props) {
  return (
    <nav
      className="bottom-nav-container fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[var(--surface)] border-t border-[var(--border)] z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {ITEMS.map(([key, Icon, label]) => {
          const active = view === key;
          return (
            <button
              key={key}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 transition-colors"
              style={{ color: active ? "var(--ink)" : "var(--ink4)" }}
              onClick={() => {
                setView(key);
                if (key === "history") preload.matches();
                if (key === "rankings") preload.rankings();
              }}
              type="button"
            >
              <Icon size={22} />
              <span className="font-jakarta text-[10px] font-bold">{label}</span>
              {active && (
                <div
                  className="w-5 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--ink)" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
