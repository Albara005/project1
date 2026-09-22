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
  Textarea,
} from "@/components/ui";
import { saveSupplier, type ActionState } from "./actions";

export type SupplierFormValues = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxNumber: string;
  address: string;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المورد"}
    </Button>
  );
}

export function SupplierForm({ supplier }: { supplier: SupplierFormValues | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSupplier, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const isEdit = Boolean(supplier);

  useEffect(() => {
    if (!state.success) return;
    if (isEdit) {
      router.push("/dashboard/suppliers");
    } else {
      formRef.current?.reset();
    }
  }, [state, isEdit, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "تعديل المورد" : "إضافة مورد"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="space-y-4"
          key={supplier?.id ?? "new"}
        >
          {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}

          <div>
            <Label htmlFor="code">الرمز</Label>
            <Input
              id="code"
              name="code"
              required
              defaultValue={supplier?.code ?? ""}
              placeholder="SUP-001"
            />
          </div>

          <div>
            <Label htmlFor="name">اسم المورد</Label>
            <Input id="name" name="name" required defaultValue={supplier?.name ?? ""} />
          </div>

          <div>
            <Label htmlFor="contactName">اسم المسؤول</Label>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={supplier?.contactName ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              defaultValue={supplier?.email ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" name="phone" dir="ltr" defaultValue={supplier?.phone ?? ""} />
          </div>

          <div>
            <Label htmlFor="taxNumber">الرقم الضريبي</Label>
            <Input
              id="taxNumber"
              name="taxNumber"
              dir="ltr"
              defaultValue={supplier?.taxNumber ?? ""}
            />
          </div>

          <div>
            <Label htmlFor="address">العنوان</Label>
            <Textarea id="address" name="address" defaultValue={supplier?.address ?? ""} />
          </div>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          ) : null}

          <SubmitButton isEdit={isEdit} />

          {isEdit ? (
            <Link href="/dashboard/suppliers" className="block">
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
