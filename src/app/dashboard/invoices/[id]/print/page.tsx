import { notFound } from "next/navigation";
import { InvoiceStatus, InvoiceType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, toNumber } from "@/lib/utils";
import { PrintDocument } from "@/components/print-document";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئياً",
  PAID: "مدفوعة",
  CANCELLED: "ملغاة",
};

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      supplier: true,
      salesOrder: { select: { number: true } },
      items: { include: { product: { select: { sku: true, unit: true } } } },
    },
  });

  if (!invoice) notFound();

  const isSales = invoice.type === InvoiceType.SALES;
  const user = await requireModule(isSales ? "sales" : "purchasing");

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  const party = isSales ? invoice.customer : invoice.supplier;
  const total = toNumber(invoice.total);
  const paid = toNumber(invoice.paidAmount);

  return (
    <PrintDocument
      organization={{
        name: organization.name,
        legalName: organization.legalName,
        taxNumber: organization.taxNumber,
        address: organization.address,
        phone: organization.phone,
        email: organization.email,
        currency: organization.currency,
      }}
      title={isSales ? "فاتورة ضريبية" : "فاتورة مشتريات"}
      subtitle={isSales ? "Tax Invoice" : "Purchase Invoice"}
      documentNumber={invoice.number}
      party={{
        heading: isSales ? "فاتورة إلى" : "فاتورة من",
        name: party?.name ?? "—",
        code: party?.code ?? null,
        taxNumber: party?.taxNumber ?? null,
        address: party?.address ?? null,
        phone: party?.phone ?? null,
      }}
      meta={[
        { label: "تاريخ الإصدار", value: formatDate(invoice.issueDate) },
        ...(invoice.dueDate
          ? [{ label: "تاريخ الاستحقاق", value: formatDate(invoice.dueDate) }]
          : []),
        { label: "الحالة", value: STATUS_LABELS[invoice.status] },
        ...(invoice.salesOrder
          ? [{ label: "أمر البيع", value: invoice.salesOrder.number }]
          : []),
      ]}
      lines={invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        sku: item.product?.sku ?? null,
        quantity: toNumber(item.quantity),
        unit: item.product?.unit ?? null,
        unitPrice: toNumber(item.unitPrice),
        taxRate: toNumber(item.taxRate),
        lineTotal: toNumber(item.lineTotal),
      }))}
      subtotal={toNumber(invoice.subtotal)}
      taxAmount={toNumber(invoice.taxAmount)}
      total={total}
      extraTotals={[
        { label: "المدفوع", value: paid },
        { label: "المتبقي", value: total - paid, emphasis: true },
      ]}
      note={invoice.note}
    />
  );
}
