import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessModule, ROLE_LABELS, type ModuleKey } from "@/lib/rbac";
import { Sidebar } from "@/components/sidebar";
import { NAV_GROUPS } from "@/components/nav-items";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true },
  });

  const allModules = Array.from(
    new Set(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.module))),
  ) as ModuleKey[];
  const allowedModules = allModules.filter((module) =>
    canAccessModule(user.role, module),
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        organizationName={organization?.name ?? "منشأتي"}
        allowedModules={allowedModules}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:px-8 print:hidden">
          <div className="ps-12 lg:ps-0">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              تسجيل الخروج
            </Button>
          </form>
        </header>

        <main className="flex-1 p-4 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
