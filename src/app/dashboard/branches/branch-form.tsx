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
  Textarea,
} from "@/components/ui";
import { createBranch, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإضافة..." : "إضافة الفرع"}
    </Button>
  );
}

export function BranchForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createBranch, {});

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>فرع جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="code">الرمز</Label>
            <Input
              id="code"
              name="code"
              required
              dir="ltr"
              placeholder="BR-DMM"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" required placeholder="فرع الدمام" />
          </div>
          <div>
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" name="phone" dir="ltr" />
          </div>
          <div>
            <Label htmlFor="address">العنوان</Label>
            <Textarea id="address" name="address" rows={2} />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تمت إضافة الفرع
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
