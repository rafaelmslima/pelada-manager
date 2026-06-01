import { FormEvent, useState } from "react";
import { api } from "../api";
import type { AuthMe } from "../types";

interface Props {
  onLogin: (me: AuthMe) => void;
  onMessage: (text: string, error?: boolean) => void;
}

type Mode = "login" | "register" | "reset";

export function AuthScreen({ onLogin, onMessage }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (mode === "reset") {
        await api.resetPassword({
          email: String(form.get("email")),
          new_password: String(form.get("password")),
          admin_secret: String(form.get("admin_secret")),
        });
        e.currentTarget.reset();
        onMessage("Senha alterada. Entre com a nova senha.");
        setMode("login");
        return;
      }
      const me =
        mode === "login"
          ? await api.login(String(form.get("email")), String(form.get("password")))
          : await api.register({
              name: String(form.get("name")),
              email: String(form.get("email")),
              password: String(form.get("password")),
              pelada_name: String(form.get("pelada_name") || "") || null,
            });
      onLogin(me);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Não foi possível entrar.", true);
    } finally {
      setBusy(false);
    }
  };

  const MODES: Array<[Mode, string]> = [["login", "Entrar"], ["register", "Cadastro"], ["reset", "Reset senha"]];

  const inputCls = "w-full bg-[var(--raised)] border border-[var(--border)] rounded-input px-3 py-[12px] font-jakarta text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--dark)] transition-colors placeholder:text-[var(--ink4)]";
  const labelCls = "flex flex-col gap-[6px] font-jakarta text-[10px] font-bold uppercase tracking-widest text-[var(--ink4)]";

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-8"
      style={{ backgroundColor: "var(--page)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-card-lg border overflow-hidden"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Logo header */}
        <div
          className="flex flex-col items-center py-8 px-5"
          style={{ backgroundColor: "var(--dark)" }}
        >
          <img
            src="/static/pelapan-logo.png"
            alt="Pelapan"
            className="w-16 h-16 rounded-logo mb-4"
            style={{ objectFit: "cover" }}
          />
          <p className="font-jakarta text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--on-dark2)" }}>
            Organize sua pelada
          </p>
          <h1 className="font-display text-[32px] leading-none" style={{ color: "var(--on-dark)" }}>
            Pelapan
          </h1>
        </div>

        <div className="p-5">
          {/* Mode tabs */}
          <div
            className="grid gap-1 rounded-[12px] p-1 mb-5"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", backgroundColor: "var(--raised)" }}
          >
            {MODES.map(([key, label]) => (
              <button
                key={key}
                className="rounded-[10px] py-[9px] font-jakarta text-[11px] font-bold transition-all"
                style={{
                  backgroundColor: mode === key ? "var(--dark)" : "transparent",
                  color: mode === key ? "var(--on-dark)" : "var(--ink4)",
                }}
                onClick={() => setMode(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form className="flex flex-col gap-3" onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className={labelCls}>
                  Nome
                  <input className={inputCls} name="name" required minLength={2} placeholder="Seu nome" />
                </label>
                <label className={labelCls}>
                  Nome da pelada
                  <input className={inputCls} name="pelada_name" placeholder="Ex: Quinta Society" />
                </label>
              </>
            )}
            {mode === "reset" && (
              <label className={labelCls}>
                Código administrativo
                <input className={inputCls} name="admin_secret" type="password" autoComplete="off" required />
              </label>
            )}
            <label className={labelCls}>
              Email
              <input className={inputCls} name="email" type="email" required placeholder="seu@email.com" />
            </label>
            <label className={labelCls}>
              {mode === "reset" ? "Nova senha" : "Senha"}
              <input
                className={inputCls}
                name="password"
                type="password"
                minLength={mode === "login" ? 1 : 6}
                required
                placeholder={mode === "reset" ? "Nova senha (mín. 6 caracteres)" : "Sua senha"}
              />
            </label>

            <button
              className="w-full mt-1 rounded-btn py-4 font-jakarta text-[13px] font-bold active-scale transition-transform"
              style={{
                backgroundColor: busy ? "var(--dark2)" : "var(--dark)",
                color: "var(--on-dark)",
              }}
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Aguarde..."
                : mode === "login"
                ? "Entrar"
                : mode === "register"
                ? "Criar conta"
                : "Alterar senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
