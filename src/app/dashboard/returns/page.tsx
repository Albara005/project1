import Link from "next/link";
import { ReturnType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  RETURN_TYPE_LABELS,
  type ReturnStatusValue,
} from "./labels";

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const { type } = await searchParams;

  const canSales = canAccessModule(user.role, "sales");
  const canPurchasing = canAccessModule(user.role, "purchasing");

  if (!canSales && !canPurchasing) {
    return (
      <EmptyState
        title="لا تملك صلاحية على المرتجعات"
        description="تحتاج صلاحية المبيعات أو المشتريات لعرض هذه الصفحة."
      />
    );
  }

  // المستخدم يرى فقط أنواع المرتجعات التي يملك صلاحية عليها
  const allowedTypes: ReturnType[] = [
    ...(canSales ? [ReturnType.SALES] : []),
    ...(canPurchasing ? [ReturnType.PURCHASE] : []),
  ];

  const filterType =
    type === "SALES" || type === "PURCHASE"
      ? (type as ReturnType)
      : undefined;

  const typeFilter =
    filterType && allowedTypes.includes(filterType) ? [filterType] : allowedTypes;

  const returns = await prisma.returnNote.findMany({
    where: { type: { in: typeFilter } },
    orderBy: { returnDate: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      type: true,
      status: true,
      returnDate: true,
      total: true,
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      invoice: { select: { id: true, number: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="المرتجعات"
        description="مرتجعات المبيعات تعيد البضاعة للمخزون وتخفّض ذمم العميل، ومرتجعات المشتريات تُخرجها وتخفّض ذمم المورد."
        action={
          <div className="flex gap-2">
            {canSales ? (
              <Link href="/dashboard/returns/new?type=SALES">
                <Button size="sm">مرتجع مبيعات</Button>
              </Link>
            ) : null}
            {canPurchasing ? (
              <Link href="/dashboard/returns/new?type=PURCHASE">
                <Button size="sm" variant="outline">
                  مرتجع مشتريات
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {allowedTypes.length > 1 ? (
        <div className="mb-4 flex gap-2">
          <FilterLink href="/dashboard/returns" label="الكل" active={!filterType} />
          <FilterLink
            href="/dashboard/returns?type=SALES"
            label="مبيعات"
            active={filterType === ReturnType.SALES}
          />
          <FilterLink
            href="/dashboard/returns?type=PURCHASE"
            label="مشتريات"
            active={filterType === ReturnType.PURCHASE}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          {returns.length === 0 ? (
            <EmptyState
              title="لا توجد مرتجعات"
              description="ابدأ بتسجيل مرتجع مبيعات أو مشتريات من الأزرار أعلاه."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>الرقم</TH>
                  <TH>النوع</TH>
                  <TH>الطرف</TH>
                  <TH>الفاتورة الأصلية</TH>
                  <TH>التاريخ</TH>
                  <TH>الإجمالي</TH>
                  <TH>الحالة</TH>
                </TR>
              </THead>
              <TBody>
                {returns.map((note) => (
                  <TR key={note.id}>
                    <TD>
                      <Link
                        href={`/dashboard/returns/${note.id}`}
                        className="font-medium hover:underline"
                      >
                        {note.number}
                      </Link>
                    </TD>
                    <TD className="text-xs">{RETURN_TYPE_LABELS[note.type]}</TD>
                    <TD>{note.customer?.name ?? note.supplier?.name ?? "—"}</TD>
                    <TD className="text-xs">
                      {note.invoice ? (
                        <Link
                          href={`/dashboard/invoices/${note.invoice.id}`}
                          className="hover:underline"
                        >
                          {note.invoice.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(note.returnDate)}
                    </TD>
                    <TD>{formatCurrency(toNumber(note.total))}</TD>
                    <TD>
                      <Badge tone={RETURN_STATUS_TONES[note.status as ReturnStatusValue]}>
                        {RETURN_STATUS_LABELS[note.status as ReturnStatusValue]}
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
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          : "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
      }
    >
      {label}
    </Link>
  );
}
