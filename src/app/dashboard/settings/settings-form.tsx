"use client";

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
import { updateOrganization, type ActionState } from "./actions";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : "حفظ التغييرات"}
    </Button>
  );
}

export function SettingsForm({
  organization,
}: {
  organization: {
    name: string;
    legalName: string;
    taxNumber: string;
    currency: string;
    email: string;
    phone: string;
    address: string;
    fiscalYearStartMonth: number;
  };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateOrganization,
    {},
  );

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">اسم المنشأة</Label>
              <Input id="name" name="name" defaultValue={organization.name} required />
            </div>
            <div>
              <Label htmlFor="legalName">الاسم النظامي</Label>
              <Input id="legalName" name="legalName" defaultValue={organization.legalName} />
            </div>
            <div>
              <Label htmlFor="taxNumber">الرقم الضريبي</Label>
              <Input
                id="taxNumber"
                name="taxNumber"
                defaultValue={organization.taxNumber}
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="currency">العملة</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={organization.currency}
                maxLength={3}
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" name="email" type="email" defaultValue={organization.email} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" name="phone" defaultValue={organization.phone} dir="ltr" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="fiscalYearStartMonth">بداية السنة المالية</Label>
              <Select
                id="fiscalYearStartMonth"
                name="fiscalYearStartMonth"
                defaultValue={String(organization.fiscalYearStartMonth)}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">العنوان</Label>
              <Textarea id="address" name="address" defaultValue={organization.address} rows={2} />
            </div>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تم حفظ الإعدادات
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
