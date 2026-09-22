"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { createLead, updateLead, type ActionState } from "./actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "./lead-status";

export type LeadFormValues = {
  id?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  note: string;
  status: string;
  estimatedValue: number;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : label}
    </Button>
  );
}

export function LeadForm({
  lead,
  mode,
}: {
  lead?: LeadFormValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createLead : updateLead;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          {mode === "edit" ? (
            <input type="hidden" name="id" value={lead?.id ?? ""} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">اسم العميل المحتمل</Label>
              <Input id="name" name="name" required defaultValue={lead?.name ?? ""} />
            </div>
            <div>
              <Label htmlFor="company">الشركة</Label>
              <Input id="company" name="company" defaultValue={lead?.company ?? ""} />
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={lead?.email ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" name="phone" dir="ltr" defaultValue={lead?.phone ?? ""} />
            </div>
            <div>
              <Label htmlFor="source">المصدر</Label>
              <Input
                id="source"
                name="source"
                placeholder="معرض، إحالة، موقع إلكتروني..."
                defaultValue={lead?.source ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="estimatedValue">القيمة المتوقعة</Label>
              <Input
                id="estimatedValue"
                name="estimatedValue"
                type="number"
                step="0.01"
                min="0"
                defaultValue={lead?.estimatedValue ?? 0}
              />
            </div>
            <div>
              <Label htmlFor="status">المرحلة</Label>
              <Select id="status" name="status" defaultValue={lead?.status ?? "NEW"}>
                {LEAD_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="note">ملاحظات</Label>
            <Textarea id="note" name="note" defaultValue={lead?.note ?? ""} />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تم حفظ الفرصة البيعية
            </p>
          ) : null}

          <div className="flex gap-2">
            <SubmitButton label={mode === "create" ? "إضافة الفرصة" : "حفظ التعديلات"} />
            <Link href="/dashboard/leads">
              <Button type="button" variant="outline">
                رجوع
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
