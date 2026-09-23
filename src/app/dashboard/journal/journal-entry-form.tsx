"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
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
import { formatCurrency } from "@/lib/utils";
import { createManualEntry, type ActionState } from "./actions";

/** خيار حساب في قائمة الاختيار — قيم نصية بسيطة قادمة من مكوّن الخادم. */
export type AccountOption = {
  code: string;
  name: string;
  typeLabel: string;
};

/** خيار فرع — قيم نصية بسيطة قادمة من مكوّن الخادم. */
export type BranchChoice = {
  id: string;
  code: string;
  name: string;
};

type LineRow = {
  key: number;
  accountCode: string;
  debit: string;
  credit: string;
  description: string;
};

function emptyRow(key: number): LineRow {
  return { key, accountCode: "", debit: "", credit: "", description: "" };
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "جاري الترحيل..." : "ترحيل القيد"}
    </Button>
  );
}

export function JournalEntryForm({
  accounts,
  today,
  branches,
  defaultBranchId,
  canChooseBranch,
  lockedBranchName,
}: {
  accounts: AccountOption[];
  today: string;
  branches: BranchChoice[];
  defaultBranchId: string;
  canChooseBranch: boolean;
  lockedBranchName: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createManualEntry,
    {},
  );
  const [rows, setRows] = useState<LineRow[]>([emptyRow(1), emptyRow(2)]);

  const totals = useMemo(() => {
    const debit = rows.reduce((sum, row) => sum + parseAmount(row.debit), 0);
    const credit = rows.reduce((sum, row) => sum + parseAmount(row.credit), 0);
    return { debit, credit, difference: debit - credit };
  }, [rows]);

  const serializedLines = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          accountCode: row.accountCode,
          debit: parseAmount(row.debit),
          credit: parseAmount(row.credit),
          description: row.description,
        })),
      ),
    [rows],
  );

  const filledRows = rows.filter(
    (row) => row.accountCode !== "" || parseAmount(row.debit) > 0 || parseAmount(row.credit) > 0,
  );
  const isBalanced = Math.abs(totals.difference) < 0.005;
  const canSubmit = isBalanced && totals.debit > 0 && filledRows.length >= 2;

  function updateRow(key: number, patch: Partial<LineRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      emptyRow(Math.max(0, ...current.map((row) => row.key)) + 1),
    ]);
  }

  function removeRow(key: number) {
    setRows((current) =>
      current.length <= 2 ? current : current.filter((row) => row.key !== key),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="lines" value={serializedLines} />

      <Card>
        <CardHeader>
          <CardTitle>بيانات القيد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="entryDate">تاريخ القيد</Label>
              <Input
                id="entryDate"
                name="entryDate"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div>
              <Label htmlFor="branchId">الفرع</Label>
              {canChooseBranch ? (
                <Select
                  id="branchId"
                  name="branchId"
                  defaultValue={defaultBranchId}
                >
                  <option value="">بدون فرع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <input type="hidden" name="branchId" value={defaultBranchId} />
                  <p className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm">
                    {lockedBranchName ?? "بدون فرع"}
                  </p>
                </>
              )}
            </div>
            <div>
              <Label htmlFor="description">البيان</Label>
              <Input
                id="description"
                name="description"
                required
                placeholder="مثال: تسوية مصروفات إيجار شهر يناير"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سطور القيد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden gap-3 px-1 text-xs font-semibold text-muted-foreground md:grid md:grid-cols-[2fr_1fr_1fr_2fr_auto]">
            <span>الحساب</span>
            <span>مدين</span>
            <span>دائن</span>
            <span>بيان السطر</span>
            <span />
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[2fr_1fr_1fr_2fr_auto] md:items-center md:border-0 md:p-1"
            >
              <div>
                <Label className="md:hidden">الحساب</Label>
                <Select
                  value={row.accountCode}
                  onChange={(event) =>
                    updateRow(row.key, { accountCode: event.target.value })
                  }
                  aria-label="الحساب"
                >
                  <option value="">— اختر الحساب —</option>
                  {accounts.map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} — {account.name} ({account.typeLabel})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label className="md:hidden">مدين</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={row.debit}
                  aria-label="مدين"
                  onChange={(event) =>
                    updateRow(row.key, {
                      debit: event.target.value,
                      credit: event.target.value ? "" : row.credit,
                    })
                  }
                />
              </div>

              <div>
                <Label className="md:hidden">دائن</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={row.credit}
                  aria-label="دائن"
                  onChange={(event) =>
                    updateRow(row.key, {
                      credit: event.target.value,
                      debit: event.target.value ? "" : row.debit,
                    })
                  }
                />
              </div>

              <div>
                <Label className="md:hidden">بيان السطر</Label>
                <Input
                  value={row.description}
                  aria-label="بيان السطر"
                  placeholder="اختياري"
                  onChange={(event) =>
                    updateRow(row.key, { description: event.target.value })
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rows.length <= 2}
                onClick={() => removeRow(row.key)}
              >
                حذف
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            إضافة سطر
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
            <span>
              إجمالي المدين:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(totals.debit)}
              </span>
            </span>
            <span>
              إجمالي الدائن:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(totals.credit)}
              </span>
            </span>
            <span
              className={
                isBalanced
                  ? "font-semibold text-green-700 dark:text-green-400"
                  : "font-semibold text-red-700 dark:text-red-400"
              }
            >
              الفرق:{" "}
              <span className="tabular-nums">
                {formatCurrency(totals.difference)}
              </span>
              {isBalanced ? " — القيد متوازن" : " — القيد غير متوازن"}
            </span>
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton disabled={!canSubmit} />
        <Link href="/dashboard/journal">
          <Button type="button" variant="outline">
            إلغاء
          </Button>
        </Link>
      </div>
    </form>
  );
}
