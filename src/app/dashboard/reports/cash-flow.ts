// وحدة خاصة بالخادم فقط (تستخدم Prisma) — لا تستوردها داخل مكوّنات العميل.
import { CashFlowCategory, JournalEntryStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import type { MovementFilter } from "@/app/dashboard/accounts/account-tree";

/**
 * قائمة التدفقات النقدية.
 *
 * الطريقة المباشرة: تُقرأ حركات حسابات النقدية فعلياً من القيود المرحّلة،
 * ويُصنَّف كل تدفق حسب تصنيف الحساب المقابل له في نفس القيد
 * (تشغيلي/استثماري/تمويلي) المعرَّف على الحساب في دليل الحسابات.
 *
 * الطريقة غير المباشرة: تبدأ من صافي الربح وتُعدّله بالتغيّر في رأس المال
 * العامل للوصول إلى النقد التشغيلي.
 *
 * كل المبالغ بعملة الأساس لأن القيود تُرحَّل دائماً بعملة الدفاتر.
 */

export type CashFlowLine = {
  accountId: string;
  code: string;
  name: string;
  /** موجب = تدفق داخل، سالب = تدفق خارج. */
  amount: number;
};

export type CashFlowSection = {
  category: CashFlowCategory;
  lines: CashFlowLine[];
  total: number;
};

export type DirectCashFlow = {
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  /** مجموع الأقسام الثلاثة. */
  netChange: number;
  /** التغيّر الفعلي في أرصدة حسابات النقدية خلال الفترة. */
  actualCashChange: number;
  openingCash: number;
  closingCash: number;
  /** فرق التصنيف؛ يجب أن يكون صفراً وإلا فهناك خلل. */
  unreconciled: number;
};

export type IndirectCashFlow = {
  netProfit: number;
  adjustments: Array<{ label: string; amount: number }>;
  operatingTotal: number;
};

const CASH_FLOW_LABELS: Record<CashFlowCategory, string> = {
  OPERATING: "الأنشطة التشغيلية",
  INVESTING: "الأنشطة الاستثمارية",
  FINANCING: "الأنشطة التمويلية",
  CASH: "النقدية",
};

export function cashFlowLabel(category: CashFlowCategory): string {
  return CASH_FLOW_LABELS[category];
}

type AccountMeta = {
  id: string;
  code: string;
  name: string;
  cashFlowCategory: CashFlowCategory | null;
};

async function loadAccounts(): Promise<Map<string, AccountMeta>> {
  const accounts = await prisma.chartOfAccount.findMany({
    select: { id: true, code: true, name: true, cashFlowCategory: true },
  });
  return new Map(accounts.map((account) => [account.id, account]));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** الحساب بلا تصنيف يُعامل كنشاط تشغيلي، وهو التصنيف الافتراضي للأنشطة الجارية. */
function categoryOf(account: AccountMeta | undefined): CashFlowCategory {
  return account?.cashFlowCategory ?? CashFlowCategory.OPERATING;
}

function isCash(account: AccountMeta | undefined): boolean {
  return account?.cashFlowCategory === CashFlowCategory.CASH;
}

/** رصيد حسابات النقدية حتى تاريخ معيّن (مدين - دائن). */
async function cashBalanceAsOf(
  cashAccountIds: string[],
  before?: Date,
  branchId?: string,
): Promise<number> {
  if (cashAccountIds.length === 0) return 0;

  const result = await prisma.journalEntryLine.aggregate({
    where: {
      accountId: { in: cashAccountIds },
      journalEntry: {
        status: JournalEntryStatus.POSTED,
        branchId,
        entryDate: before ? { lt: before } : undefined,
      },
    },
    _sum: { debit: true, credit: true },
  });

  return round2(toNumber(result._sum.debit) - toNumber(result._sum.credit));
}

/**
 * الطريقة المباشرة: لكل قيد يمسّ النقدية، يُوزَّع صافي الحركة النقدية على
 * الأطراف غير النقدية في القيد بنسبة مبالغها، ويُجمع حسب تصنيف كل طرف.
 * التوزيع النسبي ضروري للقيود متعددة السطور مثل قيد فاتورة فيها ضريبة.
 */
export async function getDirectCashFlow(
  filter?: MovementFilter,
): Promise<DirectCashFlow> {
  const accounts = await loadAccounts();
  const cashAccountIds = [...accounts.values()]
    .filter((account) => account.cashFlowCategory === CashFlowCategory.CASH)
    .map((account) => account.id);

  const hasRange = Boolean(filter?.from || filter?.to);

  const entries = await prisma.journalEntry.findMany({
    where: {
      status: JournalEntryStatus.POSTED,
      branchId: filter?.branchId,
      entryDate: hasRange ? { gte: filter?.from, lte: filter?.to } : undefined,
      lines: { some: { accountId: { in: cashAccountIds } } },
    },
    select: {
      id: true,
      lines: { select: { accountId: true, debit: true, credit: true } },
    },
  });

  const buckets = new Map<CashFlowCategory, Map<string, number>>([
    [CashFlowCategory.OPERATING, new Map()],
    [CashFlowCategory.INVESTING, new Map()],
    [CashFlowCategory.FINANCING, new Map()],
  ]);

  let actualCashChange = 0;

  for (const entry of entries) {
    const cashLines = entry.lines.filter((line) => isCash(accounts.get(line.accountId)));
    const otherLines = entry.lines.filter((line) => !isCash(accounts.get(line.accountId)));

    // موجب = دخل نقد، سالب = خرج نقد
    const netCash = cashLines.reduce(
      (sum, line) => sum + toNumber(line.debit) - toNumber(line.credit),
      0,
    );
    if (netCash === 0) continue;
    actualCashChange += netCash;

    const weights = otherLines.map((line) =>
      Math.abs(toNumber(line.debit) - toNumber(line.credit)),
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    if (totalWeight === 0) {
      // قيد نقدي بحت (تحويل بين حسابات نقدية) لا يُصنَّف في أي نشاط
      continue;
    }

    otherLines.forEach((line, index) => {
      const account = accounts.get(line.accountId);
      const category = categoryOf(account);
      const share = netCash * (weights[index] / totalWeight);
      const bucket = buckets.get(category);
      if (!bucket) return;
      bucket.set(line.accountId, (bucket.get(line.accountId) ?? 0) + share);
    });
  }

  function toSection(category: CashFlowCategory): CashFlowSection {
    const bucket = buckets.get(category) ?? new Map<string, number>();
    const lines: CashFlowLine[] = [...bucket.entries()]
      .map(([accountId, amount]) => {
        const account = accounts.get(accountId);
        return {
          accountId,
          code: account?.code ?? "",
          name: account?.name ?? "",
          amount: round2(amount),
        };
      })
      .filter((line) => Math.abs(line.amount) >= 0.01)
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      category,
      lines,
      total: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
    };
  }

  const operating = toSection(CashFlowCategory.OPERATING);
  const investing = toSection(CashFlowCategory.INVESTING);
  const financing = toSection(CashFlowCategory.FINANCING);

  const netChange = round2(operating.total + investing.total + financing.total);
  const roundedActual = round2(actualCashChange);

  const openingCash = await cashBalanceAsOf(
    cashAccountIds,
    filter?.from,
    filter?.branchId,
  );

  return {
    operating,
    investing,
    financing,
    netChange,
    actualCashChange: roundedActual,
    openingCash,
    closingCash: round2(openingCash + roundedActual),
    unreconciled: round2(roundedActual - netChange),
  };
}

/**
 * الطريقة غير المباشرة: صافي الربح معدّلاً بالتغيّر في رأس المال العامل.
 * زيادة أصل تشغيلي (ذمم مدينة، مخزون) تستهلك نقداً فتُطرح، وزيادة خصم
 * تشغيلي (ذمم دائنة، ضريبة مستحقة) توفّر نقداً فتُضاف.
 */
export async function getIndirectCashFlow(
  filter?: MovementFilter,
): Promise<IndirectCashFlow> {
  const accounts = await loadAccounts();
  const hasRange = Boolean(filter?.from || filter?.to);

  const grouped = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        status: JournalEntryStatus.POSTED,
        branchId: filter?.branchId,
        entryDate: hasRange ? { gte: filter?.from, lte: filter?.to } : undefined,
      },
    },
    _sum: { debit: true, credit: true },
  });

  const full = await prisma.chartOfAccount.findMany({
    select: { id: true, type: true, code: true, name: true, cashFlowCategory: true },
  });
  const typeById = new Map(full.map((account) => [account.id, account]));

  let revenue = 0;
  let expense = 0;
  const workingCapital: Array<{ label: string; amount: number }> = [];

  for (const row of grouped) {
    const account = typeById.get(row.accountId);
    if (!account) continue;

    const debit = toNumber(row._sum.debit);
    const credit = toNumber(row._sum.credit);
    const meta = accounts.get(row.accountId);

    if (account.type === "REVENUE") {
      revenue += credit - debit;
      continue;
    }
    if (account.type === "EXPENSE") {
      expense += debit - credit;
      continue;
    }

    // أصول وخصوم تشغيلية فقط تدخل في رأس المال العامل؛ النقدية نفسها مستبعدة
    if (isCash(meta)) continue;
    if (categoryOf(meta) !== CashFlowCategory.OPERATING) continue;

    if (account.type === "ASSET") {
      const increase = debit - credit;
      if (Math.abs(increase) >= 0.01) {
        workingCapital.push({
          label: `التغيّر في ${account.name}`,
          amount: round2(-increase),
        });
      }
    } else if (account.type === "LIABILITY") {
      const increase = credit - debit;
      if (Math.abs(increase) >= 0.01) {
        workingCapital.push({
          label: `التغيّر في ${account.name}`,
          amount: round2(increase),
        });
      }
    }
  }

  const netProfit = round2(revenue - expense);
  const operatingTotal = round2(
    netProfit + workingCapital.reduce((sum, item) => sum + item.amount, 0),
  );

  return { netProfit, adjustments: workingCapital, operatingTotal };
}
