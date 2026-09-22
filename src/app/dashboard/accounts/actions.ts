"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { collectDescendantIds } from "./account-tree";

export type ActionState = { error?: string; success?: boolean };

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;

const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "رمز الحساب مطلوب")
    .max(20, "رمز الحساب يجب ألا يتجاوز 20 خانة"),
  name: z.string().trim().min(1, "اسم الحساب مطلوب"),
  type: z.enum(ACCOUNT_TYPES, { message: "نوع الحساب غير صحيح" }),
  parentId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  isActive: z.string().optional(),
});

async function resolveParent(
  parentId: string | undefined,
  selfId?: string,
): Promise<{ value: string | null; error?: string }> {
  if (!parentId) return { value: null };

  const parent = await prisma.chartOfAccount.findUnique({
    where: { id: parentId },
    select: { id: true },
  });
  if (!parent) return { value: null, error: "الحساب الأب غير موجود" };

  if (selfId) {
    const accounts = await prisma.chartOfAccount.findMany({
      select: { id: true, parentId: true },
    });
    const forbidden = collectDescendantIds(accounts, selfId);
    if (forbidden.has(parentId)) {
      return {
        value: null,
        error: "لا يمكن اختيار الحساب نفسه أو أحد حساباته الفرعية كحساب أب",
      };
    }
  }

  return { value: parent.id };
}

export async function createAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("accounting");

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const parent = await resolveParent(parsed.data.parentId);
  if (parent.error) return { error: parent.error };

  try {
    await prisma.chartOfAccount.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        parentId: parent.value,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive !== "false",
      },
    });
  } catch {
    return { error: "تعذر حفظ الحساب، تأكد من أن رمز الحساب غير مكرر" };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function updateAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("accounting");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "الحساب غير محدد" };

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const parent = await resolveParent(parsed.data.parentId, id);
  if (parent.error) return { error: parent.error };

  try {
    await prisma.chartOfAccount.update({
      where: { id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        parentId: parent.value,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive !== "false",
      },
    });
  } catch {
    return { error: "تعذر تحديث الحساب، تأكد من أن رمز الحساب غير مكرر" };
  }

  revalidatePath("/dashboard/accounts");
  redirect("/dashboard/accounts");
}

/** حذف حساب: ممنوع إذا كانت عليه سطور قيود أو حسابات فرعية. */
export async function deleteAccount(formData: FormData): Promise<void> {
  await requireUserAction("accounting");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/dashboard/accounts?error=" + encodeURIComponent("الحساب غير محدد"));

  const [linesCount, childrenCount] = await Promise.all([
    prisma.journalEntryLine.count({ where: { accountId: id } }),
    prisma.chartOfAccount.count({ where: { parentId: id } }),
  ]);

  if (linesCount > 0) {
    redirect(
      "/dashboard/accounts?error=" +
        encodeURIComponent(
          `لا يمكن حذف الحساب لأنه مستخدم في ${linesCount} سطر من سطور القيود`,
        ),
    );
  }

  if (childrenCount > 0) {
    redirect(
      "/dashboard/accounts?error=" +
        encodeURIComponent(
          "لا يمكن حذف الحساب لأنه يحتوي على حسابات فرعية، احذفها أو انقلها أولاً",
        ),
    );
  }

  try {
    await prisma.chartOfAccount.delete({ where: { id } });
  } catch {
    redirect(
      "/dashboard/accounts?error=" + encodeURIComponent("تعذر حذف الحساب"),
    );
  }

  revalidatePath("/dashboard/accounts");
  redirect("/dashboard/accounts");
}
