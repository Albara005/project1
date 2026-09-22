"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@/components/ui";
import type { AvailableTransition, WorkflowSnapshot } from "@/lib/workflow";

export type WorkflowHistoryRow = {
  id: string;
  fromStateKey: string | null;
  toStateKey: string;
  note: string | null;
  createdAt: Date;
  actor: { name: string } | null;
};

const TONE_BY_COLOR: Record<string, "gray" | "blue" | "green" | "amber" | "red" | "purple"> = {
  gray: "gray",
  blue: "blue",
  green: "green",
  amber: "amber",
  red: "red",
  purple: "purple",
};

/**
 * لوحة سير العمل: تعرض الحالة الحالية والإجراءات المتاحة للمستخدم الحالي.
 * الإجراءات تأتي ديناميكياً من تعريف سير العمل في قاعدة البيانات.
 */
export function WorkflowPanel({
  snapshot,
  history,
  onTransition,
}: {
  snapshot: WorkflowSnapshot | null;
  history: WorkflowHistoryRow[];
  onTransition: (transitionId: string, note: string) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTransition, setActiveTransition] = useState<AvailableTransition | null>(null);
  const [note, setNote] = useState("");

  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>سير العمل</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لا يوجد تعريف سير عمل نشط لهذا النوع من المستندات.
          </p>
        </CardContent>
      </Card>
    );
  }

  function run(transition: AvailableTransition, noteValue: string) {
    setError(null);
    startTransition(async () => {
      const result = await onTransition(transition.id, noteValue);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setActiveTransition(null);
      setNote("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>سير العمل — {snapshot.definitionName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">الحالة الحالية:</span>
          <Badge tone={TONE_BY_COLOR[snapshot.currentStateColor] ?? "gray"}>
            {snapshot.currentStateLabel}
          </Badge>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {snapshot.availableTransitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {snapshot.isFinal
              ? "اكتمل سير العمل لهذا المستند."
              : "لا توجد إجراءات متاحة لك في هذه الحالة."}
          </p>
        ) : activeTransition ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{activeTransition.label}</p>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                activeTransition.requiresNote ? "الملاحظة مطلوبة لهذا الإجراء" : "ملاحظة (اختياري)"
              }
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending || (activeTransition.requiresNote && !note.trim())}
                onClick={() => run(activeTransition, note)}
              >
                {pending ? "جاري التنفيذ..." : "تأكيد"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setActiveTransition(null);
                  setNote("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {snapshot.availableTransitions.map((transition) => (
              <Button
                key={transition.id}
                size="sm"
                variant={transition.requiresNote ? "outline" : "primary"}
                disabled={pending}
                onClick={() => {
                  if (transition.requiresNote) {
                    setActiveTransition(transition);
                  } else {
                    run(transition, "");
                  }
                }}
              >
                {transition.label}
              </Button>
            ))}
          </div>
        )}

        {history.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              سجل الإجراءات
            </p>
            <ul className="space-y-2">
              {history.map((row) => (
                <li key={row.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {row.fromStateKey ? `${row.fromStateKey} ← ${row.toStateKey}` : row.toStateKey}
                  </span>
                  {row.actor ? ` · ${row.actor.name}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
