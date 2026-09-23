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
} from "@/components/ui";
import { saveWarehouse, type ActionState } from "./actions";

export type WarehouseFormValues = {
  id: string;
  code: string;
  name: string;
  location: string;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المستودع"}
    </Button>
  );
}

export function WarehouseForm({ warehouse }: { warehouse: WarehouseFormValues | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveWarehouse, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const isEdit = Boolean(warehouse);

  useEffect(() => {
    if (!state.success) return;
    if (isEdit) {
      router.push("/dashboard/warehouses");
    } else {
      formRef.current?.reset();
    }
  }, [state, isEdit, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "تعديل المستودع" : "إضافة مستودع"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="space-y-4"
          key={warehouse?.id ?? "new"}
        >
          {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}

          <div>
            <Label htmlFor="code">الرمز</Label>
            <Input
              id="code"
              name="code"
              required
              defaultValue={warehouse?.code ?? ""}
              placeholder="WH-01"
            />
          </div>

          <div>
            <Label htmlFor="name">اسم المستودع</Label>
            <Input id="name" name="name" required defaultValue={warehouse?.name ?? ""} />
          </div>

          <div>
            <Label htmlFor="location">الموقع</Label>
            <Input
              id="location"
              name="location"
              defaultValue={warehouse?.location ?? ""}
              placeholder="المدينة أو العنوان (اختياري)"
            />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          <SubmitButton isEdit={isEdit} />

          {isEdit ? (
            <Link href="/dashboard/warehouses" className="block">
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
