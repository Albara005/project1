import { Prisma, Role } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

/**
 * حصر الفروع لوحدة الموارد البشرية.
 *
 * القاعدة المشتركة بين صفحات الموظفين والإجازات والرواتب:
 * - المدير العام (ADMIN) يرى كل الفروع ويختار أي فرع.
 * - المستخدم بلا فرع (branchId = null) يرى كل الفروع أيضاً (غير مقيّد).
 * - غير ذلك: يرى فرعه فقط ولا يستطيع الكتابة خارج فرعه.
 *
 * ملف خادم فقط — لا تستورده داخل ملف "use client".
 */

export type BranchOption = { id: string; code: string; name: string };

export type BranchScope = {
  /** فرع المستخدم الحالي كما هو في جدول المستخدمين (غير موجود على الجلسة). */
  userBranchId: string | null;
  /** هل يرى المستخدم كل الفروع ويستطيع اختيار أيّها؟ */
  canChooseBranch: boolean;
  /** الفرع الذي تُحصر به القوائم، أو null إذا كان غير مقيّد. */
  restrictToBranchId: string | null;
  /** الفروع النشطة لعرضها في القوائم المنسدلة. */
  branches: BranchOption[];
};

/** يقرأ فرع المستخدم من قاعدة البيانات ويحمّل الفروع النشطة. */
export async function getBranchScope(user: CurrentUser): Promise<BranchScope> {
  const [record, branches] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { branchId: true } }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const userBranchId = record?.branchId ?? null;
  const canChooseBranch = user.role === Role.ADMIN || userBranchId === null;

  return {
    userBranchId,
    canChooseBranch,
    restrictToBranchId: canChooseBranch ? null : userBranchId,
    branches,
  };
}

/**
 * يحوّل قيمة فلتر الفرع القادمة من searchParams إلى الفرع الفعلي المطلوب تصفيته.
 * المستخدم المقيّد يُجبَر دائماً على فرعه مهما كان الرابط.
 */
export function resolveBranchFilter(
  scope: BranchScope,
  requested: string | undefined,
): string | null {
  if (scope.restrictToBranchId) return scope.restrictToBranchId;

  const value = (requested ?? "").trim();
  if (!value) return null;
  return scope.branches.some((branch) => branch.id === value) ? value : null;
}

/**
 * يحدد الفرع الذي يُحفظ على السجل: المقيّد يُجبَر على فرعه،
 * وغير المقيّد يأخذ ما اختاره، ويُستخدم فرع المستخدم كقيمة افتراضية عند الإنشاء.
 */
export function resolveBranchForWrite(
  scope: BranchScope,
  requested: string | null,
  { isCreate }: { isCreate: boolean },
): string | null {
  if (scope.restrictToBranchId) return scope.restrictToBranchId;
  if (requested) return requested;
  return isCreate ? scope.userBranchId : null;
}

/** يتحقق أن الفرع المطلوب موجود ونشط. يعيد رسالة عربية عند الفشل. */
export function validateBranchId(
  scope: BranchScope,
  branchId: string | null,
): string | null {
  if (!branchId) return null;
  return scope.branches.some((branch) => branch.id === branchId)
    ? null
    : "الفرع المحدد غير موجود أو غير نشط";
}

/** جزء شرط Prisma لحصر الموظفين بفرع (أو بلا حصر). */
export function employeeBranchWhere(
  branchId: string | null,
): Prisma.EmployeeWhereInput {
  return branchId ? { branchId } : {};
}

/** اسم الفرع للعرض، أو شرطة عند عدم وجوده. */
export function branchName(
  branches: BranchOption[],
  branchId: string | null | undefined,
): string {
  if (!branchId) return "—";
  return branches.find((branch) => branch.id === branchId)?.name ?? "—";
}

/** تسمية مجموعة "بدون فرع" في التجميعات. */
export const NO_BRANCH_LABEL = "بدون فرع";
