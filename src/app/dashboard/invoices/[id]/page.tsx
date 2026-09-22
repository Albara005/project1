import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, formatNumber, toNumber } from "@/lib/utils";
import {
  Badge,
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
import {
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../payments/labels";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  INVOICE_TYPE_LABELS,
} from "../labels";
import { PaymentForm } from "../payment-form";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("sales");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, code: true, name: true } },
      salesOrder: { select: { id: true, number: true } },
      items: { orderBy: { description: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const total = toNumber(invoice.total);
  const paid = toNumber(invoice.paidAmount);
  const remaining = Math.max(0, Math.round((total - paid + Number.EPSILON) * 100) / 100);
  const party = invoice.customer ?? invoice.supplier;
  const today = new Date().toISOString().slice(0, 10);
  const canPay = invoice.status !== "CANCELLED" && invoice.status !== "DRAFT";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${INVOICE_TYPE_LABELS[invoice.type]} ${invoice.number}`}
        description={party ? party.name : "بدون طرف مرتبط"}
        action={
          <Badge tone={INVOICE_STATUS_TONES[invoice.status]}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>بيانات الفاتورة</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">الطرف</dt>
                  <dd className="font-medium">
                    {invoice.customer ? (
                      <Link
                        href={`/dashboard/customers/${invoice.customer.id}`}
                        className="hover:underline"
                      >
                        {invoice.customer.code} — {invoice.customer.name}
                      </Link>
                    ) : (
                      (invoice.supplier
                        ? `${invoice.supplier.code} — ${invoice.supplier.name}`
                        : "—")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">أمر البيع</dt>
                  <dd className="font-medium">
                    {invoice.salesOrder ? (
                      <Link
                        href={`/dashboard/sales-orders/${invoice.salesOrder.id}`}
                        className="hover:underline"
                      >
                        {invoice.salesOrder.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">تاريخ الإصدار</dt>
                  <dd className="font-medium">{formatDate(invoice.issueDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">تاريخ الاستحقاق</dt>
                  <dd className="font-medium">{formatDate(invoice.dueDate)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">ملاحظات</dt>
                  <dd className="font-medium">{invoice.note ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>بنود الفاتورة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoice.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد بنود في هذه الفاتورة
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>البند</TH>
                      <TH>الكمية</TH>
                      <TH>سعر الوحدة</TH>
                      <TH>الضريبة %</TH>
                      <TH>إجمالي السطر</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {invoice.items.map((item) => (
                      <TR key={item.id}>
                        <TD className="font-medium">{item.description}</TD>
                        <TD>{formatNumber(toNumber(item.quantity), 3)}</TD>
                        <TD>{formatCurrency(toNumber(item.unitPrice))}</TD>
                        <TD>{formatNumber(toNumber(item.taxRate), 2)}%</TD>
                        <TD className="font-medium">
                          {formatCurrency(toNumber(item.lineTotal))}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}

              <div className="space-y-1 border-t border-border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع قبل الضريبة</span>
                  <span>{formatCurrency(toNumber(invoice.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة</span>
                  <span>{formatCurrency(toNumber(invoice.taxAmount))}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المدفوع</span>
                  <span>{formatCurrency(paid)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>المتبقي</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الدفعات المرتبطة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoice.payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لم تُسجَّل أي دفعة على هذه الفاتورة
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>رقم السند</TH>
                      <TH>النوع</TH>
                      <TH>الطريقة</TH>
                      <TH>التاريخ</TH>
                      <TH>المرجع</TH>
                      <TH>المبلغ</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {invoice.payments.map((payment) => (
                      <TR key={payment.id}>
                        <TD className="font-medium">{payment.number}</TD>
                        <TD>
                          <Badge
                            tone={payment.direction === "INBOUND" ? "green" : "amber"}
                          >
                            {PAYMENT_DIRECTION_LABELS[payment.direction]}
                          </Badge>
                        </TD>
                        <TD>{PAYMENT_METHOD_LABELS[payment.method]}</TD>
                        <TD className="text-muted-foreground">
                          {formatDate(payment.paidAt)}
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
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تسجيل دفعة</CardTitle>
          </CardHeader>
          <CardContent>
            {canPay ? (
              <PaymentForm
                invoiceId={invoice.id}
                remaining={remaining}
                today={today}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {invoice.status === "CANCELLED"
                  ? "الفاتورة ملغاة، لا يمكن تسجيل دفعات عليها."
                  : "يجب إصدار الفاتورة قبل تسجيل الدفعات."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
