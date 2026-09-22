import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { canAccessModule, type ModuleKey } from "@/lib/rbac";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
};

/** يعيد المستخدم الحالي أو يحوّل لصفحة الدخول. يُستخدم في كل صفحات لوحة التحكم. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    organizationId: session.user.organizationId,
  };
}

/** يتحقق أن المستخدم يملك صلاحية الوصول للوحدة، وإلا يحوّله للوحة الرئيسية. */
export async function requireModule(module: ModuleKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessModule(user.role, module)) redirect("/dashboard?denied=" + module);
  return user;
}

/** للاستخدام داخل Server Actions: يرمي خطأ بدل التحويل. */
export async function requireUserAction(module?: ModuleKey): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("غير مصرح: يرجى تسجيل الدخول");

  const user: CurrentUser = {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    organizationId: session.user.organizationId,
  };

  if (module && !canAccessModule(user.role, module)) {
    throw new Error("غير مصرح: لا تملك صلاحية على هذه الوحدة");
  }

  return user;
}
