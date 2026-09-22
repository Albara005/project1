"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  approvePayslip,
  payPeriod,
  runPayroll,
  updatePayslipDeductions,
  type ActionState,
} from "./actions";
import { MONTH_LABELS } from "./labels";

const MONTH_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function Feedback({ state, small }: { state: ActionState; small?: boolean }) {
  const base = small ? "mt-1 text-xs" : "rounded-lg px-3 py-2 text-sm";
  if (state.error) {
    return (
      <p
        className={
          small
            ? `${base} text-red-700 dark:text-red-300`
            : `${base} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`
        }
      >
        {state.error}
      </p>
    );
  }
  if (state.success && state.message) {
    return (
      <p
        className={
          small
            ? `${base} text-green-700 dark:text-green-300`
            : `${base} bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300`
        }
      >
        {state.message}
      </p>
    );
  }
  return null;
}

function PendingButton({
  label,
  pendingLabel,
  variant = "primary",
  size = "md",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** تشغيل الرواتب لفترة مختارة. */
export function PayrollRunForm({
  years,
  currentYear,
  currentMonth,
}: {
  years: number[];
  currentYear: number;
  currentMonth: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(runPayroll, {});

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Label htmlFor="periodYear">السنة</Label>
          <Select id="periodYear" name="periodYear" defaultValue={String(currentYear)}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Label htmlFor="periodMonth">الشهر</Label>
          <Select id="periodMonth" name="periodMonth" defaultValue={String(currentMonth)}>
            {MONTH_VALUES.map((month) => (
              <option key={month} value={month}>
                {MONTH_LABELS[month]}
              </option>
            ))}
          </Select>
        </div>
        <PendingButton label="تشغيل الرواتب" pendingLabel="جاري التشغيل..." />
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** تعديل استقطاعات مسيّر بحالة مسودة. */
export function PayslipDeductionsForm({
  payslipId,
  deductions,
}: {
  payslipId: string;
  deductions: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updatePayslipDeductions,
    {},
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="payslipId" value={payslipId} />
      <Input
        name="deductions"
        type="number"
        step="0.01"
        min="0"
        defaultValue={String(deductions)}
        aria-label="الاستقطاعات"
        className="h-8 w-28 text-xs"
      />
      <PendingButton
        label="حفظ"
        pendingLabel="..."
        variant="outline"
        size="sm"
      />
      <Feedback state={state} small />
    </form>
  );
}

/** اعتماد مسيّر: مسودة ← معتمد. */
export function ApprovePayslipForm({ payslipId }: { payslipId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(approvePayslip, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="payslipId" value={payslipId} />
      <PendingButton label="اعتماد" pendingLabel="..." variant="secondary" size="sm" />
      <Feedback state={state} small />
    </form>
  );
}

/** صرف رواتب فترة معتمدة كاملة مع ترحيل القيد المجمّع. */
export function PayPeriodForm({
  periodYear,
  periodMonth,
  disabled,
}: {
  periodYear: number;
  periodMonth: number;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(payPeriod, {});

  if (disabled) return null;

  return (
    <form action={formAction} className="text-end">
      <input type="hidden" name="periodYear" value={periodYear} />
      <input type="hidden" name="periodMonth" value={periodMonth} />
      <PendingButton label="صرف الرواتب" pendingLabel="جاري الصرف..." size="sm" />
      <Feedback state={state} small />
    </form>
  );
}
