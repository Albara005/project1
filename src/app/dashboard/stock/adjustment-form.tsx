"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
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
import { createStockAdjustment, type ActionState } from "./actions";

export type ProductOption = { id: string; sku: string; name: string; unit: string };
export type WarehouseOption = { id: string; code: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "جاري التنفيذ..." : "تنفيذ التسوية"}
    </Button>
  );
}

/** نموذج تسوية الجرد: كمية موجبة للزيادة وسالبة للنقص، مع سبب إلزامي. */
export function AdjustmentForm({
  products,
  warehouses,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createStockAdjustment,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  const disabled = products.length === 0 || warehouses.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>تسوية جرد</CardTitle>
        <CardDescription>
          أدخل كمية موجبة لزيادة الرصيد أو سالبة لتخفيضه، مع ذكر السبب.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            يلزم وجود منتج نشط ومستودع نشط واحد على الأقل لتنفيذ التسوية.
          </p>
        ) : (
          <form ref={formRef} action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="productId">المنتج</Label>
              <Select id="productId" name="productId" required defaultValue="">
                <option value="" disabled>
                  اختر منتجاً
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="warehouseId">المستودع</Label>
              <Select id="warehouseId" name="warehouseId" required defaultValue="">
                <option value="" disabled>
                  اختر مستودعاً
                </option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">الكمية (+ / −)</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.001"
                required
                dir="ltr"
                placeholder="5 أو 5-"
              />
            </div>

            <div>
              <Label htmlFor="note">سبب التسوية</Label>
              <Textarea
                id="note"
                name="note"
                required
                placeholder="مثال: فرق جرد سنوي، تلف، خطأ إدخال"
              />
            </div>

            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {state.error}
              </p>
            ) : null}

            {state.success ? (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                تم تسجيل التسوية وتحديث الرصيد.
              </p>
            ) : null}

            <SubmitButton />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
