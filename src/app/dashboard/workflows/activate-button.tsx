"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { toggleDefinitionActive } from "./actions";

export function ActivateButton({
  definitionId,
  isActive,
}: {
  definitionId: string;
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
            const result = await toggleDefinitionActive(definitionId, !isActive);
            setError(result.error ?? null);
          })
        }
      >
        {isActive ? "إيقاف" : "تفعيل"}
      </Button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
