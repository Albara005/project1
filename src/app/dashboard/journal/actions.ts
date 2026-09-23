"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { JournalEntryStatus, JournalSourceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  PostingError,
  postJournalEntry,
} from "@/lib/modules/accounting-posting";
import { requireUserAction, type CurrentUser } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { getUserBranchScope } from "@/app/dashboard/reports/branch-scope";

export type ActionState = { error?: string; success?: boolean };

const lineSchema = z.object({
  accountCode: z.string().trim().default(""),
  debit: z.number().nonnegative("لا يمكن إدخال مبالغ سالبة").default(0),
  credit: z.number().nonnegative("لا يمكن إدخال مبالغ سالبة").default(0),
  description: z.string().trim().optional(),
});

const linesSchema = z.array(lineSchema);

const entrySchema = z.object({
  entryDate: z.string().trim().min(1, "تاريخ القيد مطلوب"),
  description: z.string().trim().min(1, "بيان القيد مطلوب"),
  lines: z.string().min(1, "أضف سطور القيد"),
  branchId: z.string().trim().optional(),
});

/**
 * الفرع الذي يُرحّل عليه القيد: المستخدم المقيّد بفرع لا يستطيع الترحيل على غيره،
 * بينما يختار ADMIN (ومن لا فرع له) أي فرع نشط أو يتركه بدون فرع.
 */
async function resolveEntryBranch(
  user: CurrentUser,
  requested: string | undefined,
): Promise<{ branchId: string | null } | { error: string }> {
  const scope = await getUserBranchScope(user);

  if (!scope.canSeeAllBranches) {
    return { branchId: scope.branchId };
  }

  const value = requested?.trim() ?? "";
  if (value === "") return { branchId: null };

  const branch = await prisma.branch.findFirst({
    where: { id: value, isActive: true },
    select: { id: true },
  });
  if (!branch) return { error: "الفرع المحدد غير موجود أو غير نشط" };

  return { branchId: branch.id };
}

/** إنشاء قيد يدوي مرحّل عبر خدمة الترحيل المشتركة (تتحقق من توازن القيد). */
export async function createManualEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("accounting");

  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const entryDate = new Date(parsed.data.entryDate);
  if (Number.isNaN(entryDate.getTime())) {
    return { error: "تاريخ القيد غير صحيح" };
  }

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(parsed.data.lines);
  } catch {
    return { error: "تعذر قراءة سطور القيد" };
  }

  const parsedLines = linesSchema.safeParse(rawLines);
  if (!parsedLines.success) {
    return {
      error: parsedLines.error.issues[0]?.message ?? "سطور القيد غير صحيحة",
    };
  }

  // نتجاهل الأسطر الفارغة تماماً، ثم نتحقق من باقي الأسطر.
  const lines = parsedLines.data.filter(
    (line) => line.debit > 0 || line.credit > 0 || line.accountCode !== "",
  );

  if (lines.length < 2) {
    return { error: "القيد يحتاج سطرين على الأقل" };
  }
  if (lines.some((line) => line.accountCode === "")) {
    return { error: "اختر الحساب لكل سطر من سطور القيد" };
  }
  if (lines.some((line) => line.debit > 0 && line.credit > 0)) {
    return { error: "لا يمكن إدخال مدين ودائن في نفس السطر" };
  }
  if (lines.some((line) => line.debit === 0 && line.credit === 0)) {
    return { error: "أدخل مبلغاً مديناً أو دائناً لكل سطر" };
  }

  const branch = await resolveEntryBranch(user, parsed.data.branchId);
  if ("error" in branch) return { error: branch.error };

  let entryId = "";
  try {
    const entry = await prisma.$transaction((tx) =>
      postJournalEntry(tx, {
        description: parsed.data.description,
        entryDate,
        sourceType: JournalSourceType.MANUAL,
        createdById: user.id,
        branchId: branch.branchId,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          debit: line.debit,
          credit: line.credit,
          description: line.description || undefined,
        })),
      }),
    );
    entryId = entry.id;
  } catch (error) {
    if (error instanceof PostingError) return { error: error.message };
    return { error: "تعذر حفظ القيد، يرجى المحاولة مرة أخرى" };
  }

  revalidatePath("/dashboard/journal");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  redirect(`/dashboard/journal/${entryId}`);
}

/** عكس قيد مرحّل: ينشئ قيداً معاكساً ويحوّل القيد الأصلي إلى حالة "معكوس". */
export async function reverseEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUserAction("accounting");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "القيد غير محدد" };

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id },
        include: {
          lines: { include: { account: { select: { code: true } } } },
        },
      });

      if (!entry) throw new PostingError("القيد غير موجود");
      if (entry.status !== JournalEntryStatus.POSTED) {
        throw new PostingError("لا يمكن عكس إلا القيود المرحّلة");
      }

      await postJournalEntry(tx, {
        description: `عكس قيد ${entry.number} — ${entry.description}`,
        entryDate: new Date(),
        sourceType: JournalSourceType.MANUAL,
        createdById: user.id,
        // القيد العكسي يبقى على نفس فرع القيد الأصلي حتى تتطابق تقارير الفروع.
        branchId: entry.branchId,
        lines: entry.lines.map((line) => ({
          accountCode: line.account.code,
          debit: toNumber(line.credit),
          credit: toNumber(line.debit),
          description: line.description ?? undefined,
        })),
      });

      await tx.journalEntry.update({
        where: { id },
        data: { status: JournalEntryStatus.REVERSED },
      });
    });
  } catch (error) {
    if (error instanceof PostingError) return { error: error.message };
    return { error: "تعذر عكس القيد، يرجى المحاولة مرة أخرى" };
  }

  revalidatePath("/dashboard/journal");
  revalidatePath(`/dashboard/journal/${id}`);
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  return { success: true };
}
