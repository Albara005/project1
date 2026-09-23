import type { Role } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export type BranchOption = { id: string; code: string; name: string };

export type BranchScope = {
  /** فرع المستخدم الحالي، ويُقرأ من قاعدة البيانات لأنه غير موجود على الجلسة. */
  userBranchId: string | null;
  /** إن لم يكن فارغاً فالمستخدم مقيّد برؤية مستندات هذا الفرع فقط. */
  restrictToBranchId: string | null;
  /** المدير أو مستخدم بلا فرع: يرى كل الفروع ويختار بينها. */
  canSeeAllBranches: boolean;
};

/**
 * يحدد نطاق الفرع للمستخدم الحالي: المدير (ADMIN) ومن ليس له فرع يريان كل الفروع،
 * ومن له فرع ودوره ليس ADMIN يُقيَّد بفرعه في القوائم وفي المستندات التي ينشئها.
 */
export async function getBranchScope(user: {
  id: string;
  role: Role;
}): Promise<BranchScope> {
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { branchId: true },
  });

  const userBranchId = record?.branchId ?? null;
  const canSeeAllBranches = user.role === "ADMIN" || userBranchId === null;

  return {
    userBranchId,
    restrictToBranchId: canSeeAllBranches ? null : userBranchId,
    canSeeAllBranches,
  };
}

/** الفروع المتاحة للاختيار أو الفلترة حسب نطاق المستخدم. */
export async function listBranchOptions(
  scope: BranchScope,
): Promise<BranchOption[]> {
  return prisma.branch.findMany({
    where: scope.restrictToBranchId
      ? { id: scope.restrictToBranchId }
      : { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

/**
 * يحوّل قيمة فلتر الفرع القادمة من الرابط إلى فرع فعلي مسموح به.
 * المستخدم المقيّد يُفرض عليه فرعه مهما كانت قيمة الرابط.
 */
export function resolveBranchFilter(
  scope: BranchScope,
  requested?: string | null,
): string | null {
  if (scope.restrictToBranchId) return scope.restrictToBranchId;
  const value = requested?.trim();
  return value ? value : null;
}

/**
 * يحدد فرع مستند جديد: المستخدم المقيّد يُنسب مستنده لفرعه دائماً،
 * وغيره يختار الفرع ويكون فرع المستخدم هو الافتراضي.
 */
export function resolveDocumentBranchId(
  scope: BranchScope,
  submitted?: string | null,
): string | null {
  if (scope.restrictToBranchId) return scope.restrictToBranchId;
  const value = submitted?.trim();
  return value ? value : scope.userBranchId;
}
