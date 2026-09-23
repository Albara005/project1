import type { BadgeTone } from "@/components/ui";

/** تسميات آمنة لمكوّنات العميل (لا تستورد عميل Prisma). */

export const EINVOICE_STATUS_LABELS: Record<string, string> = {
  GENERATED: "مُولَّدة",
  SIGNED: "موقّعة",
  SUBMITTED: "أُرسلت",
  REPORTED: "مُبلَّغة",
  CLEARED: "مُجازة",
  ACCEPTED_WITH_WARNINGS: "مقبولة بملاحظات",
  REJECTED: "مرفوضة",
  FAILED: "فشل الإرسال",
};

export const EINVOICE_STATUS_TONES: Record<string, BadgeTone> = {
  GENERATED: "gray",
  SIGNED: "blue",
  SUBMITTED: "amber",
  REPORTED: "green",
  CLEARED: "green",
  ACCEPTED_WITH_WARNINGS: "amber",
  REJECTED: "red",
  FAILED: "red",
};

export const EINVOICE_TYPE_LABELS: Record<string, string> = {
  STANDARD: "قياسية (تُجاز)",
  SIMPLIFIED: "مبسطة (تُبلَّغ)",
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
  sandbox: "بيئة التطوير",
  simulation: "بيئة المحاكاة",
  production: "بيئة الإنتاج",
};

export const INVOICE_TYPE_OPTIONS = [
  { value: "1100", label: "قياسية ومبسطة" },
  { value: "1000", label: "قياسية فقط" },
  { value: "0100", label: "مبسطة فقط" },
] as const;
