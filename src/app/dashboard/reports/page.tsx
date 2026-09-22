import Link from "next/link";
import { requireModule } from "@/lib/session";
import { ACCOUNT_CODES } from "@/lib/modules/accounting-posting";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_TONES,
} from "@/app/dashboard/accounts/account-labels";
import {
  endOfDay,
  parseDateParam,
  startOfCurrentYear,
  toDateInputValue,
} from "./date-range";
import {
  findBalanceByCode,
  getAccountTotals,
  sumBalances,
  type AccountTotals,
} from "./report-data";

export const dynamic = "force-dynamic";

const EPSILON = 0.005;

function AccountLinesTable({
  rows,
  totalLabel,
  total,
}: {
  rows: AccountTotals[];
  totalLabel: string;
  total: number;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>الحساب</TH>
          <TH className="text-end">الرصيد</TH>
        </TR>
      </THead>
      <TBody>
        {rows.length === 0 ? (
          <TR>
            <TD colSpan={2} className="text-muted-foreground">
              لا توجد حركة خلال الفترة
            </TD>
          </TR>
        ) : (
          rows.map((row) => (
            <TR key={row.id}>
              <TD>
                <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                  {row.code}
                </span>{" "}
                {row.name}
              </TD>
              <TD className="text-end tabular-nums">
                {formatCurrency(row.balance)}
              </TD>
            </TR>
          ))
        )}
        <TR className="bg-muted/50 font-semibold">
          <TD>{totalLabel}</TD>
          <TD className="text-end tabular-nums">{formatCurrency(total)}</TD>
        </TR>
      </TBody>
    </Table>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireModule("accounting");
  const { from, to } = await searchParams;

  const fromDate = parseDateParam(from) ?? startOfCurrentYear();
  const toDate = parseDateParam(to, true) ?? endOfDay();

  // تقارير الفترة (ميزان المراجعة وقائمة الدخل) مقابل الأرصدة التراكمية (الميزانية العمومية).
  const [periodRows, cumulativeRows] = await Promise.all([
    getAccountTotals({ from: fromDate, to: toDate }),
    getAccountTotals({ to: toDate }),
  ]);

  // ---- ميزان المراجعة ----
  const trialDebit = periodRows.reduce((sum, row) => sum + row.debit, 0);
  const trialCredit = periodRows.reduce((sum, row) => sum + row.credit, 0);
  const trialBalanced = Math.abs(trialDebit - trialCredit) < EPSILON;

  // ---- قائمة الدخل (الفترة) ----
  const revenueRows = periodRows.filter((row) => row.type === "REVENUE");
  const expenseRows = periodRows.filter((row) => row.type === "EXPENSE");
  const totalRevenue = sumBalances(periodRows, "REVENUE");
  const totalExpenses = sumBalances(periodRows, "EXPENSE");
  const netIncome = totalRevenue - totalExpenses;

  // ---- الميزانية العمومية (تراكمية حتى تاريخ النهاية) ----
  const assetRows = cumulativeRows.filter((row) => row.type === "ASSET");
  const liabilityRows = cumulativeRows.filter((row) => row.type === "LIABILITY");
  const equityRows = cumulativeRows.filter((row) => row.type === "EQUITY");
  const totalAssets = sumBalances(cumulativeRows, "ASSET");
  const totalLiabilities = sumBalances(cumulativeRows, "LIABILITY");
  const totalEquity = sumBalances(cumulativeRows, "EQUITY");
  const retainedResult =
    sumBalances(cumulativeRows, "REVENUE") - sumBalances(cumulativeRows, "EXPENSE");
  const equationRight = totalLiabilities + totalEquity + retainedResult;
  const equationDiff = totalAssets - equationRight;
  const equationBalanced = Math.abs(equationDiff) < EPSILON;

  // ---- ملخص الذمم ----
  const receivables = findBalanceByCode(cumulativeRows, ACCOUNT_CODES.RECEIVABLES);
  const payables = findBalanceByCode(cumulativeRows, ACCOUNT_CODES.PAYABLES);
  const cash = findBalanceByCode(cumulativeRows, ACCOUNT_CODES.CASH);
  const vat = findBalanceByCode(cumulativeRows, ACCOUNT_CODES.VAT_PAYABLE);

  const summaryCards = [
    {
      label: "الذمم المدينة (العملاء)",
      code: ACCOUNT_CODES.RECEIVABLES,
      value: receivables,
    },
    {
      label: "الذمم الدائنة (الموردون)",
      code: ACCOUNT_CODES.PAYABLES,
      value: payables,
    },
    { label: "النقدية", code: ACCOUNT_CODES.CASH, value: cash },
    {
      label: "ضريبة القيمة المضافة المستحقة",
      code: ACCOUNT_CODES.VAT_PAYABLE,
      value: vat,
    },
  ];

  return (
    <div>
      <PageHeader
        title="التقارير المالية"
        description={`محسوبة من القيود المرحّلة فقط — الفترة من ${formatDate(fromDate)} إلى ${formatDate(toDate)}`}
        action={
          <Link href="/dashboard/journal">
            <Button type="button" variant="outline">
              القيود المحاسبية
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <form method="get" className="grid items-end gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="from">من تاريخ</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={from ?? toDateInputValue(fromDate)}
              />
            </div>
            <div>
              <Label htmlFor="to">إلى تاريخ</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={to ?? toDateInputValue(toDate)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">تحديث التقارير</Button>
              <Link href="/dashboard/reports">
                <Button type="button" variant="outline">
                  السنة الحالية
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.code}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1.5 text-xl font-bold tabular-nums">
                {card.value === null ? "—" : formatCurrency(card.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {card.code}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ------------------------- ميزان المراجعة ------------------------- */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            ميزان المراجعة
            <Badge tone={trialBalanced ? "green" : "red"}>
              {trialBalanced
                ? "متوازن"
                : `غير متوازن — فرق ${formatCurrency(trialDebit - trialCredit)}`}
            </Badge>
          </CardTitle>
          <CardDescription>
            مجاميع المدين والدائن لكل حساب خلال الفترة المختارة.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <TR>
                <TH>الرمز</TH>
                <TH>الحساب</TH>
                <TH>النوع</TH>
                <TH className="text-end">مدين</TH>
                <TH className="text-end">دائن</TH>
                <TH className="text-end">الرصيد</TH>
              </TR>
            </THead>
            <TBody>
              {periodRows.map((row) => (
                <TR key={row.id}>
                  <TD dir="ltr" className="font-mono text-xs text-muted-foreground">
                    {row.code}
                  </TD>
                  <TD className="font-medium">{row.name}</TD>
                  <TD>
                    <Badge tone={ACCOUNT_TYPE_TONES[row.type]}>
                      {ACCOUNT_TYPE_LABELS[row.type]}
                    </Badge>
                  </TD>
                  <TD className="text-end tabular-nums">
                    {formatCurrency(row.debit)}
                  </TD>
                  <TD className="text-end tabular-nums">
                    {formatCurrency(row.credit)}
                  </TD>
                  <TD className="text-end font-medium tabular-nums">
                    {formatCurrency(row.balance)}
                  </TD>
                </TR>
              ))}
              <TR className="bg-muted/50 font-semibold">
                <TD colSpan={3}>الإجمالي</TD>
                <TD className="text-end tabular-nums">
                  {formatCurrency(trialDebit)}
                </TD>
                <TD className="text-end tabular-nums">
                  {formatCurrency(trialCredit)}
                </TD>
                <TD className="text-end tabular-nums">
                  {formatCurrency(trialDebit - trialCredit)}
                </TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------- قائمة الدخل ------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الدخل</CardTitle>
            <CardDescription>
              الإيرادات والمصروفات خلال الفترة المختارة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div>
              <p className="px-5 pb-2 text-sm font-semibold">الإيرادات</p>
              <AccountLinesTable
                rows={revenueRows}
                totalLabel="إجمالي الإيرادات"
                total={totalRevenue}
              />
            </div>
            <div>
              <p className="px-5 pb-2 text-sm font-semibold">المصروفات</p>
              <AccountLinesTable
                rows={expenseRows}
                totalLabel="إجمالي المصروفات"
                total={totalExpenses}
              />
            </div>
            <div className="mx-5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-3">
              <span className="text-sm font-semibold">
                {netIncome >= 0 ? "صافي الربح" : "صافي الخسارة"}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-bold tabular-nums">
                  {formatCurrency(netIncome)}
                </span>
                <Badge tone={netIncome >= 0 ? "green" : "red"}>
                  {netIncome >= 0 ? "ربح" : "خسارة"}
                </Badge>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------- الميزانية العمومية ---------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>الميزانية العمومية</CardTitle>
            <CardDescription>
              الأرصدة التراكمية حتى {formatDate(toDate)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div>
              <p className="px-5 pb-2 text-sm font-semibold">الأصول</p>
              <AccountLinesTable
                rows={assetRows}
                totalLabel="إجمالي الأصول"
                total={totalAssets}
              />
            </div>
            <div>
              <p className="px-5 pb-2 text-sm font-semibold">الخصوم</p>
              <AccountLinesTable
                rows={liabilityRows}
                totalLabel="إجمالي الخصوم"
                total={totalLiabilities}
              />
            </div>
            <div>
              <p className="px-5 pb-2 text-sm font-semibold">حقوق الملكية</p>
              <AccountLinesTable
                rows={equityRows}
                totalLabel="إجمالي حقوق الملكية"
                total={totalEquity}
              />
            </div>

            <div className="mx-5 space-y-2 rounded-lg bg-muted px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>نتيجة الأعمال المرحّلة (إيرادات - مصروفات)</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(retainedResult)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">
                  المعادلة المحاسبية: الأصول = الخصوم + حقوق الملكية + نتيجة
                  الأعمال
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular-nums">
                  {formatCurrency(totalAssets)} = {formatCurrency(equationRight)}
                </span>
                <Badge tone={equationBalanced ? "green" : "red"}>
                  {equationBalanced
                    ? "المعادلة متوازنة"
                    : `فرق ${formatCurrency(equationDiff)}`}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
