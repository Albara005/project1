"use client";

import { useState, useTransition } from "react";
import type { Role } from "@/generated/prisma";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/labels";
import { Button, Select } from "@/components/ui";
import { toggleUserActive, updateUserRole } from "./actions";

export function UserRowActions({
  userId,
  role,
  isActive,
}: {
  userId: string;
  role: Role;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Select
        className="h-8 w-36 text-xs"
        defaultValue={role}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () => {
            const result = await updateUserRole(userId, event.target.value as Role);
            setError(result.error ?? null);
          })
        }
      >
        {ROLE_VALUES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </Select>

      <Button
        size="sm"
        variant={isActive ? "outline" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleUserActive(userId, !isActive);
            setError(result.error ?? null);
          })
        }
      >
        {isActive ? "تعطيل" : "تفعيل"}
      </Button>

      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
