"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
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
import { saveProduct, type ActionState } from "./actions";

export type ProductFormValues = {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  categoryId: string;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  reorderLevel: number;
};

export type CategoryOption = { id: string; name: string };

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المنتج"}
    </Button>
  );
}

export function ProductForm({
  product,
  categories,
}: {
  product: ProductFormValues | null;
  categories: CategoryOption[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveProduct, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const isEdit = Boolean(product);

  useEffect(() => {
    if (!state.success) return;
    if (isEdit) {
      router.push("/dashboard/products");
    } else {
      formRef.current?.reset();
    }
  }, [state, isEdit, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "تعديل المنتج" : "إضافة منتج"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="space-y-4"
          key={product?.id ?? "new"}
        >
          {product ? <input type="hidden" name="id" value={product.id} /> : null}

          <div>
            <Label htmlFor="sku">رمز المنتج (SKU)</Label>
            <Input
              id="sku"
              name="sku"
              required
              dir="ltr"
              defaultValue={product?.sku ?? ""}
              placeholder="SKU-001"
            />
          </div>

          <div>
            <Label htmlFor="name">اسم المنتج</Label>
            <Input id="name" name="name" required defaultValue={product?.name ?? ""} />
          </div>

          <div>
            <Label htmlFor="categoryId">الفئة</Label>
            <Select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""}>
              <option value="">بدون فئة</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="unit">وحدة القياس</Label>
            <Input id="unit" name="unit" required defaultValue={product?.unit ?? "قطعة"} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="costPrice">سعر التكلفة</Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={product?.costPrice ?? 0}
              />
            </div>
            <div>
              <Label htmlFor="salePrice">سعر البيع</Label>
              <Input
                id="salePrice"
                name="salePrice"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={product?.salePrice ?? 0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="taxRate">نسبة الضريبة %</Label>
              <Input
                id="taxRate"
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                dir="ltr"
                defaultValue={product?.taxRate ?? 15}
              />
            </div>
            <div>
              <Label htmlFor="reorderLevel">حد إعادة الطلب</Label>
              <Input
                id="reorderLevel"
                name="reorderLevel"
                type="number"
                step="1"
                min="0"
                dir="ltr"
                defaultValue={product?.reorderLevel ?? 0}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description ?? ""}
              placeholder="وصف مختصر (اختياري)"
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          <SubmitButton isEdit={isEdit} />

          {isEdit ? (
            <Link href="/dashboard/products" className="block">
              <Button type="button" variant="outline" className="w-full">
                إلغاء التعديل
              </Button>
            </Link>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
