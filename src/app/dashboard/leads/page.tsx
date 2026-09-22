import Link from "next/link";
import { LeadStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatCurrency, toNumber } from "@/lib/utils";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { LeadCard } from "./lead-card";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, LEAD_STATUS_TONES } from "./lead-status";

export default async function LeadsPage() {
  await requireModule("crm");

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, name: true } } },
  });

  const rows = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    estimatedValue: toNumber(lead.estimatedValue),
    customerId: lead.customer?.id ?? null,
    customerName: lead.customer?.name ?? null,
  }));

  const openValue = rows
    .filter((lead) => lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST)
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  return (
    <div>
      <PageHeader
        title="الفرص البيعية"
        description={`مسار البيع — ${rows.length} فرصة، قيمة الفرص المفتوحة ${formatCurrency(openValue)}`}
        action={
          <Link href="/dashboard/leads/new">
            <Button>فرصة جديدة</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد فرص بيعية"
          description="أضف أول فرصة وتابعها عبر مراحل مسار البيع حتى تحويلها إلى عميل."
          action={
            <Link href="/dashboard/leads/new">
              <Button>فرصة جديدة</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {LEAD_STATUS_ORDER.map((status) => {
            const columnLeads = rows.filter((lead) => lead.status === status);
            const columnValue = columnLeads.reduce(
              (sum, lead) => sum + lead.estimatedValue,
              0,
            );

            return (
              <section
                key={status}
                className="rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone={LEAD_STATUS_TONES[status]}>
                    {LEAD_STATUS_LABELS[status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {columnLeads.length} · {formatCurrency(columnValue)}
                  </span>
                </div>

                {columnLeads.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    لا توجد فرص في هذه المرحلة
                  </p>
                ) : (
                  <div className="space-y-2">
                    {columnLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
