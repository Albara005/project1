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
import { saveCategory, type ActionState } from "./actions";

export type CategoryFormValues = {
  id: string;
  name: string;
  description: string;
};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الفئة"}
    </Button>
  );
}

export function CategoryForm({ category }: { category: CategoryFormValues | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCategory, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const isEdit = Boolean(category);

  useEffect(() => {
    if (!state.success) return;
    if (isEdit) {
      router.push("/dashboard/categories");
    } else {
      formRef.current?.reset();
    }
  }, [state, isEdit, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "تعديل الفئة" : "إضافة فئة"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4" key={category?.id ?? "new"}>
          {category ? <input type="hidden" name="id" value={category.id} /> : null}

          <div>
            <Label htmlFor="name">اسم الفئة</Label>
            <Input id="name" name="name" required defaultValue={category?.name ?? ""} />
          </div>

          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={category?.description ?? ""}
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
            <Link href="/dashboard/categories" className="block">
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
