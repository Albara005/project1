import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatNumber } from "@/lib/utils";
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
import { SupplierForm } from "./supplier-form";
import { toggleSupplierActive } from "./actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireModule("purchasing");
  const { edit } = await searchParams;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      taxNumber: true,
      address: true,
      isActive: true,
      _count: { select: { purchaseOrders: true } },
    },
  });

  const editing = edit ? suppliers.find((supplier) => supplier.id === edit) : undefined;

  return (
    <div>
      <PageHeader
        title="الموردون"
        description="بيانات الموردين المعتمدين لدى المنشأة"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-5">
              {suppliers.length === 0 ? (
                <EmptyState
                  title="لا يوجد موردون بعد"
                  description="أضف أول مورد من النموذج المجاور."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>الرمز</TH>
                      <TH>الاسم</TH>
                      <TH>المسؤول</TH>
                      <TH>الهاتف</TH>
                      <TH>أوامر الشراء</TH>
                      <TH>الحالة</TH>
                      <TH>إجراءات</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {suppliers.map((supplier) => (
                      <TR key={supplier.id}>
                        <TD className="font-medium">{supplier.code}</TD>
                        <TD>{supplier.name}</TD>
                        <TD className="text-muted-foreground">
                          {supplier.contactName || "—"}
                        </TD>
                        <TD dir="ltr" className="text-muted-foreground">
                          {supplier.phone || "—"}
                        </TD>
                        <TD>{formatNumber(supplier._count.purchaseOrders, 0)}</TD>
                        <TD>
                          <Badge tone={supplier.isActive ? "green" : "gray"}>
                            {supplier.isActive ? "نشط" : "موقوف"}
                          </Badge>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/suppliers?edit=${supplier.id}`}>
                              <Button type="button" variant="outline" size="sm">
                                تعديل
                              </Button>
                            </Link>
                            <form action={toggleSupplierActive}>
                              <input type="hidden" name="id" value={supplier.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                {supplier.isActive ? "إيقاف" : "تفعيل"}
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

        <SupplierForm
          supplier={
            editing
              ? {
                  id: editing.id,
                  code: editing.code,
                  name: editing.name,
                  contactName: editing.contactName ?? "",
                  email: editing.email ?? "",
                  phone: editing.phone ?? "",
                  taxNumber: editing.taxNumber ?? "",
                  address: editing.address ?? "",
                }
              : null
          }
        />
      </div>
    </div>
  );
}
