"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LeadStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const leadSchema = z.object({
  name: z.string().trim().min(1, "اسم الفرصة مطلوب"),
  company: optionalText,
  email: optionalText,
  phone: optionalText,
  source: optionalText,
  note: optionalText,
  status: z.enum(LeadStatus, { message: "حالة غير صحيحة" }),
  estimatedValue: z.coerce
    .number()
    .min(0, "القيمة المتوقعة لا يمكن أن تكون سالبة")
    .default(0),
});

const updateSchema = leadSchema.extend({
  id: z.string().trim().min(1, "الفرصة غير محددة"),
});

export async function createLead(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("crm");

  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.lead.create({
      data: {
        ...parsed.data,
        estimatedValue: new Prisma.Decimal(parsed.data.estimatedValue),
      },
    });
  } catch {
    return { error: "تعذر حفظ الفرصة البيعية" };
  }

  revalidatePath("/dashboard/leads");
  redirect("/dashboard/leads");
}

export async function updateLead(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("crm");

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.lead.update({
      where: { id },
      data: { ...data, estimatedValue: new Prisma.Decimal(data.estimatedValue) },
    });
  } catch {
    return { error: "تعذر تحديث الفرصة البيعية" };
  }

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${id}`);
  return { success: true };
}

/** تغيير مرحلة الفرصة في مسار البيع. */
export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<ActionState> {
  await requireUserAction("crm");

  const parsed = z.enum(LeadStatus, { message: "حالة غير صحيحة" }).safeParse(status);
  if (!parsed.success) {
    return { error: "حالة غير صحيحة" };
  }

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: parsed.data },
    });
  } catch {
    return { error: "تعذر تغيير حالة الفرصة" };
  }

  revalidatePath("/dashboard/leads");
  return { success: true };
}

export async function deleteLead(leadId: string): Promise<ActionState> {
  await requireUserAction("crm");

  try {
    await prisma.lead.delete({ where: { id: leadId } });
  } catch {
    return { error: "تعذر حذف الفرصة البيعية" };
  }

  revalidatePath("/dashboard/leads");
  return { success: true };
}

/** يولّد رمز عميل جديد بصيغة CUS-00X اعتماداً على آخر رمز مستخدم. */
async function nextCustomerCode(client: Prisma.TransactionClient): Promise<string> {
  const last = await client.customer.findFirst({
    where: { code: { startsWith: "CUS-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  const lastSequence = Number(last?.code?.split("-").pop() ?? 0);
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  return `CUS-${String(next).padStart(3, "0")}`;
}

/**
 * تحويل فرصة رابحة إلى عميل: ينشئ سجل عميل جديداً ويربطه بالفرصة
 * ضمن معاملة واحدة.
 */
export async function convertLeadToCustomer(leadId: string): Promise<ActionState> {
  await requireUserAction("crm");

  try {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error("الفرصة البيعية غير موجودة");
      if (lead.customerId) throw new Error("تم تحويل هذه الفرصة إلى عميل مسبقاً");
      if (lead.status !== LeadStatus.WON) {
        throw new Error("لا يمكن التحويل إلا بعد كسب الفرصة (حالة: مكسوبة)");
      }

      const code = await nextCustomerCode(tx);

      const customer = await tx.customer.create({
        data: {
          code,
          name: lead.company?.trim() || lead.name,
          contactName: lead.company ? lead.name : null,
          email: lead.email,
          phone: lead.phone,
          creditLimit: new Prisma.Decimal(0),
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { customerId: customer.id },
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذر تحويل الفرصة إلى عميل",
    };
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/customers");
  return { success: true };
}
