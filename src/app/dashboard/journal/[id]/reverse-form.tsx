"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { reverseEntry, type ActionState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "جاري العكس..." : "عكس القيد"}
    </Button>
  );
}

export function ReverseForm({ entryId }: { entryId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    reverseEntry,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={entryId} />
      <p className="text-sm text-muted-foreground">
        ينشئ عكس القيد قيداً جديداً معاكساً (تبديل المدين والدائن) ويحوّل هذا
        القيد إلى حالة &quot;معكوس&quot;.
      </p>
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
