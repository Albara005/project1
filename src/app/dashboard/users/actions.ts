"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const createUserSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  role: z.enum(Role),
});

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireUserAction("settings");

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        organizationId: current.organizationId,
      },
    });
  } catch {
    return { error: "البريد الإلكتروني مستخدم مسبقاً" };
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<ActionState> {
  const current = await requireUserAction("settings");

  if (userId === current.id && role !== Role.ADMIN) {
    return { error: "لا يمكنك إزالة صلاحية المدير عن حسابك الحالي" };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionState> {
  const current = await requireUserAction("settings");

  if (userId === current.id && !isActive) {
    return { error: "لا يمكنك تعطيل حسابك الحالي" };
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/dashboard/users");
  return { success: true };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}
