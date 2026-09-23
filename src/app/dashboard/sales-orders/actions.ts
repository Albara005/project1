"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  InvoiceStatus,
  InvoiceType,
  SalesOrderStatus,
  StockMovementType,
  WorkflowEntityType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { applyStockMovement, StockError } from "@/lib/modules/stock";
import {
  nextDocumentNumber,
  postSalesInvoice,
  PostingError,
} from "@/lib/modules/accounting-posting";
import {
  CurrencyError,
  getExchangeRate,
  toBaseAmount,
} from "@/lib/modules/currency";
import { applyTransition, startWorkflow, WorkflowError } from "@/lib/workflow";
import { getBranchScope, resolveBranchId } from "../invoices/document-scope";
import { salesOrderStatusFromStateKey } from "./status";

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

const orderSchema = z.object({
  customerId: z.string().trim().min(1, "يجب اختيار العميل"),
  warehouseId: z.string().trim().min(1, "يجب اختيار المستودع"),
  currencyId: z.string().trim().min(1, "يجب اختيار العملة"),
  branchId: optionalText,
  deliveryDate: optionalText,
  note: optionalText,
  items: z.string().min(1, "أضف صنفاً واحداً على الأقل"),
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * قيمة المستند بعملة الأساس: العمود المخزَّن إن وُجد، وإلا تُشتق من سعر الصرف
 * حتى تبقى الأوامر المنشأة قبل إضافة أعمدة الأساس صحيحة الترحيل.
 */
function baseOf(stored: unknown, documentAmount: unknown, exchangeRate: unknown): number {
  const value = toNumber(stored);
  if (value !== 0) return value;
  return toBaseAmount(toNumber(documentAmount), toNumber(exchangeRate) || 1);
}

/**
 * ينشئ أمر بيع جديداً. الإجماليات تُحسب في الخادم من السطور المرسلة
 * ولا يُعتمد على أي مجاميع قادمة من المتصفح.
 */
export async function createSalesOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("sales");

  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(parsed.data.items);
  } catch {
    return { error: "تعذر قراءة أصناف أمر البيع" };
  }

  const itemsParsed = z
    .array(itemSchema)
    .min(1, "أضف صنفاً واحداً على الأقل")
    .safeParse(rawItems);

  if (!itemsParsed.success) {
    return { error: itemsParsed.error.issues[0]?.message ?? "أصناف غير صحيحة" };
  }

  const productIds = Array.from(new Set(itemsParsed.data.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  if (products.length !== productIds.length) {
    return { error: "أحد المنتجات المختارة غير موجود" };
  }

  // حساب الإجماليات في الخادم: lineTotal صافي السطر قبل الضريبة
  const lines = itemsParsed.data.map((item) => {
    const lineTotal = round2(item.quantity * item.unitPrice);
    return { ...item, lineTotal, lineTax: round2((lineTotal * item.taxRate) / 100) };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const taxAmount = round2(lines.reduce((sum, line) => sum + line.lineTax, 0));
  const total = round2(subtotal + taxAmount);

  // سعر الصرف يُثبَّت على المستند وقت إنشائه، والقيم بعملة الأساس تُشتق منه
  const orderDate = new Date();
  let exchangeRate: number;
  try {
    exchangeRate = await getExchangeRate(parsed.data.currencyId, orderDate);
  } catch (error) {
    if (error instanceof CurrencyError) return { error: error.message };
    throw error;
  }

  const baseSubtotal = toBaseAmount(subtotal, exchangeRate);
  const baseTaxAmount = toBaseAmount(taxAmount, exchangeRate);
  const baseTotal = toBaseAmount(total, exchangeRate);

  const scope = await getBranchScope(user);
  const branchId = resolveBranchId(scope, parsed.data.branchId);

  let orderId: string;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, "salesOrder", "SO");

      const created = await tx.salesOrder.create({
        data: {
          number,
          customerId: parsed.data.customerId,
          warehouseId: parsed.data.warehouseId,
          branchId,
          currencyId: parsed.data.currencyId,
          exchangeRate,
          status: SalesOrderStatus.DRAFT,
          orderDate,
          deliveryDate: parsed.data.deliveryDate
            ? new Date(parsed.data.deliveryDate)
            : null,
          note: parsed.data.note,
          subtotal,
          taxAmount,
          total,
          baseSubtotal,
          baseTaxAmount,
          baseTotal,
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

      // مبلغ سير العمل بعملة الأساس حتى تتقارن حدود الاعتماد بين العملات
      await startWorkflow(WorkflowEntityType.SALES_ORDER, created.id, {
        amount: baseTotal,
        actorId: user.id,
        client: tx,
      });

      return created;
    });

    orderId = order.id;
  } catch {
    return { error: "تعذر إنشاء أمر البيع، تحقق من البيانات وحاول مرة أخرى" };
  }

  revalidatePath("/dashboard/sales-orders");
  redirect(`/dashboard/sales-orders/${orderId}`);
}

/**
 * ينفّذ انتقال سير العمل على أمر البيع ويطبّق أثر الحالة الجديدة داخل نفس المعاملة:
 * CONFIRMED ← صرف المخزون، INVOICED ← إصدار الفاتورة وترحيل القيد.
 */
export async function runSalesOrderTransition(
  orderId: string,
  transitionId: string,
  note: string,
): Promise<{ error?: string }> {
  const user = await requireUserAction("sales");

  try {
    await prisma.$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { product: { select: { name: true } } } },
            invoices: { select: { id: true } },
          },
        });

        if (!order) throw new WorkflowError("أمر البيع غير موجود");

        const { toStateKey } = await applyTransition({
          entityType: WorkflowEntityType.SALES_ORDER,
          entityId: order.id,
          transitionId,
          role: user.role,
          actorId: user.id,
          note,
          client: tx,
        });

        if (toStateKey === "CONFIRMED") {
          // الحماية من تكرار الأثر: لا نصرف المخزون مرتين لنفس الأمر
          if (!order.confirmedAt) {
            for (const item of order.items) {
              await applyStockMovement(tx, {
                productId: item.productId,
                warehouseId: order.warehouseId,
                type: StockMovementType.SALE_OUT,
                quantity: toNumber(item.quantity),
                unitCost: toNumber(item.unitPrice),
                reference: order.number,
                note: `صرف مخزون لأمر البيع ${order.number}`,
              });
            }

            await tx.salesOrder.update({
              where: { id: order.id },
              data: { confirmedAt: new Date() },
            });
          }
        } else if (toStateKey === "INVOICED") {
          // الحماية من تكرار الأثر: لا نصدر فاتورة ثانية لنفس الأمر
          if (order.invoices.length === 0) {
            const invoiceNumber = await nextDocumentNumber(tx, "invoice", "INV");
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            const baseSubtotal = baseOf(
              order.baseSubtotal,
              order.subtotal,
              order.exchangeRate,
            );
            const baseTaxAmount = baseOf(
              order.baseTaxAmount,
              order.taxAmount,
              order.exchangeRate,
            );
            const baseTotal = baseOf(order.baseTotal, order.total, order.exchangeRate);

            // الفاتورة ترث عملة الأمر وسعر صرفه وفرعه، فلا تتغيّر قيمتها بعملة الأساس
            const invoice = await tx.invoice.create({
              data: {
                number: invoiceNumber,
                type: InvoiceType.SALES,
                status: InvoiceStatus.ISSUED,
                customerId: order.customerId,
                salesOrderId: order.id,
                branchId: order.branchId,
                currencyId: order.currencyId,
                exchangeRate: order.exchangeRate,
                issueDate: new Date(),
                dueDate,
                subtotal: order.subtotal,
                taxAmount: order.taxAmount,
                total: order.total,
                baseSubtotal,
                baseTaxAmount,
                baseTotal,
                note: `فاتورة عن أمر البيع ${order.number}`,
                items: {
                  create: order.items.map((item) => ({
                    productId: item.productId,
                    description: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    taxRate: item.taxRate,
                    lineTotal: item.lineTotal,
                  })),
                },
              },
            });

            // القيود تُرحَّل دائماً بعملة الأساس، لا بعملة المستند
            await postSalesInvoice(tx, {
              invoiceId: invoice.id,
              number: invoice.number,
              subtotal: baseSubtotal,
              taxAmount: baseTaxAmount,
              total: baseTotal,
              createdById: user.id,
              branchId: order.branchId,
            });
          }
        }

        const status = salesOrderStatusFromStateKey(toStateKey);
        if (status && status !== order.status) {
          await tx.salesOrder.update({
            where: { id: order.id },
            data: { status },
          });
        }
      },
      { timeout: 20000 },
    );
  } catch (error) {
    if (
      error instanceof StockError ||
      error instanceof WorkflowError ||
      error instanceof PostingError
    ) {
      return { error: error.message };
    }
    console.error("runSalesOrderTransition", error);
    return { error: "تعذر تنفيذ الإجراء على أمر البيع" };
  }

  revalidatePath("/dashboard/sales-orders");
  revalidatePath(`/dashboard/sales-orders/${orderId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/stock");
  return {};
}
