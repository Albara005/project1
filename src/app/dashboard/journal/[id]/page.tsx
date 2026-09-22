import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JournalEntryStatus } from "@/generated/prisma";
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
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/app/dashboard/accounts/account-labels";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_STATUS_TONES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_TONES,
} from "../labels";
import { ReverseForm } from "./reverse-form";

export const dynamic = "force-dynamic";

export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("accounting");
  const { id } = await params;

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      invoice: { select: { id: true, number: true } },
      purchaseOrder: { select: { id: true, number: true } },
      salesOrder: { select: { id: true, number: true } },
      payment: { select: { id: true, number: true } },
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
  });

  if (!entry) notFound();

  const lines = entry.lines
    .map((line) => ({
      id: line.id,
      accountId: line.account.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      description: line.description,
    }))
    .sort((a, b) => b.debit - a.debit || a.accountCode.localeCompare(b.accountCode, "en"));

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  const sourceLink =
    entry.invoice
      ? { href: `/dashboard/invoices/${entry.invoice.id}`, label: `فاتورة ${entry.invoice.number}` }
      : entry.purchaseOrder
        ? {
            href: `/dashboard/purchase-orders/${entry.purchaseOrder.id}`,
            label: `أمر شراء ${entry.purchaseOrder.number}`,
          }
        : entry.salesOrder
          ? {
              href: `/dashboard/sales-orders/${entry.salesOrder.id}`,
              label: `أمر بيع ${entry.salesOrder.number}`,
            }
          : entry.payment
            ? { href: `/dashboard/payments`, label: `سند ${entry.payment.number}` }
            : null;

  const details: Array<{ label: string; value: ReactNode }> = [
    { label: "رقم القيد", value: <span dir="ltr">{entry.number}</span> },
    { label: "التاريخ", value: formatDate(entry.entryDate) },
    {
      label: "المصدر",
      value: (
        <Badge tone={SOURCE_TYPE_TONES[entry.sourceType]}>
          {SOURCE_TYPE_LABELS[entry.sourceType]}
        </Badge>
      ),
    },
    {
      label: "الحالة",
      value: (
        <Badge tone={ENTRY_STATUS_TONES[entry.status]}>
          {ENTRY_STATUS_LABELS[entry.status]}
        </Badge>
      ),
    },
    { label: "أنشأه", value: entry.createdBy?.name ?? "—" },
    {
      label: "المستند المرتبط",
      value: sourceLink ? (
        <Link href={sourceLink.href} className="hover:underline">
          {sourceLink.label}
        </Link>
      ) : (
        "—"
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`القيد ${entry.number}`}
        description={entry.description}
        action={
          <Link href="/dashboard/journal">
            <Button type="button" variant="outline">
              رجوع للقيود
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>بيانات القيد</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                {details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="text-xs text-muted-foreground">
                      {detail.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>سطور القيد</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead>
                  <TR>
                    <TH>الحساب</TH>
                    <TH>النوع</TH>
                    <TH>بيان السطر</TH>
                    <TH className="text-end">مدين</TH>
                    <TH className="text-end">دائن</TH>
                  </TR>
                </THead>
                <TBody>
                  {lines.map((line) => (
                    <TR key={line.id}>
                      <TD>
                        <Link
                          href={`/dashboard/accounts?edit=${line.accountId}`}
                          className="hover:underline"
                        >
                          <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                            {line.accountCode}
                          </span>{" "}
                          <span className="font-medium">{line.accountName}</span>
                        </Link>
                      </TD>
                      <TD>{ACCOUNT_TYPE_LABELS[line.accountType]}</TD>
                      <TD className="text-muted-foreground">
                        {line.description ?? "—"}
                      </TD>
                      <TD className="text-end tabular-nums">
                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                      </TD>
                      <TD className="text-end tabular-nums">
                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                      </TD>
                    </TR>
                  ))}
                  <TR className="bg-muted/50 font-semibold">
                    <TD colSpan={3}>الإجمالي</TD>
                    <TD className="text-end tabular-nums">
                      {formatCurrency(totalDebit)}
                    </TD>
                    <TD className="text-end tabular-nums">
                      {formatCurrency(totalCredit)}
                    </TD>
                  </TR>
                </TBody>
              </Table>
              <p className="px-4 pt-3 text-sm">
                {isBalanced ? (
                  <Badge tone="green">القيد متوازن</Badge>
                ) : (
                  <Badge tone="red">
                    القيد غير متوازن — الفرق {formatCurrency(totalDebit - totalCredit)}
                  </Badge>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>إجراءات</CardTitle>
          </CardHeader>
          <CardContent>
            {entry.status === JournalEntryStatus.POSTED ? (
              <ReverseForm entryId={entry.id} />
            ) : entry.status === JournalEntryStatus.REVERSED ? (
              <p className="text-sm text-muted-foreground">
                تم عكس هذا القيد سابقاً، ولا يمكن عكسه مرة أخرى.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا يمكن عكس إلا القيود المرحّلة.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
