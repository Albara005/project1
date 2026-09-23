import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowEntityType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, formatNumber, toNumber } from "@/lib/utils";
import { formatMoney, getBaseCurrency } from "@/lib/modules/currency";
import { getWorkflowHistory, getWorkflowSnapshot } from "@/lib/workflow";
import { WorkflowPanel } from "@/components/workflow-panel";
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
import { CurrencyNote, Money } from "../../invoices/document-money";
import { runSalesOrderTransition } from "../actions";
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_STATUS_TONES } from "../status";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("sales");
  const { id } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      warehouse: { select: { name: true, code: true } },
      branch: { select: { code: true, name: true } },
      currency: { select: { code: true, decimals: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      invoices: {
        select: {
          id: true,
          number: true,
          total: true,
          baseTotal: true,
          exchangeRate: true,
          issueDate: true,
          status: true,
          currency: { select: { code: true, decimals: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const [snapshot, history, baseCurrency] = await Promise.all([
    getWorkflowSnapshot(WorkflowEntityType.SALES_ORDER, order.id, user.role),
    getWorkflowHistory(WorkflowEntityType.SALES_ORDER, order.id),
    getBaseCurrency(),
  ]);

  // عملة المستند تُستخدم للعرض، وأعمدة الأساس هي ما رُحِّل به القيد
  const documentCurrency = order.currency ?? baseCurrency;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`أمر بيع ${order.number}`}
        description={`العميل: ${order.customer.name} · المستودع: ${order.warehouse.name}`}
        action={
          <Badge tone={SALES_ORDER_STATUS_TONES[order.status]}>
            {SALES_ORDER_STATUS_LABELS[order.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>بيانات المستند</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">العميل</dt>
                  <dd>
                    <Link
                      href={`/dashboard/customers/${order.customer.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.customer.code} — {order.customer.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">المستودع</dt>
                  <dd className="font-medium">
                    {order.warehouse.code} — {order.warehouse.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">الفرع</dt>
                  <dd className="font-medium">
                    {order.branch
                      ? `${order.branch.code} — ${order.branch.name}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">العملة</dt>
                  <dd className="font-medium">
                    <CurrencyNote
                      currency={order.currency}
                      exchangeRate={order.exchangeRate}
                      baseCurrency={baseCurrency}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">تاريخ الأمر</dt>
                  <dd className="font-medium">{formatDate(order.orderDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">تاريخ التسليم</dt>
                  <dd className="font-medium">{formatDate(order.deliveryDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">تاريخ التأكيد</dt>
                  <dd className="font-medium">{formatDate(order.confirmedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ملاحظات</dt>
                  <dd className="font-medium">{order.note ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الأصناف</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>المنتج</TH>
                    <TH>الكمية</TH>
                    <TH>سعر الوحدة</TH>
                    <TH>الضريبة %</TH>
                    <TH>إجمالي السطر</TH>
                  </TR>
                </THead>
                <TBody>
                  {order.items.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <span className="font-medium">{item.product.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.product.sku}
                        </span>
                      </TD>
                      <TD>
                        {formatNumber(toNumber(item.quantity), 3)} {item.product.unit}
                      </TD>
                      <TD>{formatMoney(toNumber(item.unitPrice), documentCurrency)}</TD>
                      <TD>{formatNumber(toNumber(item.taxRate), 2)}%</TD>
                      <TD className="font-medium">
                        {formatMoney(toNumber(item.lineTotal), documentCurrency)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="space-y-1 border-t border-border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع قبل الضريبة</span>
                  <span className="text-end">
                    <Money
                      amount={toNumber(order.subtotal)}
                      currency={order.currency}
                      storedBase={order.baseSubtotal}
                      exchangeRate={order.exchangeRate}
                      baseCurrency={baseCurrency}
                    />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة</span>
                  <span className="text-end">
                    <Money
                      amount={toNumber(order.taxAmount)}
                      currency={order.currency}
                      storedBase={order.baseTaxAmount}
                      exchangeRate={order.exchangeRate}
                      baseCurrency={baseCurrency}
                    />
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>الإجمالي</span>
                  <span className="text-end">
                    <Money
                      amount={toNumber(order.total)}
                      currency={order.currency}
                      storedBase={order.baseTotal}
                      exchangeRate={order.exchangeRate}
                      baseCurrency={baseCurrency}
                    />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الفواتير المرتبطة</CardTitle>
            </CardHeader>
            <CardContent>
              {order.invoices.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  لم تُصدر فاتورة لهذا الأمر بعد
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {order.invoices.map((invoice) => (
                    <li
                      key={invoice.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(invoice.issueDate)}
                      </span>
                      <span className="text-sm font-medium text-end">
                        <Money
                          amount={toNumber(invoice.total)}
                          currency={invoice.currency}
                          storedBase={invoice.baseTotal}
                          exchangeRate={invoice.exchangeRate}
                          baseCurrency={baseCurrency}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <WorkflowPanel
          snapshot={snapshot}
          history={history}
          onTransition={runSalesOrderTransition.bind(null, order.id)}
        />
      </div>
    </div>
  );
}
