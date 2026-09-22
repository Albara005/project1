import type { BadgeTone } from "@/components/ui";
import type { SalesOrderStatus } from "@/generated/prisma";

/** وحدة خالية من الاعتماديات (استيراد أنواع فقط) حتى تصلح للاستخدام في مكوّنات العميل. */
export const SALES_ORDER_STATUS_VALUES: SalesOrderStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "DELIVERED",
  "INVOICED",
  "CANCELLED",
];

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  CONFIRMED: "مؤكد",
  DELIVERED: "مُسلَّم",
  INVOICED: "مُفوتر",
  CANCELLED: "ملغي",
};

export const SALES_ORDER_STATUS_TONES: Record<SalesOrderStatus, BadgeTone> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "amber",
  CONFIRMED: "blue",
  DELIVERED: "purple",
  INVOICED: "green",
  CANCELLED: "red",
};

/**
 * حالات المستند تحمل نفس مفاتيح حالات سير العمل، لكن سير العمل ديناميكي
 * وقد يحتوي مفاتيح غير موجودة في الـ enum، لذا نتحقق قبل المزامنة.
 */
export function salesOrderStatusFromStateKey(key: string): SalesOrderStatus | null {
  return SALES_ORDER_STATUS_VALUES.find((status) => status === key) ?? null;
}
