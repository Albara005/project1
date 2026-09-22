"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const customerSchema = z.object({
  code: z.string().trim().min(1, "رمز العميل مطلوب"),
  name: z.string().trim().min(1, "اسم العميل مطلوب"),
  contactName: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  taxNumber: optionalText,
  creditLimit: z.coerce
    .number()
    .min(0, "حد الائتمان لا يمكن أن يكون سالباً")
    .default(0),
  isActive: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

const updateSchema = customerSchema.extend({
  id: z.string().trim().min(1, "العميل غير محدد"),
});

export async function createCustomer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("sales");

  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.customer.create({
      data: {
        ...parsed.data,
        creditLimit: new Prisma.Decimal(parsed.data.creditLimit),
      },
    });
  } catch {
    return { error: "تعذر الحفظ، تأكد من عدم تكرار رمز العميل" };
  }

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}

export async function updateCustomer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("sales");

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.customer.update({
      where: { id },
      data: { ...data, creditLimit: new Prisma.Decimal(data.creditLimit) },
    });
  } catch {
    return { error: "تعذر التحديث، تأكد من عدم تكرار رمز العميل" };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { success: true };
}

/** حذف عميل. يُرفض الحذف إذا كانت له مستندات مرتبطة. */
export async function deleteCustomer(id: string): Promise<ActionState> {
  await requireUserAction("sales");

  const [orders, invoices] = await Promise.all([
    prisma.salesOrder.count({ where: { customerId: id } }),
    prisma.invoice.count({ where: { customerId: id } }),
  ]);

  if (orders > 0 || invoices > 0) {
    return {
      error: "لا يمكن حذف عميل مرتبط بأوامر بيع أو فواتير، يمكنك إلغاء تنشيطه بدلاً من ذلك",
    };
  }

  try {
    await prisma.customer.delete({ where: { id } });
  } catch {
    return { error: "تعذر حذف العميل" };
  }

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}
