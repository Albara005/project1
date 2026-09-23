"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ReturnStatus,
  ReturnType,
  StockMovementType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { applyStockMovement, StockError } from "@/lib/modules/stock";
import {
  nextDocumentNumber,
  postPurchaseReturn,
  postSalesReturn,
  PostingError,
} from "@/lib/modules/accounting-posting";

export type ActionState = { error?: string; success?: boolean };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const itemSchema = z.object({
  productId: z.string().trim().min(1, "يجب اختيار المنتج في كل سطر"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().min(0, "سعر الوحدة غير صحيح"),
  taxRate: z.coerce
    .number()
    .min(0, "نسبة الضريبة غير صحيحة")
    .max(100, "نسبة الضريبة غير صحيحة"),
});

const returnSchema = z.object({
  type: z.enum(ReturnType),
  partyId: z.string().trim().min(1, "يجب اختيار الطرف (عميل أو مورد)"),
  warehouseId: z.string().trim().min(1, "يجب اختيار المستودع"),
  invoiceId: optionalText,
  reason: optionalText,
  items: z.string().min(1, "أضف صنفاً واحداً على الأقل"),
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** الوحدة التي تحكم الصلاحية: المرتجعات البيعية للمبيعات والشرائية للمشتريات. */
function moduleFor(type: ReturnType) {
  return type === ReturnType.SALES ? ("sales" as const) : ("purchasing" as const);
}

/**
 * ينشئ إشعار مرتجع بحالة مسودة. الإجماليات تُحسب في الخادم،
 * وإذا رُبط المرتجع بفاتورة أصلية فلا يُسمح بتجاوز الكميات المفوترة
 * (مع خصم ما سبق إرجاعه على نفس الفاتورة).
 */
export async function createReturn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsedType = z.enum(ReturnType).safeParse(formData.get("type"));
  if (!parsedType.success) return { error: "نوع المرتجع غير صحيح" };

  const user = await requireUserAction(moduleFor(parsedType.data));

  const parsed = returnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(parsed.data.items);
  } catch {
    return { error: "تعذر قراءة أصناف المرتجع" };
  }

  const itemsParsed = z
    .array(itemSchema)
    .min(1, "أضف صنفاً واحداً على الأقل")
    .safeParse(rawItems);

  if (!itemsParsed.success) {
    return { error: itemsParsed.error.issues[0]?.message ?? "أصناف غير صحيحة" };
  }

  const isSales = parsed.data.type === ReturnType.SALES;

  const productIds = Array.from(new Set(itemsParsed.data.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    return { error: "أحد المنتجات المختارة غير موجود" };
  }

  if (parsed.data.invoiceId) {
    const check = await validateAgainstInvoice(
      parsed.data.invoiceId,
      itemsParsed.data.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    );
    if (check) return { error: check };
  }

  const lines = itemsParsed.data.map((item) => {
    const lineTotal = round2(item.quantity * item.unitPrice);
    return { ...item, lineTotal, lineTax: round2((lineTotal * item.taxRate) / 100) };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const taxAmount = round2(lines.reduce((sum, line) => sum + line.lineTax, 0));
  const total = round2(subtotal + taxAmount);

  let returnId: string;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(
        tx,
        "returnNote",
        isSales ? "SRN" : "PRN",
      );

      return tx.returnNote.create({
        data: {
          number,
          type: parsed.data.type,
          status: ReturnStatus.DRAFT,
          customerId: isSales ? parsed.data.partyId : null,
          supplierId: isSales ? null : parsed.data.partyId,
          invoiceId: parsed.data.invoiceId,
          warehouseId: parsed.data.warehouseId,
          reason: parsed.data.reason,
          subtotal,
          taxAmount,
          total,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });
    });

    returnId = created.id;
  } catch {
    return { error: "تعذر إنشاء المرتجع، تحقق من البيانات وحاول مرة أخرى" };
  }

  revalidatePath("/dashboard/returns");
  redirect(`/dashboard/returns/${returnId}`);
}

/**
 * يتحقق أن كميات المرتجع لا تتجاوز المفوتر ناقصاً ما سبق إرجاعه.
 * يعيد رسالة خطأ عربية عند المخالفة، أو null عند السلامة.
 */
async function validateAgainstInvoice(
  invoiceId: string,
  items: Array<{ productId: string; quantity: number }>,
  excludeReturnId?: string,
): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { select: { productId: true, quantity: true } },
      returns: {
        where: {
          status: { not: ReturnStatus.CANCELLED },
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
        include: { items: { select: { productId: true, quantity: true } } },
      },
    },
  });

  if (!invoice) return "الفاتورة الأصلية غير موجودة";

  const invoiced = new Map<string, number>();
  for (const item of invoice.items) {
    if (!item.productId) continue;
    invoiced.set(item.productId, (invoiced.get(item.productId) ?? 0) + Number(item.quantity));
  }

  const alreadyReturned = new Map<string, number>();
  for (const note of invoice.returns) {
    for (const item of note.items) {
      alreadyReturned.set(
        item.productId,
        (alreadyReturned.get(item.productId) ?? 0) + Number(item.quantity),
      );
    }
  }

  for (const item of items) {
    const invoicedQty = invoiced.get(item.productId) ?? 0;
    if (invoicedQty === 0) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      return `المنتج "${product?.name ?? ""}" غير موجود في الفاتورة الأصلية`;
    }

    const remaining = invoicedQty - (alreadyReturned.get(item.productId) ?? 0);
    if (item.quantity > remaining) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      });
      return `كمية المرتجع للمنتج "${product?.name ?? ""}" تتجاوز المتبقي من الفاتورة (المتاح ${remaining})`;
    }
  }

  return null;
}

