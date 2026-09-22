import Link from "next/link";
import { Prisma } from "@/generated/prisma";
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
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { EmployeeForm } from "./employee-form";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_TONES } from "./labels";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireModule("hr");

  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const where: Prisma.EmployeeWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { employeeNo: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [employees, departments, positions] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { employeeNo: "asc" },
      include: {
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.position.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, departmentId: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="الموظفون"
        description="بيانات الموظفين والرواتب الأساسية والبدلات"
      />

      <Card className="mb-4">
        <CardContent className="pt-5">
          <details>
            <summary className="cursor-pointer list-none text-sm font-semibold text-primary">
              + إضافة موظف جديد
            </summary>
            <div className="mt-4 border-t border-border pt-4">
              <EmployeeForm departments={departments} positions={positions} />
            </div>
          </details>
        </CardContent>
      </Card>

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/dashboard/employees">
        <div className="min-w-56 flex-1">
          <Input
            name="q"
            defaultValue={search}
            placeholder="بحث بالاسم أو الرقم الوظيفي"
            aria-label="بحث عن موظف"
          />
        </div>
        <Button type="submit" variant="secondary">
          بحث
        </Button>
        {search ? (
          <Link href="/dashboard/employees">
            <Button type="button" variant="ghost">
              مسح
            </Button>
          </Link>
        ) : null}
      </form>

      {employees.length === 0 ? (
        <EmptyState
          title={search ? "لا توجد نتائج مطابقة" : "لا يوجد موظفون بعد"}
          description={
            search
              ? "جرّب البحث باسم آخر أو امسح كلمة البحث."
              : "أضف أول موظف من نموذج الإضافة بالأعلى."
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>الرقم الوظيفي</TH>
                <TH>الاسم</TH>
                <TH>القسم</TH>
                <TH>المسمى الوظيفي</TH>
                <TH>تاريخ التعيين</TH>
                <TH>الراتب الأساسي</TH>
                <TH>البدلات</TH>
                <TH>الحالة</TH>
              </TR>
            </THead>
            <TBody>
              {employees.map((employee) => (
                <TR key={employee.id}>
                  <TD className="font-mono text-xs">{employee.employeeNo}</TD>
                  <TD>
                    <Link
                      href={`/dashboard/employees/${employee.id}`}
                      className="font-medium hover:underline"
                    >
                      {employee.firstName} {employee.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {employee.email ?? employee.phone ?? "—"}
                    </p>
                  </TD>
                  <TD>{employee.department?.name ?? "—"}</TD>
                  <TD>{employee.position?.title ?? "—"}</TD>
                  <TD>{formatDate(employee.hireDate)}</TD>
                  <TD>{formatCurrency(toNumber(employee.baseSalary))}</TD>
                  <TD>{formatCurrency(toNumber(employee.allowances))}</TD>
                  <TD>
                    <Badge tone={EMPLOYEE_STATUS_TONES[employee.status]}>
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
