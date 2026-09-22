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
  postPayment,
  PostingError,
} from "@/lib/modules/accounting-posting";

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
        },
      });

      if (!invoice) throw new PaymentError("الفاتورة غير موجودة");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new PaymentError("لا يمكن تسجيل دفعة على فاتورة ملغاة");
      }

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
          amount: input.amount,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          reference: input.reference,
          note: input.note,
        },
      });

      const newPaid = round2(alreadyPaid + input.amount);
      const fullyPaid = total - newPaid <= 0.005;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          status: fullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        },
      });

      await postPayment(tx, {
        paymentId: payment.id,
        number: payment.number,
        amount: input.amount,
        direction: direction === PaymentDirection.INBOUND ? "INBOUND" : "OUTBOUND",
        createdById: user.id,
      });
    });
  } catch (error) {
    if (error instanceof PaymentError || error instanceof PostingError) {
      return { error: error.message };
    }
    console.error("recordPayment", error);
    return { error: "تعذر تسجيل الدفعة، حاول مرة أخرى" };
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${input.invoiceId}`);
  revalidatePath("/dashboard/payments");
  return { success: true };
}
