import type { BadgeTone } from "@/components/ui";
import type { LeadStatus } from "@/generated/prisma";

/**
 * وحدة خالية من الاعتماديات: تُستورد من مكوّنات العميل أيضاً،
 * لذلك لا تستورد أي قيمة من عميل Prisma (استيراد الأنواع فقط).
 * مراحل مسار البيع بالترتيب: جديدة ← تم التواصل ← مؤهلة ← عرض سعر ← مكسوبة/خاسرة
 */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "جديدة",
  CONTACTED: "تم التواصل",
  QUALIFIED: "مؤهلة",
  PROPOSAL: "عرض سعر",
  WON: "مكسوبة",
  LOST: "خاسرة",
};

export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  NEW: "gray",
  CONTACTED: "blue",
  QUALIFIED: "purple",
  PROPOSAL: "amber",
  WON: "green",
  LOST: "red",
};
