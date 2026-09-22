import type { PurchaseOrderStatus } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

/** تسميات ودلالات ألوان حالات أمر الشراء (مفاتيح الحالات نفسها مفاتيح سير العمل). */
export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  RECEIVED: "مستلم",
  CANCELLED: "ملغي",
};

export const PURCHASE_ORDER_STATUS_TONES: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "amber",
  APPROVED: "blue",
  RECEIVED: "green",
  CANCELLED: "red",
};
