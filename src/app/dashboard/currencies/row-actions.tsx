"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  deleteExchangeRate,
  setBaseCurrency,
  toggleCurrencyActive,
} from "./actions";

export function CurrencyRowActions({
  currencyId,
  isActive,
  isBase,
  canChangeBase,
}: {
  currencyId: string;
  isActive: boolean;
  isBase: boolean;
  canChangeBase: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {!isBase && canChangeBase ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setBaseCurrency(currencyId);
              setError(result.error ?? null);
            })
          }
        >
          اجعلها الأساس
        </Button>
      ) : null}

      {!isBase ? (
        <Button
          size="sm"
          variant={isActive ? "outline" : "primary"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await toggleCurrencyActive(currencyId, !isActive);
              setError(result.error ?? null);
            })
          }
        >
          {isActive ? "تعطيل" : "تفعيل"}
        </Button>
      ) : null}

      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

export function DeleteRateButton({ rateId }: { rateId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="icon"
        variant="ghost"
        aria-label="حذف السعر"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteExchangeRate(rateId);
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
