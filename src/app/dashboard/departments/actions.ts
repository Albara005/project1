"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean; message?: string };

const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  });

const departmentSchema = z.object({
  id: optionalText,
  code: z.string().trim().min(1, "رمز القسم مطلوب"),
  name: z.string().trim().min(1, "اسم القسم مطلوب"),
});

const positionSchema = z.object({
  id: optionalText,
  title: z.string().trim().min(1, "المسمى الوظيفي مطلوب"),
  departmentId: optionalText,
});

/** إنشاء أو تعديل قسم. */
export async function saveDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const parsed = departmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, code, name } = parsed.data;

  try {
    if (id) {
      await prisma.department.update({ where: { id }, data: { code, name } });
    } else {
      await prisma.department.create({ data: { code, name } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "رمز القسم أو اسمه مستخدم مسبقاً" };
    }
    return { error: "تعذر حفظ القسم" };
  }

  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/employees");
  return { success: true, message: id ? "تم تحديث القسم" : "تمت إضافة القسم" };
}

/** حذف قسم — يُمنع إن كان مرتبطاً بموظفين أو مسميات وظيفية. */
export async function deleteDepartment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "القسم غير محدد" };

  const [employees, positions] = await Promise.all([
    prisma.employee.count({ where: { departmentId: id } }),
    prisma.position.count({ where: { departmentId: id } }),
  ]);

  if (employees > 0) return { error: "لا يمكن حذف قسم يضم موظفين" };
  if (positions > 0) return { error: "لا يمكن حذف قسم يحتوي على مسميات وظيفية" };

  try {
    await prisma.department.delete({ where: { id } });
  } catch {
    return { error: "تعذر حذف القسم" };
  }

  revalidatePath("/dashboard/departments");
  return { success: true };
}

/** إنشاء أو تعديل مسمى وظيفي. */
export async function savePosition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const parsed = positionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { id, title, departmentId } = parsed.data;

  try {
    if (id) {
      await prisma.position.update({ where: { id }, data: { title, departmentId } });
    } else {
      await prisma.position.create({ data: { title, departmentId } });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "هذا المسمى الوظيفي موجود مسبقاً في نفس القسم" };
    }
    return { error: "تعذر حفظ المسمى الوظيفي" };
  }

  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/employees");
  return { success: true, message: id ? "تم تحديث المسمى الوظيفي" : "تمت إضافة المسمى الوظيفي" };
}

/** حذف مسمى وظيفي — يُمنع إن كان مرتبطاً بموظفين. */
export async function deletePosition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "المسمى الوظيفي غير محدد" };

  const employees = await prisma.employee.count({ where: { positionId: id } });
  if (employees > 0) return { error: "لا يمكن حذف مسمى وظيفي مرتبط بموظفين" };

  try {
    await prisma.position.delete({ where: { id } });
  } catch {
    return { error: "تعذر حذف المسمى الوظيفي" };
  }

  revalidatePath("/dashboard/departments");
  return { success: true };
}
