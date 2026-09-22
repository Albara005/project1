"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { EMPLOYEE_STATUS_VALUES } from "./labels";

export type ActionState = { error?: string; success?: boolean; message?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  });

const requiredDate = (message: string) =>
  z
    .string()
    .min(1, message)
    .transform((value) => new Date(value))
    .refine((date) => !Number.isNaN(date.getTime()), { message });

const optionalDate = (message: string) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed === "" ? null : new Date(trimmed);
    })
    .refine((date) => date === null || !Number.isNaN(date.getTime()), { message });

const money = (message: string) =>
  z
    .string()
    .optional()
    .transform((value) => Number((value ?? "").trim() || "0"))
    .refine((amount) => Number.isFinite(amount) && amount >= 0, { message });

const employeeSchema = z.object({
  id: optionalText,
  employeeNo: z.string().trim().min(1, "الرقم الوظيفي مطلوب"),
  firstName: z.string().trim().min(1, "الاسم الأول مطلوب"),
  lastName: z.string().trim().min(1, "اسم العائلة مطلوب"),
  email: optionalText,
  phone: optionalText,
  nationalId: optionalText,
  hireDate: requiredDate("تاريخ التعيين غير صحيح"),
  terminationDate: optionalDate("تاريخ انتهاء الخدمة غير صحيح"),
  departmentId: optionalText,
  positionId: optionalText,
  baseSalary: money("الراتب الأساسي غير صحيح"),
  allowances: money("قيمة البدلات غير صحيحة"),
  status: z.enum(EMPLOYEE_STATUS_VALUES),
});

/** إنشاء موظف جديد أو تعديل موظف قائم (يُحدد بوجود الحقل المخفي id). */
export async function saveEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const input = parsed.data;

  if (input.email && !EMAIL_PATTERN.test(input.email)) {
    return { error: "البريد الإلكتروني غير صحيح" };
  }
  if (input.terminationDate && input.terminationDate < input.hireDate) {
    return { error: "تاريخ انتهاء الخدمة يجب أن يكون بعد تاريخ التعيين" };
  }

  const data = {
    employeeNo: input.employeeNo,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    nationalId: input.nationalId,
    hireDate: input.hireDate,
    terminationDate: input.terminationDate,
    departmentId: input.departmentId,
    positionId: input.positionId,
    baseSalary: new Prisma.Decimal(input.baseSalary),
    allowances: new Prisma.Decimal(input.allowances),
    status: input.status,
  };

  try {
    if (input.id) {
      await prisma.employee.update({ where: { id: input.id }, data });
    } else {
      await prisma.employee.create({ data });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "الرقم الوظيفي أو البريد الإلكتروني مستخدم مسبقاً" };
    }
    return { error: "تعذر حفظ بيانات الموظف" };
  }

  revalidatePath("/dashboard/employees");
  if (input.id) revalidatePath(`/dashboard/employees/${input.id}`);
  return { success: true, message: input.id ? "تم تحديث بيانات الموظف" : "تمت إضافة الموظف" };
}

/** حذف موظف — يُمنع إن كان له سجلات رواتب أو إجازات للحفاظ على السجل التاريخي. */
export async function deleteEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "الموظف غير محدد" };

  const [payslips, leaves] = await Promise.all([
    prisma.payslip.count({ where: { employeeId: id } }),
    prisma.leaveRequest.count({ where: { employeeId: id } }),
  ]);

  if (payslips > 0 || leaves > 0) {
    return {
      error: "لا يمكن حذف موظف له مسيّرات رواتب أو طلبات إجازة — غيّر حالته إلى منتهية خدمته",
    };
  }

  try {
    await prisma.employee.delete({ where: { id } });
  } catch {
    return { error: "تعذر حذف الموظف" };
  }

  revalidatePath("/dashboard/employees");
  return { success: true };
}
