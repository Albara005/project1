import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, formatNumber, toNumber } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { EmployeeForm } from "../employee-form";
import { DeleteEmployeeForm } from "../delete-employee-form";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_TONES } from "../labels";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_TONES,
  LEAVE_TYPE_LABELS,
} from "@/app/dashboard/leaves/labels";
import {
  PAYSLIP_STATUS_LABELS,
  PAYSLIP_STATUS_TONES,
  periodLabel,
} from "@/app/dashboard/payroll/labels";

function toDateInput(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("hr");
  const { id } = await params;

  const [employee, departments, positions] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { name: true, code: true } },
        position: { select: { title: true } },
        leaveRequests: { orderBy: { startDate: "desc" } },
        payslips: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.position.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, departmentId: true },
    }),
  ]);

  if (!employee) notFound();

  const totalSalary = toNumber(employee.baseSalary) + toNumber(employee.allowances);

  const profileRows: { label: string; value: string; ltr?: boolean }[] = [
    { label: "الرقم الوظيفي", value: employee.employeeNo, ltr: true },
    { label: "البريد الإلكتروني", value: employee.email ?? "—", ltr: true },
    { label: "رقم الجوال", value: employee.phone ?? "—", ltr: true },
    { label: "رقم الهوية", value: employee.nationalId ?? "—", ltr: true },
    { label: "القسم", value: employee.department?.name ?? "—" },
    { label: "المسمى الوظيفي", value: employee.position?.title ?? "—" },
    { label: "تاريخ التعيين", value: formatDate(employee.hireDate) },
    { label: "تاريخ انتهاء الخدمة", value: formatDate(employee.terminationDate) },
    { label: "الراتب الأساسي", value: formatCurrency(toNumber(employee.baseSalary)) },
    { label: "البدلات", value: formatCurrency(toNumber(employee.allowances)) },
    { label: "إجمالي الاستحقاق الشهري", value: formatCurrency(totalSalary) },
  ];

  return (
    <div>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`ملف الموظف — ${employee.employeeNo}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={EMPLOYEE_STATUS_TONES[employee.status]}>
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </Badge>
            <Link href="/dashboard/employees">
              <Button variant="outline" size="sm">
                عودة للقائمة
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>البيانات الأساسية</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {profileRows.map((row) => (
                <div key={row.label} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd
                    className="mt-0.5 text-sm font-medium"
                    dir={row.ltr ? "ltr" : undefined}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ملخص</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">طلبات الإجازة</span>
              <span className="font-medium">{formatNumber(employee.leaveRequests.length, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">مسيّرات الرواتب</span>
              <span className="font-medium">{formatNumber(employee.payslips.length, 0)}</span>
            </div>
            <div className="border-t border-border pt-3">
              <DeleteEmployeeForm employeeId={employee.id} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>تعديل بيانات الموظف</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            departments={departments}
            positions={positions}
            employee={{
              id: employee.id,
              employeeNo: employee.employeeNo,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email ?? "",
              phone: employee.phone ?? "",
              nationalId: employee.nationalId ?? "",
              hireDate: toDateInput(employee.hireDate),
              terminationDate: toDateInput(employee.terminationDate),
              departmentId: employee.departmentId ?? "",
              positionId: employee.positionId ?? "",
              baseSalary: String(toNumber(employee.baseSalary)),
              allowances: String(toNumber(employee.allowances)),
              status: employee.status,
            }}
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>طلبات الإجازة</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {employee.leaveRequests.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                لا توجد طلبات إجازة لهذا الموظف.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>النوع</TH>
                    <TH>من</TH>
                    <TH>إلى</TH>
                    <TH>الأيام</TH>
                    <TH>الحالة</TH>
                  </TR>
                </THead>
                <TBody>
                  {employee.leaveRequests.map((request) => (
                    <TR key={request.id}>
                      <TD>
                        <Link
                          href={`/dashboard/leaves/${request.id}`}
                          className="font-medium hover:underline"
                        >
                          {LEAVE_TYPE_LABELS[request.type]}
                        </Link>
                      </TD>
                      <TD>{formatDate(request.startDate)}</TD>
                      <TD>{formatDate(request.endDate)}</TD>
                      <TD>{formatNumber(request.days, 0)}</TD>
                      <TD>
                        <Badge tone={LEAVE_STATUS_TONES[request.status]}>
                          {LEAVE_STATUS_LABELS[request.status]}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>مسيّرات الرواتب</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {employee.payslips.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                لا توجد مسيّرات رواتب لهذا الموظف.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>الرقم</TH>
                    <TH>الفترة</TH>
                    <TH>الاستقطاعات</TH>
                    <TH>الصافي</TH>
                    <TH>الحالة</TH>
                  </TR>
                </THead>
                <TBody>
                  {employee.payslips.map((payslip) => (
                    <TR key={payslip.id}>
                      <TD className="font-mono text-xs">{payslip.number}</TD>
                      <TD>{periodLabel(payslip.periodYear, payslip.periodMonth)}</TD>
                      <TD>{formatCurrency(toNumber(payslip.deductions))}</TD>
                      <TD className="font-medium">
                        {formatCurrency(toNumber(payslip.netSalary))}
                      </TD>
                      <TD>
                        <Badge tone={PAYSLIP_STATUS_TONES[payslip.status]}>
                          {PAYSLIP_STATUS_LABELS[payslip.status]}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
