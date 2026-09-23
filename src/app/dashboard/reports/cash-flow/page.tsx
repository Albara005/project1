import Link from "next/link";
import { requireModule } from "@/lib/session";
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
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  ALL_BRANCHES_LABEL,
  branchLabel,
  listBranchOptions,
  resolveBranchParam,
} from "../branch-scope";
import {
  endOfDay,
  parseDateParam,
  startOfCurrentYear,
  toDateInputValue,
} from "../date-range";
import {
  getDirectCashFlow,
  getIndirectCashFlow,
  type CashFlowSection,
} from "../cash-flow";

export const dynamic = "force-dynamic";

const EPSILON = 0.005;

const SECTION_TITLES: Record<string, string> = {
  OPERATING: "التدفقات النقدية من الأنشطة التشغيلية",
  INVESTING: "التدفقات النقدية من الأنشطة الاستثمارية",
  FINANCING: "التدفقات النقدية من الأنشطة التمويلية",
};

const SECTION_HINTS: Record<string, string> = {
  OPERATING: "النقد الناتج عن النشاط الجاري: التحصيل من العملاء والسداد للموردين والمصروفات.",
  INVESTING: "شراء الأصول طويلة الأجل أو بيعها.",
  FINANCING: "رأس المال والقروض: ما دخل من الملاك والبنوك وما سُدّد لهم.",
};

function FlowSection({ section }: { section: CashFlowSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_TITLES[section.category] ?? section.category}</CardTitle>
        <CardDescription>{SECTION_HINTS[section.category]}</CardDescription>
      </CardHeader>
      <CardContent>
        {section.lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            لا توجد حركة نقدية في هذا النشاط خلال الفترة
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>البند</TH>
                <TH className="text-end">المبلغ</TH>
              </TR>
            </THead>
            <TBody>
              {section.lines.map((line) => (
                <TR key={line.accountId}>
                  <TD>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.code}
                    </span>{" "}
                    {line.name}
                  </TD>
                  <TD
                    className={`text-end ${line.amount < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"}`}
                  >
                    {formatCurrency(line.amount)}
                  </TD>
                </TR>
              ))}
              <TR className="border-t-2 border-border font-semibold">
                <TD>صافي النشاط</TD>
                <TD className="text-end">{formatCurrency(section.total)}</TD>
              </TR>
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  await requireModule("accounting");
  const { from, to, branch } = await searchParams;

  const fromDate = parseDateParam(from) ?? startOfCurrentYear();
  const toDate = parseDateParam(to, true) ?? endOfDay();

  const branches = await listBranchOptions();
  const branchId = resolveBranchParam(branch, branches);

  const filter = { from: fromDate, to: toDate, branchId: branchId ?? undefined };
  const [direct, indirect] = await Promise.all([
    getDirectCashFlow(filter),
    getIndirectCashFlow(filter),
  ]);

  const reconciled = Math.abs(direct.unreconciled) < EPSILON;
  const methodsAgree =
    Math.abs(indirect.operatingTotal - direct.operating.total) < EPSILON;

  return (
    <div>
      <PageHeader
        title="قائمة التدفقات النقدية"
        description={`الحركة النقدية الفعلية من القيود المرحّلة خلال الفترة، بعملة الدفاتر · ${branchId ? branchLabel(branches, branchId) : ALL_BRANCHES_LABEL}`}
        action={
          <Link href="/dashboard/reports">
            <Button variant="outline" size="sm">
              التقارير المالية
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
            <div>
              <Label htmlFor="branch">الفرع</Label>
              <Select id="branch" name="branch" defaultValue={branchId ?? ""}>
                <option value="">{ALL_BRANCHES_LABEL}</option>
                {branches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">تحديث</Button>
              <Link href="/dashboard/reports/cash-flow">
                <Button type="button" variant="outline">
                  إعادة تعيين
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="نقدية أول المدة" value={direct.openingCash} />
        <SummaryCard
          label="صافي التغيّر في النقدية"
          value={direct.netChange}
          emphasis
        />
        <SummaryCard label="نقدية آخر المدة" value={direct.closingCash} />
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">مطابقة التصنيف</p>
            <div className="mt-1.5">
              <Badge tone={reconciled ? "green" : "red"}>
                {reconciled ? "مطابقة" : `فرق ${formatCurrency(direct.unreconciled)}`}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              مجموع الأنشطة مقابل الحركة الفعلية للنقدية
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <FlowSection section={direct.operating} />
        <FlowSection section={direct.investing} />
        <FlowSection section={direct.financing} />

        <Card>
          <CardHeader>
            <CardTitle>صافي التغيّر في النقدية</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TBody>
                <Row label="الأنشطة التشغيلية" value={direct.operating.total} />
                <Row label="الأنشطة الاستثمارية" value={direct.investing.total} />
                <Row label="الأنشطة التمويلية" value={direct.financing.total} />
                <TR className="border-t-2 border-border font-semibold">
                  <TD>صافي التغيّر خلال الفترة</TD>
                  <TD className="text-end">{formatCurrency(direct.netChange)}</TD>
                </TR>
                <Row label="نقدية أول المدة" value={direct.openingCash} />
                <TR className="border-t-2 border-border text-base font-bold">
                  <TD>نقدية آخر المدة</TD>
                  <TD className="text-end">{formatCurrency(direct.closingCash)}</TD>
                </TR>
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>التسوية بالطريقة غير المباشرة</CardTitle>
            <CardDescription>
              تبدأ من صافي الربح وتُعدّله بالتغيّر في رأس المال العامل للوصول إلى
              النقد التشغيلي. يجب أن يطابق ناتجها النقد التشغيلي بالطريقة المباشرة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TBody>
                <Row label="صافي الربح" value={indirect.netProfit} />
                {indirect.adjustments.map((item) => (
                  <Row key={item.label} label={item.label} value={item.amount} />
                ))}
                <TR className="border-t-2 border-border font-semibold">
                  <TD>النقد التشغيلي (غير مباشر)</TD>
                  <TD className="text-end">
                    {formatCurrency(indirect.operatingTotal)}
                  </TD>
                </TR>
                <TR>
                  <TD className="text-muted-foreground">
                    النقد التشغيلي (مباشر)
                  </TD>
                  <TD className="text-end text-muted-foreground">
                    {formatCurrency(direct.operating.total)}
                  </TD>
                </TR>
              </TBody>
            </Table>

            <div className="mt-4">
              <Badge tone={methodsAgree ? "green" : "red"}>
                {methodsAgree
                  ? "الطريقتان متطابقتان"
                  : `فرق ${formatCurrency(indirect.operatingTotal - direct.operating.total)}`}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        الفترة من {formatDate(fromDate)} إلى {formatDate(toDate)} · تصنيف كل حساب
        (تشغيلي/استثماري/تمويلي) قابل للتعديل من دليل الحسابات.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1.5 text-xl font-bold ${
            emphasis && value < 0 ? "text-red-600" : ""
          }`}
        >
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <TR>
      <TD>{label}</TD>
      <TD
        className={`text-end ${value < 0 ? "text-red-600" : ""}`}
      >
        {formatCurrency(value)}
      </TD>
    </TR>
  );
}
