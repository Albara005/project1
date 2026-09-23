import {
  EInvoiceStatus,
  EInvoiceType,
  InvoiceType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import {
  buildUblInvoice,
  computeInvoiceHash,
  newInvoiceUuid,
  INITIAL_PREVIOUS_HASH,
  type InvoiceTypeCode,
  type UblLine,
} from "./ubl";
import { signInvoice } from "./sign";
import {
  clearInvoice,
  reportInvoice,
  type FatooraEnvironment,
} from "./fatoora";

export class EInvoiceError extends Error {}

/**
 * ربط فواتير النظام بالفوترة الإلكترونية.
 *
 * التسلسل هو النقطة الحرجة: العدّاد وتجزئة الفاتورة السابقة يُقرآن
 * ويُكتبان داخل معاملة واحدة، وإلا أنتجت فاتورتان متزامنتان نفس العدّاد
 * وانكسرت السلسلة لدى الهيئة.
 */

/** الفاتورة قياسية إن كان للمشتري رقم ضريبي، وإلا فمبسطة. */
function resolveDocumentType(buyerVatNumber: string | null): EInvoiceType {
  return buyerVatNumber ? EInvoiceType.STANDARD : EInvoiceType.SIMPLIFIED;
}

export async function getActiveCredential() {
  return prisma.eInvoiceCredential.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * يولّد الفاتورة الإلكترونية ويوقّعها ويحفظها بحالة SIGNED.
 * لا يرسلها للهيئة — الإرسال خطوة منفصلة قابلة لإعادة المحاولة.
 */
export async function issueEInvoice(invoiceId: string): Promise<string> {
  const credential = await getActiveCredential();
  if (!credential) {
    throw new EInvoiceError(
      "لا توجد شهادة مفعّلة؛ أكمل انضمام المنشأة من صفحة الفوترة الإلكترونية أولاً",
    );
  }
  if (!credential.certificatePem) {
    throw new EInvoiceError("الشهادة غير مكتملة؛ أعد إجراء الانضمام");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      supplier: true,
      currency: true,
      items: { include: { product: { select: { unit: true } } } },
      eInvoice: true,
    },
  });

  if (!invoice) throw new EInvoiceError("الفاتورة غير موجودة");
  if (invoice.type !== InvoiceType.SALES) {
    throw new EInvoiceError(
      "الفوترة الإلكترونية تخص فواتير المبيعات؛ فاتورة المشتريات يصدرها المورد",
    );
  }
  if (invoice.eInvoice) {
    throw new EInvoiceError("سبق إصدار فاتورة إلكترونية لهذه الفاتورة");
  }
  if (invoice.items.length === 0) {
    throw new EInvoiceError("لا يمكن إصدار فاتورة إلكترونية بلا أصناف");
  }

  const organization = await prisma.organization.findFirst();
  if (!organization?.taxNumber) {
    throw new EInvoiceError("الرقم الضريبي للمنشأة غير معرّف في الإعدادات");
  }

  const documentType = resolveDocumentType(invoice.customer?.taxNumber ?? null);
  const currencyCode = invoice.currency?.code ?? organization.currency;

  const lines: UblLine[] = invoice.items.map((item, index) => {
    const net = toNumber(item.lineTotal);
    const rate = toNumber(item.taxRate);
    return {
      id: index + 1,
      name: item.description,
      quantity: toNumber(item.quantity),
      unitCode: item.product?.unit ? "PCE" : "PCE",
      unitPrice: toNumber(item.unitPrice),
      lineExtensionAmount: net,
      taxRate: rate,
      taxAmount: Math.round((net * rate) / 100 * 100) / 100,
    };
  });

  const uuid = newInvoiceUuid();

  // العدّاد والتجزئة السابقة يُقرآن داخل المعاملة لمنع تضارب الإصدار المتزامن
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.eInvoice.findFirst({
      orderBy: { icv: "desc" },
      select: { icv: true, hash: true },
    });

    const icv = (last?.icv ?? 0n) + 1n;
    const previousHash = last?.hash ?? INITIAL_PREVIOUS_HASH;

    const xml = buildUblInvoice({
      invoiceNumber: invoice.number,
      uuid,
      issueDate: invoice.issueDate,
      documentType: documentType === EInvoiceType.STANDARD ? "STANDARD" : "SIMPLIFIED",
      typeCode: "388" as InvoiceTypeCode,
      currencyCode,
      icv,
      previousHash,
      seller: {
        name: organization.legalName || organization.name,
        vatNumber: organization.taxNumber!,
        city: organization.address ?? undefined,
      },
      buyer: {
        name: invoice.customer?.name ?? "عميل نقدي",
        vatNumber: invoice.customer?.taxNumber ?? null,
        city: invoice.customer?.address ?? undefined,
      },
      lines,
      lineExtensionTotal: toNumber(invoice.subtotal),
      taxExclusiveAmount: toNumber(invoice.subtotal),
      taxInclusiveAmount: toNumber(invoice.total),
      taxTotal: toNumber(invoice.taxAmount),
      payableAmount: toNumber(invoice.total),
    });

    const hash = computeInvoiceHash(xml);

    return tx.eInvoice.create({
      data: {
        invoiceId: invoice.id,
        uuid,
        icv,
        hash,
        previousHash,
        type: documentType,
        status: EInvoiceStatus.GENERATED,
        xml,
      },
    });
  });

  // التوقيع خارج المعاملة لأنه عملية تشفير قد تطول ولا تمس السلسلة
  const signed = await signInvoice({
    xml: created.xml,
    privateKeyPem: credential.privateKeyPem,
    certificatePem: credential.certificatePem,
    sellerName: organization.legalName || organization.name,
    vatNumber: organization.taxNumber,
    issueDate: invoice.issueDate,
    total: toNumber(invoice.total),
    vatTotal: toNumber(invoice.taxAmount),
    includeIssuerSignature: documentType === EInvoiceType.SIMPLIFIED,
  });

  await prisma.eInvoice.update({
    where: { id: created.id },
    data: {
      signedXml: signed.signedXml,
      signature: signed.signature,
      qrCode: signed.qrPayload,
      status: EInvoiceStatus.SIGNED,
    },
  });

  return created.id;
}

