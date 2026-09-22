"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const schema = z.object({
  name: z.string().min(2, "اسم المنشأة مطلوب"),
  legalName: z.string().optional(),
  taxNumber: z.string().optional(),
  currency: z.string().min(3, "رمز العملة مطلوب").max(3, "رمز العملة من ثلاثة أحرف"),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});

export async function updateOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("settings");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      taxNumber: parsed.data.taxNumber || null,
      currency: parsed.data.currency.toUpperCase(),
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { success: true };
}
