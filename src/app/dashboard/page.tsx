import Link from "next/link";
import { InvoiceStatus, SalesOrderStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  CurrencyError,
  formatMoney,
  getBaseCurrency,
  round2,
  type CurrencyInfo,
} from "@/lib/modules/currency";
import { formatCurrency, formatNumber, toNumber } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { getUserBranchScope } from "@/app/dashboard/reports/branch-scope";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // نطاق العرض: ADMIN ومن لا فرع له يرى المنشأة كاملة، وغيرهما يرى فرعه فقط.
  const scope = await getUserBranchScope(user);
  const branchId = scope.branchId ?? undefined;
  const scopeLabel = scope.branchId ? (scope.branchName ?? "فرعي") : "كل الفروع";

  // عملة الدفاتر — كل مؤشرات لوحة التحكم مجمّعة بها عبر أعمدة base*.
  let baseCurrency: CurrencyInfo | null = null;
  try {
    baseCurrency = await getBaseCurrency();
  } catch (error) {
    if (!(error instanceof CurrencyError)) throw error;
  }

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
    // المبالغ المجمّعة تستخدم دائماً أعمدة عملة الأساس (baseTotal) حتى لا تُجمع
    // فواتير الدولار مع فواتير الريال.
    prisma.invoice.aggregate({
      where: { type: "SALES", status: { not: InvoiceStatus.CANCELLED }, branchId },
      _sum: { baseTotal: true },
    }),
    prisma.salesOrder.count({
      where: {
        status: { in: [SalesOrderStatus.DRAFT, SalesOrderStatus.PENDING_APPROVAL, SalesOrderStatus.CONFIRMED] },
        branchId,
      },
    }),
    prisma.invoice.findMany({
      where: {
        type: "SALES",
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        branchId,
      },
      select: { baseTotal: true, paidAmount: true, exchangeRate: true },
    }),
    prisma.product.count({
      where: {
        isActive: true,
        ...(branchId
          ? { stockItems: { some: { warehouse: { branchId } } } }
          : {}),
      },
    }),
    prisma.employee.count({ where: { status: "ACTIVE", branchId } }),
    prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        ...(branchId ? { employee: { branchId } } : {}),
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, reorderLevel: { gt: 0 } },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderLevel: true,
        stockItems: {
          where: branchId ? { warehouse: { branchId } } : undefined,
          select: { quantity: true },
        },
      },
      take: 50,
    }),
    prisma.invoice.findMany({
      where: { type: "SALES", branchId },
      orderBy: { issueDate: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        total: true,
        baseTotal: true,
        status: true,
        issueDate: true,
        customer: { select: { name: true } },
        currency: { select: { code: true, decimals: true, isBase: true } },
      },
    }),
  ]);

  // المتبقي على العملاء بعملة الدفاتر: المدفوع مسجَّل بعملة الفاتورة، لذلك
  // نحوّله بسعر الصرف المثبّت على الفاتورة نفسها قبل طرحه من الإجمالي الأساسي.
  const receivables = unpaidInvoices.reduce((sum, invoice) => {
    const basePaid = round2(
      toNumber(invoice.paidAmount) * toNumber(invoice.exchangeRate),
    );
    return sum + toNumber(invoice.baseTotal) - basePaid;
  }, 0);

  const lowStockItems = lowStock
    .map((product) => ({
      ...product,
      onHand: product.stockItems.reduce((sum, item) => sum + toNumber(item.quantity), 0),
    }))
    .filter((product) => product.onHand <= product.reorderLevel);

  const kpis = [
    {
      label: "إجمالي المبيعات",
      value: formatCurrency(toNumber(salesAgg._sum.baseTotal)),
      hint: "قيمة كل فواتير المبيعات بعملة الدفاتر",
    },
    {
      label: "الذمم المدينة",
      value: formatCurrency(receivables),
      hint: "مبالغ مستحقة على العملاء بعملة الدفاتر",
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
        description={`نظرة عامة على أداء المنشأة — المبالغ بعملة الدفاتر${baseCurrency ? ` (${baseCurrency.code})` : ""}`}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">نطاق العرض:</span>
            <Badge tone={scope.branchId ? "blue" : "gray"}>{scopeLabel}</Badge>
          </span>
        }
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
                {recentInvoices.map((invoice) => {
                  // المستند يُعرض بعملته، ويُعرض ما يقابله بعملة الدفاتر أسفله.
                  const currency = invoice.currency;
                  const isForeign = Boolean(currency && !currency.isBase);
                  const displayAmount = currency
                    ? formatMoney(toNumber(invoice.total), currency)
                    : formatCurrency(toNumber(invoice.total));

                  return (
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
                        <p className="text-sm font-medium">{displayAmount}</p>
                        {isForeign ? (
                          <p className="text-xs text-muted-foreground">
                            ‎= {formatCurrency(toNumber(invoice.baseTotal))}
                          </p>
                        ) : null}
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
                  );
                })}
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
