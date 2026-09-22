import { Prisma, StockMovementType } from "@/generated/prisma";
import { prisma } from "@/lib/db";

type TxClient = Prisma.TransactionClient | typeof prisma;

export class StockError extends Error {}

const OUTBOUND: StockMovementType[] = [
  StockMovementType.SALE_OUT,
  StockMovementType.TRANSFER_OUT,
  StockMovementType.RETURN_OUT,
];

/**
 * يسجّل حركة مخزون ويحدّث الرصيد في المستودع ضمن نفس المعاملة.
 * الكمية تُمرَّر دائماً موجبة؛ الاتجاه يُحدَّد من نوع الحركة.
 * ADJUSTMENT يقبل قيمة موجبة أو سالبة.
 */
export async function applyStockMovement(
  client: TxClient,
  input: {
    productId: string;
    warehouseId: string;
    type: StockMovementType;
    quantity: number;
    unitCost?: number;
    reference?: string;
    note?: string;
    allowNegative?: boolean;
  },
) {
  const signedQuantity =
    input.type === StockMovementType.ADJUSTMENT
      ? input.quantity
      : OUTBOUND.includes(input.type)
        ? -Math.abs(input.quantity)
        : Math.abs(input.quantity);

  if (signedQuantity === 0) return;

  const stockItem = await client.stockItem.upsert({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    update: {},
    create: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: 0,
    },
  });

  const newQuantity = Number(stockItem.quantity) + signedQuantity;

  if (newQuantity < 0 && !input.allowNegative) {
    const product = await client.product.findUnique({
      where: { id: input.productId },
      select: { name: true },
    });
    throw new StockError(
      `الرصيد غير كافٍ للمنتج "${product?.name ?? input.productId}": المتاح ${Number(stockItem.quantity)}، المطلوب ${Math.abs(signedQuantity)}`,
    );
  }

  await client.stockItem.update({
    where: { id: stockItem.id },
    data: { quantity: new Prisma.Decimal(newQuantity) },
  });

  await client.stockMovement.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: new Prisma.Decimal(Math.abs(signedQuantity)),
      unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : null,
      reference: input.reference ?? null,
      note: input.note ?? null,
    },
  });
}

/** الرصيد الإجمالي لمنتج عبر كل المستودعات. */
export async function getOnHandQuantity(productId: string): Promise<number> {
  const result = await prisma.stockItem.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return Number(result._sum.quantity ?? 0);
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE_IN: "استلام مشتريات",
  SALE_OUT: "صرف مبيعات",
  ADJUSTMENT: "تسوية جرد",
  TRANSFER_IN: "تحويل وارد",
  TRANSFER_OUT: "تحويل صادر",
  RETURN_IN: "مرتجع وارد",
  RETURN_OUT: "مرتجع صادر",
};
