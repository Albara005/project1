"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  deleteDepartment,
  deletePosition,
  saveDepartment,
  savePosition,
  type ActionState,
} from "./actions";

export type DepartmentOption = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : label}
    </Button>
  );
}

function FeedBack({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.success && state.message) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        {state.message}
      </p>
    );
  }
  return null;
}

export function DepartmentForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(saveDepartment, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="dep-code">رمز القسم</Label>
          <Input id="dep-code" name="code" required placeholder="DEP-HR" dir="ltr" />
        </div>
        <div>
          <Label htmlFor="dep-name">اسم القسم</Label>
          <Input id="dep-name" name="name" required placeholder="الموارد البشرية" />
        </div>
      </div>
      <FeedBack state={state} />
      <SubmitButton label="إضافة القسم" />
    </form>
  );
}

export function PositionForm({ departments }: { departments: DepartmentOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePosition, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pos-title">المسمى الوظيفي</Label>
          <Input id="pos-title" name="title" required placeholder="أخصائي موارد بشرية" />
        </div>
        <div>
          <Label htmlFor="pos-department">القسم</Label>
          <Select id="pos-department" name="departmentId" defaultValue="">
            <option value="">— بدون قسم —</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FeedBack state={state} />
      <SubmitButton label="إضافة المسمى الوظيفي" />
    </form>
  );
}

function RowDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? "..." : "حذف"}
    </Button>
  );
}

export function DeleteDepartmentForm({ departmentId }: { departmentId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteDepartment, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={departmentId} />
      <RowDeleteButton />
      {state.error ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-300">{state.error}</p>
      ) : null}
    </form>
  );
}

export function DeletePositionForm({ positionId }: { positionId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deletePosition, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={positionId} />
      <RowDeleteButton />
      {state.error ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-300">{state.error}</p>
      ) : null}
    </form>
  );
}
