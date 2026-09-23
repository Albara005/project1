import { formatMoney, toBaseAmount, type CurrencyInfo } from "@/lib/modules/currency";
import { cn, toNumber } from "@/lib/utils";

/**
 * عرض مبالغ المستندات متعددة العملات.
 * وحدة خاصة بالخادم فقط (تستورد وحدة العملات) — لا تُستورد داخل مكوّنات العميل.
 */

export type DocumentCurrency = { code: string; decimals: number } | null | undefined;

/**
 * قيمة المبلغ بعملة الأساس: يُعتمد العمود المخزَّن، ويُحسب من سعر الصرف
 * عند غيابه حتى تظل المستندات القديمة (قبل إضافة أعمدة الأساس) صحيحة العرض.
 */
export function baseValue(
  amount: number,
  storedBase: unknown,
  exchangeRate: unknown,
): number {
  const stored = toNumber(storedBase);
  if (stored !== 0) return stored;
  return toBaseAmount(amount, toNumber(exchangeRate) || 1);
}

/** هل يختلف مستند بعملته عن عملة الأساس؟ */
export function isForeign(
  currency: DocumentCurrency,
  baseCurrency: CurrencyInfo,
): boolean {
  return !!currency && currency.code !== baseCurrency.code;
}

/**
 * مبلغ بعملة المستند، ويظهر أسفله المعادل بعملة الأساس حين تختلف العملتان.
 */
export function Money({
  amount,
  currency,
  storedBase,
  exchangeRate,
  baseCurrency,
  className,
  baseClassName,
}: {
  amount: number;
  currency: DocumentCurrency;
  /** عمود الأساس المخزَّن على المستند (baseTotal / baseAmount ...). */
  storedBase?: unknown;
  exchangeRate?: unknown;
  baseCurrency: CurrencyInfo;
  className?: string;
  baseClassName?: string;
}) {
  const documentCurrency = currency ?? baseCurrency;

  return (
    <>
      <span className={className}>{formatMoney(amount, documentCurrency)}</span>
      {isForeign(currency, baseCurrency) ? (
        <span
          className={cn(
            "block text-xs font-normal text-muted-foreground",
            baseClassName,
          )}
        >
          {"‎= "}
          {formatMoney(baseValue(amount, storedBase, exchangeRate), baseCurrency)}
        </span>
      ) : null}
    </>
  );
}

/** وسم صغير يوضّح عملة المستند وسعر صرفها مقابل عملة الأساس. */
export function CurrencyNote({
  currency,
  exchangeRate,
  baseCurrency,
}: {
  currency: DocumentCurrency;
  exchangeRate: unknown;
  baseCurrency: CurrencyInfo;
}) {
  const documentCurrency = currency ?? baseCurrency;
  const rate = toNumber(exchangeRate) || 1;

  return (
    <span>
      {documentCurrency.code}
      {isForeign(currency, baseCurrency) ? (
        <span className="block text-xs text-muted-foreground">
          {"‎"}1 {documentCurrency.code} = {rate} {baseCurrency.code}
        </span>
      ) : null}
    </span>
  );
}
