import Link from "next/link";
import { InvoiceStatus, InvoiceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, toNumber } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";

export default async function CustomersPage() {
  await requireModule("sales");

  const [customers, balances] = await Promise.all([
    prisma.customer.findMany({ orderBy: { code: "asc" } }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        type: InvoiceType.SALES,
        status: { not: InvoiceStatus.CANCELLED },
        customerId: { not: null },
      },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  // الرصيد المستحق = مجموع (إجمالي الفاتورة - المدفوع) لفواتير المبيعات غير الملغاة
  const outstandingByCustomer = new Map<string, number>();
  for (const row of balances) {
    if (!row.customerId) continue;
    outstandingByCustomer.set(
      row.customerId,
      toNumber(row._sum.total) - toNumber(row._sum.paidAmount),
    );
  }

  const totalOutstanding = Array.from(outstandingByCustomer.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <div>
      <PageHeader
        title="العملاء"
        description="بيانات العملاء وأرصدتهم المستحقة"
        action={
          <Link href="/dashboard/customers/new">
            <Button>عميل جديد</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">عدد العملاء</p>
            <p className="mt-1.5 text-xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">عملاء نشطون</p>
            <p className="mt-1.5 text-xl font-bold">
              {customers.filter((customer) => customer.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">إجمالي المستحق</p>
            <p className="mt-1.5 text-xl font-bold">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="لا يوجد عملاء بعد"
          description="ابدأ بإضافة أول عميل لتتمكن من إنشاء أوامر البيع والفواتير."
          action={
            <Link href="/dashboard/customers/new">
              <Button>عميل جديد</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>الرمز</TH>
                  <TH>الاسم</TH>
                  <TH>جهة الاتصال</TH>
                  <TH>الهاتف</TH>
                  <TH>حد الائتمان</TH>
                  <TH>الرصيد المستحق</TH>
                  <TH>الحالة</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {customers.map((customer) => {
                  const outstanding = outstandingByCustomer.get(customer.id) ?? 0;
                  const creditLimit = toNumber(customer.creditLimit);
                  const overLimit = creditLimit > 0 && outstanding > creditLimit;

                  return (
                    <TR key={customer.id}>
                      <TD className="font-medium">{customer.code}</TD>
                      <TD>
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">
                        {customer.contactName ?? "—"}
                      </TD>
                      <TD dir="ltr" className="text-start text-muted-foreground">
                        {customer.phone ?? "—"}
                      </TD>
                      <TD>{formatCurrency(creditLimit)}</TD>
                      <TD>
                        <Badge tone={overLimit ? "red" : outstanding > 0 ? "amber" : "green"}>
                          {formatCurrency(outstanding)}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge tone={customer.isActive ? "green" : "gray"}>
                          {customer.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </TD>
                      <TD>
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="text-sm text-muted-foreground hover:underline"
                        >
                          تعديل
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
