"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_VALUES } from "@/lib/labels";
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
  Textarea,
} from "@/components/ui";
import { createDefinition, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "جاري الإنشاء..." : "إنشاء التعريف"}
    </Button>
  );
}

export function DefinitionForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createDefinition,
    {},
  );

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>تعريف سير عمل جديد</CardTitle>
        <CardDescription>
          يُنشأ بحالة ابتدائية واحدة (مسودة)، ثم تضيف بقية الحالات والانتقالات.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" required placeholder="مثال: اعتماد أوامر الشراء" />
          </div>
          <div>
            <Label htmlFor="entityType">نوع المستند</Label>
            <Select id="entityType" name="entityType" required defaultValue="">
              <option value="" disabled>
                اختر النوع
              </option>
              {ENTITY_TYPE_VALUES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              تم إنشاء التعريف
            </p>
          ) : null}

          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
