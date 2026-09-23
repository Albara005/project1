import type { BadgeTone } from "@/components/ui";

/** تسميات آمنة لمكوّنات العميل (لا تستورد عميل Prisma). */

export const RETURN_TYPE_VALUES = ["SALES", "PURCHASE"] as const;
export type ReturnTypeValue = (typeof RETURN_TYPE_VALUES)[number];

export const RETURN_TYPE_LABELS: Record<ReturnTypeValue, string> = {
  SALES: "مرتجع مبيعات",
  PURCHASE: "مرتجع مشتريات",
};

export const RETURN_STATUS_VALUES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type ReturnStatusValue = (typeof RETURN_STATUS_VALUES)[number];

export const RETURN_STATUS_LABELS: Record<ReturnStatusValue, string> = {
  DRAFT: "مسودة",
  CONFIRMED: "مؤكد",
  CANCELLED: "ملغي",
};

export const RETURN_STATUS_TONES: Record<ReturnStatusValue, BadgeTone> = {
  DRAFT: "gray",
  CONFIRMED: "green",
  CANCELLED: "red",
};
