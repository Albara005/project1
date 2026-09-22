import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { Button, PageHeader } from "@/components/ui";
import { PurchaseOrderForm } from "./purchase-order-form";

export default async function NewPurchaseOrderPage() {
  await requireModule("purchasing");

  const [suppliers, warehouses, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        costPrice: true,
        taxRate: true,
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="أمر شراء جديد"
        description="يُحفظ الأمر كمسودة ويبدأ سير العمل الخاص به"
        action={
          <Link href="/dashboard/purchase-orders">
            <Button type="button" variant="outline">
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <PurchaseOrderForm
        suppliers={suppliers}
        warehouses={warehouses}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          costPrice: toNumber(product.costPrice),
          taxRate: toNumber(product.taxRate),
        }))}
      />
    </div>
  );
}
