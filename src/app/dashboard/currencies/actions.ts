"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "رمز العملة من ثلاثة أحرف (مثل USD)")
    .regex(/^[A-Z]{3}$/, "رمز العملة بحروف إنجليزية فقط"),
  name: z.string().trim().min(2, "اسم العملة مطلوب"),
  symbol: z.string().trim().min(1, "رمز العرض مطلوب"),
  decimals: z.coerce.number().int().min(0).max(4),
});

export async function createCurrency(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = currencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.currency.create({ data: { ...parsed.data, isBase: false } });
  } catch {
    return { error: "رمز العملة مستخدم مسبقاً" };
  }

  revalidatePath("/dashboard/currencies");
  return { success: true };
}

export async function toggleCurrencyActive(
  currencyId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireUserAction("settings");

  const currency = await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) return { error: "العملة غير موجودة" };

  if (currency.isBase && !isActive) {
    return { error: "لا يمكن تعطيل عملة الأساس" };
  }

  await prisma.currency.update({ where: { id: currencyId }, data: { isActive } });
  revalidatePath("/dashboard/currencies");
  return { success: true };
}

/**
 * تغيير عملة الأساس عملية خطيرة: القيود المرحّلة سابقاً مُمسوكة بالعملة
 * القديمة ولا تُعاد ترجمتها، فلا يُسمح بها بعد وجود قيود محاسبية.
 */
export async function setBaseCurrency(currencyId: string): Promise<ActionState> {
  await requireUserAction("settings");

  const currency = await prisma.currency.findUnique({ where: { id: currencyId } });
  if (!currency) return { error: "العملة غير موجودة" };
  if (currency.isBase) return { success: true };

  const postedEntries = await prisma.journalEntry.count();
  if (postedEntries > 0) {
    return {
      error:
        "لا يمكن تغيير عملة الأساس بعد وجود قيود محاسبية، لأن القيود السابقة مُمسوكة بالعملة الحالية",
    };
  }

  await prisma.$transaction([
    prisma.currency.updateMany({ where: { isBase: true }, data: { isBase: false } }),
    prisma.currency.update({
      where: { id: currencyId },
      data: { isBase: true, isActive: true },
    }),
  ]);

  revalidatePath("/dashboard/currencies");
  return { success: true };
}

const rateSchema = z.object({
  currencyId: z.string().trim().min(1, "اختر العملة"),
  rate: z.coerce.number().positive("سعر الصرف يجب أن يكون أكبر من صفر"),
  validFrom: z.string().trim().min(1, "تاريخ السريان مطلوب"),
});

export async function upsertExchangeRate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const currency = await prisma.currency.findUnique({
    where: { id: parsed.data.currencyId },
  });
  if (!currency) return { error: "العملة غير موجودة" };
  if (currency.isBase) {
    return { error: "عملة الأساس سعرها ثابت عند 1 ولا يُسجَّل لها سعر صرف" };
  }

  // التاريخ يُخزَّن كتاريخ فقط (بدون وقت) ليتطابق مع عمود @db.Date
  const validFrom = new Date(`${parsed.data.validFrom}T00:00:00.000Z`);
  if (Number.isNaN(validFrom.getTime())) {
    return { error: "تاريخ السريان غير صحيح" };
  }

  await prisma.exchangeRate.upsert({
    where: {
      currencyId_validFrom: { currencyId: parsed.data.currencyId, validFrom },
    },
    update: { rate: parsed.data.rate },
    create: {
      currencyId: parsed.data.currencyId,
      rate: parsed.data.rate,
      validFrom,
    },
  });

  revalidatePath("/dashboard/currencies");
  return { success: true };
}

export async function deleteExchangeRate(rateId: string): Promise<ActionState> {
  await requireUserAction("settings");
  await prisma.exchangeRate.delete({ where: { id: rateId } });
  revalidatePath("/dashboard/currencies");
  return { success: true };
}
