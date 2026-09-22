import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, currency = "SAR") {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatNumber(value: number | string, fractionDigits = 2) {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(num) ? num : 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** يولّد رقم مستند متسلسل مثل PO-2026-0001 */
export function buildDocumentNumber(prefix: string, sequence: number, date = new Date()) {
  return `${prefix}-${date.getFullYear()}-${String(sequence).padStart(4, "0")}`;
}
