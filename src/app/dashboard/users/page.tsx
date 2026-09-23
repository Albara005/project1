import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
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
import { UserForm } from "./user-form";
import { UserRowActions } from "./user-row-actions";

export default async function UsersPage() {
  const current = await requireModule("settings");

  const users = await prisma.user.findMany({
    where: { organizationId: current.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="المستخدمون"
        description="أضف مستخدمي النظام وحدّد أدوارهم. الدور يحدد الوحدات التي يراها المستخدم والإجراءات التي ينفذها في سير العمل."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>قائمة المستخدمين</CardTitle>
            <CardDescription>{users.length} مستخدم</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>الاسم</TH>
                  <TH>البريد الإلكتروني</TH>
                  <TH>الدور</TH>
                  <TH>الحالة</TH>
                  <TH>تاريخ الإضافة</TH>
                  <TH> </TH>
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
                    <TD dir="ltr" className="text-start text-xs">
                      {user.email}
                    </TD>
                    <TD>{ROLE_LABELS[user.role]}</TD>
                    <TD>
                      <Badge tone={user.isActive ? "green" : "red"}>
                        {user.isActive ? "نشط" : "معطّل"}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TD>
                    <TD>
                      <UserRowActions
                        userId={user.id}
                        role={user.role}
                        isActive={user.isActive}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <UserForm />
      </div>
    </div>
  );
}
