// وحدة خاصة بالخادم فقط (تستخدم Prisma) — لا تستوردها داخل مكوّنات العميل.
import type { AccountType } from "@/generated/prisma";
import { JournalEntryStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { ACCOUNT_CODES } from "@/lib/modules/accounting-posting";
import { toNumber } from "@/lib/utils";
import { signedBalance } from "@/app/dashboard/accounts/account-labels";
import {
  getAccountMovements,
  type DateRange,
  type MovementFilter,
} from "@/app/dashboard/accounts/account-tree";
import { NO_BRANCH_LABEL, type BranchOption } from "./branch-scope";

export type AccountTotals = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  /** الرصيد حسب طبيعة الحساب (مدين - دائن للأصول والمصروفات، والعكس لغيرها). */
  balance: number;
};

/**
 * أرصدة كل الحسابات من سطور القيود المرحّلة فقط خلال الفترة المطلوبة.
 * القيود المولّدة تلقائياً من الوحدات الأخرى مشمولة لأنها تُرحّل بنفس الخدمة.
 * كل المبالغ بعملة الأساس لأن القيود تُرحّل دائماً بعملة الدفاتر.
 */
export async function getAccountTotals(
  filter?: MovementFilter,
): Promise<AccountTotals[]> {
  const [accounts, movements] = await Promise.all([
    prisma.chartOfAccount.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    getAccountMovements(filter),
  ]);

  return accounts.map((account) => {
    const movement = movements.get(account.id) ?? { debit: 0, credit: 0 };
    return {
      ...account,
      debit: movement.debit,
      credit: movement.credit,
      balance: signedBalance(account.type, movement.debit, movement.credit),
    };
  });
}

export function sumBalances(rows: AccountTotals[], type: AccountType): number {
  return rows
    .filter((row) => row.type === type)
    .reduce((sum, row) => sum + row.balance, 0);
}

export function withMovements(rows: AccountTotals[]): AccountTotals[] {
  return rows.filter((row) => row.debit !== 0 || row.credit !== 0);
}

export function findBalanceByCode(
  rows: AccountTotals[],
  code: string,
): number | null {
  const row = rows.find((item) => item.code === code);
  return row ? row.balance : null;
}

/** صافي فروقات العملة = رصيد 4200 (أرباح) ناقص رصيد 5400 (خسائر). */
export function fxResult(rows: AccountTotals[]): {
  gain: number;
  loss: number;
  net: number;
} {
  const gain = findBalanceByCode(rows, ACCOUNT_CODES.FX_GAIN) ?? 0;
  const loss = findBalanceByCode(rows, ACCOUNT_CODES.FX_LOSS) ?? 0;
  return { gain, loss, net: gain - loss };
}

/** نتيجة أعمال فرع واحد خلال الفترة — كلها بعملة الأساس. */
export type BranchResult = {
  branchId: string | null;
  code: string | null;
  name: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  fxGain: number;
  fxLoss: number;
  fxNet: number;
};

const INCOME_TYPES: AccountType[] = ["REVENUE", "EXPENSE"];

function emptyResult(
  branchId: string | null,
  code: string | null,
  name: string,
): BranchResult {
  return {
    branchId,
    code,
    name,
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    fxGain: 0,
    fxLoss: 0,
    fxNet: 0,
  };
}

/**
 * مقارنة نتائج الفروع خلال الفترة: الإيرادات والمصروفات وصافي الربح لكل فرع،
 * مع إبراز نصيب كل فرع من فروقات العملة (4200 و 5400).
 * تُحتسب من سطور القيود المرحّلة فقط، ويُضاف صف للقيود غير المرتبطة بفرع.
 */
export async function getBranchResults(
  range: DateRange,
  branches: BranchOption[],
): Promise<BranchResult[]> {
  const hasRange = Boolean(range.from || range.to);

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      account: { type: { in: INCOME_TYPES } },
      journalEntry: {
        status: JournalEntryStatus.POSTED,
        entryDate: hasRange ? { gte: range.from, lte: range.to } : undefined,
      },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { type: true, code: true } },
      journalEntry: { select: { branchId: true } },
    },
  });

  // نبدأ بكل الفروع النشطة حتى تظهر الفروع بلا حركة بأصفار في المقارنة.
  const results = new Map<string, BranchResult>(
    branches.map((branch) => [
      branch.id,
      emptyResult(branch.id, branch.code, branch.name),
    ]),
  );
  const UNASSIGNED = "";

  for (const line of lines) {
    const branchId = line.journalEntry.branchId;
    const key = branchId ?? UNASSIGNED;
    let row = results.get(key);
    if (!row) {
      row = emptyResult(branchId ?? null, null, NO_BRANCH_LABEL);
      results.set(key, row);
    }

    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);

    if (line.account.type === "REVENUE") {
      row.revenue += credit - debit;
    } else {
      row.expenses += debit - credit;
    }

    if (line.account.code === ACCOUNT_CODES.FX_GAIN) {
      row.fxGain += credit - debit;
    } else if (line.account.code === ACCOUNT_CODES.FX_LOSS) {
      row.fxLoss += debit - credit;
    }
  }

  for (const row of results.values()) {
    row.netProfit = row.revenue - row.expenses;
    row.fxNet = row.fxGain - row.fxLoss;
  }

  // قد تحمل بعض القيود فرعاً موقوفاً ليس ضمن خيارات الفلتر — نجلب اسمه ليظهر بوضوح.
  const unnamed = [...results.values()].filter(
    (row) => row.branchId !== null && row.code === null,
  );
  if (unnamed.length > 0) {
    const extra = await prisma.branch.findMany({
      where: { id: { in: unnamed.map((row) => row.branchId as string) } },
      select: { id: true, code: true, name: true },
    });
    for (const branch of extra) {
      const row = results.get(branch.id);
      if (!row) continue;
      row.code = branch.code;
      row.name = `${branch.name} (موقوف)`;
    }
  }

  const ordered = branches
    .map((branch) => results.get(branch.id))
    .filter((row): row is BranchResult => Boolean(row));

  // صفوف القيود غير المرتبطة بفرع، والفروع غير النشطة، تُعرض بعد الفروع النشطة.
  const known = new Set(branches.map((branch) => branch.id));
  for (const [key, row] of results) {
    if (key === UNASSIGNED || !known.has(key)) ordered.push(row);
  }

  return ordered;
}

export function sumBranchResults(rows: BranchResult[]): BranchResult {
  return rows.reduce((total, row) => {
    total.revenue += row.revenue;
    total.expenses += row.expenses;
    total.netProfit += row.netProfit;
    total.fxGain += row.fxGain;
    total.fxLoss += row.fxLoss;
    total.fxNet += row.fxNet;
    return total;
  }, emptyResult(null, null, "الإجمالي"));
}
