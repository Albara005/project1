import type { PayslipStatus } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

export const PAYSLIP_STATUS_LABELS: Record<PayslipStatus, string> = {
  DRAFT: "مسودة",
  APPROVED: "معتمد",
  PAID: "مدفوع",
};

export const PAYSLIP_STATUS_TONES: Record<PayslipStatus, BadgeTone> = {
  DRAFT: "gray",
  APPROVED: "blue",
  PAID: "green",
};

export const MONTH_LABELS: Record<number, string> = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

/** يعيد تسمية الفترة مثل: مارس 2026 */
export function periodLabel(year: number, month: number) {
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}
