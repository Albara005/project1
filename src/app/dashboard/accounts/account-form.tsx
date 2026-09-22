"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
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
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from "./account-labels";
import { createAccount, updateAccount, type ActionState } from "./actions";

export type AccountOption = {
  id: string;
  code: string;
  name: string;
};

export type EditingAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة الحساب"}
    </Button>
  );
}

export function AccountForm({
  parentOptions,
  editing,
}: {
  parentOptions: AccountOption[];
  editing?: EditingAccount;
}) {
  const action = editing ? updateAccount : createAccount;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !editing) formRef.current?.reset();
  }, [state, editing]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>
          {editing ? `تعديل الحساب ${editing.code}` : "إضافة حساب جديد"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="code">رمز الحساب</Label>
              <Input
                id="code"
                name="code"
                required
                dir="ltr"
                placeholder="5400"
                defaultValue={editing?.code ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="name">اسم الحساب</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="مصروفات تسويق"
                defaultValue={editing?.name ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="type">نوع الحساب</Label>
              <Select id="type" name="type" defaultValue={editing?.type ?? "ASSET"}>
                {ACCOUNT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="parentId">الحساب الأب (اختياري)</Label>
              <Select
                id="parentId"
                name="parentId"
                defaultValue={editing?.parentId ?? ""}
              >
                <option value="">— بدون حساب أب —</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-3">
              <Label htmlFor="description">وصف (اختياري)</Label>
              <Input
                id="description"
                name="description"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="isActive">الحالة</Label>
              <Select
                id="isActive"
                name="isActive"
                defaultValue={editing && !editing.isActive ? "false" : "true"}
              >
                <option value="true">نشط</option>
                <option value="false">غير نشط</option>
              </Select>
            </div>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success && !editing ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تمت إضافة الحساب بنجاح
            </p>
          ) : null}

          <div className="flex gap-2">
            <SubmitButton editing={Boolean(editing)} />
            {editing ? (
              <Link href="/dashboard/accounts">
                <Button type="button" variant="outline">
                  إلغاء
                </Button>
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
