"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { upsertExchangeRate, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الحفظ..." : "حفظ السعر"}
    </Button>
  );
}

export function RateForm({
  currencies,
  baseCode,
}: {
  currencies: Array<{ id: string; code: string; name: string }>;
  baseCode: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    upsertExchangeRate,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>تسجيل سعر صرف</CardTitle>
        <CardDescription>
          تسجيل سعر بنفس التاريخ يحدّث السعر القائم بدل تكراره.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            أضف عملة أجنبية مفعّلة أولاً لتسجيل سعر صرف لها.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <div>
              <Label htmlFor="currencyId">العملة</Label>
              <Select id="currencyId" name="currencyId" required defaultValue="">
                <option value="" disabled>
                  اختر العملة
                </option>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code} — {currency.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">
                السعر مقابل {baseCode || "عملة الأساس"}
              </Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.000001"
                min="0"
                required
                dir="ltr"
                placeholder="3.75"
              />
            </div>
            <div>
              <Label htmlFor="validFrom">سارٍ من</Label>
              <Input
                id="validFrom"
                name="validFrom"
                type="date"
                required
                dir="ltr"
                defaultValue={today}
              />
            </div>

            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                تم حفظ السعر
              </p>
            ) : null}

            <Submit />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
