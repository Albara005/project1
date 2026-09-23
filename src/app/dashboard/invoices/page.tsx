import Link from "next/link";
import type { InvoiceStatus, InvoiceType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { cn, formatDate, toNumber } from "@/lib/utils";
import { formatMoney, getBaseCurrency } from "@/lib/modules/currency";
import {
  Badge,
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
import { Money, baseValue } from "./document-money";
import { branchFilter, getBranchScope } from "./document-scope";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  INVOICE_STATUS_VALUES,
  INVOICE_TYPE_SHORT_LABELS,
  INVOICE_TYPE_VALUES,
} from "./labels";

function filterLink(active: boolean) {
  return cn(
    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border hover:bg-muted",
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const user = await requireModule("sales");
  const scope = await getBranchScope(user);
  const query = await searchParams;

  const type: InvoiceType | undefined = INVOICE_TYPE_VALUES.find(
    (value) => value === query.type,
  );
  const status: InvoiceStatus | undefined = INVOICE_STATUS_VALUES.find(
    (value) => value === query.status,
  );

  const where: Prisma.InvoiceWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...branchFilter(scope),
  };

  const [invoices, baseCurrency] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        branch: { select: { name: true } },
        currency: { select: { code: true, decimals: true } },
      },
    }),
    getBaseCurrency(),
  ]);

  // المجاميع عبر فواتير بعملات مختلفة لا تصح إلا بعملة الأساس
  const totals = invoices.reduce(
    (acc, invoice) => {
      const rate = invoice.exchangeRate;
      const baseTotal = baseValue(toNumber(invoice.total), invoice.baseTotal, rate);
      const basePaid = baseValue(toNumber(invoice.paidAmount), 0, rate);
      return {
        total: acc.total + baseTotal,
        remaining:
          acc.remaining +
          (invoice.status === "CANCELLED" ? 0 : baseTotal - basePaid),
      };
    },
    { total: 0, remaining: 0 },
  );

  /** يبني رابط تصفية يحافظ على بقية المرشحات؛ القيمة "" تعني إزالة المرشح. */
  function href(next: { type?: string; status?: string }) {
    const params = new URLSearchParams();
    const nextType = next.type !== undefined ? next.type : (type ?? "");
    const nextStatus = next.status !== undefined ? next.status : (status ?? "");
    if (nextType) params.set("type", nextType);
    if (nextStatus) params.set("status", nextStatus);
    const queryString = params.toString();
    return queryString ? `/dashboard/invoices?${queryString}` : "/dashboard/invoices";
  }

  return (
    <div>
      <PageHeader
        title="الفواتير"
        description={`${invoices.length} فاتورة · الإجمالي ${formatMoney(totals.total, baseCurrency)} · المتبقي ${formatMoney(totals.remaining, baseCurrency)} (بعملة الأساس)`}
      />

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">النوع:</span>
          <Link href={href({ type: "" })} className={filterLink(!type)}>
            الكل
          </Link>
          {INVOICE_TYPE_VALUES.map((value) => (
            <Link
              key={value}
              href={href({ type: value })}
              className={filterLink(type === value)}
            >
              {INVOICE_TYPE_SHORT_LABELS[value]}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">الحالة:</span>
          <Link href={href({ status: "" })} className={filterLink(!status)}>
            الكل
          </Link>
          {INVOICE_STATUS_VALUES.map((value) => (
            <Link
              key={value}
              href={href({ status: value })}
              className={filterLink(status === value)}
            >
              {INVOICE_STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="لا توجد فواتير مطابقة"
          description="تصدر فواتير المبيعات تلقائياً عند نقل أمر البيع إلى حالة «مُفوتر»."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>رقم الفاتورة</TH>
                  <TH>النوع</TH>
                  <TH>الطرف</TH>
                  <TH>الفرع</TH>
                  <TH>تاريخ الإصدار</TH>
                  <TH>الاستحقاق</TH>
                  <TH>العملة</TH>
                  <TH>الإجمالي</TH>
                  <TH>المدفوع</TH>
                  <TH>المتبقي</TH>
                  <TH>الحالة</TH>
                </TR>
              </THead>
              <TBody>
                {invoices.map((invoice) => {
                  const total = toNumber(invoice.total);
                  const paid = toNumber(invoice.paidAmount);
                  const rate = invoice.exchangeRate;
                  const baseTotal = baseValue(total, invoice.baseTotal, rate);
                  const basePaid = baseValue(paid, 0, rate);

                  return (
                    <TR key={invoice.id}>
                      <TD>
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="font-medium hover:underline"
                        >
                          {invoice.number}
                        </Link>
                      </TD>
                      <TD>
                        <Badge tone={invoice.type === "SALES" ? "blue" : "purple"}>
                          {INVOICE_TYPE_SHORT_LABELS[invoice.type]}
                        </Badge>
                      </TD>
                      <TD>
                        {invoice.customer?.name ?? invoice.supplier?.name ?? "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {invoice.branch?.name ?? "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {formatDate(invoice.issueDate)}
                      </TD>
                      <TD className="text-muted-foreground">
                        {formatDate(invoice.dueDate)}
                      </TD>
                      <TD className="text-muted-foreground">
                        {invoice.currency?.code ?? baseCurrency.code}
                      </TD>
                      <TD>
                        <Money
                          amount={total}
                          currency={invoice.currency}
                          storedBase={invoice.baseTotal}
                          exchangeRate={rate}
                          baseCurrency={baseCurrency}
                          className="font-medium"
                        />
                      </TD>
                      <TD>
                        <Money
                          amount={paid}
                          currency={invoice.currency}
                          storedBase={basePaid}
                          exchangeRate={rate}
                          baseCurrency={baseCurrency}
                        />
                      </TD>
                      <TD>
                        <Money
                          amount={total - paid}
                          currency={invoice.currency}
                          storedBase={baseTotal - basePaid}
                          exchangeRate={rate}
                          baseCurrency={baseCurrency}
                        />
                      </TD>
                      <TD>
                        <Badge tone={INVOICE_STATUS_TONES[invoice.status]}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
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
