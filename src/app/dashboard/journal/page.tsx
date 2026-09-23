import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { JournalEntryStatus, JournalSourceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { parseDateParam } from "@/app/dashboard/reports/date-range";
import {
  ALL_BRANCHES_LABEL,
  listBranchOptions,
  resolveBranchParam,
} from "@/app/dashboard/reports/branch-scope";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_STATUS_ORDER,
  ENTRY_STATUS_TONES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ORDER,
  SOURCE_TYPE_TONES,
} from "./labels";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
  status?: string;
  source?: string;
  branch?: string;
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModule("accounting");
  const { from, to, status, source, branch } = await searchParams;

  const fromDate = parseDateParam(from);
  const toDate = parseDateParam(to, true);

  const statusFilter =
    status && status in JournalEntryStatus
      ? (status as JournalEntryStatus)
      : undefined;
  const sourceFilter =
    source && source in JournalSourceType
      ? (source as JournalSourceType)
      : undefined;

  const branches = await listBranchOptions();
  const branchFilter = resolveBranchParam(branch, branches);

  const where: Prisma.JournalEntryWhereInput = {
    entryDate: fromDate || toDate ? { gte: fromDate, lte: toDate } : undefined,
    status: statusFilter,
    sourceType: sourceFilter,
    branchId: branchFilter,
  };

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ entryDate: "desc" }, { number: "desc" }],
    take: 200,
    select: {
      id: true,
      number: true,
      entryDate: true,
      description: true,
      status: true,
      sourceType: true,
      branch: { select: { id: true, name: true } },
      lines: { select: { debit: true } },
    },
  });

  const rows = entries.map((entry) => ({
    ...entry,
    totalDebit: entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0),
  }));

  const grandTotal = rows
    .filter((row) => row.status === JournalEntryStatus.POSTED)
    .reduce((sum, row) => sum + row.totalDebit, 0);

  return (
    <div>
      <PageHeader
        title="القيود المحاسبية"
        description="كل القيود اليدوية والقيود المولّدة تلقائياً من المبيعات والمشتريات والمدفوعات والرواتب."
        action={
          <Link href="/dashboard/journal/new">
            <Button type="button">قيد يدوي جديد</Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <form method="get" className="grid items-end gap-4 md:grid-cols-6">
            <div>
              <Label htmlFor="from">من تاريخ</Label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
            </div>
            <div>
              <Label htmlFor="to">إلى تاريخ</Label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
            </div>
            <div>
              <Label htmlFor="status">الحالة</Label>
              <Select id="status" name="status" defaultValue={statusFilter ?? ""}>
                <option value="">كل الحالات</option>
                {ENTRY_STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {ENTRY_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="source">المصدر</Label>
              <Select id="source" name="source" defaultValue={sourceFilter ?? ""}>
                <option value="">كل المصادر</option>
                {SOURCE_TYPE_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {SOURCE_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="branch">الفرع</Label>
              <Select id="branch" name="branch" defaultValue={branchFilter ?? ""}>
                <option value="">{ALL_BRANCHES_LABEL}</option>
                {branches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">تطبيق الفلتر</Button>
              <Link href="/dashboard/journal">
                <Button type="button" variant="outline">
                  إعادة تعيين
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد قيود مطابقة"
          description="جرّب توسيع نطاق التاريخ أو إنشاء قيد يدوي جديد."
          action={
            <Link href="/dashboard/journal/new">
              <Button type="button">قيد يدوي جديد</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="px-0 pt-5">
            <Table>
              <THead>
                <TR>
                  <TH>رقم القيد</TH>
                  <TH>التاريخ</TH>
                  <TH>البيان</TH>
                  <TH>الفرع</TH>
                  <TH>المصدر</TH>
                  <TH>الحالة</TH>
                  <TH className="text-end">إجمالي المدين</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link
                        href={`/dashboard/journal/${row.id}`}
                        className="font-medium hover:underline"
                        dir="ltr"
                      >
                        {row.number}
                      </Link>
                    </TD>
                    <TD>{formatDate(row.entryDate)}</TD>
                    <TD className="max-w-[28rem] truncate">{row.description}</TD>
                    <TD className="text-muted-foreground">
                      {row.branch?.name ?? "—"}
                    </TD>
                    <TD>
                      <Badge tone={SOURCE_TYPE_TONES[row.sourceType]}>
                        {SOURCE_TYPE_LABELS[row.sourceType]}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={ENTRY_STATUS_TONES[row.status]}>
                        {ENTRY_STATUS_LABELS[row.status]}
                      </Badge>
                    </TD>
                    <TD className="text-end tabular-nums">
                      {formatCurrency(row.totalDebit)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <p className="px-4 pt-4 text-sm text-muted-foreground">
              النطاق:{" "}
              {branchFilter
                ? branches.find((option) => option.id === branchFilter)?.name
                : ALL_BRANCHES_LABEL}{" "}
              — عدد القيود المعروضة: {rows.length} — إجمالي مدين القيود المرحّلة:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(grandTotal)}
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
