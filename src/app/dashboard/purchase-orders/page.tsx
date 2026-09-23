import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
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
  Label,
  PageHeader,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  getBranchScope,
  listBranchOptions,
  resolveBranchFilter,
} from "@/app/dashboard/warehouses/branch-scope";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_TONES,
} from "./labels";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const user = await requireModule("purchasing");
  const { branch } = await searchParams;

  const scope = await getBranchScope(user);
  const branchFilter = resolveBranchFilter(scope, branch);

  const where: Prisma.PurchaseOrderWhereInput = branchFilter
    ? { branchId: branchFilter }
    : {};

  const [orders, branches, baseCurrency] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        orderDate: true,
        expectedDate: true,
        total: true,
        baseTotal: true,
        supplier: { select: { name: true } },
        warehouse: { select: { code: true, name: true } },
        branch: { select: { code: true, name: true } },
        currency: { select: { code: true, decimals: true, isBase: true } },
        _count: { select: { items: true } },
      },
    }),
    listBranchOptions(scope),
    getBaseCurrency(),
  ]);

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

      {scope.canSeeAllBranches && branches.length > 0 ? (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form method="get" className="grid items-end gap-4 md:grid-cols-4">
              <div>
                <Label htmlFor="branch">الفرع</Label>
                <Select id="branch" name="branch" defaultValue={branchFilter ?? ""}>
                  <option value="">كل الفروع</option>
                  {branches.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.code} — {option.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">تطبيق الفلتر</Button>
                <Link href="/dashboard/purchase-orders">
                  <Button type="button" variant="outline">
                    إعادة تعيين
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

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
                  <TH>الفرع</TH>
                  <TH>المستودع</TH>
                  <TH>التاريخ</TH>
                  <TH>عدد البنود</TH>
                  <TH>الإجمالي</TH>
                  <TH>الحالة</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((order) => {
                  const currency = order.currency ?? baseCurrency;
                  // المبلغ يُعرض بعملة المستند، وما يعادله بعملة الأساس أسفله
                  const isForeign = !currency.isBase;
                  return (
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
                        {order.branch
                          ? `${order.branch.code} — ${order.branch.name}`
                          : "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {order.warehouse.code} — {order.warehouse.name}
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {formatDate(order.orderDate)}
                      </TD>
                      <TD>{order._count.items}</TD>
                      <TD className="whitespace-nowrap font-medium">
                        {formatMoney(toNumber(order.total), currency)}
                        {isForeign ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            = {formatMoney(toNumber(order.baseTotal), baseCurrency)}
                          </span>
                        ) : null}
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
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
