import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/app/dashboard/accounts/account-labels";
import { toDateInputValue } from "@/app/dashboard/reports/date-range";
import {
  getUserBranchScope,
  listBranchOptions,
} from "@/app/dashboard/reports/branch-scope";
import { JournalEntryForm } from "../journal-entry-form";

export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage() {
  const user = await requireModule("accounting");

  const [accounts, branches, scope] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true, type: true },
    }),
    listBranchOptions(),
    getUserBranchScope(user),
  ]);

  // الفرع الافتراضي هو فرع المستخدم، و ADMIN (ومن لا فرع له) يمكنه اختيار فرع آخر.
  const defaultBranchId = scope.homeBranchId ?? "";
  const lockedBranchName = scope.canSeeAllBranches
    ? null
    : (branches.find((branch) => branch.id === defaultBranchId)?.name ?? null);

  // نمرّر نصوصاً بسيطة فقط إلى مكوّن العميل (لا نمرّر نماذج Prisma).
  const options = accounts.map((account) => ({
    code: account.code,
    name: account.name,
    typeLabel: ACCOUNT_TYPE_LABELS[account.type],
  }));

  return (
    <div>
      <PageHeader
        title="قيد يدوي جديد"
        description="أدخل سطور القيد. لن يُحفظ القيد إلا إذا تساوى إجمالي المدين مع إجمالي الدائن."
        action={
          <Link href="/dashboard/journal">
            <Button type="button" variant="outline">
              رجوع للقيود
            </Button>
          </Link>
        }
      />

      {options.length === 0 ? (
        <EmptyState
          title="لا توجد حسابات نشطة"
          description="أضف حسابات في دليل الحسابات قبل إنشاء قيد."
          action={
            <Link href="/dashboard/accounts">
              <Button type="button">دليل الحسابات</Button>
            </Link>
          }
        />
      ) : (
        <JournalEntryForm
          accounts={options}
          today={toDateInputValue(new Date())}
          branches={branches}
          defaultBranchId={defaultBranchId}
          canChooseBranch={scope.canSeeAllBranches}
          lockedBranchName={lockedBranchName}
        />
      )}
    </div>
  );
}
