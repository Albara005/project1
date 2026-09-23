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
import { createReturn, type ActionState } from "../actions";

type PartyOption = { id: string; code: string; name: string };
type WarehouseOption = { id: string; code: string; name: string };
type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  taxRate: number;
};
type InvoiceOption = {
  id: string;
  number: string;
  partyId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
};

type LineRow = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

function emptyLine(): LineRow {
  return { key: newKey(), productId: "", quantity: "1", unitPrice: "0", taxRate: "15" };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function SubmitButton({ isSales }: { isSales: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "جاري الحفظ..." : isSales ? "حفظ مرتجع المبيعات" : "حفظ مرتجع المشتريات"}
    </Button>
  );
}

export function ReturnForm({
  type,
  parties,
  warehouses,
  products,
  invoices,
  preselectedInvoiceId,
}: {
  type: "SALES" | "PURCHASE";
  parties: PartyOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  invoices: InvoiceOption[];
  preselectedInvoiceId: string;
}) {
  const isSales = type === "SALES";
  const [state, formAction] = useActionState<ActionState, FormData>(createReturn, {});

  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId);
  const [partyId, setPartyId] = useState(
    invoices.find((inv) => inv.id === preselectedInvoiceId)?.partyId ?? "",
  );
  const [lines, setLines] = useState<LineRow[]>(() => {
    const invoice = invoices.find((inv) => inv.id === preselectedInvoiceId);
    return invoice ? linesFromInvoice(invoice) : [emptyLine()];
  });

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  function linesFromInvoice(invoice: InvoiceOption): LineRow[] {
    if (invoice.items.length === 0) return [emptyLine()];
    return invoice.items.map((item) => ({
      key: newKey(),
      productId: item.productId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      taxRate: String(item.taxRate),
    }));
  }

  /** اختيار الفاتورة يملأ الطرف والأصناف تلقائياً من بنود الفاتورة. */
  function onInvoiceChange(value: string) {
    setInvoiceId(value);
    const invoice = invoices.find((inv) => inv.id === value);
    if (!invoice) return;
    if (invoice.partyId) setPartyId(invoice.partyId);
    setLines(linesFromInvoice(invoice));
  }

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function onProductChange(key: string, productId: string) {
    const product = productById.get(productId);
    updateLine(key, {
      productId,
      unitPrice: product ? String(product.price) : "0",
      taxRate: product ? String(product.taxRate) : "15",
    });
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const line of lines) {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice) || 0;
      const taxRate = Number(line.taxRate) || 0;
      const lineTotal = round2(quantity * unitPrice);
      subtotal += lineTotal;
      taxAmount += round2((lineTotal * taxRate) / 100);
    }
    return {
      subtotal: round2(subtotal),
      taxAmount: round2(taxAmount),
      total: round2(subtotal + taxAmount),
    };
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

  const relevantInvoices = partyId
    ? invoices.filter((inv) => !inv.partyId || inv.partyId === partyId)
    : invoices;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="items" value={itemsPayload} />

      <Card>
        <CardHeader>
          <CardTitle>بيانات المرتجع</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="invoiceId">الفاتورة الأصلية (اختياري)</Label>
            <Select
              id="invoiceId"
              name="invoiceId"
              value={invoiceId}
              onChange={(event) => onInvoiceChange(event.target.value)}
            >
              <option value="">بدون ربط بفاتورة</option>
              {relevantInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="partyId">{isSales ? "العميل" : "المورد"}</Label>
            <Select
              id="partyId"
              name="partyId"
              required
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
            >
              <option value="" disabled>
                {isSales ? "اختر العميل" : "اختر المورد"}
              </option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.code} — {party.name}
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
            <Label htmlFor="reason">سبب الإرجاع</Label>
            <Textarea id="reason" name="reason" rows={2} placeholder="مثال: صنف تالف" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأصناف المرتجعة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="grid items-end gap-2 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <Label>المنتج</Label>
                <Select
                  value={line.productId}
                  onChange={(event) => onProductChange(line.key, event.target.value)}
                >
                  <option value="">اختر المنتج</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} — {product.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>الكمية</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  dir="ltr"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>سعر الوحدة</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>الضريبة %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  dir="ltr"
                  value={line.taxRate}
                  onChange={(event) => updateLine(line.key, { taxRate: event.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? [emptyLine()]
                        : current.filter((row) => row.key !== line.key),
                    )
                  }
                >
                  حذف
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            إضافة صنف
          </Button>

          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الضريبة</span>
              <span>{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>الإجمالي</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton isSales={isSales} />
        <Link href="/dashboard/returns">
          <Button type="button" variant="outline">
            إلغاء
          </Button>
        </Link>
      </div>
    </form>
  );
}
