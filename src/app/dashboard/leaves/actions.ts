"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EmployeeStatus,
  LeaveStatus,
  WorkflowEntityType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import { applyTransition, startWorkflow, WorkflowError } from "@/lib/workflow";
import { LEAVE_TYPE_VALUES } from "./labels";

export type ActionState = { error?: string; success?: boolean; message?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

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
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .refine((date) => !Number.isNaN(date.getTime()), { message });

const leaveSchema = z.object({
  employeeId: z.string().trim().min(1, "الموظف مطلوب"),
  type: z.enum(LEAVE_TYPE_VALUES),
  startDate: requiredDate("تاريخ بداية الإجازة غير صحيح"),
  endDate: requiredDate("تاريخ نهاية الإجازة غير صحيح"),
  reason: optionalText,
});

/** مفاتيح حالات سير العمل ← عمود الحالة في طلب الإجازة (نفس الأسماء). */
const LEAVE_STATUS_BY_STATE: Record<string, LeaveStatus> = {
  PENDING: LeaveStatus.PENDING,
  APPROVED: LeaveStatus.APPROVED,
  REJECTED: LeaveStatus.REJECTED,
  CANCELLED: LeaveStatus.CANCELLED,
};

/** تاريخ اليوم عند منتصف الليل بتوقيت UTC، ليقارن بتواريخ الإجازات المخزنة بنفس الشكل. */
function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * إنشاء طلب إجازة جديد: يحسب عدد الأيام من المدة (شامل الطرفين)
 * ويبدأ سير العمل الديناميكي في نفس المعاملة.
 */
export async function createLeaveRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("hr");

  const parsed = leaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { employeeId, type, startDate, endDate, reason } = parsed.data;

  if (endDate.getTime() < startDate.getTime()) {
    return { error: "تاريخ النهاية يجب أن يكون في نفس يوم البداية أو بعده" };
  }

  const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) return { error: "الموظف غير موجود" };

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          employeeId,
          type,
          status: LeaveStatus.PENDING,
          startDate,
          endDate,
          days,
          reason,
        },
      });

      await startWorkflow(WorkflowEntityType.LEAVE_REQUEST, request.id, {
        actorId: user.id,
        client: tx,
      });
    });
  } catch {
    return { error: "تعذر إنشاء طلب الإجازة" };
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/employees");
  return { success: true, message: `تم إنشاء طلب الإجازة (${days} يوم)` };
}

/**
 * تنفيذ انتقال سير عمل على طلب إجازة ومزامنة أثره على المستند:
 * تحديث حالة الطلب والمعتمد وتاريخ القرار والملاحظة، وتحويل حالة الموظف
 * إلى "في إجازة" إذا كانت المدة تشمل اليوم.
 */
export async function runLeaveTransition(
  requestId: string,
  transitionId: string,
  note: string,
): Promise<{ error?: string }> {
  const user = await requireUserAction("hr");

  try {
    await prisma.$transaction(async (tx) => {
      const result = await applyTransition({
        entityType: WorkflowEntityType.LEAVE_REQUEST,
        entityId: requestId,
        transitionId,
        role: user.role,
        actorId: user.id,
        note,
        client: tx,
      });

      const nextStatus = LEAVE_STATUS_BY_STATE[result.toStateKey];
      if (!nextStatus) return;

      const trimmedNote = note?.trim() || null;

      const request = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          approverId: user.id,
          decidedAt: new Date(),
          decisionNote: trimmedNote,
        },
        select: { employeeId: true, startDate: true, endDate: true },
      });

      if (nextStatus === LeaveStatus.APPROVED) {
        const today = todayUtc();
        const coversToday =
          request.startDate.getTime() <= today.getTime() &&
          request.endDate.getTime() >= today.getTime();

        if (coversToday) {
          await tx.employee.update({
            where: { id: request.employeeId },
            data: { status: EmployeeStatus.ON_LEAVE },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof WorkflowError) return { error: error.message };
    return { error: "تعذر تنفيذ الإجراء على طلب الإجازة" };
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath(`/dashboard/leaves/${requestId}`);
  revalidatePath("/dashboard/employees");
  return {};
}
