import { StockMovementType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { MOVEMENT_TYPE_LABELS } from "@/lib/modules/stock";
import { formatCurrency, formatDate, formatNumber, toNumber } from "@/lib/utils";
import {
  Badge,
  type BadgeTone,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { AdjustmentForm } from "./adjustment-form";

const MOVEMENT_TONES: Record<StockMovementType, BadgeTone> = {
  PURCHASE_IN: "green",
  SALE_OUT: "blue",
  ADJUSTMENT: "amber",
  TRANSFER_IN: "purple",
  TRANSFER_OUT: "purple",
  RETURN_IN: "gray",
  RETURN_OUT: "gray",
};

const INBOUND_TYPES: StockMovementType[] = [
  StockMovementType.PURCHASE_IN,
  StockMovementType.TRANSFER_IN,
  StockMovementType.RETURN_IN,
];

const OUTBOUND_TYPES: StockMovementType[] = [
  StockMovementType.SALE_OUT,
  StockMovementType.TRANSFER_OUT,
  StockMovementType.RETURN_OUT,
];

function movementSign(type: StockMovementType) {
  if (INBOUND_TYPES.includes(type)) return "+";
  if (OUTBOUND_TYPES.includes(type)) return "−";
  return "±";
}

export default async function StockPage() {
  await requireModule("inventory");

  const [balances, movements, products, warehouses] = await Promise.all([
    prisma.stockItem.findMany({
      orderBy: [{ product: { name: "asc" } }, { warehouse: { code: "asc" } }],
      select: {
        id: true,
        quantity: true,
        updatedAt: true,
        product: {
          select: { id: true, sku: true, name: true, unit: true, reorderLevel: true },
        },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        quantity: true,
        unitCost: true,
        reference: true,
        note: true,
        createdAt: true,
        product: { select: { sku: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, sku: true, name: true, unit: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  // إجمالي رصيد كل منتج عبر المستودعات لمقارنته بحد إعادة الطلب
  const totalByProduct = new Map<string, number>();
  for (const balance of balances) {
    totalByProduct.set(
      balance.product.id,
      (totalByProduct.get(balance.product.id) ?? 0) + toNumber(balance.quantity),
    );
  }

  return (
    <div>
      <PageHeader
        title="أرصدة وحركات المخزون"
        description="عرض للقراءة فقط لأرصدة المنتجات في المستودعات، مع سجل آخر 100 حركة"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>الأرصدة الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <EmptyState
                  title="لا توجد أرصدة مسجّلة"
                  description="ستظهر الأرصدة بعد استلام أوامر الشراء أو تنفيذ تسوية جرد."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>SKU</TH>
                      <TH>المنتج</TH>
                      <TH>المستودع</TH>
                      <TH>الرصيد</TH>
                      <TH>إجمالي المنتج</TH>
                      <TH>آخر تحديث</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {balances.map((balance) => {
                      const total = totalByProduct.get(balance.product.id) ?? 0;
                      const isLow =
                        balance.product.reorderLevel > 0 &&
                        total <= balance.product.reorderLevel;
                      return (
                        <TR key={balance.id}>
                          <TD dir="ltr" className="font-medium">
                            {balance.product.sku}
                          </TD>
                          <TD>{balance.product.name}</TD>
                          <TD className="text-muted-foreground">
                            {balance.warehouse.code} — {balance.warehouse.name}
                          </TD>
                          <TD>
                            {formatNumber(toNumber(balance.quantity), 2)}{" "}
                            {balance.product.unit}
                          </TD>
                          <TD>
                            {isLow ? (
                              <Badge tone="red">
                                {formatNumber(total, 2)} / {balance.product.reorderLevel}
                              </Badge>
                            ) : (
                              <span>{formatNumber(total, 2)}</span>
                            )}
                          </TD>
                          <TD className="text-muted-foreground">
                            {formatDate(balance.updatedAt)}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>سجل الحركات (آخر 100)</CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <EmptyState title="لا توجد حركات مخزون بعد" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>التاريخ</TH>
                      <TH>نوع الحركة</TH>
                      <TH>المنتج</TH>
                      <TH>المستودع</TH>
                      <TH>الكمية</TH>
                      <TH>تكلفة الوحدة</TH>
                      <TH>المرجع</TH>
                      <TH>ملاحظة</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {movements.map((movement) => (
                      <TR key={movement.id}>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {formatDate(movement.createdAt)}
                        </TD>
                        <TD>
                          <Badge tone={MOVEMENT_TONES[movement.type]}>
                            {MOVEMENT_TYPE_LABELS[movement.type]}
                          </Badge>
                        </TD>
                        <TD>
                          <span dir="ltr">{movement.product.sku}</span> — {movement.product.name}
                        </TD>
                        <TD className="text-muted-foreground">{movement.warehouse.code}</TD>
                        <TD className="whitespace-nowrap">
                          {movementSign(movement.type)}
                          {formatNumber(toNumber(movement.quantity), 2)}{" "}
                          {movement.product.unit}
                        </TD>
                        <TD>
                          {movement.unitCost == null
                            ? "—"
                            : formatCurrency(toNumber(movement.unitCost))}
                        </TD>
                        <TD className="text-muted-foreground">{movement.reference || "—"}</TD>
                        <TD className="max-w-60 truncate text-muted-foreground">
                          {movement.note || "—"}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <AdjustmentForm products={products} warehouses={warehouses} />
      </div>
    </div>
  );
}
