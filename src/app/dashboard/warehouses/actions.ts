"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

const warehouseSchema = z.object({
  id: z.string().trim().optional(),
  code: z.string().trim().min(1, "رمز المستودع مطلوب"),
  name: z.string().trim().min(1, "اسم المستودع مطلوب"),
  location: z.string().trim().optional(),
});

export type ActionState = { error?: string; success?: boolean };

/** ينشئ مستودعاً جديداً أو يحدّث مستودعاً قائماً حسب وجود المعرّف. */
export async function saveWarehouse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("inventory");

  const parsed = warehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, code, name, location } = parsed.data;
  const data = { code, name, location: location || null };

  try {
    if (id) {
      await prisma.warehouse.update({ where: { id }, data });
    } else {
      await prisma.warehouse.create({ data });
    }
  } catch {
    return { error: "تعذر الحفظ، تأكد من عدم تكرار رمز المستودع" };
  }

  revalidatePath("/dashboard/warehouses");
  revalidatePath("/dashboard/stock");
  return { success: true };
}

/** يفعّل أو يوقف مستودعاً (لا نحذف لارتباطه بالحركات والمستندات). */
export async function toggleWarehouseActive(formData: FormData): Promise<void> {
  await requireUserAction("inventory");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!warehouse) return;

  await prisma.warehouse.update({
    where: { id },
    data: { isActive: !warehouse.isActive },
  });

  revalidatePath("/dashboard/warehouses");
  revalidatePath("/dashboard/stock");
}
