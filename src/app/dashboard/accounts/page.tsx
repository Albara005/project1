import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { AccountForm } from "./account-form";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ORDER,
  ACCOUNT_TYPE_TONES,
} from "./account-labels";
import {
  buildAccountTree,
  collectDescendantIds,
  flattenAccountTree,
  getAccountMovements,
  type AccountInput,
} from "./account-tree";
import { deleteAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  await requireModule("accounting");
  const { edit, error } = await searchParams;

  const [accounts, movements] = await Promise.all([
    prisma.chartOfAccount.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
        description: true,
      },
    }),
    getAccountMovements(),
  ]);

  const inputs: AccountInput[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    parentId: account.parentId,
    isActive: account.isActive,
  }));

  const roots = buildAccountTree(inputs, movements);
  const editingAccount = edit
    ? accounts.find((account) => account.id === edit)
    : undefined;

  // عند التعديل نمنع اختيار الحساب نفسه أو أحد فروعه كحساب أب حتى لا تنشأ دورة.
  const forbiddenParents = editingAccount
    ? collectDescendantIds(inputs, editingAccount.id)
    : new Set<string>();
  const parentOptions = accounts
    .filter((account) => !forbiddenParents.has(account.id))
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
    }));

  const totalAccounts = accounts.length;

  return (
    <div>
      <PageHeader
        title="دليل الحسابات"
        description={`شجرة الحسابات المحاسبية — ${totalAccounts} حساب. الأرصدة محسوبة من القيود المرحّلة فقط.`}
      />

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <AccountForm
        parentOptions={parentOptions}
        editing={
          editingAccount
            ? {
                id: editingAccount.id,
                code: editingAccount.code,
                name: editingAccount.name,
                type: editingAccount.type,
                parentId: editingAccount.parentId,
                description: editingAccount.description,
                isActive: editingAccount.isActive,
              }
            : undefined
        }
      />

      {roots.length === 0 ? (
        <EmptyState
          title="لا توجد حسابات بعد"
          description="ابدأ بإضافة حسابات دليل الحسابات من النموذج أعلاه."
        />
      ) : (
        <div className="space-y-6">
          {ACCOUNT_TYPE_ORDER.map((type) => {
            const groupRoots = roots.filter((node) => node.type === type);
            if (groupRoots.length === 0) return null;

            const rows = flattenAccountTree(groupRoots);
            const groupTotal = groupRoots.reduce(
              (sum, node) => sum + node.totalBalance,
              0,
            );

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <Badge tone={ACCOUNT_TYPE_TONES[type]}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      إجمالي المجموعة: {formatCurrency(groupTotal)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <THead>
                      <TR>
                        <TH>الحساب</TH>
                        <TH>النوع</TH>
                        <TH className="text-end">رصيد الحساب</TH>
                        <TH className="text-end">الرصيد شاملاً الفروع</TH>
                        <TH className="text-end">إجراءات</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {rows.map(({ node, depth }) => (
                        <TR key={node.id}>
                          <TD>
                            <div
                              style={{ paddingInlineStart: depth * 18 }}
                              className="flex flex-wrap items-center gap-2"
                            >
                              {depth > 0 ? (
                                <span className="text-muted-foreground">↳</span>
                              ) : null}
                              <span
                                dir="ltr"
                                className="font-mono text-xs text-muted-foreground"
                              >
                                {node.code}
                              </span>
                              <span
                                className={
                                  depth === 0 ? "font-semibold" : "font-medium"
                                }
                              >
                                {node.name}
                              </span>
                              {!node.isActive ? (
                                <Badge tone="gray">غير نشط</Badge>
                              ) : null}
                            </div>
                          </TD>
                          <TD>
                            <Badge tone={ACCOUNT_TYPE_TONES[node.type]}>
                              {ACCOUNT_TYPE_LABELS[node.type]}
                            </Badge>
                          </TD>
                          <TD className="text-end tabular-nums">
                            {formatCurrency(node.ownBalance)}
                          </TD>
                          <TD className="text-end font-medium tabular-nums">
                            {formatCurrency(node.totalBalance)}
                          </TD>
                          <TD>
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/dashboard/accounts?edit=${node.id}`}>
                                <Button type="button" variant="outline" size="sm">
                                  تعديل
                                </Button>
                              </Link>
                              <form action={deleteAccount}>
                                <input type="hidden" name="id" value={node.id} />
                                <Button type="submit" variant="danger" size="sm">
                                  حذف
                                </Button>
                              </form>
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
