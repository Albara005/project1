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
  getBranchScope,
  employeeBranchWhere,
  NO_BRANCH_LABEL,
} from "@/app/dashboard/employees/branch-scope";
import {
  DeleteDepartmentForm,
  DeletePositionForm,
  DepartmentForm,
  PositionForm,
} from "./department-forms";

/** مفتاح مجموعة "بدون فرع" داخل جداول التوزيع. */
const NO_BRANCH_KEY = "__no_branch__";
/** مفتاح مجموعة "بدون قسم" داخل جداول التوزيع. */
const NO_DEPARTMENT_KEY = "__no_department__";

export default async function DepartmentsPage() {
  const user = await requireModule("hr");

  const scope = await getBranchScope(user);
  // المستخدم المقيّد بفرع يرى أعداد فرعه فقط.
  const employeeWhere = employeeBranchWhere(scope.restrictToBranchId);

  const [departments, positions, headcounts, positionCounts] = await Promise.all([
    prisma.department.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { positions: true } },
      },
    }),
    prisma.position.findMany({
      orderBy: { title: "asc" },
      include: {
        department: { select: { name: true } },
      },
    }),
    // توزيع الموظفين على (القسم × الفرع) في استعلام واحد.
    prisma.employee.groupBy({
      by: ["departmentId", "branchId"],
      where: employeeWhere,
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["positionId"],
      where: employeeWhere,
      _count: { _all: true },
    }),
  ]);

  const departmentOptions = departments.map((department) => ({
    id: department.id,
    name: department.name,
  }));

  // الفروع التي يظهر لها عمود: الفروع النشطة الظاهرة للمستخدم فقط.
  const visibleBranches = scope.restrictToBranchId
    ? scope.branches.filter((branch) => branch.id === scope.restrictToBranchId)
    : scope.branches;

  const hasUnassignedBranch = headcounts.some(
    (row) => row.branchId === null && row._count._all > 0,
  );

  const branchColumns: { key: string; name: string }[] = [
    ...visibleBranches.map((branch) => ({ key: branch.id, name: branch.name })),
    ...(hasUnassignedBranch ? [{ key: NO_BRANCH_KEY, name: NO_BRANCH_LABEL }] : []),
  ];

  // خريطة: القسم ← (الفرع ← العدد)، مع مجموع لكل قسم ولكل فرع.
  const byDepartment = new Map<string, Map<string, number>>();
  const branchTotals = new Map<string, number>();
  const departmentTotals = new Map<string, number>();
  let totalEmployees = 0;

  for (const row of headcounts) {
    const departmentKey = row.departmentId ?? NO_DEPARTMENT_KEY;
    const branchKey = row.branchId ?? NO_BRANCH_KEY;
    const count = row._count._all;

    let cells = byDepartment.get(departmentKey);
    if (!cells) {
      cells = new Map<string, number>();
      byDepartment.set(departmentKey, cells);
    }
    cells.set(branchKey, (cells.get(branchKey) ?? 0) + count);

    branchTotals.set(branchKey, (branchTotals.get(branchKey) ?? 0) + count);
    departmentTotals.set(departmentKey, (departmentTotals.get(departmentKey) ?? 0) + count);
    totalEmployees += count;
  }

  const positionEmployeeCounts = new Map<string, number>(
    positionCounts
      .filter((row) => row.positionId !== null)
      .map((row) => [row.positionId as string, row._count._all]),
  );

  const unassignedDepartmentTotal = departmentTotals.get(NO_DEPARTMENT_KEY) ?? 0;

  return (
    <div>
      <PageHeader
        title="الأقسام والمسميات الوظيفية"
        description={`${formatNumber(departments.length, 0)} قسم · ${formatNumber(
          positions.length,
          0,
        )} مسمى وظيفي · ${formatNumber(totalEmployees, 0)} موظف موزّع على الأقسام`}
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>توزيع الموظفين على الفروع</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {branchColumns.length === 0 || totalEmployees === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              لا يوجد موظفون مرتبطون بفروع بعد — حدّد فرع كل موظف من صفحة الموظفين.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>القسم</TH>
                    {branchColumns.map((column) => (
                      <TH key={column.key}>{column.name}</TH>
                    ))}
                    <TH>الإجمالي</TH>
                  </TR>
                </THead>
                <TBody>
                  {departments.map((department) => {
                    const cells = byDepartment.get(department.id);
                    const total = departmentTotals.get(department.id) ?? 0;
                    return (
                      <TR key={department.id}>
                        <TD className="font-medium">
                          {department.name}
                          <p className="font-mono text-xs text-muted-foreground">
                            {department.code}
                          </p>
                        </TD>
                        {branchColumns.map((column) => {
                          const count = cells?.get(column.key) ?? 0;
                          return (
                            <TD key={column.key}>
                              {count > 0 ? (
                                <Link
                                  href={
                                    column.key === NO_BRANCH_KEY
                                      ? "/dashboard/employees"
                                      : `/dashboard/employees?branch=${column.key}`
                                  }
                                  className="hover:underline"
                                >
                                  <Badge tone="blue">{formatNumber(count, 0)}</Badge>
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TD>
                          );
                        })}
                        <TD className="font-medium">{formatNumber(total, 0)}</TD>
                      </TR>
                    );
                  })}

                  {unassignedDepartmentTotal > 0 ? (
                    <TR>
                      <TD className="font-medium text-muted-foreground">بدون قسم</TD>
                      {branchColumns.map((column) => {
                        const count = byDepartment.get(NO_DEPARTMENT_KEY)?.get(column.key) ?? 0;
                        return (
                          <TD key={column.key}>
                            {count > 0 ? (
                              <Badge tone="gray">{formatNumber(count, 0)}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TD>
                        );
                      })}
                      <TD className="font-medium">
                        {formatNumber(unassignedDepartmentTotal, 0)}
                      </TD>
                    </TR>
                  ) : null}

                  <TR className="bg-muted/40">
                    <TD className="font-semibold">الإجمالي</TD>
                    {branchColumns.map((column) => (
                      <TD key={column.key} className="font-semibold">
                        {formatNumber(branchTotals.get(column.key) ?? 0, 0)}
                      </TD>
                    ))}
                    <TD className="font-semibold">{formatNumber(totalEmployees, 0)}</TD>
                  </TR>
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                            <Badge
                              tone={
                                (departmentTotals.get(department.id) ?? 0) > 0 ? "blue" : "gray"
                              }
                            >
                              {formatNumber(departmentTotals.get(department.id) ?? 0, 0)}
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
                          <Badge
                            tone={
                              (positionEmployeeCounts.get(position.id) ?? 0) > 0 ? "blue" : "gray"
                            }
                          >
                            {formatNumber(positionEmployeeCounts.get(position.id) ?? 0, 0)}
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