/**
 * يؤكد المرتجع: يحرّك المخزون ويرحّل القيد المحاسبي في معاملة واحدة.
 * مرتجع المبيعات يُدخل البضاعة للمخزون، ومرتجع المشتريات يُخرجها.
 */
export async function confirmReturn(returnNoteId: string): Promise<ActionState> {
  const note = await prisma.returnNote.findUnique({
    where: { id: returnNoteId },
    include: { items: true },
  });
  if (!note) return { error: "المرتجع غير موجود" };

  const user = await requireUserAction(moduleFor(note.type));

  if (note.status !== ReturnStatus.DRAFT) {
    return { error: "لا يمكن تأكيد مرتجع غير مسودة" };
  }
  if (note.items.length === 0) {
    return { error: "لا يمكن تأكيد مرتجع بلا أصناف" };
  }

  const isSales = note.type === ReturnType.SALES;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of note.items) {
        await applyStockMovement(tx, {
          productId: item.productId,
          warehouseId: note.warehouseId,
          // مرتجع مبيعات يعيد البضاعة إلينا، ومرتجع مشتريات يخرجها للمورد
          type: isSales ? StockMovementType.RETURN_IN : StockMovementType.RETURN_OUT,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitPrice),
          reference: note.number,
        });
      }

      const amounts = {
        returnNoteId: note.id,
        number: note.number,
        subtotal: Number(note.subtotal),
        taxAmount: Number(note.taxAmount),
        total: Number(note.total),
        createdById: user.id,
      };

      if (isSales) {
        await postSalesReturn(tx, amounts);
      } else {
        await postPurchaseReturn(tx, amounts);
      }

      await tx.returnNote.update({
        where: { id: note.id },
        data: { status: ReturnStatus.CONFIRMED, confirmedAt: new Date() },
      });
    });
  } catch (error) {
    if (error instanceof StockError || error instanceof PostingError) {
      return { error: error.message };
    }
    return { error: "تعذر تأكيد المرتجع" };
  }

  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/returns/${returnNoteId}`);
  return { success: true };
}

export async function cancelReturn(returnNoteId: string): Promise<ActionState> {
  const note = await prisma.returnNote.findUnique({
    where: { id: returnNoteId },
    select: { id: true, status: true, type: true },
  });
  if (!note) return { error: "المرتجع غير موجود" };

  await requireUserAction(moduleFor(note.type));

  if (note.status === ReturnStatus.CONFIRMED) {
    return { error: "لا يمكن إلغاء مرتجع مؤكد؛ سجّل مستنداً معاكساً بدلاً من ذلك" };
  }

  await prisma.returnNote.update({
    where: { id: note.id },
    data: { status: ReturnStatus.CANCELLED },
  });

  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/returns/${returnNoteId}`);
  return { success: true };
}
