"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      طباعة المستند
    </Button>
  );
}
