/**
 * قيم وتسميات آمنة للاستخدام في مكوّنات العميل ("use client").
 *
 * مهم: لا تستورد هذا الملف أي شيء من `@/generated/prisma` أو `@/lib/db`،
 * لأن استيراد عميل Prisma داخل مكوّن عميل يسحب وحدات Node (fs/net/tls)
 * إلى حزمة المتصفح ويكسر البناء. استخدم هذه الثوابت في مكوّنات العميل،
 * وأنواع Prisma في كود الخادم فقط.
 */

export const ROLE_VALUES = [
  "ADMIN",
  "ACCOUNTANT",
  "SALES",
  "PURCHASING",
  "INVENTORY",
  "HR",
  "EMPLOYEE",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

export const ROLE_LABELS: Record<RoleValue, string> = {
  ADMIN: "مدير النظام",
  ACCOUNTANT: "محاسب",
  SALES: "مبيعات",
  PURCHASING: "مشتريات",
  INVENTORY: "مخزون",
  HR: "موارد بشرية",
  EMPLOYEE: "موظف",
};

export const ENTITY_TYPE_VALUES = [
  "PURCHASE_ORDER",
  "SALES_ORDER",
  "INVOICE",
  "LEAVE_REQUEST",
  "JOURNAL_ENTRY",
] as const;

export type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityTypeValue, string> = {
  PURCHASE_ORDER: "أمر شراء",
  SALES_ORDER: "أمر بيع",
  INVOICE: "فاتورة",
  LEAVE_REQUEST: "طلب إجازة",
  JOURNAL_ENTRY: "قيد محاسبي",
};

export const STATE_COLOR_OPTIONS = [
  { value: "gray", label: "رمادي" },
  { value: "blue", label: "أزرق" },
  { value: "amber", label: "برتقالي" },
  { value: "green", label: "أخضر" },
  { value: "red", label: "أحمر" },
  { value: "purple", label: "بنفسجي" },
] as const;
