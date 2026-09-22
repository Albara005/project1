// وحدة خاصة بالخادم فقط (تستخدم Prisma) — لا تستوردها داخل مكوّنات العميل.
import type { AccountType } from "@/generated/prisma";
import { JournalEntryStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { signedBalance } from "./account-labels";

export type AccountMovement = { debit: number; credit: number };

export type DateRange = { from?: Date; to?: Date };

/**
 * مجاميع المدين والدائن لكل حساب من سطور القيود **المرحّلة فقط**.
 * تشمل القيود اليدوية والقيود المولّدة تلقائياً من المبيعات والمشتريات والرواتب.
 */
export async function getAccountMovements(
  range?: DateRange,
): Promise<Map<string, AccountMovement>> {
  const hasRange = Boolean(range?.from || range?.to);
  const grouped = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        status: JournalEntryStatus.POSTED,
        entryDate: hasRange ? { gte: range?.from, lte: range?.to } : undefined,
      },
    },
    _sum: { debit: true, credit: true },
  });

  return new Map(
    grouped.map((row) => [
      row.accountId,
      { debit: toNumber(row._sum.debit), credit: toNumber(row._sum.credit) },
    ]),
  );
}

export type AccountInput = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isActive: boolean;
};

export type AccountNode = AccountInput & {
  debit: number;
  credit: number;
  /** رصيد الحساب نفسه دون الحسابات الفرعية. */
  ownBalance: number;
  /** رصيد الحساب شاملاً أرصدة الحسابات الفرعية. */
  totalBalance: number;
  hasMovements: boolean;
  children: AccountNode[];
};

function compareByCode(a: AccountNode, b: AccountNode) {
  return a.code.localeCompare(b.code, "en");
}

/** يبني شجرة الحسابات (أب ← أبناء) ويحسب الأرصدة المجمّعة. */
export function buildAccountTree(
  accounts: AccountInput[],
  movements: Map<string, AccountMovement>,
): AccountNode[] {
  const nodes = new Map<string, AccountNode>();

  for (const account of accounts) {
    const movement = movements.get(account.id) ?? { debit: 0, credit: 0 };
    nodes.set(account.id, {
      ...account,
      debit: movement.debit,
      credit: movement.credit,
      ownBalance: signedBalance(account.type, movement.debit, movement.credit),
      totalBalance: 0,
      hasMovements: movement.debit !== 0 || movement.credit !== 0,
      children: [],
    });
  }

  const roots: AccountNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // حماية من أي دورة في البيانات: نزور كل حساب مرة واحدة فقط.
  const visited = new Set<string>();
  function rollUp(node: AccountNode): number {
    if (visited.has(node.id)) return 0;
    visited.add(node.id);
    node.children.sort(compareByCode);
    node.totalBalance =
      node.ownBalance +
      node.children.reduce((sum, child) => sum + rollUp(child), 0);
    return node.totalBalance;
  }

  roots.sort(compareByCode);
  for (const root of roots) rollUp(root);

  return roots;
}

export type FlatAccountRow = { node: AccountNode; depth: number };

/** يحوّل الشجرة إلى صفوف مسطّحة مع عمق كل صف لعرضها في جدول. */
export function flattenAccountTree(
  nodes: AccountNode[],
  depth = 0,
): FlatAccountRow[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenAccountTree(node.children, depth + 1),
  ]);
}

/** معرّفات الحساب وكل أبنائه (لمنع اختيار أب يسبّب دورة عند التعديل). */
export function collectDescendantIds(
  accounts: Array<{ id: string; parentId: string | null }>,
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const account of accounts) {
    if (!account.parentId) continue;
    const siblings = childrenByParent.get(account.parentId) ?? [];
    siblings.push(account.id);
    childrenByParent.set(account.parentId, siblings);
  }

  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (result.has(child)) continue;
      result.add(child);
      queue.push(child);
    }
  }
  return result;
}
