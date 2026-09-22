"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

const categorySchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "اسم الفئة مطلوب"),
  description: z.string().trim().optional(),
});

export type ActionState = { error?: string; success?: boolean };

/** ينشئ فئة جديدة أو يحدّث فئة قائمة حسب وجود المعرّف. */
export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("inventory");

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, name, description } = parsed.data;
  const data = { name, description: description || null };

  try {
    if (id) {
      await prisma.productCategory.update({ where: { id }, data });
    } else {
      await prisma.productCategory.create({ data });
    }
  } catch {
    return { error: "تعذر الحفظ، تأكد من عدم تكرار اسم الفئة" };
  }

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
  return { success: true };
}

/** يحذف فئة؛ منتجاتها تبقى بدون فئة. */
export async function deleteCategory(formData: FormData): Promise<void> {
  await requireUserAction("inventory");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await prisma.productCategory.delete({ where: { id } });
  } catch {
    // تُتجاهل أخطاء الحذف (فئة غير موجودة مثلاً) ويُعاد عرض القائمة كما هي
  }

  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
}
