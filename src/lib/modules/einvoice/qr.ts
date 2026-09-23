import QRCode from "qrcode";

/**
 * رمز QR للمرحلة الثانية: تسعة حقول بصيغة TLV بدل الخمسة في المرحلة الأولى.
 * الحقول الأربعة الإضافية تثبت أن الفاتورة وُقِّعت بشهادة صادرة من الهيئة،
 * فيستطيع المتحقق التأكد دون الرجوع لأي خدمة.
 */

export type Phase2QrInput = {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vatTotal: number;
  /** تجزئة الفاتورة بترميز base64 */
  invoiceHash: string;
  /** توقيع الفاتورة بترميز base64 */
  signature: string;
  /** المفتاح العام من الشهادة بصيغة DER وترميز base64 */
  publicKeyDerBase64: string;
  /** توقيع جهة الإصدار على الشهادة — للفواتير المبسطة فقط */
  issuerSignatureBase64?: string;
};

function tlv(tag: number, value: Buffer): Buffer {
  if (value.length > 255) {
    // الطول يُخزَّن في بايت واحد، والحقول الثمانية والتاسعة قد تتجاوزه
    // فتُستخدم صيغة الطول الممتد المعرّفة في المواصفة
    const lengthBytes = Buffer.from([0x81, value.length & 0xff]);
    if (value.length > 0xff) {
      throw new Error(`قيمة الحقل ${tag} أطول من الحد المسموح`);
    }
    return Buffer.concat([Buffer.from([tag]), lengthBytes, value]);
  }
  return Buffer.concat([Buffer.from([tag, value.length]), value]);
}

function text(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function formatTimestamp(date: Date): string {
  return `${date.toISOString().split(".")[0]}Z`;
}

function formatAmount(value: number): string {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

/** يبني سلسلة TLV بترميز base64 لرمز المرحلة الثانية. */
export function buildPhase2QrPayload(input: Phase2QrInput): string {
  const parts: Buffer[] = [
    tlv(1, text(input.sellerName)),
    tlv(2, text(input.vatNumber)),
    tlv(3, text(formatTimestamp(input.timestamp))),
    tlv(4, text(formatAmount(input.total))),
    tlv(5, text(formatAmount(input.vatTotal))),
    tlv(6, text(input.invoiceHash)),
    tlv(7, Buffer.from(input.signature, "base64")),
    tlv(8, Buffer.from(input.publicKeyDerBase64, "base64")),
  ];

  if (input.issuerSignatureBase64) {
    parts.push(tlv(9, Buffer.from(input.issuerSignatureBase64, "base64")));
  }

  return Buffer.concat(parts).toString("base64");
}

/** يفك ترميز السلسلة للتحقق أو للفحص. */
export function decodePhase2QrPayload(base64: string): Record<number, Buffer> {
  const buffer = Buffer.from(base64, "base64");
  const fields: Record<number, Buffer> = {};

  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const tag = buffer[offset];
    let length = buffer[offset + 1];
    let valueStart = offset + 2;

    // 0x81 يعني أن الطول الحقيقي في البايت التالي
    if (length === 0x81 && offset + 3 <= buffer.length) {
      length = buffer[offset + 2];
      valueStart = offset + 3;
    }

    const end = valueStart + length;
    if (end > buffer.length) break;

    fields[tag] = buffer.subarray(valueStart, end);
    offset = end;
  }

  return fields;
}

export async function generatePhase2QrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 150,
  });
}
