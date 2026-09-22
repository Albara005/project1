import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { ConvertLeadButton } from "../convert-lead-button";
import { LeadForm } from "../lead-form";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from "../lead-status";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("crm");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, code: true } } },
  });

  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={lead.name}
        description={lead.company ?? "فرصة بيعية"}
        action={
          <Badge tone={LEAD_STATUS_TONES[lead.status]}>
            {LEAD_STATUS_LABELS[lead.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeadForm
            mode="edit"
            lead={{
              id: lead.id,
              name: lead.name,
              company: lead.company ?? "",
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              source: lead.source ?? "",
              note: lead.note ?? "",
              status: lead.status,
              estimatedValue: toNumber(lead.estimatedValue),
            }}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تحويل الفرصة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>القيمة المتوقعة: {formatCurrency(toNumber(lead.estimatedValue))}</p>
              <p>تاريخ الإنشاء: {formatDate(lead.createdAt)}</p>
              <p>آخر تحديث: {formatDate(lead.updatedAt)}</p>
            </div>

            {lead.customer ? (
              <div className="space-y-2">
                <Badge tone="green">تم التحويل إلى عميل</Badge>
                <p className="text-sm">
                  <Link
                    href={`/dashboard/customers/${lead.customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {lead.customer.code} — {lead.customer.name}
                  </Link>
                </p>
              </div>
            ) : lead.status === LeadStatus.WON ? (
              <ConvertLeadButton leadId={lead.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                يمكن تحويل الفرصة إلى عميل بعد نقلها إلى مرحلة «مكسوبة».
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
