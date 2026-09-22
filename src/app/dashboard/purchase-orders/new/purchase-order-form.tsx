"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
import { createPurchaseOrder, type ActionState } from "../actions";

export type SupplierOption = { id: string; code: string; name: string };
export type WarehouseOption = { id: string; code: string; name: string };
export type BranchOption = { id: string; code: string; name: string };
/** `rate` = كم وحدة من عملة الأساس تساوي وحدة واحدة من هذه العملة (null = لا سعر سارٍ). */
export type CurrencyOption = {
  id: string;
  code: string;
  name: string;
  isBase: boolean;
  rate: number | null;
};
export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  taxRate: number;
};

type Line = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

let lineCounter = 0;

function emptyLine(): Line {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    productId: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "15",
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return value.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** تنسيق مبلغ بعملة محددة؛ يسقط إلى رقم مجرد إن لم يكن رمز العملة معروفاً. */
function moneyIn(value: number, code: string) {
  if (!code) return money(value);
  try {
    return new Intl.NumberFormat("ar-SA-u-nu-latn", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${money(value)} ${code}`;
  }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "جاري الحفظ..." : "حفظ كمسودة"}
    </Button>
  );
}

/**
 * محرر أمر الشراء: يحتفظ بالبنود في حالة محلية ويرسلها كحقل JSON واحد،
 * والمجاميع المعروضة هنا للاسترشاد فقط — الخادم يعيد حسابها قبل الحفظ.
 */
export function PurchaseOrderForm({
  suppliers,
  warehouses,
  products,
  currencies,
  branches,
  defaultCurrencyId,
  defaultBranchId,
  baseCurrencyCode,
  canChooseBranch,
}: {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  currencies: CurrencyOption[];
  branches: BranchOption[];
  defaultCurrencyId: string;
  defaultBranchId: string;
  baseCurrencyCode: string;
  canChooseBranch: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createPurchaseOrder,
    {},
  );
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [currencyId, setCurrencyId] = useState(defaultCurrencyId);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onProductChange(key: string, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(key, {
      productId,
      unitPrice: product ? String(product.costPrice) : "0",
      taxRate: product ? String(product.taxRate) : "15",
    });
  }

  const computed = lines.map((line) => {
    const lineSubtotal = num(line.quantity) * num(line.unitPrice);
    const lineTax = (lineSubtotal * num(line.taxRate)) / 100;
    return { key: line.key, lineSubtotal, lineTax, lineTotal: lineSubtotal + lineTax };
  });
  const subtotal = computed.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const taxAmount = computed.reduce((sum, line) => sum + line.lineTax, 0);
  const total = subtotal + taxAmount;

  const serializedItems = JSON.stringify(
    lines.map((line) => ({
      productId: line.productId,
      quantity: num(line.quantity),
      unitPrice: num(line.unitPrice),
      taxRate: num(line.taxRate),
    })),
  );

  const selectedCurrency =
    currencies.find((currency) => currency.id === currencyId) ?? currencies[0];
  const currencyCode = selectedCurrency?.code ?? baseCurrencyCode;
  const showBaseEquivalent =
    Boolean(selectedCurrency) && !selectedCurrency!.isBase && Boolean(baseCurrencyCode);
  const rate = selectedCurrency?.rate ?? null;

  const missingData =
    suppliers.length === 0 ||
    warehouses.length === 0 ||
    products.length === 0 ||
    currencies.length === 0;

  if (missingData) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">
            يلزم وجود مورد نشط ومستودع نشط ومنتج نشط وعملة واحدة على الأقل قبل إنشاء أمر
            شراء.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="items" value={serializedItems} />

      <Card>
        <CardHeader>
          <CardTitle>بيانات أمر الشراء</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="supplierId">المورد</Label>
            <Select id="supplierId" name="supplierId" required defaultValue="">
              <option value="" disabled>
                اختر المورد
              </option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} — {supplier.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="warehouseId">المستودع المستلم</Label>
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
            <Label htmlFor="expectedDate">تاريخ الاستلام المتوقع</Label>
            <Input id="expectedDate" name="expectedDate" type="date" dir="ltr" />
          </div>

          <div>
            <Label htmlFor="note">ملاحظات</Label>
            <Textarea id="note" name="note" placeholder="ملاحظة على الأمر (اختياري)" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>البنود</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            {lines.map((line, index) => {
              const totals = computed[index];
              const product = products.find((item) => item.id === line.productId);
              return (
                <div
                  key={line.key}
                  className="grid items-end gap-3 rounded-lg border border-border p-3 md:grid-cols-12"
                >
                  <div className="md:col-span-4">
                    <Label htmlFor={`product-${line.key}`}>المنتج</Label>
                    <Select
                      id={`product-${line.key}`}
                      value={line.productId}
                      onChange={(event) => onProductChange(line.key, event.target.value)}
                    >
                      <option value="" disabled>
                        اختر منتجاً
                      </option>
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
                      step="0.001"
                      min="0"
                      dir="ltr"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor={`unitPrice-${line.key}`}>سعر الوحدة</Label>
                    <Input
                      id={`unitPrice-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(line.key, { unitPrice: event.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor={`taxRate-${line.key}`}>الضريبة %</Label>
                    <Input
                      id={`taxRate-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      dir="ltr"
                      value={line.taxRate}
                      onChange={(event) =>
                        updateLine(line.key, { taxRate: event.target.value })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 md:col-span-2">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي البند</p>
                      <p className="text-sm font-medium">{money(totals?.lineTotal ?? 0)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.key !== line.key),
                        )
                      }
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            إضافة بند
          </Button>

          <div className="mt-2 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الضريبة</span>
              <span>{money(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>الإجمالي</span>
              <span>{money(total)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              المجاميع تُحتسب نهائياً في الخادم عند الحفظ.
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
        <SubmitButton disabled={lines.some((line) => !line.productId)} />
        <Link href="/dashboard/purchase-orders">
          <Button type="button" variant="outline">
            إلغاء
          </Button>
        </Link>
      </div>
    </form>
  );
}
