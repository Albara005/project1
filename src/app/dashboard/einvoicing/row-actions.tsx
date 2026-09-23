"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { issueForInvoice, submitToZatca } from "./actions";

export function SubmitButton({
  eInvoiceId,
  disabled,
}: {
  eInvoiceId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            const result = await submitToZatca(eInvoiceId);
            setMessage(result.error ?? result.success ?? null);
          })
        }
      >
        {pending ? "جاري الإرسال..." : "إرسال للهيئة"}
      </Button>
      {message ? (
        <p className="mt-1 max-w-56 text-[11px] text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}

/** يُستخدم في صفحة الفاتورة لإصدار نسختها الإلكترونية وتوقيعها. */
export function IssueEInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await issueForInvoice(invoiceId);
            setMessage(result.error ?? result.success ?? null);
          })
        }
      >
        {pending ? "جاري الإصدار..." : "إصدار فاتورة إلكترونية"}
      </Button>
      {message ? (
        <p className="mt-1 max-w-64 text-[11px] text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
