"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EmployeeStatus, PayslipStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import {
  nextDocumentNumber,
  postPayrollEntry,
  PostingError,
} from "@/lib/modules/accounting-posting";
import { round2 } from "@/lib/modules/currency";
import {
  branchName,
  getBranchScope,
  validateBranchId,
  type BranchScope,
} from "@/app/dashboard/employees/branch-scope";
import { toNumber } from "@/lib/utils";

export type ActionState = { error?: string; success?: boolean; message?: string };

/** خطأ تشغيلي داخلي لإلغاء المعاملة برسالة عربية واضحة (غير مُصدَّر: ملف "use server"). */
class PayrollError extends Error {}

const numeric = (message: string, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => Number((value ?? "").trim()))
    .refine(
      (amount) => Number.isInteger(amount) && amount >= min && amount <= max,
      { message },
    );

const money = (message: string) =>
  z
    .string()
    .optional()
    .transform((value) => Number((value ?? "").trim() || "0"))
    .refine((amount) => Number.isFinite(amount) && amount >= 0, { message });

const periodSchema = z.object({
  periodYear: numeric("سنة غير صحيحة", 2000, 2100),
  periodMonth: numeric("شهر غير صحيح", 1, 12),
});

const deductionsSchema = z.object({
  payslipId: z.string().trim().min(1, "المسيّر غير محدد"),
  deductions: money("قيمة الاستقطاعات غير صحيحة"),
});

function revalidatePayroll() {
  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/employees");
}

/**
 * تشغيل الرواتب لفترة (سنة/شهر): ينشئ مسيّراً بحالة "مسودة" لكل موظف على رأس العمل
 * لا يملك مسيّراً لنفس الفترة. القيد الفريد (employeeId, periodYear, periodMonth)
 * يمنع التكرار، ونتعامل مع التعارض برسالة واضحة بدل الانهيار.
 */
export async function runPayroll(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const parsed = periodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { periodYear, periodMonth } = parsed.data;

  let created = 0;

  try {
    created = await prisma.$transaction(async (tx) => {
      const employees = await tx.employee.findMany({
        where: { status: EmployeeStatus.ACTIVE },
        orderBy: { employeeNo: "asc" },
        select: { id: true, baseSalary: true, allowances: true },
      });

      const existing = await tx.payslip.findMany({
        where: { periodYear, periodMonth },
        select: { employeeId: true },
      });
      const alreadyPaid = new Set(existing.map((payslip) => payslip.employeeId));

      let count = 0;
      for (const employee of employees) {
        if (alreadyPaid.has(employee.id)) continue;

        const baseSalary = toNumber(employee.baseSalary);
        const allowances = toNumber(employee.allowances);
        const deductions = 0;
        const number = await nextDocumentNumber(tx, "payslip", "PAY");

        await tx.payslip.create({
          data: {
            number,
            employeeId: employee.id,
            periodYear,
            periodMonth,
            baseSalary: new Prisma.Decimal(baseSalary),
            allowances: new Prisma.Decimal(allowances),
            deductions: new Prisma.Decimal(deductions),
            netSalary: new Prisma.Decimal(baseSalary + allowances - deductions),
            status: PayslipStatus.DRAFT,
          },
        });
        count += 1;
      }

      return count;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "توجد مسيّرات لهذه الفترة بالفعل — لم يتم إنشاء أي مسيّر جديد" };
    }
    return { error: "تعذر تشغيل الرواتب لهذه الفترة" };
  }

  revalidatePayroll();

  if (created === 0) {
    return {
      success: true,
      message: "لا توجد مسيّرات جديدة: كل الموظفين على رأس العمل لديهم مسيّر لهذه الفترة",
    };
  }

  return { success: true, message: `تم إنشاء ${created} مسيّر راتب بحالة مسودة` };
}

/** تعديل استقطاعات مسيّر بحالة مسودة وإعادة احتساب الصافي. */
export async function updatePayslipDeductions(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const parsed = deductionsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { payslipId, deductions } = parsed.data;

  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    select: { status: true, baseSalary: true, allowances: true },
  });

  if (!payslip) return { error: "المسيّر غير موجود" };
  if (payslip.status !== PayslipStatus.DRAFT) {
    return { error: "لا يمكن تعديل مسيّر بعد اعتماده" };
  }

  const gross = toNumber(payslip.baseSalary) + toNumber(payslip.allowances);
  if (deductions > gross) {
    return { error: "الاستقطاعات تتجاوز إجمالي الاستحقاق" };
  }

  try {
    await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        deductions: new Prisma.Decimal(deductions),
        netSalary: new Prisma.Decimal(gross - deductions),
      },
    });
  } catch {
    return { error: "تعذر حفظ الاستقطاعات" };
  }

  revalidatePayroll();
  return { success: true, message: "تم تحديث الاستقطاعات" };
}

/** اعتماد مسيّر: مسودة ← معتمد. */
export async function approvePayslip(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("hr");

  const payslipId = String(formData.get("payslipId") ?? "").trim();
  if (!payslipId) return { error: "المسيّر غير محدد" };

  const result = await prisma.payslip.updateMany({
    where: { id: payslipId, status: PayslipStatus.DRAFT },
    data: { status: PayslipStatus.APPROVED },
  });

  if (result.count === 0) {
    return { error: "لا يمكن اعتماد هذا المسيّر — تأكد أنه ما زال مسودة" };
  }

  revalidatePayroll();
  return { success: true, message: "تم اعتماد المسيّر" };
}

/**
 * صرف رواتب فترة معتمدة: يحوّل مسيّرات الفترة المعتمدة إلى "مدفوع"
 * ويُرحّل قيداً محاسبياً واحداً مجمّعاً بإجمالي صافي الرواتب — كل ذلك في معاملة واحدة.
 */
export async function payPeriod(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("hr");

  const parsed = periodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const { periodYear, periodMonth } = parsed.data;

  let totalNet = 0;
  let paidCount = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payslips = await tx.payslip.findMany({
        where: { periodYear, periodMonth, status: PayslipStatus.APPROVED },
        select: { id: true, netSalary: true },
      });

      if (payslips.length === 0) {
        throw new PayrollError("لا توجد مسيّرات معتمدة قابلة للصرف في هذه الفترة");
      }

      const total = payslips.reduce(
        (sum, payslip) => sum + toNumber(payslip.netSalary),
        0,
      );

      await tx.payslip.updateMany({
        where: { id: { in: payslips.map((payslip) => payslip.id) } },
        data: { status: PayslipStatus.PAID, paidAt: new Date() },
      });

      await postPayrollEntry(tx, {
        description: `رواتب شهر ${periodMonth}/${periodYear}`,
        amount: total,
        createdById: user.id,
      });

      return { total, count: payslips.length };
    });

    totalNet = result.total;
    paidCount = result.count;
  } catch (error) {
    if (error instanceof PayrollError) return { error: error.message };
    if (error instanceof PostingError) return { error: error.message };
    return { error: "تعذر صرف رواتب هذه الفترة" };
  }

  revalidatePayroll();
  revalidatePath("/dashboard/journal");

  return {
    success: true,
    message: `تم صرف ${paidCount} مسيّر بإجمالي ${totalNet.toFixed(2)} وترحيل قيد الرواتب`,
  };
}