/**
 * يرسل الفاتورة للهيئة: المبسطة تُبلَّغ والقياسية تُجاز.
 * يحفظ رد الهيئة كاملاً حتى عند الرفض، لأن رسائل التحقق هي الدليل الوحيد
 * على سبب الرفض.
 */
export async function submitEInvoice(eInvoiceId: string): Promise<EInvoiceStatus> {
  const credential = await getActiveCredential();
  if (!credential?.productionCsid || !credential.productionSecret) {
    throw new EInvoiceError(
      "لا توجد شهادة إنتاج مفعّلة؛ أكمل خطوات الانضمام قبل الإرسال",
    );
  }

  const record = await prisma.eInvoice.findUnique({ where: { id: eInvoiceId } });
  if (!record) throw new EInvoiceError("السجل غير موجود");
  if (!record.signedXml) throw new EInvoiceError("الفاتورة غير موقّعة بعد");
  if (
    record.status === EInvoiceStatus.CLEARED ||
    record.status === EInvoiceStatus.REPORTED
  ) {
    throw new EInvoiceError("سبق إرسال هذه الفاتورة بنجاح");
  }

  const environment = credential.environment as FatooraEnvironment;
  const credentials = {
    csid: credential.productionCsid,
    secret: credential.productionSecret,
  };
  const payload = {
    invoiceHash: record.hash,
    uuid: record.uuid,
    invoiceBase64: Buffer.from(record.signedXml, "utf8").toString("base64"),
  };

  await prisma.eInvoice.update({
    where: { id: record.id },
    data: {
      status: EInvoiceStatus.SUBMITTED,
      submittedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  const result =
    record.type === EInvoiceType.SIMPLIFIED
      ? await reportInvoice(environment, credentials, payload)
      : await clearInvoice(environment, credentials, payload);

  const zatcaStatus = result.reportingStatus ?? result.clearanceStatus ?? "";
  const status = resolveStatus(result.ok, zatcaStatus, result.errors.length > 0);

  await prisma.eInvoice.update({
    where: { id: record.id },
    data: {
      status,
      responseStatus: `${result.status} ${zatcaStatus}`.trim(),
      responseBody: result.raw.slice(0, 20000),
      warnings: result.warnings.length ? result.warnings.join("\n") : null,
      errors: result.errors.length ? result.errors.join("\n") : null,
    },
  });

  return status;
}

function resolveStatus(
  ok: boolean,
  zatcaStatus: string,
  hasErrors: boolean,
): EInvoiceStatus {
  const normalized = zatcaStatus.toUpperCase();

  if (normalized.includes("NOT_REPORTED") || normalized.includes("NOT_CLEARED")) {
    return EInvoiceStatus.REJECTED;
  }
  if (normalized.includes("REPORTED")) {
    return hasErrors
      ? EInvoiceStatus.ACCEPTED_WITH_WARNINGS
      : EInvoiceStatus.REPORTED;
  }
  if (normalized.includes("CLEARED")) {
    return hasErrors
      ? EInvoiceStatus.ACCEPTED_WITH_WARNINGS
      : EInvoiceStatus.CLEARED;
  }
  if (!ok) return EInvoiceStatus.FAILED;

  return EInvoiceStatus.SUBMITTED;
}

/**
 * يتحقق من سلامة السلسلة: كل فاتورة تحمل تجزئة سابقتها، والعدّاد متصل.
 * يُستخدم في شاشة المراجعة وفي الفحص الدوري.
 */
export async function verifyChain(): Promise<{
  total: number;
  broken: Array<{ icv: string; number: string; reason: string }>;
}> {
  const records = await prisma.eInvoice.findMany({
    orderBy: { icv: "asc" },
    select: {
      icv: true,
      hash: true,
      previousHash: true,
      xml: true,
      invoice: { select: { number: true } },
    },
  });

  const broken: Array<{ icv: string; number: string; reason: string }> = [];
  let expectedIcv = 1n;
  let expectedPrevious = INITIAL_PREVIOUS_HASH;

  for (const record of records) {
    const number = record.invoice?.number ?? "";

    if (record.icv !== expectedIcv) {
      broken.push({
        icv: record.icv.toString(),
        number,
        reason: `العدّاد غير متصل: المتوقع ${expectedIcv}`,
      });
    }
    if (record.previousHash !== expectedPrevious) {
      broken.push({
        icv: record.icv.toString(),
        number,
        reason: "تجزئة الفاتورة السابقة لا تطابق السلسلة",
      });
    }
    if (computeInvoiceHash(record.xml) !== record.hash) {
      broken.push({
        icv: record.icv.toString(),
        number,
        reason: "محتوى الفاتورة لا يطابق تجزئتها المحفوظة",
      });
    }

    expectedIcv = record.icv + 1n;
    expectedPrevious = record.hash;
  }

  return { total: records.length, broken };
}

export function decimalToNumber(value: Prisma.Decimal | number | null): number {
  return toNumber(value);
}
