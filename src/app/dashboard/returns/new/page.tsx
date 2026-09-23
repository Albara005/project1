import { notFound } from "next/navigation";
import { InvoiceType, ReturnType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { ReturnForm } from "./return-form";

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; invoice?: string }>;
}) {
  const { type, invoice } = await searchParams;

  if (type !== "SALES" && type !== "PURCHASE") notFound();
  const returnType = type as ReturnType;
  const isSales = returnType === ReturnType.SALES;

  await requireModule(isSales ? "sales" : "purchasing");

  const [parties, warehouses, products, invoices] = await Promise.all([
    isSales
      ? prisma.customer.findMany({
          where: { isActive: true },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        })
      : prisma.supplier.findMany({
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
      select: { id: true, sku: true, name: true, unit: true, salePrice: true, costPrice: true, taxRate: true },
    }),
    prisma.invoice.findMany({
      where: { type: isSales ? InvoiceType.SALES : InvoiceType.PURCHASE },
      orderBy: { issueDate: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        customerId: true,
        supplierId: true,
        items: {
          select: { productId: true, quantity: true, unitPrice: true, taxRate: true },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={isSales ? "مرتجع مبيعات جديد" : "مرتجع مشتريات جديد"}
        description={
          isSales
            ? "اختر الفاتورة الأصلية لتعبئة الأصناف تلقائياً، ولن يُسمح بتجاوز الكميات المفوترة."
            : "سجّل البضاعة المرتجعة للمورد؛ ستُخصم من المخزون عند التأكيد."
        }
      />

      <ReturnForm
        type={returnType}
        parties={parties}
        warehouses={warehouses}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          price: toNumber(isSales ? product.salePrice : product.costPrice),
          taxRate: toNumber(product.taxRate),
        }))}
        invoices={invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          partyId: (isSales ? inv.customerId : inv.supplierId) ?? "",
          items: inv.items
            .filter((item) => item.productId)
            .map((item) => ({
              productId: item.productId!,
              quantity: toNumber(item.quantity),
              unitPrice: toNumber(item.unitPrice),
              taxRate: toNumber(item.taxRate),
            })),
        }))}
        preselectedInvoiceId={invoice ?? ""}
      />
    </div>
  );
}
