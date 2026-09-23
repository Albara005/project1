import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

type TxClient = Prisma.TransactionClient | typeof prisma;

export class CurrencyError extends Error {}

export type CurrencyInfo = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isBase: boolean;
};

/** عملة الأساس التي تُمسك بها الدفاتر؛ كل القيود تُرحَّل بها. */
export async function getBaseCurrency(client: TxClient = prisma): Promise<CurrencyInfo> {
  const base = await client.currency.findFirst({ where: { isBase: true } });
  if (!base) {
    throw new CurrencyError(
      "لم تُحدَّد عملة أساس للنظام. عرّف عملة الأساس من إعدادات العملات.",
    );
  }
  return toInfo(base);
}

function toInfo(currency: {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  isBase: boolean;
}): CurrencyInfo {
  return {
    id: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    decimals: currency.decimals,
    isBase: currency.isBase,
  };
}

export async function listActiveCurrencies(): Promise<CurrencyInfo[]> {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [{ isBase: "desc" }, { code: "asc" }],
  });
  return currencies.map(toInfo);
}

/**
 * سعر صرف العملة مقابل عملة الأساس في تاريخ معيّن: يُؤخذ آخر سعر
 * سارٍ في ذلك التاريخ أو قبله، لأن السعر يظل سارياً حتى يصدر سعر أحدث.
 * عملة الأساس سعرها 1 دائماً.
 */
export async function getExchangeRate(
  currencyId: string,
  onDate: Date = new Date(),
  client: TxClient = prisma,
): Promise<number> {
  const currency = await client.currency.findUnique({ where: { id: currencyId } });
  if (!currency) throw new CurrencyError("العملة غير موجودة");
  if (currency.isBase) return 1;

  const rate = await client.exchangeRate.findFirst({
    where: { currencyId, validFrom: { lte: onDate } },
    orderBy: { validFrom: "desc" },
  });

  if (!rate) {
    throw new CurrencyError(
      `لا يوجد سعر صرف لعملة ${currency.code} بتاريخ ${onDate.toISOString().slice(0, 10)} أو قبله`,
    );
  }

  return Number(rate.rate);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** يحوّل مبلغاً من عملة المستند إلى عملة الأساس. */
export function toBaseAmount(amount: number, exchangeRate: number): number {
  return round2(amount * exchangeRate);
}

/**
 * يحسب فرق العملة المحقّق عند السداد: الفرق بين قيمة المبلغ بعملة الأساس
 * وقت إصدار الفاتورة وقيمته وقت التحصيل الفعلي.
 *
 * موجب = ربح فروقات عملة، سالب = خسارة.
 * الاتجاه يُعكس للمدفوعات الصادرة لأن ارتفاع سعر الصرف يزيد ما ندفعه.
 */
export function realizedFxDifference(params: {
  amount: number;
  invoiceRate: number;
  paymentRate: number;
  direction: "INBOUND" | "OUTBOUND";
}): number {
  const difference = round2(
    params.amount * params.paymentRate - params.amount * params.invoiceRate,
  );
  return params.direction === "INBOUND" ? difference : -difference;
}

/** تنسيق مبلغ بعملة محددة مع أرقام لاتينية. */
export function formatMoney(
  amount: number,
  currency: { code: string; decimals?: number },
): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: currency.decimals ?? 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
