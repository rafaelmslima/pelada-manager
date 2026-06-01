import type { BillingType, Position } from "./types";

export function formatPosition(position: Position | string) {
  return { defesa: "Defesa", meio: "Meio", ataque: "Ataque" }[position] || position;
}

export function formatBillingType(type: BillingType | string) {
  return { diarista: "Diarista", mensalista: "Mensalista" }[type] || type;
}

export function formatRating(value: number) {
  return Number(value).toFixed(1).replace(".0", "");
}

export function formatDecimal(value: number) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

export function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatDateDisplay(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day} ${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function whatsappLink(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

const AVATAR_COLORS = [
  "#2D6040", "#2D4A7A", "#5C3A80", "#8A4820", "#1D6060",
  "#6B2D40", "#404A2D", "#2D3A6B", "#7A2D5C", "#3A6B5C",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
