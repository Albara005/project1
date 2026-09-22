"use client";

import { useState, useTransition } from "react";
import { Button, Select } from "@/components/ui";
import { assignUserBranch, toggleBranchActive } from "./actions";

export function BranchRowActions({
  branchId,
  isActive,
}: {
  branchId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="sm"
        variant={isActive ? "outline" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleBranchActive(branchId, !isActive);
            setError(result.error ?? null);
          })
        }
      >
        {isActive ? "تعطيل" : "تفعيل"}
      </Button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function UserBranchSelect({
  userId,
  branchId,
  branches,
}: {
  userId: string;
  branchId: string | null;
  branches: Array<{ id: string; name: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Select
        className="h-8 w-52 text-xs"
        defaultValue={branchId ?? ""}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () => {
            const value = event.target.value;
            const result = await assignUserBranch(userId, value === "" ? null : value);
            setError(result.error ?? null);
          })
        }
      >
        <option value="">كل الفروع</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </Select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
