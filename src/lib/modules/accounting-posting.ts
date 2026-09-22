import {
  JournalEntryStatus,
  JournalSourceType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";

type TxClient = Prisma.TransactionClient | typeof prisma;

export class PostingError extends Error {}

/** أكواد الحسابات القياسية المستخدمة في الترحيل التلقائي (من دليل الحسابات الافتراضي). */
export const ACCOUNT_CODES = {
  CASH: "1100",
  RECEIVABLES: "1200",
  INVENTORY: "1300",
  PAYABLES: "2100",
  VAT_PAYABLE: "2200",
  SALES_REVENUE: "4100",
  COGS: "5100",
  SALARIES: "5200",
} as const;

export type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
};

/** يولّد رقم قيد متسلسل مثل JV-2026-0007 ضمن نفس المعاملة. */
export async function nextDocumentNumber(
  client: TxClient,
  model:
    | "journalEntry"
    | "invoice"
    | "payment"
    | "purchaseOrder"
    | "salesOrder"
    | "payslip"
    | "returnNote",
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();

  // @ts-expect-error - الوصول الديناميكي للنموذج مقصود لتوحيد توليد الأرقام
  const last = await client[model].findFirst({
    where: { number: { startsWith: `${prefix}-${year}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const lastSequence = last?.number
    ? Number(String(last.number).split("-").pop() ?? 0)
    : 0;

  return `${prefix}-${year}-${String(lastSequence + 1).padStart(4, "0")}`;
}

/**
 * ينشئ قيداً محاسبياً مرحّلاً من سطور معرّفة بأكواد الحسابات.
 * يتحقق من توازن المدين والدائن قبل الحفظ.
 */
export async function postJournalEntry(
  client: TxClient,
  input: {
    description: string;
    lines: JournalLineInput[];
    sourceType?: JournalSourceType;
    entryDate?: Date;
    createdById?: string;
    invoiceId?: string;
    purchaseOrderId?: string;
    salesOrderId?: string;
    paymentId?: string;
    returnNoteId?: string;
  },
) {
  const lines = input.lines.filter(
    (line) => (line.debit ?? 0) !== 0 || (line.credit ?? 0) !== 0,
  );

  if (lines.length < 2) {
    throw new PostingError("القيد يحتاج سطرين على الأقل");
  }

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new PostingError(
      `القيد غير متوازن: مدين ${totalDebit.toFixed(2)} مقابل دائن ${totalCredit.toFixed(2)}`,
    );
  }

  const codes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accounts = await client.chartOfAccount.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });

  const accountByCode = new Map(accounts.map((account) => [account.code, account.id]));
  const missing = codes.filter((code) => !accountByCode.has(code));
  if (missing.length > 0) {
    throw new PostingError(`حسابات غير موجودة في دليل الحسابات: ${missing.join(", ")}`);
  }

  const number = await nextDocumentNumber(client, "journalEntry", "JV");

  return client.journalEntry.create({
    data: {
      number,
      description: input.description,
      entryDate: input.entryDate ?? new Date(),
      status: JournalEntryStatus.POSTED,
      sourceType: input.sourceType ?? JournalSourceType.MANUAL,
      createdById: input.createdById ?? null,
      invoiceId: input.invoiceId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      salesOrderId: input.salesOrderId ?? null,
      paymentId: input.paymentId ?? null,
      returnNoteId: input.returnNoteId ?? null,
      lines: {
        create: lines.map((line) => ({
          accountId: accountByCode.get(line.accountCode)!,
          debit: new Prisma.Decimal(line.debit ?? 0),
          credit: new Prisma.Decimal(line.credit ?? 0),
          description: line.description ?? null,
        })),
      },
    },
  });
}

/**
 * قيد فاتورة مبيعات: مدين الذمم المدينة، دائن الإيرادات + ضريبة القيمة المضافة.
 */
export async function postSalesInvoice(
  client: TxClient,
  input: {
    invoiceId: string;
    number: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    createdById?: string;
  },
) {
  return postJournalEntry(client, {
    description: `فاتورة مبيعات ${input.number}`,
    sourceType: JournalSourceType.SALES_INVOICE,
    invoiceId: input.invoiceId,
    createdById: input.createdById,
    lines: [
      { accountCode: ACCOUNT_CODES.RECEIVABLES, debit: input.total, description: "ذمم العميل" },
      { accountCode: ACCOUNT_CODES.SALES_REVENUE, credit: input.subtotal, description: "إيرادات مبيعات" },
      { accountCode: ACCOUNT_CODES.VAT_PAYABLE, credit: input.taxAmount, description: "ضريبة قيمة مضافة" },
    ],
  });
}

/**
 * قيد استلام مشتريات: مدين المخزون + الضريبة، دائن ذمم الموردين.
 */
export async function postPurchaseReceipt(
  client: TxClient,
  input: {
    purchaseOrderId: string;
    number: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    createdById?: string;
  },
) {
  return postJournalEntry(client, {
    description: `استلام أمر شراء ${input.number}`,
    sourceType: JournalSourceType.PURCHASE_ORDER,
    purchaseOrderId: input.purchaseOrderId,
    createdById: input.createdById,
    lines: [
      { accountCode: ACCOUNT_CODES.INVENTORY, debit: input.subtotal, description: "إدخال مخزون" },
      { accountCode: ACCOUNT_CODES.VAT_PAYABLE, debit: input.taxAmount, description: "ضريبة مدخلات" },
      { accountCode: ACCOUNT_CODES.PAYABLES, credit: input.total, description: "ذمم المورد" },
    ],
  });
}

/**
 * قيد دفعة: وارد (تحصيل من عميل) أو صادر (سداد لمورد).
 */
export async function postPayment(
  client: TxClient,
  input: {
    paymentId: string;
    number: string;
    amount: number;
    direction: "INBOUND" | "OUTBOUND";
    createdById?: string;
  },
) {
  const lines: JournalLineInput[] =
    input.direction === "INBOUND"
      ? [
          { accountCode: ACCOUNT_CODES.CASH, debit: input.amount, description: "تحصيل نقدي" },
          { accountCode: ACCOUNT_CODES.RECEIVABLES, credit: input.amount, description: "تسوية ذمم العميل" },
        ]
      : [
          { accountCode: ACCOUNT_CODES.PAYABLES, debit: input.amount, description: "تسوية ذمم المورد" },
          { accountCode: ACCOUNT_CODES.CASH, credit: input.amount, description: "سداد نقدي" },
        ];

  return postJournalEntry(client, {
    description: `سند ${input.direction === "INBOUND" ? "قبض" : "صرف"} ${input.number}`,
    sourceType: JournalSourceType.PAYMENT,
    paymentId: input.paymentId,
    createdById: input.createdById,
    lines,
  });
}

/**
 * قيد مرتجع مبيعات: عكس أثر فاتورة البيع — مدين الإيرادات والضريبة،
 * دائن ذمم العميل (تنخفض مديونيته بقيمة المرتجع).
 */
export async function postSalesReturn(
  client: TxClient,
  input: {
    returnNoteId: string;
    number: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    createdById?: string;
  },
) {
  return postJournalEntry(client, {
    description: `مرتجع مبيعات ${input.number}`,
    sourceType: JournalSourceType.SALES_RETURN,
    returnNoteId: input.returnNoteId,
    createdById: input.createdById,
    lines: [
      { accountCode: ACCOUNT_CODES.SALES_REVENUE, debit: input.subtotal, description: "تخفيض إيرادات" },
      { accountCode: ACCOUNT_CODES.VAT_PAYABLE, debit: input.taxAmount, description: "تخفيض ضريبة مستحقة" },
      { accountCode: ACCOUNT_CODES.RECEIVABLES, credit: input.total, description: "تخفيض ذمم العميل" },
    ],
  });
}

/**
 * قيد مرتجع مشتريات: عكس أثر الاستلام — مدين ذمم المورد،
 * دائن المخزون وضريبة المدخلات.
 */
export async function postPurchaseReturn(
  client: TxClient,
  input: {
    returnNoteId: string;
    number: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    createdById?: string;
  },
) {
  return postJournalEntry(client, {
    description: `مرتجع مشتريات ${input.number}`,
    sourceType: JournalSourceType.PURCHASE_RETURN,
    returnNoteId: input.returnNoteId,
    createdById: input.createdById,
    lines: [
      { accountCode: ACCOUNT_CODES.PAYABLES, debit: input.total, description: "تخفيض ذمم المورد" },
      { accountCode: ACCOUNT_CODES.INVENTORY, credit: input.subtotal, description: "إخراج مخزون" },
      { accountCode: ACCOUNT_CODES.VAT_PAYABLE, credit: input.taxAmount, description: "تخفيض ضريبة مدخلات" },
    ],
  });
}

/** قيد رواتب: مدين مصروف الرواتب، دائن النقدية. */
export async function postPayrollEntry(
  client: TxClient,
  input: { description: string; amount: number; createdById?: string },
) {
  return postJournalEntry(client, {
    description: input.description,
    sourceType: JournalSourceType.PAYROLL,
    createdById: input.createdById,
    lines: [
      { accountCode: ACCOUNT_CODES.SALARIES, debit: input.amount, description: "مصروف رواتب" },
      { accountCode: ACCOUNT_CODES.CASH, credit: input.amount, description: "صرف رواتب" },
    ],
  });
}
