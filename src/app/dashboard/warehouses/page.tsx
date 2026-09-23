import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatNumber, toNumber } from "@/lib/utils";
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
import { getBranchScope, listBranchOptions } from "./branch-scope";
import { WarehouseForm } from "./warehouse-form";
import { toggleWarehouseActive } from "./actions";

export default async function WarehousesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireModule("inventory");
  const { edit } = await searchParams;

  const scope = await getBranchScope(user);

  const [warehouses, branches] = await Promise.all([
    prisma.warehouse.findMany({
      where: scope.restrictToBranchId
        ? { branchId: scope.restrictToBranchId }
        : {},
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        location: true,
        isActive: true,
        branchId: true,
        branch: { select: { code: true, name: true } },
        stockItems: { select: { quantity: true } },
      },
    }),
    listBranchOptions(scope),
  ]);

  const editing = edit ? warehouses.find((warehouse) => warehouse.id === edit) : undefined;

  return (
    <div>
      <PageHeader
        title="المستودعات"
        description="مواقع تخزين البضاعة وأرصدتها"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-5">
              {warehouses.length === 0 ? (
                <EmptyState
                  title="لا توجد مستودعات بعد"
                  description="أضف أول مستودع من النموذج المجاور."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>الرمز</TH>
                      <TH>الاسم</TH>
                      <TH>الموقع</TH>
                      <TH>إجمالي الكميات</TH>
                      <TH>الحالة</TH>
                      <TH>إجراءات</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {warehouses.map((warehouse) => {
                      const onHand = warehouse.stockItems.reduce(
                        (sum, item) => sum + toNumber(item.quantity),
                        0,
                      );
                      return (
                        <TR key={warehouse.id}>
                          <TD className="font-medium">{warehouse.code}</TD>
                          <TD>{warehouse.name}</TD>
                          <TD className="text-muted-foreground">
                            {warehouse.location || "—"}
                          </TD>
                          <TD>{formatNumber(onHand, 2)}</TD>
                          <TD>
                            <Badge tone={warehouse.isActive ? "green" : "gray"}>
                              {warehouse.isActive ? "نشط" : "موقوف"}
                            </Badge>
                          </TD>
                          <TD>
                            <div className="flex items-center gap-2">
                              <Link href={`/dashboard/warehouses?edit=${warehouse.id}`}>
                                <Button type="button" variant="outline" size="sm">
                                  تعديل
                                </Button>
                              </Link>
                              <form action={toggleWarehouseActive}>
                                <input type="hidden" name="id" value={warehouse.id} />
                                <Button type="submit" variant="ghost" size="sm">
                                  {warehouse.isActive ? "إيقاف" : "تفعيل"}
                                </Button>
                              </form>
                            </div>
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

        <WarehouseForm
          warehouse={
            editing
              ? {
                  id: editing.id,
                  code: editing.code,
                  name: editing.name,
                  location: editing.location ?? "",
                }
              : null
          }
        />
      </div>
    </div>
  );
}
