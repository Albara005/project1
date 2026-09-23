"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

const supplierSchema = z.object({
  id: z.string().trim().optional(),
  code: z.string().trim().min(1, "رمز المورد مطلوب"),
  name: z.string().trim().min(1, "اسم المورد مطلوب"),
  contactName: z.string().trim().optional(),
  email: z
    .union([z.literal(""), z.email("البريد الإلكتروني غير صحيح")])
    .optional(),
  phone: z.string().trim().optional(),
  taxNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export type ActionState = { error?: string; success?: boolean };

/** ينشئ مورداً جديداً أو يحدّث مورداً قائماً حسب وجود المعرّف. */
export async function saveSupplier(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("purchasing");

  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, code, name, contactName, email, phone, taxNumber, address } = parsed.data;
  const data = {
    code,
    name,
    contactName: contactName || null,
    email: email || null,
    phone: phone || null,
    taxNumber: taxNumber || null,
    address: address || null,
  };

  try {
    if (id) {
      await prisma.supplier.update({ where: { id }, data });
    } else {
      await prisma.supplier.create({ data });
    }
  } catch {
    return { error: "تعذر الحفظ، تأكد من عدم تكرار رمز المورد" };
  }

  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/purchase-orders");
  return { success: true };
}

/** يفعّل أو يوقف مورداً (لا نحذف لارتباطه بأوامر الشراء). */
export async function toggleSupplierActive(formData: FormData): Promise<void> {
  await requireUserAction("purchasing");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!supplier) return;

  await prisma.supplier.update({
    where: { id },
    data: { isActive: !supplier.isActive },
  });

  revalidatePath("/dashboard/suppliers");
}
