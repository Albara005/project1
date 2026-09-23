import { Role } from "@/generated/prisma";
import { prisma } from "@/lib/db";

/**
 * أدوات مشتركة لحصر مستندات المبيعات على فرع المستخدم.
 * وحدة خاصة بالخادم فقط — لا تُستورد داخل مكوّنات العميل.
 */

export type BranchOption = { id: string; code: string; name: string };

export type BranchScope = {
  /** فرع المستخدم الحالي، أو null إن لم يُربط بفرع. */
  branchId: string | null;
  /** true حين يجب حصر القوائم والمستندات على فرع المستخدم. */
  restricted: boolean;
};

/**
 * نطاق الفرع للمستخدم: مدير النظام ومن لا فرع له يريان كل الفروع،
 * ومن عداهما يرى مستندات فرعه فقط. الفرع ليس في الجلسة فيُقرأ من قاعدة البيانات.
 */
export async function getBranchScope(user: {
  id: string;
  role: Role;
}): Promise<BranchScope> {
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { branchId: true },
  });

  const branchId = record?.branchId ?? null;
  return { branchId, restricted: user.role !== Role.ADMIN && branchId !== null };
}

/** جزء شرط الاستعلام الذي يحصر النتائج على فرع المستخدم عند اللزوم. */
export function branchFilter(scope: BranchScope): { branchId?: string } {
  return scope.restricted && scope.branchId ? { branchId: scope.branchId } : {};
}

/** الفروع المتاحة للاختيار: كلها لمدير النظام، وفرع المستخدم فقط لغيره. */
export async function listBranchOptions(scope: BranchScope): Promise<BranchOption[]> {
  return prisma.branch.findMany({
    where: {
      isActive: true,
      ...(scope.restricted && scope.branchId ? { id: scope.branchId } : {}),
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/**
 * الفرع الذي يُحفظ على المستند: المستخدم المحصور لا يستطيع الكتابة خارج فرعه،
 * ومن عداه يأخذ ما اختاره وإلا فرعه الافتراضي.
 */
export function resolveBranchId(
  scope: BranchScope,
  requested: string | null | undefined,
): string | null {
  if (scope.restricted) return scope.branchId;
  return requested && requested.length > 0 ? requested : scope.branchId;
}
