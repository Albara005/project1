import QRCode from "qrcode";

/**
 * رمز QR للفوترة الإلكترونية (المرحلة الأولى) بحسب متطلبات هيئة الزكاة
 * والضريبة والجمارك (ZATCA).
 *
 * البيانات تُرمَّز بصيغة TLV: لكل حقل وسم (بايت واحد) ثم طول قيمته بالبايت
 * (بايت واحد) ثم القيمة بترميز UTF-8، ثم تُجمع الحقول وتُرمَّز Base64.
 *
 * الحقول الخمسة الإلزامية:
 *   1) اسم البائع  2) الرقم الضريبي للبائع  3) ختم زمني ISO 8601
 *   4) إجمالي الفاتورة شاملاً الضريبة  5) إجمالي ضريبة القيمة المضافة
 */

export type ZatcaInvoiceData = {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vatTotal: number;
};

const TAGS = {
  SELLER_NAME: 1,
  VAT_NUMBER: 2,
  TIMESTAMP: 3,
  TOTAL: 4,
  VAT_TOTAL: 5,
} as const;

function tlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf8");

  // الطول يُخزَّن في بايت واحد، فالقيم الأطول من 255 بايت غير صالحة
  if (valueBuffer.length > 255) {
    throw new Error(`قيمة الحقل ${tag} تتجاوز 255 بايت المسموح بها في ترميز TLV`);
  }

  return Buffer.concat([
    Buffer.from([tag, valueBuffer.length]),
    valueBuffer,
  ]);
}

/** الختم الزمني بصيغة ISO 8601 بتوقيت UTC وبدون أجزاء الثانية. */
function formatTimestamp(date: Date): string {
  return `${date.toISOString().split(".")[0]}Z`;
}

/** المبالغ تُكتب بخانتين عشريتين كنص. */
function formatAmount(value: number): string {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

/** يبني سلسلة Base64 المطلوبة داخل رمز QR. */
export function buildZatcaQrPayload(data: ZatcaInvoiceData): string {
  const buffer = Buffer.concat([
    tlv(TAGS.SELLER_NAME, data.sellerName),
    tlv(TAGS.VAT_NUMBER, data.vatNumber),
    tlv(TAGS.TIMESTAMP, formatTimestamp(data.timestamp)),
    tlv(TAGS.TOTAL, formatAmount(data.total)),
    tlv(TAGS.VAT_TOTAL, formatAmount(data.vatTotal)),
  ]);

  return buffer.toString("base64");
}

/** يفك ترميز السلسلة للتحقق أو للفحص. */
export function decodeZatcaQrPayload(base64: string): Record<number, string> {
  const buffer = Buffer.from(base64, "base64");
  const fields: Record<number, string> = {};

  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const tag = buffer[offset];
    const length = buffer[offset + 1];
    const start = offset + 2;
    const end = start + length;
    if (end > buffer.length) break;

    fields[tag] = buffer.subarray(start, end).toString("utf8");
    offset = end;
  }

  return fields;
}

/**
 * يولّد رمز QR بصيغة SVG جاهز للتضمين في صفحة الطباعة.
 * يعيد null إذا كان الرقم الضريبي غير متوفر، لأن الرمز بلا رقم ضريبي غير نظامي.
 */
export async function generateZatcaQrSvg(
  data: Omit<ZatcaInvoiceData, "vatNumber"> & { vatNumber: string | null },
): Promise<string | null> {
  if (!data.vatNumber?.trim()) return null;

  const payload = buildZatcaQrPayload({ ...data, vatNumber: data.vatNumber.trim() });

  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 120,
  });
}
