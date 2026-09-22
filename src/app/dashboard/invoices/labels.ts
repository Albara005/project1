import type { BadgeTone } from "@/components/ui";
import type { InvoiceStatus, InvoiceType } from "@/generated/prisma";

/** وحدة خالية من الاعتماديات (استيراد أنواع فقط) صالحة للاستخدام في مكوّنات العميل. */
export const INVOICE_STATUS_VALUES: InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئياً",
  PAID: "مدفوعة",
  CANCELLED: "ملغاة",
};

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  DRAFT: "gray",
  ISSUED: "amber",
  PARTIALLY_PAID: "blue",
  PAID: "green",
  CANCELLED: "red",
};

export const INVOICE_TYPE_VALUES: InvoiceType[] = ["SALES", "PURCHASE"];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  SALES: "فاتورة مبيعات",
  PURCHASE: "فاتورة مشتريات",
};

export const INVOICE_TYPE_SHORT_LABELS: Record<InvoiceType, string> = {
  SALES: "مبيعات",
  PURCHASE: "مشتريات",
};
