import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
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
import { SALES_ORDER_STATUS_LABELS, SALES_ORDER_STATUS_TONES } from "./status";

export default async function SalesOrdersPage() {
  await requireModule("sales");

  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      warehouse: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="أوامر البيع"
        description="دورة المستند: مسودة ← بانتظار الاعتماد ← مؤكد ← مُفوتر"
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
                  <TH>المستودع</TH>
                  <TH>التاريخ</TH>
                  <TH>الأصناف</TH>
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
                    <TD className="text-muted-foreground">{order.warehouse.name}</TD>
                    <TD className="text-muted-foreground">{formatDate(order.orderDate)}</TD>
                    <TD className="text-muted-foreground">{order._count.items}</TD>
                    <TD className="font-medium">{formatCurrency(toNumber(order.total))}</TD>
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
