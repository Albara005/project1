"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { convertLeadToCustomer } from "./actions";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await convertLeadToCustomer(leadId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "جاري التحويل..." : "تحويل إلى عميل"}
      </Button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
