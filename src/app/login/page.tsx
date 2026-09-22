import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            ERP
          </div>
          <h1 className="text-2xl font-bold">نظام ERP المتكامل</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            سجّل الدخول للوصول إلى لوحة التحكم
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
