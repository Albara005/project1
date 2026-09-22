"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteCustomer } from "./actions";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("هل تريد حذف هذا العميل نهائياً؟")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteCustomer(customerId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "جاري الحذف..." : "حذف العميل"}
      </Button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
