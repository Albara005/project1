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
  Select,
} from "@/components/ui";
import { STATE_COLOR_OPTIONS } from "@/lib/labels";
import { createState, type ActionState } from "../actions";



function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإضافة..." : "إضافة الحالة"}
    </Button>
  );
}

export function StateForm({ definitionId }: { definitionId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createState, {});

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>إضافة حالة</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="definitionId" value={definitionId} />
          <div>
            <Label htmlFor="key">المفتاح</Label>
            <Input
              id="key"
              name="key"
              required
              dir="ltr"
              placeholder="PENDING_APPROVAL"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="label">الاسم المعروض</Label>
            <Input id="label" name="label" required placeholder="بانتظار الاعتماد" />
          </div>
          <div>
            <Label htmlFor="color">اللون</Label>
            <Select id="color" name="color" defaultValue="gray">
              {STATE_COLOR_OPTIONS.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isInitial" className="h-4 w-4" />
            حالة ابتدائية (تحل محل الحالة الابتدائية الحالية)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isFinal" className="h-4 w-4" />
            حالة نهائية
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
