import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  RETURN_TYPE_LABELS,
  type ReturnStatusValue,
} from "../labels";
import { ReturnActions } from "./return-actions";

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const note = await prisma.returnNote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true, code: true } },
      warehouse: { select: { name: true, code: true } },
      invoice: { select: { id: true, number: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
      journalEntries: {
        select: { id: true, number: true, entryDate: true },
      },
    },
  });

  if (!note) notFound();

  const isSales = note.type === ReturnType.SALES;
  await requireModule(isSales ? "sales" : "purchasing");

  const status = note.status as ReturnStatusValue;

  return (
    <div>
      <PageHeader
        title={`${RETURN_TYPE_LABELS[note.type]} ${note.number}`}
        description={
          isSales
            ? "عند التأكيد تعود البضاعة للمخزون ويُرحَّل قيد يخفّض الإيرادات وذمم العميل."
            : "عند التأكيد تُخصم البضاعة من المخزون ويُرحَّل قيد يخفّض ذمم المورد والمخزون."
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/returns"
              className="text-sm text-muted-foreground hover:underline"
            >
              ← عودة للمرتجعات
            </Link>
            <Link href={`/dashboard/returns/${note.id}/print`} target="_blank">
              <Button size="sm" variant="outline">
                طباعة
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>الأصناف</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>المنتج</TH>
                    <TH>الكمية</TH>
                    <TH>سعر الوحدة</TH>
                    <TH>الضريبة</TH>
                    <TH>الإجمالي</TH>
                  </TR>
                </THead>
                <TBody>
                  {note.items.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <span className="font-medium">{item.product.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.product.sku}
                        </span>
                      </TD>
                      <TD>
                        {toNumber(item.quantity)} {item.product.unit}
                      </TD>
                      <TD>{formatCurrency(toNumber(item.unitPrice))}</TD>
                      <TD className="text-xs">{toNumber(item.taxRate)}%</TD>
                      <TD>{formatCurrency(toNumber(item.lineTotal))}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                  <span>{formatCurrency(toNumber(note.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة</span>
                  <span>{formatCurrency(toNumber(note.taxAmount))}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(toNumber(note.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {note.journalEntries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>القيود المحاسبية المرتبطة</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {note.journalEntries.map((entry) => (
                    <li key={entry.id} className="flex justify-between text-sm">
                      <Link
                        href={`/dashboard/journal/${entry.id}`}
                        className="font-medium hover:underline"
                      >
                        {entry.number}
                      </Link>
                      <span className="text-muted-foreground">
                        {formatDate(entry.entryDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>التفاصيل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="الحالة">
                <Badge tone={RETURN_STATUS_TONES[status]}>
                  {RETURN_STATUS_LABELS[status]}
                </Badge>
              </Row>
              <Row label={isSales ? "العميل" : "المورد"}>
                {note.customer?.name ?? note.supplier?.name ?? "—"}
              </Row>
              <Row label="المستودع">{note.warehouse.name}</Row>
              <Row label="التاريخ">{formatDate(note.returnDate)}</Row>
              {note.confirmedAt ? (
                <Row label="تاريخ التأكيد">{formatDate(note.confirmedAt)}</Row>
              ) : null}
              <Row label="الفاتورة الأصلية">
                {note.invoice ? (
                  <Link
                    href={`/dashboard/invoices/${note.invoice.id}`}
                    className="hover:underline"
                  >
                    {note.invoice.number}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              {note.reason ? <Row label="السبب">{note.reason}</Row> : null}
            </CardContent>
          </Card>

          <ReturnActions returnNoteId={note.id} status={status} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}
