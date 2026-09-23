"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  InvoiceStatus,
  InvoiceType,
  PaymentDirection,
  PaymentMethod,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import {
  nextDocumentNumber,
  postFxDifference,
  postPayment,
  PostingError,
} from "@/lib/modules/accounting-posting";
import {
  CurrencyError,
  getBaseCurrency,
  getExchangeRate,
  realizedFxDifference,
  toBaseAmount,
} from "@/lib/modules/currency";
import { getBranchScope } from "./document-scope";

export type ActionState = { error?: string; success?: boolean };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const paymentSchema = z.object({
  invoiceId: z.string().trim().min(1, "الفاتورة غير محددة"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  method: z.enum(PaymentMethod, { message: "طريقة الدفع غير صحيحة" }),
  paidAt: optionalText,
  reference: optionalText,
  note: optionalText,
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

class PaymentError extends Error {}

/**
 * تسجيل دفعة على فاتورة: إنشاء سند القبض/الصرف، تحديث المدفوع وحالة الفاتورة،
 * وترحيل القيد المحاسبي — كل ذلك ضمن معاملة واحدة.
 *
 * الدفعة تُسجَّل بعملة الفاتورة، لكنها تحمل سعر صرف تاريخ السداد لا تاريخ
 * الفاتورة. القيد يُرحَّل بعملة الأساس بالمبلغ المحوَّل بسعر السداد، ويُرحَّل
 * معه قيد فرق العملة المحقّق حتى تُقفل ذمم الطرف على صفر عند السداد الكامل.
 */
export async function recordPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("sales");

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const input = parsed.data;
  const scope = await getBranchScope(user);

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          total: true,
          paidAmount: true,
          branchId: true,
          currencyId: true,
          exchangeRate: true,
        },
      });

      if (!invoice) throw new PaymentError("الفاتورة غير موجودة");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new PaymentError("لا يمكن تسجيل دفعة على فاتورة ملغاة");
      }

      // المقارنة تتم بعملة الفاتورة: المدفوع والإجمالي بنفس العملة دائماً
      const total = toNumber(invoice.total);
      const alreadyPaid = toNumber(invoice.paidAmount);
      const remaining = round2(total - alreadyPaid);

      if (remaining <= 0) {
        throw new PaymentError("الفاتورة مسددة بالكامل");
      }
      if (input.amount - remaining > 0.005) {
        throw new PaymentError(
          `المبلغ يتجاوز المتبقي على الفاتورة (${remaining.toFixed(2)})`,
        );
      }

      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

      // الدفعة ترث عملة الفاتورة، لكن سعر صرفها هو سعر تاريخ السداد
      const currencyId =
        invoice.currencyId ?? (await getBaseCurrency(tx)).id;
      const invoiceRate = toNumber(invoice.exchangeRate) || 1;

      let paymentRate: number;
      try {
        paymentRate = await getExchangeRate(currencyId, paidAt, tx);
      } catch (error) {
        if (error instanceof CurrencyError) throw new PaymentError(error.message);
        throw error;
      }

      const baseAmount = toBaseAmount(input.amount, paymentRate);
      const branchId = invoice.branchId ?? scope.branchId;

      const number = await nextDocumentNumber(tx, "payment", "PAY");
      const direction =
        invoice.type === InvoiceType.SALES
          ? PaymentDirection.INBOUND
          : PaymentDirection.OUTBOUND;

      const payment = await tx.payment.create({
        data: {
          number,
          invoiceId: invoice.id,
          direction,
          method: input.method,
          branchId,
          currencyId,
          exchangeRate: paymentRate,
          amount: input.amount,
          baseAmount,
          paidAt,
          reference: input.reference,
          note: input.note,
        },
      });

      // المدفوع يبقى بعملة الفاتورة حتى تصح المقارنة مع إجماليها
      const newPaid = round2(alreadyPaid + input.amount);
      const fullyPaid = total - newPaid <= 0.005;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          status: fullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        },
      });

      // القيد يُرحَّل بعملة الأساس بقيمة المبلغ بسعر يوم السداد
      await postPayment(tx, {
        paymentId: payment.id,
        number: payment.number,
        amount: baseAmount,
        direction: direction === PaymentDirection.INBOUND ? "INBOUND" : "OUTBOUND",
        createdById: user.id,
        branchId,
      });

      // الفرق بين قيمة المبلغ بسعر الفاتورة وسعر السداد يُقفل في فروقات العملة،
      // فتعود ذمم الطرف إلى الصفر عند السداد الكامل
      const difference = realizedFxDifference({
        amount: input.amount,
        invoiceRate,
        paymentRate,
        direction: direction === PaymentDirection.INBOUND ? "INBOUND" : "OUTBOUND",
      });

      await postFxDifference(tx, {
        description: `فرق عملة عن سند ${payment.number} للفاتورة ${invoice.number}`,
        difference,
        direction: direction === PaymentDirection.INBOUND ? "INBOUND" : "OUTBOUND",
        paymentId: payment.id,
        createdById: user.id,
        branchId,
      });
    });
  } catch (error) {
    if (
      error instanceof PaymentError ||
      error instanceof PostingError ||
      error instanceof CurrencyError
    ) {
      return { error: error.message };
    }
    console.error("recordPayment", error);
    return { error: "تعذر تسجيل الدفعة، حاول مرة أخرى" };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${input.invoiceId}`);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/customers");
  return { success: true };
}
