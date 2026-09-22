"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role, WorkflowEntityType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";

export type ActionState = { error?: string; success?: boolean };

const definitionSchema = z.object({
  name: z.string().min(2, "اسم سير العمل مطلوب"),
  description: z.string().optional(),
  entityType: z.enum(WorkflowEntityType),
});

export async function createDefinition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("workflows");

  const parsed = definitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  try {
    await prisma.workflowDefinition.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        entityType: parsed.data.entityType,
        isActive: false,
        states: {
          create: [
            { key: "DRAFT", label: "مسودة", color: "gray", isInitial: true, sortOrder: 0 },
          ],
        },
      },
    });
  } catch {
    return { error: "يوجد سير عمل بنفس الاسم لهذا النوع من المستندات" };
  }

  revalidatePath("/dashboard/workflows");
  return { success: true };
}

/**
 * تفعيل تعريف سير عمل. يُسمح بتعريف نشط واحد فقط لكل نوع مستند،
 * لأن محرك سير العمل يختار التعريف النشط عند إنشاء أي مستند جديد.
 */
export async function toggleDefinitionActive(
  definitionId: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireUserAction("workflows");

  const definition = await prisma.workflowDefinition.findUnique({
    where: { id: definitionId },
    include: { states: true },
  });
  if (!definition) return { error: "التعريف غير موجود" };

  if (isActive) {
    if (!definition.states.some((state) => state.isInitial)) {
      return { error: "لا يمكن التفعيل: يجب تحديد حالة ابتدائية واحدة على الأقل" };
    }

    await prisma.$transaction([
      prisma.workflowDefinition.updateMany({
        where: { entityType: definition.entityType, id: { not: definitionId } },
        data: { isActive: false },
      }),
      prisma.workflowDefinition.update({
        where: { id: definitionId },
        data: { isActive: true },
      }),
    ]);
  } else {
    await prisma.workflowDefinition.update({
      where: { id: definitionId },
      data: { isActive: false },
    });
  }

  revalidatePath("/dashboard/workflows");
  revalidatePath(`/dashboard/workflows/${definitionId}`);
  return { success: true };
}

const stateSchema = z.object({
  definitionId: z.string().min(1),
  key: z
    .string()
    .min(2, "مفتاح الحالة مطلوب")
    .regex(/^[A-Z][A-Z0-9_]*$/, "المفتاح بحروف إنجليزية كبيرة وشرطة سفلية فقط (مثل: PENDING_APPROVAL)"),
  label: z.string().min(1, "اسم الحالة مطلوب"),
  color: z.enum(["gray", "blue", "amber", "green", "red", "purple"]),
  isInitial: z.coerce.boolean().optional(),
  isFinal: z.coerce.boolean().optional(),
});

export async function createState(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("workflows");

  const parsed = stateSchema.safeParse({
    definitionId: formData.get("definitionId"),
    key: formData.get("key"),
    label: formData.get("label"),
    color: formData.get("color"),
    isInitial: formData.get("isInitial") === "on",
    isFinal: formData.get("isFinal") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { definitionId, isInitial, ...state } = parsed.data;
  const count = await prisma.workflowState.count({ where: { definitionId } });

  try {
    await prisma.$transaction(async (tx) => {
      if (isInitial) {
        await tx.workflowState.updateMany({
          where: { definitionId },
          data: { isInitial: false },
        });
      }
      await tx.workflowState.create({
        data: {
          ...state,
          definitionId,
          isInitial: isInitial ?? false,
          isFinal: state.isFinal ?? false,
          sortOrder: count,
        },
      });
    });
  } catch {
    return { error: "مفتاح الحالة مستخدم مسبقاً في سير العمل هذا" };
  }

  revalidatePath(`/dashboard/workflows/${definitionId}`);
  return { success: true };
}

export async function deleteState(stateId: string): Promise<ActionState> {
  await requireUserAction("workflows");

  const state = await prisma.workflowState.findUnique({
    where: { id: stateId },
    include: { _count: { select: { instances: true } } },
  });
  if (!state) return { error: "الحالة غير موجودة" };

  if (state._count.instances > 0) {
    return { error: "لا يمكن حذف حالة مرتبطة بمستندات قائمة" };
  }

  await prisma.workflowState.delete({ where: { id: stateId } });
  revalidatePath(`/dashboard/workflows/${state.definitionId}`);
  return { success: true };
}

const transitionSchema = z
  .object({
    definitionId: z.string().min(1),
    fromStateId: z.string().min(1, "الحالة المصدر مطلوبة"),
    toStateId: z.string().min(1, "الحالة الهدف مطلوبة"),
    label: z.string().min(1, "اسم الإجراء مطلوب"),
    allowedRoles: z.array(z.enum(Role)).default([]),
    minAmount: z.string().optional(),
    maxAmount: z.string().optional(),
    requiresNote: z.coerce.boolean().optional(),
  })
  .refine((data) => data.fromStateId !== data.toStateId, {
    message: "لا يمكن أن تكون الحالة المصدر هي نفسها الهدف",
  });

export async function createTransition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("workflows");

  const parsed = transitionSchema.safeParse({
    definitionId: formData.get("definitionId"),
    fromStateId: formData.get("fromStateId"),
    toStateId: formData.get("toStateId"),
    label: formData.get("label"),
    allowedRoles: formData.getAll("allowedRoles"),
    minAmount: formData.get("minAmount"),
    maxAmount: formData.get("maxAmount"),
    requiresNote: formData.get("requiresNote") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { definitionId, minAmount, maxAmount, ...transition } = parsed.data;
  const count = await prisma.workflowTransition.count({ where: { definitionId } });
  const min = minAmount?.trim() ? Number(minAmount) : null;
  const max = maxAmount?.trim() ? Number(maxAmount) : null;

  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    return { error: "حدود المبلغ يجب أن تكون أرقاماً" };
  }
  if (min !== null && max !== null && min > max) {
    return { error: "الحد الأدنى للمبلغ أكبر من الحد الأعلى" };
  }

  await prisma.workflowTransition.create({
    data: {
      ...transition,
      definitionId,
      requiresNote: transition.requiresNote ?? false,
      minAmount: min,
      maxAmount: max,
      sortOrder: count,
    },
  });

  revalidatePath(`/dashboard/workflows/${definitionId}`);
  return { success: true };
}

export async function deleteTransition(transitionId: string): Promise<ActionState> {
  await requireUserAction("workflows");

  const transition = await prisma.workflowTransition.findUnique({
    where: { id: transitionId },
    select: { definitionId: true },
  });
  if (!transition) return { error: "الإجراء غير موجود" };

  await prisma.workflowTransition.delete({ where: { id: transitionId } });
  revalidatePath(`/dashboard/workflows/${transition.definitionId}`);
  return { success: true };
}
