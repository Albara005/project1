"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/labels";
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
import { createTransition, type ActionState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإضافة..." : "إضافة الانتقال"}
    </Button>
  );
}

export function TransitionForm({
  definitionId,
  states,
}: {
  definitionId: string;
  states: Array<{ id: string; label: string }>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTransition,
    {},
  );

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>إضافة انتقال</CardTitle>
        <CardDescription>
          اترك الأدوار فارغة للسماح للجميع. مدير النظام يستطيع تنفيذ كل الانتقالات دائماً.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="definitionId" value={definitionId} />
          <div>
            <Label htmlFor="label">اسم الإجراء</Label>
            <Input id="label" name="label" required placeholder="إرسال للاعتماد" />
          </div>
          <div>
            <Label htmlFor="fromStateId">من حالة</Label>
            <Select id="fromStateId" name="fromStateId" required defaultValue="">
              <option value="" disabled>
                اختر الحالة
              </option>
              {states.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="toStateId">إلى حالة</Label>
            <Select id="toStateId" name="toStateId" required defaultValue="">
              <option value="" disabled>
                اختر الحالة
              </option>
              {states.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>الأدوار المسموح لها</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border p-2">
              {ROLE_VALUES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="allowedRoles"
                    value={role}
                    className="h-3.5 w-3.5"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="minAmount">حد أدنى للقيمة</Label>
              <Input
                id="minAmount"
                name="minAmount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="20000"
              />
            </div>
            <div>
              <Label htmlFor="maxAmount">حد أعلى للقيمة</Label>
              <Input
                id="maxAmount"
                name="maxAmount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="20000"
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            اتركهما فارغين إن لم يكن الإجراء مقيّداً بقيمة المستند.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiresNote" className="h-4 w-4" />
            يتطلب إدخال ملاحظة
          </label>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
