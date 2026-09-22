import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowEntityType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { getWorkflowHistory, getWorkflowSnapshot } from "@/lib/workflow";
import { formatDate, formatNumber } from "@/lib/utils";
import { WorkflowPanel } from "@/components/workflow-panel";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { runLeaveTransition } from "../actions";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_TONES, LEAVE_TYPE_LABELS } from "../labels";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONES,
} from "@/app/dashboard/employees/labels";

export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("hr");
  const { id } = await params;

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          status: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      },
      approver: { select: { name: true } },
    },
  });

  if (!request) notFound();

  const [snapshot, history] = await Promise.all([
    getWorkflowSnapshot(WorkflowEntityType.LEAVE_REQUEST, request.id, user.role),
    getWorkflowHistory(WorkflowEntityType.LEAVE_REQUEST, request.id),
  ]);

  const details: { label: string; value: string }[] = [
    { label: "نوع الإجازة", value: LEAVE_TYPE_LABELS[request.type] },
    { label: "من تاريخ", value: formatDate(request.startDate) },
    { label: "إلى تاريخ", value: formatDate(request.endDate) },
    { label: "عدد الأيام", value: `${formatNumber(request.days, 0)} يوم` },
    { label: "تاريخ الطلب", value: formatDate(request.createdAt) },
    { label: "القسم", value: request.employee.department?.name ?? "—" },
    { label: "المسمى الوظيفي", value: request.employee.position?.title ?? "—" },
    { label: "المعتمِد", value: request.approver?.name ?? "—" },
    { label: "تاريخ القرار", value: formatDate(request.decidedAt) },
  ];

  return (
    <div>
      <PageHeader
        title={`طلب إجازة — ${request.employee.firstName} ${request.employee.lastName}`}
        description={`${LEAVE_TYPE_LABELS[request.type]} · ${formatNumber(request.days, 0)} يوم`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={LEAVE_STATUS_TONES[request.status]}>
              {LEAVE_STATUS_LABELS[request.status]}
            </Badge>
            <Link href="/dashboard/leaves">
              <Button variant="outline" size="sm">
                عودة للقائمة
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الطلب</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {details.map((row) => (
                  <div key={row.label} className="rounded-lg bg-muted/40 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {request.reason ? (
                <div className="mt-4 rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">سبب الإجازة</p>
                  <p className="mt-1 text-sm">{request.reason}</p>
                </div>
              ) : null}

              {request.decisionNote ? (
                <div className="mt-3 rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">ملاحظة القرار</p>
                  <p className="mt-1 text-sm">{request.decisionNote}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الموظف</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  href={`/dashboard/employees/${request.employee.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {request.employee.firstName} {request.employee.lastName}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  {request.employee.employeeNo}
                </p>
              </div>
              <Badge tone={EMPLOYEE_STATUS_TONES[request.employee.status]}>
                {EMPLOYEE_STATUS_LABELS[request.employee.status]}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <WorkflowPanel
          snapshot={snapshot}
          history={history}
          onTransition={runLeaveTransition.bind(null, request.id)}
        />
      </div>
    </div>
  );
}
