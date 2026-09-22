import Link from "next/link";
import { LeaveStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, formatNumber } from "@/lib/utils";
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
import { LeaveForm } from "./leave-form";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONES, LEAVE_TYPE_LABELS } from "./labels";

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "الكل" },
  { key: "PENDING", label: LEAVE_STATUS_LABELS.PENDING },
  { key: "APPROVED", label: LEAVE_STATUS_LABELS.APPROVED },
  { key: "REJECTED", label: LEAVE_STATUS_LABELS.REJECTED },
  { key: "CANCELLED", label: LEAVE_STATUS_LABELS.CANCELLED },
];

function isLeaveStatus(value: string): value is LeaveStatus {
  return value in LEAVE_STATUS_LABELS;
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireModule("hr");

  const { status } = await searchParams;
  const selected = (status ?? "").trim();

  const where: Prisma.LeaveRequestWhereInput = isLeaveStatus(selected)
    ? { status: selected }
    : {};

  const [requests, employees] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
    }),
    prisma.employee.findMany({
      where: { status: { not: "TERMINATED" } },
      orderBy: { employeeNo: "asc" },
      select: { id: true, firstName: true, lastName: true, employeeNo: true },
    }),
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.employeeNo} — ${employee.firstName} ${employee.lastName}`,
  }));

  return (
    <div>
      <PageHeader
        title="طلبات الإجازات"
        description="الطلبات تُدار عبر محرك سير العمل الديناميكي: الموافقة والرفض والإلغاء تأتي من تعريف سير العمل."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>طلب إجازة جديد</CardTitle>
        </CardHeader>
        <CardContent>
          {employeeOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              أضف موظفين أولاً من صفحة الموظفين لتتمكن من تسجيل طلبات الإجازات.
            </p>
          ) : (
            <LeaveForm employees={employeeOptions} />
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = selected === filter.key;
          return (
            <Link
              key={filter.key || "all"}
              href={filter.key ? `/dashboard/leaves?status=${filter.key}` : "/dashboard/leaves"}
              className={
                isActive
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات إجازة"
          description="أنشئ أول طلب إجازة من النموذج بالأعلى."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>الموظف</TH>
                <TH>النوع</TH>
                <TH>من</TH>
                <TH>إلى</TH>
                <TH>الأيام</TH>
                <TH>تاريخ الطلب</TH>
                <TH>الحالة</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((request) => (
                <TR key={request.id}>
                  <TD>
                    <Link
                      href={`/dashboard/leaves/${request.id}`}
                      className="font-medium hover:underline"
                    >
                      {request.employee.firstName} {request.employee.lastName}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {request.employee.employeeNo}
                    </p>
                  </TD>
                  <TD>{LEAVE_TYPE_LABELS[request.type]}</TD>
                  <TD>{formatDate(request.startDate)}</TD>
                  <TD>{formatDate(request.endDate)}</TD>
                  <TD>{formatNumber(request.days, 0)}</TD>
                  <TD>{formatDate(request.createdAt)}</TD>
                  <TD>
                    <Badge tone={LEAVE_STATUS_TONES[request.status]}>
                      {LEAVE_STATUS_LABELS[request.status]}
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
