"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { recordPayment, type ActionState } from "./actions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
} from "../payments/labels";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "جاري التسجيل..." : "تسجيل دفعة"}
    </Button>
  );
}

export function PaymentForm({
  invoiceId,
  remaining,
  today,
}: {
  invoiceId: string;
  remaining: number;
  today: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    recordPayment,
    {},
  );

  const settled = remaining <= 0;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div>
        <Label htmlFor="amount">المبلغ (المتبقي {formatCurrency(remaining)})</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={remaining > 0 ? remaining : undefined}
          defaultValue={remaining > 0 ? remaining.toFixed(2) : ""}
          disabled={settled}
          required
        />
      </div>

      <div>
        <Label htmlFor="method">طريقة الدفع</Label>
        <Select id="method" name="method" defaultValue="CASH" disabled={settled}>
          {PAYMENT_METHOD_VALUES.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="paidAt">تاريخ الدفع</Label>
        <Input
          id="paidAt"
          name="paidAt"
          type="date"
          dir="ltr"
          defaultValue={today}
          disabled={settled}
        />
      </div>

      <div>
        <Label htmlFor="reference">المرجع</Label>
        <Input
          id="reference"
          name="reference"
          placeholder="رقم الحوالة أو الشيك"
          disabled={settled}
        />
      </div>

      <div>
        <Label htmlFor="note">ملاحظات</Label>
        <Textarea id="note" name="note" className="min-h-16" disabled={settled} />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          تم تسجيل الدفعة وترحيل القيد المحاسبي
        </p>
      ) : null}

      {settled ? (
        <p className="text-sm text-muted-foreground">الفاتورة مسددة بالكامل.</p>
      ) : (
        <SubmitButton disabled={settled} />
      )}
    </form>
  );
}
