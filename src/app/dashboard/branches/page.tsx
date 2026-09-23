import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { BranchForm } from "./branch-form";
import { BranchRowActions, UserBranchSelect } from "./row-actions";

export default async function BranchesPage() {
  const current = await requireModule("settings");

  const [branches, users] = await Promise.all([
    prisma.branch.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: {
            warehouses: true,
            users: true,
            employees: true,
            salesOrders: true,
            purchaseOrders: true,
            invoices: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: current.organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
        branch: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="الفروع"
        description="المستندات تُنسب لفرع، والتقارير تُقارن أداء الفروع. المستخدم المرتبط بفرع يرى مستندات فرعه فقط، ومدير النظام يرى الجميع."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>قائمة الفروع</CardTitle>
              <CardDescription>{branches.length} فرع</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>الرمز</TH>
                    <TH>الاسم</TH>
                    <TH>مستودعات</TH>
                    <TH>موظفون</TH>
                    <TH>مستندات</TH>
                    <TH>الحالة</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {branches.map((branch) => (
                    <TR key={branch.id}>
                      <TD className="font-mono text-xs font-semibold">{branch.code}</TD>
                      <TD>
                        {branch.name}
                        {branch.address ? (
                          <span className="block text-xs text-muted-foreground">
                            {branch.address}
                          </span>
                        ) : null}
                      </TD>
                      <TD className="text-xs">{branch._count.warehouses}</TD>
                      <TD className="text-xs">{branch._count.employees}</TD>
                      <TD className="text-xs text-muted-foreground">
                        {branch._count.salesOrders +
                          branch._count.purchaseOrders +
                          branch._count.invoices}
                      </TD>
                      <TD>
                        <Badge tone={branch.isActive ? "green" : "gray"}>
                          {branch.isActive ? "مفعّل" : "معطّل"}
                        </Badge>
                      </TD>
                      <TD>
                        <BranchRowActions
                          branchId={branch.id}
                          isActive={branch.isActive}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ربط المستخدمين بالفروع</CardTitle>
              <CardDescription>
                المستخدم بلا فرع يرى مستندات كل الفروع.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>المستخدم</TH>
                    <TH>الدور</TH>
                    <TH>الفرع</TH>
                  </TR>
                </THead>
                <TBody>
                  {users.map((user) => (
                    <TR key={user.id}>
                      <TD className="font-medium">
                        {user.name}
                        {user.id === current.id ? (
                          <span className="ms-1 text-xs text-muted-foreground">(أنت)</span>
                        ) : null}
                      </TD>
                      <TD className="text-xs">{ROLE_LABELS[user.role]}</TD>
                      <TD>
                        <UserBranchSelect
                          userId={user.id}
                          branchId={user.branchId}
                          branches={branches.map((branch) => ({
                            id: branch.id,
                            name: branch.name,
                          }))}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <BranchForm />
      </div>
    </div>
  );
}
