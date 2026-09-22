"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { deleteState, deleteTransition } from "../actions";

function DeleteButton({ onDelete }: { onDelete: () => Promise<{ error?: string }> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label="حذف"
        onClick={() =>
          startTransition(async () => {
            const result = await onDelete();
            setError(result.error ?? null);
          })
        }
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function DeleteStateButton({ stateId }: { stateId: string }) {
  return <DeleteButton onDelete={() => deleteState(stateId)} />;
}

export function DeleteTransitionButton({ transitionId }: { transitionId: string }) {
  return <DeleteButton onDelete={() => deleteTransition(transitionId)} />;
}
