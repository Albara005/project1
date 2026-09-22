import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatNumber } from "@/lib/utils";
import {
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
import { CategoryForm } from "./category-form";
import { deleteCategory } from "./actions";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireModule("inventory");
  const { edit } = await searchParams;

  const categories = await prisma.productCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { products: true } },
    },
  });

  const editing = edit ? categories.find((category) => category.id === edit) : undefined;

  return (
    <div>
      <PageHeader
        title="فئات المنتجات"
        description="تصنيف المنتجات لتسهيل البحث والتقارير"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-5">
              {categories.length === 0 ? (
                <EmptyState
                  title="لا توجد فئات بعد"
                  description="أضف أول فئة من النموذج المجاور."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>الاسم</TH>
                      <TH>الوصف</TH>
                      <TH>عدد المنتجات</TH>
                      <TH>إجراءات</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {categories.map((category) => (
                      <TR key={category.id}>
                        <TD className="font-medium">{category.name}</TD>
                        <TD className="text-muted-foreground">
                          {category.description || "—"}
                        </TD>
                        <TD>{formatNumber(category._count.products, 0)}</TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/categories?edit=${category.id}`}>
                              <Button type="button" variant="outline" size="sm">
                                تعديل
                              </Button>
                            </Link>
                            <form action={deleteCategory}>
                              <input type="hidden" name="id" value={category.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                حذف
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

        <CategoryForm
          category={
            editing
              ? {
                  id: editing.id,
                  name: editing.name,
                  description: editing.description ?? "",
                }
              : null
          }
        />
      </div>
    </div>
  );
}
