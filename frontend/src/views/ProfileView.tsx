import {
  IconBallFootball,
  IconBell,
  IconCash,
  IconChevronRight,
  IconClock,
  IconEdit,
  IconLogout,
  IconMapPin,
} from "@tabler/icons-react";
import { useState } from "react";
import { api } from "../api";
import { initials } from "../format";
import type { AuthMe, BillingType } from "../types";

interface Props {
  session: AuthMe;
  onSession: (me: AuthMe) => void;
  onMessage: (text: string, error?: boolean) => void;
  onError: (error: unknown) => void;
  onLogout: () => void;
}

function SettingRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: typeof IconBallFootball;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center px-4 py-[13px] border-b border-[var(--border)] last:border-b-0">
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        <Icon size={16} style={{ color: "#C8C0B0" }} />
      </div>
      <div className="flex-1 px-[10px] min-w-0">
        {children || (
          <>
            <p className="font-jakarta text-[10px] font-semibold text-[var(--ink4)]">{label}</p>
            <p className="font-jakarta text-[13px] font-bold text-[var(--ink)] truncate">{value || "—"}</p>
          </>
        )}
      </div>
      <IconChevronRight size={16} style={{ color: "#D4CEC4" }} />
    </div>
  );
}

export function ProfileView({ session, onSession, onMessage, onError, onLogout }: Props) {
  const [name, setName] = useState(session.pelada.name);
  const [location, setLocation] = useState(session.pelada.location || "");
  const [time, setTime] = useState(session.pelada.match_time || "20:00");
  const [billing, setBilling] = useState<BillingType>(session.pelada.default_billing_type || "diarista");
  const [editMode, setEditMode] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const me = await api.updatePelada({ name, location, match_time: time, default_billing_type: billing });
      onSession(me);
      onMessage("Configurações salvas.");
      setEditMode(false);
    } catch (error) {
      onError(error);
    }
  };

  const inputCls = "w-full bg-[var(--raised)] border border-[var(--border)] rounded-input px-3 py-[10px] font-jakarta text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--dark)]";
  const labelCls = "font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)] mb-1 block";

  return (
    <div className="flex flex-col">
      {/* Avatar row */}
      <div className="flex items-center gap-4 px-5 pt-6 pb-5">
        <div
          className="rounded-logo flex items-center justify-center flex-shrink-0"
          style={{ width: 56, height: 56, backgroundColor: "var(--dark)" }}
        >
          <span className="font-display text-[24px] text-[var(--on-dark)]">
            {initials(session.pelada.name)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[28px] text-[var(--ink)] leading-none truncate">{session.pelada.name}</h1>
          <p className="font-jakarta text-[11px] text-[var(--ink4)] mt-1">Administrador da pelada</p>
        </div>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-[10px] border active-scale transition-transform flex-shrink-0"
          style={{ backgroundColor: "var(--raised)", borderColor: "var(--border)" }}
          onClick={() => setEditMode(!editMode)}
          type="button"
        >
          <IconEdit size={16} style={{ color: "var(--ink3)" }} />
        </button>
      </div>

      {/* Edit form */}
      {editMode ? (
        <form className="flex flex-col gap-4 px-5 pb-4" onSubmit={save}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-card-md p-4 flex flex-col gap-3">
            <p className="font-jakarta text-[12px] font-bold text-[var(--ink)]">Sobre a pelada</p>
            <div>
              <label className={labelCls}>Nome da pelada</label>
              <input className={inputCls} value={name} required maxLength={120}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Local</label>
              <input className={inputCls} value={location} maxLength={160} placeholder="Ex: Guga Soccer"
                onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Horário</label>
                <input className={inputCls} value={time} maxLength={20}
                  onChange={(e) => setTime(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cobrança padrão</label>
                <select className={inputCls} value={billing}
                  onChange={(e) => setBilling(e.target.value as BillingType)}>
                  <option value="diarista">Diarista</option>
                  <option value="mensalista">Mensalista</option>
                </select>
              </div>
            </div>
          </div>

          <button
            className="w-full rounded-btn py-4 font-jakarta text-[13px] font-bold active-scale transition-transform"
            style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)" }}
            type="submit"
          >
            Salvar configurações
          </button>
          <button
            className="w-full rounded-btn py-3 font-jakarta text-[12px] font-bold border"
            style={{ backgroundColor: "transparent", color: "var(--ink3)", borderColor: "var(--border)" }}
            type="button"
            onClick={() => setEditMode(false)}
          >
            Cancelar
          </button>
        </form>
      ) : (
        /* Settings list */
        <div className="flex flex-col gap-3 px-5 pb-4">
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-card-md overflow-hidden"
          >
            <SettingRow icon={IconBallFootball} label="Nome da pelada" value={session.pelada.name} />
            <SettingRow icon={IconMapPin} label="Local" value={session.pelada.location || "Não informado"} />
            <SettingRow icon={IconClock} label="Horário" value={session.pelada.match_time || "Não informado"} />
            <SettingRow icon={IconCash} label="Cobrança padrão"
              value={session.pelada.default_billing_type === "diarista" ? "Diarista" : "Mensalista"} />
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-card-md overflow-hidden">
            <SettingRow icon={IconBell} label="Notificações" value="Em breve" />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-5 pb-6 mt-2">
        <button
          className="w-full flex items-center justify-center gap-2 rounded-btn py-4 border font-jakarta text-[12px] font-bold active-scale transition-transform"
          style={{ backgroundColor: "transparent", borderColor: "var(--border)", color: "var(--danger)" }}
          onClick={onLogout}
          type="button"
        >
          <IconLogout size={16} />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
