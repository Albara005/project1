"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { deleteEmployee, type ActionState } from "./actions";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "جاري الحذف..." : "حذف الموظف"}
    </Button>
  );
}

export function DeleteEmployeeForm({ employeeId }: { employeeId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteEmployee, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={employeeId} />
      <DeleteButton />
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
