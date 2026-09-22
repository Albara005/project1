import Link from "next/link";
import { InvoiceStatus, SalesOrderStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatCurrency, formatNumber, toNumber } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();

  const [
    salesAgg,
    openOrders,
    unpaidInvoices,
    productCount,
    employeeCount,
    pendingLeaves,
    lowStock,
    recentInvoices,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { type: "SALES", status: { not: InvoiceStatus.CANCELLED } },
      _sum: { total: true },
    }),
    prisma.salesOrder.count({
      where: {
        status: { in: [SalesOrderStatus.DRAFT, SalesOrderStatus.PENDING_APPROVAL, SalesOrderStatus.CONFIRMED] },
      },
    }),
    prisma.invoice.findMany({
      where: {
        type: "SALES",
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
      },
      select: { total: true, paidAmount: true },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.product.findMany({
      where: { isActive: true, reorderLevel: { gt: 0 } },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderLevel: true,
        stockItems: { select: { quantity: true } },
      },
      take: 50,
    }),
    prisma.invoice.findMany({
      where: { type: "SALES" },
      orderBy: { issueDate: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        issueDate: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const receivables = unpaidInvoices.reduce(
    (sum, invoice) => sum + toNumber(invoice.total) - toNumber(invoice.paidAmount),
    0,
  );

  const lowStockItems = lowStock
    .map((product) => ({
      ...product,
      onHand: product.stockItems.reduce((sum, item) => sum + toNumber(item.quantity), 0),
    }))
    .filter((product) => product.onHand <= product.reorderLevel);

  const kpis = [
    {
      label: "إجمالي المبيعات",
      value: formatCurrency(toNumber(salesAgg._sum.total)),
      hint: "قيمة كل فواتير المبيعات",
    },
    {
      label: "الذمم المدينة",
      value: formatCurrency(receivables),
      hint: "مبالغ مستحقة على العملاء",
    },
    {
      label: "أوامر بيع مفتوحة",
      value: formatNumber(openOrders, 0),
      hint: "لم تُفوتر بعد",
    },
    {
      label: "منتجات نشطة",
      value: formatNumber(productCount, 0),
      hint: `${lowStockItems.length} منتج بحاجة لإعادة طلب`,
    },
    {
      label: "الموظفون",
      value: formatNumber(employeeCount, 0),
      hint: `${pendingLeaves} طلب إجازة معلّق`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={`مرحباً، ${user.name}`}
        description="نظرة عامة على أداء المنشأة"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="mt-1.5 text-xl font-bold">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أحدث فواتير المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد فواتير بعد
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentInvoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {invoice.customer?.name ?? "—"}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-medium">
                        {formatCurrency(toNumber(invoice.total))}
                      </p>
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
            <CardTitle>تنبيهات المخزون المنخفض</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                كل الأرصدة ضمن الحدود الآمنة
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {lowStockItems.slice(0, 6).map((product) => (
                  <li key={product.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <Badge tone="red">
                      {formatNumber(product.onHand, 0)} / {product.reorderLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئياً",
  PAID: "مدفوعة",
  CANCELLED: "ملغاة",
};
