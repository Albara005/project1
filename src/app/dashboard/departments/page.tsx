import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatNumber } from "@/lib/utils";
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
  DeleteDepartmentForm,
  DeletePositionForm,
  DepartmentForm,
  PositionForm,
} from "./department-forms";

export default async function DepartmentsPage() {
  await requireModule("hr");

  const [departments, positions] = await Promise.all([
    prisma.department.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { employees: true, positions: true } },
      },
    }),
    prisma.position.findMany({
      orderBy: { title: "asc" },
      include: {
        department: { select: { name: true } },
        _count: { select: { employees: true } },
      },
    }),
  ]);

  const departmentOptions = departments.map((department) => ({
    id: department.id,
    name: department.name,
  }));

  const totalEmployees = departments.reduce(
    (sum, department) => sum + department._count.employees,
    0,
  );

  return (
    <div>
      <PageHeader
        title="الأقسام والمسميات الوظيفية"
        description={`${formatNumber(departments.length, 0)} قسم · ${formatNumber(
          positions.length,
          0,
        )} مسمى وظيفي · ${formatNumber(totalEmployees, 0)} موظف موزّع على الأقسام`}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إضافة قسم</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الأقسام</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {departments.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    title="لا توجد أقسام بعد"
                    description="أضف أول قسم من النموذج بالأعلى."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>الرمز</TH>
                      <TH>الاسم</TH>
                      <TH>عدد الموظفين</TH>
                      <TH>المسميات</TH>
                      <TH> </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {departments.map((department) => (
                      <TR key={department.id}>
                        <TD className="font-mono text-xs">{department.code}</TD>
                        <TD className="font-medium">{department.name}</TD>
                        <TD>
                          <Link
                            href={`/dashboard/employees?q=${encodeURIComponent(department.name)}`}
                            className="hover:underline"
                          >
                            <Badge tone={department._count.employees > 0 ? "blue" : "gray"}>
                              {formatNumber(department._count.employees, 0)}
                            </Badge>
                          </Link>
                        </TD>
                        <TD>{formatNumber(department._count.positions, 0)}</TD>
                        <TD className="text-end">
                          <DeleteDepartmentForm departmentId={department.id} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إضافة مسمى وظيفي</CardTitle>
            </CardHeader>
            <CardContent>
              <PositionForm departments={departmentOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>المسميات الوظيفية</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {positions.length === 0 ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    title="لا توجد مسميات وظيفية بعد"
                    description="أضف أول مسمى وظيفي من النموذج بالأعلى."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>المسمى</TH>
                      <TH>القسم</TH>
                      <TH>عدد الموظفين</TH>
                      <TH> </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {positions.map((position) => (
                      <TR key={position.id}>
                        <TD className="font-medium">{position.title}</TD>
                        <TD>{position.department?.name ?? "—"}</TD>
                        <TD>
                          <Badge tone={position._count.employees > 0 ? "blue" : "gray"}>
                            {formatNumber(position._count.employees, 0)}
                          </Badge>
                        </TD>
                        <TD className="text-end">
                          <DeletePositionForm positionId={position.id} />
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
    </div>
  );
}
