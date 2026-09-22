"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const branchSchema = z.object({
  code: z.string().trim().min(2, "رمز الفرع مطلوب"),
  name: z.string().trim().min(2, "اسم الفرع مطلوب"),
  address: optionalText,
  phone: optionalText,
});

export async function createBranch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.branch.create({ data: parsed.data });
  } catch {
    return { error: "رمز الفرع مستخدم مسبقاً" };
  }

  revalidatePath("/dashboard/branches");
  return { success: true };
}

export async function updateBranch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "الفرع غير محدد" };

  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.branch.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "تعذر حفظ الفرع، تحقق من عدم تكرار الرمز" };
  }

  revalidatePath("/dashboard/branches");
  return { success: true };
}

export async function toggleBranchActive(
  branchId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireUserAction("settings");

  // تعطيل الفرع لا يحذف مستنداته؛ يمنع فقط اختياره في المستندات الجديدة
  await prisma.branch.update({ where: { id: branchId }, data: { isActive } });
  revalidatePath("/dashboard/branches");
  return { success: true };
}

/** يعيّن الفرع الافتراضي لمستخدم؛ يحدد ما يراه من مستندات. */
export async function assignUserBranch(
  userId: string,
  branchId: string | null,
): Promise<ActionState> {
  await requireUserAction("settings");

  await prisma.user.update({ where: { id: userId }, data: { branchId } });
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/users");
  return { success: true };
}
