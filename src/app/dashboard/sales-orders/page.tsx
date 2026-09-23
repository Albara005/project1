import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, toNumber } from "@/lib/utils";
import { formatMoney, getBaseCurrency } from "@/lib/modules/currency";
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
import { Money, baseValue } from "../invoices/document-money";
import { branchFilter, getBranchScope } from "../invoices/document-scope";
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_STATUS_TONES } from "./status";

export default async function SalesOrdersPage() {
  const user = await requireModule("sales");
  const scope = await getBranchScope(user);

  const [orders, baseCurrency] = await Promise.all([
    prisma.salesOrder.findMany({
      where: branchFilter(scope),
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
        branch: { select: { name: true } },
        currency: { select: { code: true, decimals: true } },
        _count: { select: { items: true } },
      },
    }),
    getBaseCurrency(),
  ]);

  // المجموع عبر أوامر بعملات مختلفة لا يصح إلا بعملة الأساس
  const baseTotal = orders.reduce(
    (sum, order) =>
      sum + baseValue(toNumber(order.total), order.baseTotal, order.exchangeRate),
    0,
  );

  return (
    <div>
      <PageHeader
        title="أوامر البيع"
        description={`دورة المستند: مسودة ← بانتظار الاعتماد ← مؤكد ← مُفوتر · الإجمالي بعملة الأساس ${formatMoney(baseTotal, baseCurrency)}`}
        action={
          <Link href="/dashboard/sales-orders/new">
            <Button>أمر بيع جديد</Button>
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد أوامر بيع"
          description="أنشئ أول أمر بيع وسيتولى سير العمل نقله بين المراحل."
          action={
            <Link href="/dashboard/sales-orders/new">
              <Button>أمر بيع جديد</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>رقم الأمر</TH>
                  <TH>العميل</TH>
                  <TH>الفرع</TH>
                  <TH>المستودع</TH>
                  <TH>التاريخ</TH>
                  <TH>الأصناف</TH>
                  <TH>العملة</TH>
                  <TH>الإجمالي</TH>
                  <TH>الحالة</TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link
                        href={`/dashboard/sales-orders/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        {order.number}
                      </Link>
                    </TD>
                    <TD>{order.customer.name}</TD>
                    <TD className="text-muted-foreground">
                      {order.branch?.name ?? "—"}
                    </TD>
                    <TD className="text-muted-foreground">{order.warehouse.name}</TD>
                    <TD className="text-muted-foreground">{formatDate(order.orderDate)}</TD>
                    <TD className="text-muted-foreground">{order._count.items}</TD>
                    <TD className="text-muted-foreground">
                      {order.currency?.code ?? baseCurrency.code}
                    </TD>
                    <TD>
                      <Money
                        amount={toNumber(order.total)}
                        currency={order.currency}
                        storedBase={order.baseTotal}
                        exchangeRate={order.exchangeRate}
                        baseCurrency={baseCurrency}
                        className="font-medium"
                      />
                    </TD>
                    <TD>
                      <Badge tone={SALES_ORDER_STATUS_TONES[order.status]}>
                        {SALES_ORDER_STATUS_LABELS[order.status]}
                      </Badge>
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
