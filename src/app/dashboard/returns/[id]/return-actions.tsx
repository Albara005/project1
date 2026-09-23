"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { cancelReturn, confirmReturn } from "../actions";
import type { ReturnStatusValue } from "../labels";

export function ReturnActions({
  returnNoteId,
  status,
}: {
  returnNoteId: string;
  status: ReturnStatusValue;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "DRAFT") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الإجراءات</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {status === "CONFIRMED"
              ? "تم تأكيد المرتجع وتحديث المخزون والقيود. لعكس الأثر سجّل مستنداً معاكساً."
              : "هذا المرتجع ملغي."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>الإجراءات</CardTitle>
        <CardDescription>
          التأكيد يحرّك المخزون ويرحّل القيد المحاسبي في عملية واحدة.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await confirmReturn(returnNoteId);
                setError(result.error ?? null);
              })
            }
          >
            {pending ? "جاري التنفيذ..." : "تأكيد المرتجع"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelReturn(returnNoteId);
                setError(result.error ?? null);
              })
            }
          >
            إلغاء
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
