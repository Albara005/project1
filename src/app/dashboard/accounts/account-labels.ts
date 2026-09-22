/**
 * تسميات أنواع الحسابات وقواعد الرصيد — وحدة خالية من أي اعتماديات على الخادم
 * حتى يمكن استيرادها داخل مكوّنات العميل بأمان (لا تستورد Prisma كقيمة).
 */

import type { AccountType } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "أصول",
  LIABILITY: "خصوم",
  EQUITY: "حقوق ملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

/** ترتيب عرض المجموعات في دليل الحسابات والتقارير. */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

export const ACCOUNT_TYPE_TONES: Record<AccountType, BadgeTone> = {
  ASSET: "blue",
  LIABILITY: "amber",
  EQUITY: "purple",
  REVENUE: "green",
  EXPENSE: "red",
};

/**
 * الرصيد الطبيعي للحساب:
 * الأصول والمصروفات = مدين - دائن، والخصوم وحقوق الملكية والإيرادات = دائن - مدين.
 */
export function signedBalance(
  type: AccountType,
  debit: number,
  credit: number,
): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}
