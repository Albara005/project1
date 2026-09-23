"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PurchaseOrderStatus,
  StockMovementType,
  WorkflowEntityType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { StockError, applyStockMovement } from "@/lib/modules/stock";
import {
  CurrencyError,
  getBaseCurrency,
  getExchangeRate,
  toBaseAmount,
} from "@/lib/modules/currency";
import {
  PostingError,
  nextDocumentNumber,
  postPurchaseReceipt,
} from "@/lib/modules/accounting-posting";
import { WorkflowError, applyTransition, startWorkflow } from "@/lib/workflow";
import {
  getBranchScope,
  resolveDocumentBranchId,
} from "@/app/dashboard/warehouses/branch-scope";

export type ActionState = { error?: string; success?: boolean };

const headerSchema = z.object({
  supplierId: z.string().trim().min(1, "يجب اختيار المورد"),
  warehouseId: z.string().trim().min(1, "يجب اختيار المستودع"),
  currencyId: z.string().trim().optional(),
  branchId: z.string().trim().optional(),
  expectedDate: z.string().trim().optional(),
  note: z.string().trim().optional(),
  items: z.string().trim().min(1, "أضف بنداً واحداً على الأقل"),
});

const lineSchema = z.object({
  productId: z.string().trim().min(1, "يجب اختيار المنتج في كل بند"),
  quantity: z.coerce
    .number({ error: "الكمية غير صحيحة" })
    .positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce
    .number({ error: "سعر الوحدة غير صحيح" })
    .min(0, "سعر الوحدة لا يمكن أن يكون سالباً"),
  taxRate: z.coerce
    .number({ error: "نسبة الضريبة غير صحيحة" })
    .min(0, "نسبة الضريبة لا يمكن أن تكون سالبة")
    .max(100, "نسبة الضريبة لا تتجاوز 100"),
});

const linesSchema = z.array(lineSchema).min(1, "أضف بنداً واحداً على الأقل");

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * ينشئ أمر شراء بحالة "مسودة" ويبدأ سير العمل المرتبط به.
 * المجاميع (الإجمالي قبل الضريبة، الضريبة، الإجمالي) تُحسب في الخادم من البنود
 * المُرسلة ولا يُعتمد أبداً على أي مجاميع قادمة من المتصفح.
 *
 * يُثبَّت على المستند سعر صرف عملته وقت الإنشاء، وتُحفظ معه المجاميع بعملة
 * الأساس (base*) لأن الدفاتر والتقارير وحدود الاعتماد كلها بعملة الأساس.
 */
export async function createPurchaseOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("purchasing");

  const parsed = headerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(parsed.data.items);
  } catch {
    return { error: "تعذر قراءة بنود أمر الشراء" };
  }

  const parsedLines = linesSchema.safeParse(rawItems);
  if (!parsedLines.success) {
    return { error: parsedLines.error.issues[0]?.message ?? "بنود غير صحيحة" };
  }

  let expectedDate: Date | null = null;
  if (parsed.data.expectedDate) {
    const candidate = new Date(parsed.data.expectedDate);
    if (Number.isNaN(candidate.getTime())) {
      return { error: "تاريخ الاستلام المتوقع غير صحيح" };
    }
    expectedDate = candidate;
  }

  // حساب المجاميع في الخادم
  let subtotal = 0;
  let taxAmount = 0;
  const items = parsedLines.data.map((line) => {
    const lineSubtotal = round2(line.quantity * line.unitPrice);
    const lineTax = round2((lineSubtotal * line.taxRate) / 100);
    subtotal = round2(subtotal + lineSubtotal);
    taxAmount = round2(taxAmount + lineTax);
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      lineTotal: round2(lineSubtotal + lineTax),
    };
  });
  const total = round2(subtotal + taxAmount);

  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const existingProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  if (existingProducts.length !== productIds.length) {
    return { error: "أحد المنتجات المختارة غير موجود" };
  }

  // العملة وسعر الصرف: يُثبَّت السعر الساري اليوم على المستند ولا يتغيّر بعدها
  const orderDate = new Date();
  let currencyId: string;
  let exchangeRate: number;
  try {
    currencyId = parsed.data.currencyId || (await getBaseCurrency()).id;
    exchangeRate = await getExchangeRate(currencyId, orderDate);
  } catch (error) {
    if (error instanceof CurrencyError) return { error: error.message };
    return { error: "تعذر تحديد سعر صرف العملة المختارة" };
  }

  const baseSubtotal = toBaseAmount(subtotal, exchangeRate);
  const baseTaxAmount = toBaseAmount(taxAmount, exchangeRate);
  // الإجمالي بعملة الأساس = مجموع جزأيه المحوَّلين، حتى يبقى القيد متوازناً
  // (تحويل الإجمالي بمفرده قد يختلف عن مجموع الجزأين بفلس واحد بسبب التقريب)
  const baseTotal = round2(baseSubtotal + baseTaxAmount);

  const scope = await getBranchScope(user);
  const branchId = resolveDocumentBranchId(scope, parsed.data.branchId);

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, "purchaseOrder", "PO");

      const created = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId: parsed.data.supplierId,
          warehouseId: parsed.data.warehouseId,
          status: PurchaseOrderStatus.DRAFT,
          branchId,
          currencyId,
          exchangeRate,
          orderDate,
          expectedDate,
          note: parsed.data.note || null,
          subtotal,
          taxAmount,
          total,
          baseSubtotal,
          baseTaxAmount,
          baseTotal,
          items: { create: items },
        },
      });

      // حدود الاعتماد في محرك سير العمل بعملة الأساس، فيُمرَّر الإجمالي المحوَّل
      await startWorkflow(WorkflowEntityType.PURCHASE_ORDER, created.id, {
        amount: baseTotal,
        actorId: user.id,
        client: tx,
      });

      return created;
    });
    orderId = order.id;
  } catch {
    return { error: "تعذر حفظ أمر الشراء، تأكد من صحة المورد والمستودع والبنود" };
  }

  revalidatePath("/dashboard/purchase-orders");
  redirect(`/dashboard/purchase-orders/${orderId}`);
}

