import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatus, InvoiceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { CustomerForm } from "../customer-form";
import { DeleteCustomerButton } from "../delete-customer-button";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئياً",
  PAID: "مدفوعة",
  CANCELLED: "ملغاة",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("sales");
  const { id } = await params;

  const [customer, balance] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { type: InvoiceType.SALES },
          orderBy: { issueDate: "desc" },
          take: 10,
          select: {
            id: true,
            number: true,
            status: true,
            issueDate: true,
            total: true,
            paidAmount: true,
          },
        },
        salesOrders: {
          orderBy: { orderDate: "desc" },
          take: 10,
          select: { id: true, number: true, status: true, orderDate: true, total: true },
        },
      },
    }),
    // الرصيد المستحق يُحسب على كل فواتير المبيعات غير الملغاة، لا على المعروض فقط
    prisma.invoice.aggregate({
      where: {
        customerId: id,
        type: InvoiceType.SALES,
        status: { not: InvoiceStatus.CANCELLED },
      },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  if (!customer) notFound();

  const outstanding =
    toNumber(balance._sum.total) - toNumber(balance._sum.paidAmount);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={customer.name}
        description={`رمز العميل: ${customer.code} · الرصيد المستحق: ${formatCurrency(outstanding)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CustomerForm
            mode="edit"
            customer={{
              id: customer.id,
              code: customer.code,
              name: customer.name,
              contactName: customer.contactName ?? "",
              phone: customer.phone ?? "",
              email: customer.email ?? "",
              address: customer.address ?? "",
              taxNumber: customer.taxNumber ?? "",
              creditLimit: toNumber(customer.creditLimit),
              isActive: customer.isActive,
            }}
          />

          <div className="mt-4">
            <DeleteCustomerButton customerId={customer.id} />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أحدث الفواتير</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.invoices.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لا توجد فواتير لهذا العميل
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {customer.invoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {invoice.number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(invoice.issueDate)}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-sm">{formatCurrency(toNumber(invoice.total))}</p>
                        <Badge
                          tone={
                            invoice.status === InvoiceStatus.PAID
                              ? "green"
                              : invoice.status === InvoiceStatus.CANCELLED
                                ? "red"
                                : "amber"
                          }
                        >
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>أحدث أوامر البيع</CardTitle>
            </CardHeader>
            <CardContent>
              {customer.salesOrders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لا توجد أوامر بيع لهذا العميل
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {customer.salesOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/sales-orders/${order.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {order.number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.orderDate)}
                        </p>
                      </div>
                      <p className="text-sm">{formatCurrency(toNumber(order.total))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
