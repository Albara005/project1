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
  Textarea,
} from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { createSalesOrder, type ActionState } from "./actions";

export type CustomerOption = { id: string; code: string; name: string };
export type WarehouseOption = { id: string; code: string; name: string };
export type CurrencyOption = { id: string; code: string; name: string };
export type BranchOption = { id: string; code: string; name: string };
export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  salePrice: number;
  taxRate: number;
};

type LineRow = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

function emptyLine(): LineRow {
  return {
    key: Math.random().toString(36).slice(2),
    productId: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "15",
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : "حفظ أمر البيع"}
    </Button>
  );
}

export function SalesOrderForm({
  customers,
  warehouses,
  products,
  currencies,
  defaultCurrencyId,
  branches,
  defaultBranchId,
  branchLocked,
}: {
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  currencies: CurrencyOption[];
  defaultCurrencyId: string;
  branches: BranchOption[];
  defaultBranchId: string;
  /** المستخدم غير المدير محصور في فرعه فلا يستطيع تغييره. */
  branchLocked: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createSalesOrder,
    {},
  );
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [currencyId, setCurrencyId] = useState(defaultCurrencyId);

  // رمز العملة المختارة يُستخدم لمعاينة الإجماليات فقط؛ القيم المعتمدة من الخادم
  const currencyCode =
    currencies.find((currency) => currency.id === currencyId)?.code ?? "SAR";

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onProductChange(key: string, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      unitPrice: product ? String(product.salePrice) : "0",
      taxRate: product ? String(product.taxRate) : "15",
    });
  }

  // معاينة فقط — الإجماليات المعتمدة تُحسب في الخادم عند الحفظ
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const line of lines) {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice) || 0;
      const taxRate = Number(line.taxRate) || 0;
      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;
      taxAmount += (lineTotal * taxRate) / 100;
    }
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [lines]);

  const itemsPayload = JSON.stringify(
    lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        taxRate: Number(line.taxRate) || 0,
      })),
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="items" value={itemsPayload} />

      <Card>
        <CardHeader>
          <CardTitle>بيانات أمر البيع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customerId">العميل</Label>
              <Select id="customerId" name="customerId" required defaultValue="">
                <option value="" disabled>
                  اختر العميل
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} — {customer.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="warehouseId">المستودع</Label>
              <Select id="warehouseId" name="warehouseId" required defaultValue="">
                <option value="" disabled>
                  اختر المستودع
                </option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="currencyId">العملة</Label>
              <Select
                id="currencyId"
                name="currencyId"
                required
                value={currencyId}
                onChange={(event) => setCurrencyId(event.target.value)}
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.code} — {currency.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="branchId">الفرع</Label>
              <Select
                id="branchId"
                name="branchId"
                defaultValue={defaultBranchId}
                disabled={branchLocked}
              >
                {branchLocked ? null : <option value="">بدون فرع</option>}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} — {branch.name}
                  </option>
                ))}
              </Select>
              {branchLocked ? (
                <input type="hidden" name="branchId" value={defaultBranchId} />
              ) : null}
            </div>
            <div>
              <Label htmlFor="deliveryDate">تاريخ التسليم</Label>
              <Input id="deliveryDate" name="deliveryDate" type="date" dir="ltr" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="note">ملاحظات</Label>
              <Textarea id="note" name="note" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأصناف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            const quantity = Number(line.quantity) || 0;
            const unitPrice = Number(line.unitPrice) || 0;
            const taxRate = Number(line.taxRate) || 0;
            const lineTotal = quantity * unitPrice;

            return (
              <div
                key={line.key}
                className="grid items-end gap-3 rounded-lg border border-border p-3 md:grid-cols-12"
              >
                <div className="md:col-span-4">
                  <Label htmlFor={`product-${line.key}`}>المنتج {index + 1}</Label>
                  <Select
                    id={`product-${line.key}`}
                    value={line.productId}
                    onChange={(event) => onProductChange(line.key, event.target.value)}
                  >
                    <option value="">اختر المنتج</option>
                    {products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor={`quantity-${line.key}`}>
                    الكمية{product ? ` (${product.unit})` : ""}
                  </Label>
                  <Input
                    id={`quantity-${line.key}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor={`price-${line.key}`}>سعر الوحدة</Label>
                  <Input
                    id={`price-${line.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) =>
                      updateLine(line.key, { unitPrice: event.target.value })
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor={`tax-${line.key}`}>الضريبة %</Label>
                  <Input
                    id={`tax-${line.key}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.taxRate}
                    onChange={(event) =>
                      updateLine(line.key, { taxRate: event.target.value })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 md:col-span-2">
                  <div className="text-sm">
                    <p className="text-muted-foreground">الإجمالي</p>
                    <p className="font-medium">
                      {formatCurrency(lineTotal, currencyCode)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ضريبة {formatCurrency((lineTotal * taxRate) / 100, currencyCode)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((row) => row.key !== line.key),
                      )
                    }
                  >
                    حذف
                  </Button>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            إضافة صنف
          </Button>

          <div className="mt-2 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع قبل الضريبة</span>
              <span>{formatCurrency(totals.subtotal, currencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الضريبة</span>
              <span>{formatCurrency(totals.taxAmount, currencyCode)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>الإجمالي</span>
              <span>{formatCurrency(totals.total, currencyCode)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              القيم أعلاه بعملة المستند وللمعاينة فقط، ويُعاد احتسابها في الخادم
              عند الحفظ مع تثبيت سعر الصرف ومعادلها بعملة الأساس.
            </p>
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton />
        <Link href="/dashboard/sales-orders">
          <Button type="button" variant="outline">
            إلغاء
          </Button>
        </Link>
      </div>
    </form>
  );
}
