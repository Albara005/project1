"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { createCurrency, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإضافة..." : "إضافة العملة"}
    </Button>
  );
}

export function CurrencyForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createCurrency, {});

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>عملة جديدة</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="code">الرمز (ISO)</Label>
            <Input
              id="code"
              name="code"
              required
              dir="ltr"
              maxLength={3}
              placeholder="USD"
              className="font-mono uppercase"
            />
          </div>
          <div>
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" required placeholder="دولار أمريكي" />
          </div>
          <div>
            <Label htmlFor="symbol">الرمز المعروض</Label>
            <Input id="symbol" name="symbol" required placeholder="$" />
          </div>
          <div>
            <Label htmlFor="decimals">الخانات العشرية</Label>
            <Input
              id="decimals"
              name="decimals"
              type="number"
              min={0}
              max={4}
              defaultValue={2}
              dir="ltr"
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تمت إضافة العملة
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