function isPurchaseOrderStatus(key: string): key is PurchaseOrderStatus {
  return Object.prototype.hasOwnProperty.call(PurchaseOrderStatus, key);
}

/**
 * يعيد مبلغ المستند بعملة الأساس: يعتمد العمود المحفوظ (base*)، ويحسبه من
 * سعر الصرف المثبّت على المستند للمستندات القديمة التي أُنشئت قبل دعم العملات.
 */
function baseAmountOf(baseValue: unknown, documentValue: unknown, rate: number) {
  const stored = toNumber(baseValue);
  if (stored !== 0) return stored;
  return toBaseAmount(toNumber(documentValue), rate);
}

/**
 * ينفّذ انتقال سير عمل على أمر شراء ويطبّق أثره داخل نفس المعاملة:
 * عند الوصول إلى "مستلم" تُدخل الكميات للمخزون ويُرحَّل قيد الاستلام،
 * وفي بقية الحالات تُزامَن حالة المستند مع مفتاح حالة سير العمل.
 *
 * القيد وتكلفة الوحدة في حركة المخزون يُرحَّلان بعملة الأساس دائماً:
 * استيراد بضاعة بـ 10,000 دولار يجب أن يُدخل المخزون بقيمته بالريال.
 */
export async function runPurchaseOrderTransition(
  orderId: string,
  transitionId: string,
  note: string,
): Promise<{ error?: string }> {
  const user = await requireUserAction("purchasing");

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new WorkflowError("أمر الشراء غير موجود");

      const result = await applyTransition({
        entityType: WorkflowEntityType.PURCHASE_ORDER,
        entityId: orderId,
        transitionId,
        role: user.role,
        actorId: user.id,
        note,
        client: tx,
      });

      const targetKey = result.toStateKey;

      if (targetKey === PurchaseOrderStatus.RECEIVED) {
        // حماية من الاستلام المزدوج: لا تُحرَّك الكميات مرة أخرى
        if (order.receivedAt) {
          await tx.purchaseOrder.update({
            where: { id: orderId },
            data: { status: PurchaseOrderStatus.RECEIVED },
          });
          return;
        }

        const rate = toNumber(order.exchangeRate) || 1;

        for (const line of order.items) {
          await applyStockMovement(tx, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            type: StockMovementType.PURCHASE_IN,
            quantity: toNumber(line.quantity),
            // تقييم المخزون جزء من الدفاتر، فتُسجَّل التكلفة بعملة الأساس
            unitCost: toBaseAmount(toNumber(line.unitPrice), rate),
            reference: order.number,
          });
        }

        const baseSubtotal = baseAmountOf(order.baseSubtotal, order.subtotal, rate);
        const baseTaxAmount = baseAmountOf(order.baseTaxAmount, order.taxAmount, rate);

        await postPurchaseReceipt(tx, {
          purchaseOrderId: order.id,
          number: order.number,
          subtotal: baseSubtotal,
          taxAmount: baseTaxAmount,
          // مجموع الجزأين وليس تحويل الإجمالي، حتى لا يختل توازن القيد بالتقريب
          total: round2(baseSubtotal + baseTaxAmount),
          createdById: user.id,
          branchId: order.branchId,
        });

        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() },
        });
        return;
      }

      if (isPurchaseOrderStatus(targetKey)) {
        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: targetKey },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof WorkflowError ||
      error instanceof StockError ||
      error instanceof PostingError
    ) {
      return { error: error.message };
    }
    return { error: "تعذر تنفيذ الإجراء على أمر الشراء" };
  }

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath(`/dashboard/purchase-orders/${orderId}`);
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/products");
  return {};
}
