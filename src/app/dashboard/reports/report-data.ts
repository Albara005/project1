// وحدة خاصة بالخادم فقط (تستخدم Prisma) — لا تستوردها داخل مكوّنات العميل.
import type { AccountType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { signedBalance } from "@/app/dashboard/accounts/account-labels";
import {
  getAccountMovements,
  type DateRange,
} from "@/app/dashboard/accounts/account-tree";

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
 */
export async function getAccountTotals(
  range?: DateRange,
): Promise<AccountTotals[]> {
  const [accounts, movements] = await Promise.all([
    prisma.chartOfAccount.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    getAccountMovements(range),
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
