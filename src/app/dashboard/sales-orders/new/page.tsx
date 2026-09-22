import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { SalesOrderForm } from "../sales-order-form";

export default async function NewSalesOrderPage() {
  await requireModule("sales");

  const [customers, warehouses, products] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, unit: true, salePrice: true, taxRate: true },
    }),
  ]);

  const missing =
    customers.length === 0 || warehouses.length === 0 || products.length === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="أمر بيع جديد"
        description="اختر العميل والمستودع ثم أضف الأصناف"
      />

      {missing ? (
        <EmptyState
          title="بيانات أساسية ناقصة"
          description="يلزم وجود عميل نشط ومستودع ومنتجات نشطة قبل إنشاء أمر بيع."
          action={
            <Link href="/dashboard/customers/new">
              <Button>إضافة عميل</Button>
            </Link>
          }
        />
      ) : (
        <SalesOrderForm
          customers={customers}
          warehouses={warehouses}
          products={products.map((product) => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            unit: product.unit,
            salePrice: toNumber(product.salePrice),
            taxRate: toNumber(product.taxRate),
          }))}
        />
      )}
    </div>
  );
}
