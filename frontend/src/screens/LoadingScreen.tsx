export function LoadingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--page)" }}>
      <img
        src="/static/pelapan-logo.png"
        alt="Pelapan"
        className="w-20 h-20 rounded-logo"
        style={{ objectFit: "cover" }}
      />
      <div className="flex flex-col items-center gap-1">
        <strong className="font-display text-[28px] text-[var(--ink)] leading-none">Pelapan</strong>
        <p className="font-jakarta text-[12px] text-[var(--ink4)]">Carregando sua pelada...</p>
      </div>
      <div
        className="w-8 h-[3px] rounded-full"
        style={{ backgroundColor: "var(--green)", animation: "pulse 1.5s infinite" }}
      />
    </div>
  );
}
