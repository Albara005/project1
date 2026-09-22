"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { createLeaveRequest, type ActionState } from "./actions";
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_VALUES } from "./labels";

export type LeaveEmployeeOption = { id: string; label: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الإرسال..." : "إرسال الطلب"}
    </Button>
  );
}

export function LeaveForm({ employees }: { employees: LeaveEmployeeOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createLeaveRequest, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="employeeId">الموظف</Label>
          <Select id="employeeId" name="employeeId" required defaultValue="">
            <option value="" disabled>
              — اختر الموظف —
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="type">نوع الإجازة</Label>
          <Select id="type" name="type" defaultValue="ANNUAL">
            {LEAVE_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {LEAVE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="startDate">من تاريخ</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div>
          <Label htmlFor="endDate">إلى تاريخ</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>

      <div>
        <Label htmlFor="reason">سبب الإجازة</Label>
        <Textarea id="reason" name="reason" placeholder="سبب الطلب (اختياري)" />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.success && state.message ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
