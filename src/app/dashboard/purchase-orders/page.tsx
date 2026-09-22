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
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_TONES,
} from "./labels";

export default async function PurchaseOrdersPage() {
  await requireModule("purchasing");

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      orderDate: true,
      expectedDate: true,
      total: true,
      supplier: { select: { name: true } },
      warehouse: { select: { code: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="أوامر الشراء"
        description="إنشاء أوامر الشراء ومتابعتها حتى الاستلام"
        action={
          <Link href="/dashboard/purchase-orders/new">
            <Button type="button">أمر شراء جديد</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-5">
          {orders.length === 0 ? (
            <EmptyState
              title="لا توجد أوامر شراء بعد"
              description="ابدأ بإنشاء أول أمر شراء من المورد."
              action={
                <Link href="/dashboard/purchase-orders/new">
                  <Button type="button">أمر شراء جديد</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>رقم الأمر</TH>
                  <TH>المورد</TH>
                  <TH>المستودع</TH>
                  <TH>التاريخ</TH>
                  <TH>عدد البنود</TH>
                  <TH>الإجمالي</TH>
                  <TH>الحالة</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD dir="ltr" className="font-medium">
                      <Link
                        href={`/dashboard/purchase-orders/${order.id}`}
                        className="hover:underline"
                      >
                        {order.number}
                      </Link>
                    </TD>
                    <TD>{order.supplier.name}</TD>
                    <TD className="text-muted-foreground">
                      {order.warehouse.code} — {order.warehouse.name}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatDate(order.orderDate)}
                    </TD>
                    <TD>{order._count.items}</TD>
                    <TD className="whitespace-nowrap font-medium">
                      {formatCurrency(toNumber(order.total))}
                    </TD>
                    <TD>
                      <Badge tone={PURCHASE_ORDER_STATUS_TONES[order.status]}>
                        {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </TD>
                    <TD>
                      <Link href={`/dashboard/purchase-orders/${order.id}`}>
                        <Button type="button" variant="outline" size="sm">
                          عرض
                        </Button>
                      </Link>
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
