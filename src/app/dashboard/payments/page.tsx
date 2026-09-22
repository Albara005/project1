import Link from "next/link";
import { PaymentDirection } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
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
import { PAYMENT_DIRECTION_LABELS, PAYMENT_METHOD_LABELS } from "./labels";

export default async function PaymentsPage() {
  await requireModule("sales");

  const payments = await prisma.payment.findMany({
    orderBy: { paidAt: "desc" },
    include: {
      invoice: {
        select: {
          id: true,
          number: true,
          type: true,
          customer: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      },
    },
  });

  const inbound = payments
    .filter((payment) => payment.direction === PaymentDirection.INBOUND)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const outbound = payments
    .filter((payment) => payment.direction === PaymentDirection.OUTBOUND)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return (
    <div>
      <PageHeader
        title="المدفوعات"
        description="سندات القبض والصرف المرتبطة بالفواتير"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">عدد السندات</p>
            <p className="mt-1.5 text-xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">إجمالي المقبوضات</p>
            <p className="mt-1.5 text-xl font-bold">{formatCurrency(inbound)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">إجمالي المدفوعات</p>
            <p className="mt-1.5 text-xl font-bold">{formatCurrency(outbound)}</p>
          </CardContent>
        </Card>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          title="لا توجد مدفوعات"
          description="تُسجَّل الدفعات من صفحة الفاتورة عبر إجراء «تسجيل دفعة»."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>رقم السند</TH>
                  <TH>النوع</TH>
                  <TH>الطريقة</TH>
                  <TH>التاريخ</TH>
                  <TH>الفاتورة</TH>
                  <TH>الطرف</TH>
                  <TH>المرجع</TH>
                  <TH>المبلغ</TH>
                </TR>
              </THead>
              <TBody>
                {payments.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="font-medium">{payment.number}</TD>
                    <TD>
                      <Badge
                        tone={
                          payment.direction === PaymentDirection.INBOUND
                            ? "green"
                            : "amber"
                        }
                      >
                        {PAYMENT_DIRECTION_LABELS[payment.direction]}
                      </Badge>
                    </TD>
                    <TD>{PAYMENT_METHOD_LABELS[payment.method]}</TD>
                    <TD className="text-muted-foreground">
                      {formatDate(payment.paidAt)}
                    </TD>
                    <TD>
                      {payment.invoice ? (
                        <Link
                          href={`/dashboard/invoices/${payment.invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {payment.invoice.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-muted-foreground">
                      {payment.invoice?.customer?.name ??
                        payment.invoice?.supplier?.name ??
                        "—"}
                    </TD>
                    <TD className="text-muted-foreground">
                      {payment.reference ?? "—"}
                    </TD>
                    <TD className="font-medium">
                      {formatCurrency(toNumber(payment.amount))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
