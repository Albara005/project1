"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

const productSchema = z.object({
  id: z.string().trim().optional(),
  sku: z.string().trim().min(1, "رمز المنتج (SKU) مطلوب"),
  name: z.string().trim().min(1, "اسم المنتج مطلوب"),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1, "وحدة القياس مطلوبة"),
  categoryId: z.string().trim().optional(),
  costPrice: z.coerce
    .number({ error: "سعر التكلفة غير صحيح" })
    .min(0, "سعر التكلفة لا يمكن أن يكون سالباً"),
  salePrice: z.coerce
    .number({ error: "سعر البيع غير صحيح" })
    .min(0, "سعر البيع لا يمكن أن يكون سالباً"),
  taxRate: z.coerce
    .number({ error: "نسبة الضريبة غير صحيحة" })
    .min(0, "نسبة الضريبة لا يمكن أن تكون سالبة")
    .max(100, "نسبة الضريبة لا تتجاوز 100"),
  reorderLevel: z.coerce
    .number({ error: "حد إعادة الطلب غير صحيح" })
    .int("حد إعادة الطلب يجب أن يكون عدداً صحيحاً")
    .min(0, "حد إعادة الطلب لا يمكن أن يكون سالباً"),
});

export type ActionState = { error?: string; success?: boolean };

/** ينشئ منتجاً جديداً أو يحدّث منتجاً قائماً حسب وجود المعرّف. */
export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("inventory");

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, description, categoryId, ...rest } = parsed.data;
  const data = {
    ...rest,
    description: description || null,
    categoryId: categoryId || null,
  };

  try {
    if (id) {
      await prisma.product.update({ where: { id }, data });
    } else {
      await prisma.product.create({ data });
    }
  } catch {
    return { error: "تعذر الحفظ، تأكد من عدم تكرار رمز المنتج (SKU)" };
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/stock");
  return { success: true };
}

/** يفعّل أو يوقف منتجاً (لا نحذف لارتباطه بالحركات والمستندات). */
export async function toggleProductActive(formData: FormData): Promise<void> {
  await requireUserAction("inventory");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!product) return;

  await prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
  });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/stock");
}
