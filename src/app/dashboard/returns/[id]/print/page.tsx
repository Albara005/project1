import { notFound } from "next/navigation";
import { ReturnType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, toNumber } from "@/lib/utils";
import { PrintDocument } from "@/components/print-document";
import { RETURN_STATUS_LABELS, type ReturnStatusValue } from "../../labels";

export default async function ReturnPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const note = await prisma.returnNote.findUnique({
    where: { id },
    include: {
      customer: true,
      supplier: true,
      invoice: { select: { number: true } },
      warehouse: { select: { name: true } },
      items: { include: { product: { select: { sku: true, name: true, unit: true } } } },
    },
  });

  if (!note) notFound();

  const isSales = note.type === ReturnType.SALES;
  const user = await requireModule(isSales ? "sales" : "purchasing");

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) notFound();

  const party = isSales ? note.customer : note.supplier;

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
      title={isSales ? "إشعار دائن (مرتجع مبيعات)" : "إشعار مدين (مرتجع مشتريات)"}
      subtitle={isSales ? "Credit Note" : "Debit Note"}
      documentNumber={note.number}
      party={{
        heading: isSales ? "إشعار إلى" : "إشعار إلى المورد",
        name: party?.name ?? "—",
        code: party?.code ?? null,
        taxNumber: party?.taxNumber ?? null,
        address: party?.address ?? null,
        phone: party?.phone ?? null,
      }}
      meta={[
        { label: "تاريخ المرتجع", value: formatDate(note.returnDate) },
        { label: "الحالة", value: RETURN_STATUS_LABELS[note.status as ReturnStatusValue] },
        { label: "المستودع", value: note.warehouse.name },
        ...(note.invoice
          ? [{ label: "الفاتورة الأصلية", value: note.invoice.number }]
          : []),
      ]}
      lines={note.items.map((item) => ({
        id: item.id,
        description: item.product.name,
        sku: item.product.sku,
        quantity: toNumber(item.quantity),
        unit: item.product.unit,
        unitPrice: toNumber(item.unitPrice),
        taxRate: toNumber(item.taxRate),
        lineTotal: toNumber(item.lineTotal),
      }))}
      subtotal={toNumber(note.subtotal)}
      taxAmount={toNumber(note.taxAmount)}
      total={toNumber(note.total)}
      note={note.reason}
      footerNote={
        isSales
          ? "يخفّض هذا الإشعار المبلغ المستحق على العميل بقيمة المرتجع."
          : "يخفّض هذا الإشعار المبلغ المستحق للمورد بقيمة المرتجع."
      }
    />
  );
}
