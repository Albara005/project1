import type { JournalEntryStatus, JournalSourceType } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

/** مصدر القيد: يدوي أو مولّد تلقائياً من وحدات المبيعات والمشتريات والرواتب. */
export const SOURCE_TYPE_LABELS: Record<JournalSourceType, string> = {
  MANUAL: "يدوي",
  SALES_INVOICE: "فاتورة مبيعات",
  PURCHASE_ORDER: "أمر شراء",
  PAYMENT: "سند دفع",
  PAYROLL: "رواتب",
};

export const SOURCE_TYPE_TONES: Record<JournalSourceType, BadgeTone> = {
  MANUAL: "gray",
  SALES_INVOICE: "green",
  PURCHASE_ORDER: "blue",
  PAYMENT: "purple",
  PAYROLL: "amber",
};

export const ENTRY_STATUS_LABELS: Record<JournalEntryStatus, string> = {
  DRAFT: "مسودة",
  POSTED: "مرحّل",
  REVERSED: "معكوس",
};

export const ENTRY_STATUS_TONES: Record<JournalEntryStatus, BadgeTone> = {
  DRAFT: "amber",
  POSTED: "green",
  REVERSED: "red",
};

export const SOURCE_TYPE_ORDER: JournalSourceType[] = [
  "MANUAL",
  "SALES_INVOICE",
  "PURCHASE_ORDER",
  "PAYMENT",
  "PAYROLL",
];

export const ENTRY_STATUS_ORDER: JournalEntryStatus[] = [
  "DRAFT",
  "POSTED",
  "REVERSED",
];
