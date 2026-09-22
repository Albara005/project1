import Link from "next/link";
import { PayslipStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, formatNumber, toNumber } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  ApprovePayslipForm,
  PayPeriodForm,
  PayrollRunForm,
  PayslipDeductionsForm,
} from "./payroll-forms";
import { PAYSLIP_STATUS_LABELS, PAYSLIP_STATUS_TONES, periodLabel } from "./labels";

type PayslipRow = {
  id: string;
  number: string;
  status: PayslipStatus;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paidAt: Date | null;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
};

type PeriodGroup = {
  key: string;
  periodYear: number;
  periodMonth: number;
  rows: PayslipRow[];
  totalNet: number;
  totalDeductions: number;
  approvedCount: number;
  draftCount: number;
  paidCount: number;
};

export default async function PayrollPage() {
  await requireModule("hr");

  const payslips = await prisma.payslip.findMany({
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { number: "asc" }],
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeNo: true },
      },
    },
  });

  const groups = new Map<string, PeriodGroup>();

  for (const payslip of payslips) {
    const key = `${payslip.periodYear}-${payslip.periodMonth}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        periodYear: payslip.periodYear,
        periodMonth: payslip.periodMonth,
        rows: [],
        totalNet: 0,
        totalDeductions: 0,
        approvedCount: 0,
        draftCount: 0,
        paidCount: 0,
      };
      groups.set(key, group);
    }

    const netSalary = toNumber(payslip.netSalary);
    const deductions = toNumber(payslip.deductions);

    group.rows.push({
      id: payslip.id,
      number: payslip.number,
      status: payslip.status,
      baseSalary: toNumber(payslip.baseSalary),
      allowances: toNumber(payslip.allowances),
      deductions,
      netSalary,
      paidAt: payslip.paidAt,
      employeeId: payslip.employee.id,
      employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
      employeeNo: payslip.employee.employeeNo,
    });

    group.totalNet += netSalary;
    group.totalDeductions += deductions;
    if (payslip.status === PayslipStatus.APPROVED) group.approvedCount += 1;
    if (payslip.status === PayslipStatus.DRAFT) group.draftCount += 1;
    if (payslip.status === PayslipStatus.PAID) group.paidCount += 1;
  }

  const periods = Array.from(groups.values());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div>
      <PageHeader
        title="الرواتب"
        description="تشغيل مسيّرات الرواتب الشهرية واعتمادها وصرفها مع ترحيل قيد محاسبي مجمّع لكل فترة."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>تشغيل الرواتب</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollRunForm
            years={years}
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            يُنشأ مسيّر بحالة مسودة لكل موظف على رأس العمل لا يملك مسيّراً لنفس الفترة.
            صافي الراتب = الراتب الأساسي + البدلات − الاستقطاعات.
          </p>
        </CardContent>
      </Card>

      {periods.length === 0 ? (
        <EmptyState
          title="لا توجد مسيّرات رواتب بعد"
          description="اختر السنة والشهر ثم اضغط «تشغيل الرواتب» لإنشاء مسيّرات الفترة."
        />
      ) : (
        <div className="space-y-4">
          {periods.map((period) => (
            <Card key={period.key}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{periodLabel(period.periodYear, period.periodMonth)}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(period.rows.length, 0)} مسيّر · إجمالي الصافي{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(period.totalNet)}
                    </span>{" "}
                    · الاستقطاعات {formatCurrency(period.totalDeductions)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {period.draftCount > 0 ? (
                      <Badge tone="gray">
                        {PAYSLIP_STATUS_LABELS.DRAFT}: {formatNumber(period.draftCount, 0)}
                      </Badge>
                    ) : null}
                    {period.approvedCount > 0 ? (
                      <Badge tone="blue">
                        {PAYSLIP_STATUS_LABELS.APPROVED}: {formatNumber(period.approvedCount, 0)}
                      </Badge>
                    ) : null}
                    {period.paidCount > 0 ? (
                      <Badge tone="green">
                        {PAYSLIP_STATUS_LABELS.PAID}: {formatNumber(period.paidCount, 0)}
                      </Badge>
                    ) : null}
                  </p>
                </div>
                <PayPeriodForm
                  periodYear={period.periodYear}
                  periodMonth={period.periodMonth}
                  disabled={period.approvedCount === 0}
                />
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <Table>
                  <THead>
                    <TR>
                      <TH>الرقم</TH>
                      <TH>الموظف</TH>
                      <TH>الراتب الأساسي</TH>
                      <TH>البدلات</TH>
                      <TH>الاستقطاعات</TH>
                      <TH>صافي الراتب</TH>
                      <TH>الحالة</TH>
                      <TH>إجراءات</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {period.rows.map((row) => (
                      <TR key={row.id}>
                        <TD className="font-mono text-xs">{row.number}</TD>
                        <TD>
                          <Link
                            href={`/dashboard/employees/${row.employeeId}`}
                            className="font-medium hover:underline"
                          >
                            {row.employeeName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.employeeNo}
                          </p>
                        </TD>
                        <TD>{formatCurrency(row.baseSalary)}</TD>
                        <TD>{formatCurrency(row.allowances)}</TD>
                        <TD>
                          {row.status === PayslipStatus.DRAFT ? (
                            <PayslipDeductionsForm
                              payslipId={row.id}
                              deductions={row.deductions}
                            />
                          ) : (
                            formatCurrency(row.deductions)
                          )}
                        </TD>
                        <TD className="font-medium">{formatCurrency(row.netSalary)}</TD>
                        <TD>
                          <Badge tone={PAYSLIP_STATUS_TONES[row.status]}>
                            {PAYSLIP_STATUS_LABELS[row.status]}
                          </Badge>
                          {row.paidAt ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(row.paidAt)}
                            </p>
                          ) : null}
                        </TD>
                        <TD>
                          {row.status === PayslipStatus.DRAFT ? (
                            <ApprovePayslipForm payslipId={row.id} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
