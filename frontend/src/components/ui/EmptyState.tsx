import { IconBallFootball } from "@tabler/icons-react";

interface Props {
  title: string;
  text: string;
}

export function EmptyState({ title, text }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 min-h-[160px] rounded-card-md border border-dashed border-[var(--border2)] bg-[var(--surface)] px-5 py-8 text-center">
      <IconBallFootball size={24} style={{ color: "var(--ink4)" }} />
      <strong className="font-jakarta text-[13px] font-bold text-[var(--ink)]">{title}</strong>
      <span className="font-jakarta text-[11px] text-[var(--ink4)] leading-relaxed">{text}</span>
    </div>
  );
}
