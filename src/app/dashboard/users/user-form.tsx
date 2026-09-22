"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/labels";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { createUser, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإضافة..." : "إضافة المستخدم"}
    </Button>
  );
}

export function UserForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createUser, {});

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>مستخدم جديد</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" name="email" type="email" required dir="ltr" />
          </div>
          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" name="password" type="password" required minLength={8} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="role">الدور</Label>
            <Select id="role" name="role" defaultValue="EMPLOYEE">
              {ROLE_VALUES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تمت إضافة المستخدم
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
