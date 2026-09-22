import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatNumber, toNumber } from "@/lib/utils";
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
import { ProductForm } from "./product-form";
import { toggleProductActive } from "./actions";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireModule("inventory");
  const { edit } = await searchParams;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unit: true,
        costPrice: true,
        salePrice: true,
        taxRate: true,
        reorderLevel: true,
        isActive: true,
        categoryId: true,
        category: { select: { name: true } },
        stockItems: { select: { quantity: true } },
      },
    }),
    prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = products.map((product) => {
    const onHand = product.stockItems.reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0,
    );
    return {
      ...product,
      onHand,
      isLow: product.reorderLevel > 0 && onHand <= product.reorderLevel,
    };
  });

  const lowCount = rows.filter((row) => row.isLow).length;
  const editing = edit ? products.find((product) => product.id === edit) : undefined;

  return (
    <div>
      <PageHeader
        title="المنتجات"
        description={
          lowCount > 0
            ? `${formatNumber(lowCount, 0)} منتج وصل حد إعادة الطلب أو أقل`
            : "كل الأرصدة ضمن الحدود الآمنة"
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <Card>
            <CardContent className="pt-5">
              {rows.length === 0 ? (
                <EmptyState
                  title="لا توجد منتجات بعد"
                  description="أضف أول منتج من النموذج المجاور."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>SKU</TH>
                      <TH>الاسم</TH>
                      <TH>الفئة</TH>
                      <TH>سعر التكلفة</TH>
                      <TH>سعر البيع</TH>
                      <TH>الرصيد الحالي</TH>
                      <TH>حد إعادة الطلب</TH>
                      <TH>الحالة</TH>
                      <TH>إجراءات</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((product) => (
                      <TR
                        key={product.id}
                        className={product.isLow ? "bg-red-50 dark:bg-red-950/30" : undefined}
                      >
                        <TD dir="ltr" className="font-medium">
                          {product.sku}
                        </TD>
                        <TD>{product.name}</TD>
                        <TD className="text-muted-foreground">
                          {product.category?.name ?? "—"}
                        </TD>
                        <TD>{formatCurrency(toNumber(product.costPrice))}</TD>
                        <TD>{formatCurrency(toNumber(product.salePrice))}</TD>
                        <TD>
                          {product.isLow ? (
                            <Badge tone="red">
                              {formatNumber(product.onHand, 2)} {product.unit}
                            </Badge>
                          ) : (
                            <span>
                              {formatNumber(product.onHand, 2)} {product.unit}
                            </span>
                          )}
                        </TD>
                        <TD>{formatNumber(product.reorderLevel, 0)}</TD>
                        <TD>
                          <Badge tone={product.isActive ? "green" : "gray"}>
                            {product.isActive ? "نشط" : "موقوف"}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/products?edit=${product.id}`}>
                              <Button type="button" variant="outline" size="sm">
                                تعديل
                              </Button>
                            </Link>
                            <form action={toggleProductActive}>
                              <input type="hidden" name="id" value={product.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                {product.isActive ? "إيقاف" : "تفعيل"}
                              </Button>
                            </form>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <ProductForm
          categories={categories}
          product={
            editing
              ? {
                  id: editing.id,
                  sku: editing.sku,
                  name: editing.name,
                  description: editing.description ?? "",
                  unit: editing.unit,
                  categoryId: editing.categoryId ?? "",
                  costPrice: toNumber(editing.costPrice),
                  salePrice: toNumber(editing.salePrice),
                  taxRate: toNumber(editing.taxRate),
                  reorderLevel: editing.reorderLevel,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
