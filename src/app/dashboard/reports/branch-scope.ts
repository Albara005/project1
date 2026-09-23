// وحدة خاصة بالخادم فقط (تستخدم Prisma) — لا تستوردها داخل مكوّنات العميل.
import type { Role } from "@/generated/prisma";
import { prisma } from "@/lib/db";

/** خيار فرع بقيم نصية بسيطة صالحة للتمرير إلى مكوّنات العميل. */
export type BranchOption = { id: string; code: string; name: string };

export const ALL_BRANCHES_LABEL = "كل الفروع";
export const NO_BRANCH_LABEL = "بدون فرع";

/** الفروع النشطة مرتّبة بالرمز — تُستخدم في فلاتر القوائم والتقارير. */
export async function listBranchOptions(): Promise<BranchOption[]> {
  return prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/** يتجاهل أي قيمة فلتر قادمة من الرابط لا تطابق فرعاً حقيقياً. */
export function resolveBranchParam(
  value: string | undefined,
  branches: BranchOption[],
): string | undefined {
  if (!value) return undefined;
  return branches.some((branch) => branch.id === value) ? value : undefined;
}

export function branchLabel(
  branches: BranchOption[],
  branchId: string | null | undefined,
): string {
  if (!branchId) return NO_BRANCH_LABEL;
  return branches.find((branch) => branch.id === branchId)?.name ?? NO_BRANCH_LABEL;
}

/**
 * نطاق الفرع الخاص بالمستخدم:
 * ADMIN — ومن لا فرع له — يرى كل الفروع، وغيرهم يُحصر في فرعه.
 * `branchId` هو الفرع الذي يجب تصفية البيانات به (null = بلا تصفية).
 */
export type BranchScope = {
  branchId: string | null;
  branchName: string | null;
  /** فرع المستخدم نفسه حتى لو كان يرى كل الفروع. */
  homeBranchId: string | null;
  canSeeAllBranches: boolean;
};

export async function getUserBranchScope(user: {
  id: string;
  role: Role;
}): Promise<BranchScope> {
  // الفرع ليس ضمن بيانات الجلسة، لذلك نقرأه من جدول المستخدمين.
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { branchId: true, branch: { select: { name: true } } },
  });

  const homeBranchId = record?.branchId ?? null;
  const canSeeAllBranches = user.role === "ADMIN" || homeBranchId === null;

  return {
    branchId: canSeeAllBranches ? null : homeBranchId,
    branchName: canSeeAllBranches ? null : (record?.branch?.name ?? null),
    homeBranchId,
    canSeeAllBranches,
  };
}
