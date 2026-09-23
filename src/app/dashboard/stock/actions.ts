"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockMovementType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { StockError, applyStockMovement } from "@/lib/modules/stock";

const adjustmentSchema = z.object({
  productId: z.string().trim().min(1, "المنتج مطلوب"),
  warehouseId: z.string().trim().min(1, "المستودع مطلوب"),
  quantity: z.coerce
    .number({ error: "الكمية غير صحيحة" })
    .refine((value) => value !== 0, "الكمية يجب أن تكون موجبة أو سالبة وليست صفراً"),
  note: z.string().trim().min(1, "سبب التسوية مطلوب"),
});

export type ActionState = { error?: string; success?: boolean };

/**
 * تسوية جرد: تزيد أو تنقص رصيد منتج في مستودع محدد وتسجّل الحركة.
 * الكمية تقبل قيمة موجبة (زيادة) أو سالبة (نقص)، والسبب إلزامي.
 */
export async function createStockAdjustment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("inventory");

  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { productId, warehouseId, quantity, note } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        productId,
        warehouseId,
        type: StockMovementType.ADJUSTMENT,
        quantity,
        // ملاحظة: خدمة المخزون تحفظ الكمية بقيمة مطلقة، لذا نوثّق الاتجاه في الملاحظة
        reference: "تسوية جرد",
        note: `${quantity > 0 ? "زيادة" : "نقص"}: ${note} — بواسطة ${user.name}`,
      });
    });
  } catch (error) {
    if (error instanceof StockError) {
      return { error: error.message };
    }
    return { error: "تعذر تنفيذ التسوية، تأكد من صحة المنتج والمستودع" };
  }

  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/products");
  return { success: true };
}
