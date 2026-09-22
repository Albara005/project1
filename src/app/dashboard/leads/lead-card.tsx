"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { convertLeadToCustomer, deleteLead, updateLeadStatus } from "./actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "./lead-status";

export type LeadCardData = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  estimatedValue: number;
  customerId: string | null;
  customerName: string | null;
};

export function LeadCard({ lead }: { lead: LeadCardData }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="text-sm font-semibold hover:underline"
        >
          {lead.name}
        </Link>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatCurrency(lead.estimatedValue)}
        </span>
      </div>

      {lead.company ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.company}</p>
      ) : null}
      {lead.phone ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
          {lead.phone}
        </p>
      ) : null}
      {lead.source ? (
        <p className="mt-1 text-xs text-muted-foreground">المصدر: {lead.source}</p>
      ) : null}

      {lead.customerId ? (
        <div className="mt-2">
          <Badge tone="green">
            تم التحويل إلى عميل{lead.customerName ? `: ${lead.customerName}` : ""}
          </Badge>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <Select
          aria-label="مرحلة الفرصة"
          className="h-8 text-xs"
          value={lead.status}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.value;
            run(() => updateLeadStatus(lead.id, value));
          }}
        >
          {LEAD_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap gap-1.5">
          {lead.status === "WON" && !lead.customerId ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => convertLeadToCustomer(lead.id))}
            >
              تحويل إلى عميل
            </Button>
          ) : null}
          {lead.customerId ? (
            <Link href={`/dashboard/customers/${lead.customerId}`}>
              <Button size="sm" variant="outline" type="button">
                ملف العميل
              </Button>
            </Link>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("هل تريد حذف هذه الفرصة؟")) return;
              run(() => deleteLead(lead.id));
            }}
          >
            حذف
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
