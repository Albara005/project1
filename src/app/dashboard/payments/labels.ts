import type { PaymentDirection, PaymentMethod } from "@/generated/prisma";

/** وحدة خالية من الاعتماديات (استيراد أنواع فقط) صالحة للاستخدام في مكوّنات العميل. */
export const PAYMENT_METHOD_VALUES: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "CHEQUE",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقداً",
  BANK_TRANSFER: "تحويل بنكي",
  CREDIT_CARD: "بطاقة ائتمان",
  CHEQUE: "شيك",
};

export const PAYMENT_DIRECTION_VALUES: PaymentDirection[] = ["INBOUND", "OUTBOUND"];

export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  INBOUND: "سند قبض",
  OUTBOUND: "سند صرف",
};
