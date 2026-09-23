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
  Textarea,
} from "@/components/ui";
import { createCustomer, updateCustomer, type ActionState } from "./actions";

export type CustomerFormValues = {
  id?: string;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  creditLimit: number;
  isActive: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : label}
    </Button>
  );
}

export function CustomerForm({
  customer,
  mode,
}: {
  customer?: CustomerFormValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createCustomer : updateCustomer;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          {mode === "edit" ? (
            <input type="hidden" name="id" value={customer?.id ?? ""} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code">رمز العميل</Label>
              <Input
                id="code"
                name="code"
                required
                defaultValue={customer?.code ?? ""}
                placeholder="CUS-004"
              />
            </div>
            <div>
              <Label htmlFor="name">اسم العميل</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={customer?.name ?? ""}
                placeholder="شركة ..."
              />
            </div>
            <div>
              <Label htmlFor="contactName">اسم جهة الاتصال</Label>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={customer?.contactName ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={customer?.phone ?? ""}
                placeholder="+9665xxxxxxxx"
              />
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={customer?.email ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="taxNumber">الرقم الضريبي</Label>
              <Input
                id="taxNumber"
                name="taxNumber"
                dir="ltr"
                defaultValue={customer?.taxNumber ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="creditLimit">حد الائتمان</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                min="0"
                defaultValue={customer?.creditLimit ?? 0}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={customer?.isActive ?? true}
                  className="h-4 w-4 rounded border-border"
                />
                عميل نشط
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="address">العنوان</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={customer?.address ?? ""}
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تم حفظ بيانات العميل
            </p>
          ) : null}

          <div className="flex gap-2">
            <SubmitButton label={mode === "create" ? "إضافة العميل" : "حفظ التعديلات"} />
            <Link href="/dashboard/customers">
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
