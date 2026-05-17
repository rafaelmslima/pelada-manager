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
