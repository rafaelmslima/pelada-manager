import { IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { BillingType, Player, PlayerPayload, Position } from "../types";

const emptyPlayer: PlayerPayload = {
  name: "",
  position: "meio",
  rating: 3,
  billing_type: "diarista",
  has_paid: false,
  whatsapp: "",
  is_active: false,
};

interface Props {
  player: Player | null;
  defaultBilling: BillingType;
  onClose: () => void;
  onSave: (payload: PlayerPayload) => void;
}

export function PlayerSheet({ player, defaultBilling, onClose, onSave }: Props) {
  const base = player || { ...emptyPlayer, billing_type: defaultBilling };
  const [payload, setPayload] = useState<PlayerPayload>({
    name: base.name,
    position: base.position as Position,
    rating: Number(base.rating),
    billing_type: base.billing_type as BillingType,
    has_paid: Boolean(base.has_paid),
    whatsapp: base.whatsapp || "",
    is_active: Boolean(base.is_active),
  });

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const field = "flex flex-col gap-[6px]";
  const label = "font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]";
  const input = "w-full bg-[var(--raised)] border border-[var(--border)] rounded-input px-3 py-[10px] font-jakarta text-[13px] font-semibold text-[var(--ink)] focus:border-[var(--dark)] outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button className="absolute inset-0 bg-[rgba(26,23,20,0.5)]" onClick={onClose} aria-label="Fechar" />

      <form
        className="relative bg-[var(--surface)] rounded-t-[24px] w-full max-w-[480px] mx-auto flex flex-col gap-4 px-5 pt-4 overflow-y-auto"
        style={{ maxHeight: "92dvh", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onSubmit={(e) => { e.preventDefault(); onSave(payload); }}
      >
        {/* Handle */}
        <div className="flex justify-center -mt-1 mb-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border2)]" />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-jakarta text-[17px] font-bold text-[var(--ink)]">
            {player ? "Editar jogador" : "Novo jogador"}
          </h2>
          <button onClick={onClose} type="button" aria-label="Fechar"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--raised)]"
          >
            <IconX size={16} style={{ color: "var(--ink3)" }} />
          </button>
        </div>

        <div className={field}>
          <label className={label}>Nome</label>
          <input
            className={input}
            value={payload.name}
            required
            maxLength={120}
            placeholder="Nome do jogador"
            onChange={(e) => setPayload({ ...payload, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={field}>
            <label className={label}>Posição</label>
            <select className={input} value={payload.position}
              onChange={(e) => setPayload({ ...payload, position: e.target.value as Position })}>
              <option value="defesa">Defesa</option>
              <option value="meio">Meio</option>
              <option value="ataque">Ataque</option>
            </select>
          </div>
          <div className={field}>
            <label className={label}>Rating (0–5)</label>
            <input
              className={input}
              min={0} max={5} step={0.1} type="number"
              value={payload.rating}
              onChange={(e) => setPayload({ ...payload, rating: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={field}>
            <label className={label}>Cobrança</label>
            <select className={input} value={payload.billing_type}
              onChange={(e) => setPayload({ ...payload, billing_type: e.target.value as BillingType })}>
              <option value="diarista">Diarista</option>
              <option value="mensalista">Mensalista</option>
            </select>
          </div>
          <div className={field}>
            <label className={label}>WhatsApp</label>
            <input
              className={input}
              value={payload.whatsapp}
              maxLength={30}
              placeholder="(11) 99999-9999"
              onChange={(e) => setPayload({ ...payload, whatsapp: e.target.value })}
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-3">
          {[
            { label: "Confirmado para hoje", key: "is_active" as const },
            { label: "Pagamento em dia", key: "has_paid" as const },
          ].map(({ label: lbl, key }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="font-jakarta text-[13px] font-semibold text-[var(--ink)]">{lbl}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={payload[key]}
                  onChange={(e) => setPayload({ ...payload, [key]: e.target.checked })}
                />
                <div
                  className="w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: payload[key] ? "var(--dark)" : "var(--border2)" }}
                >
                  <div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: payload[key] ? "translateX(22px)" : "translateX(4px)" }}
                  />
                </div>
              </div>
            </label>
          ))}
        </div>

        <button
          className="w-full rounded-btn py-4 font-jakarta text-[13px] font-bold active-scale transition-transform mt-1"
          style={{ backgroundColor: "var(--dark)", color: "var(--on-dark)" }}
          type="submit"
        >
          Salvar jogador
        </button>
      </form>
    </div>
  );
}
