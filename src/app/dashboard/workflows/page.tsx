import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { ENTITY_TYPE_LABELS } from "@/lib/workflow";
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
import { DefinitionForm } from "./definition-form";
import { ActivateButton } from "./activate-button";

export default async function WorkflowsPage() {
  await requireModule("workflows");

  const definitions = await prisma.workflowDefinition.findMany({
    orderBy: [{ entityType: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { states: true, transitions: true, instances: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="سير العمل الديناميكي"
        description="عرّف حالات المستندات وانتقالاتها وقواعد الموافقة دون تعديل الكود. التعريف النشط لكل نوع مستند هو الذي يُطبَّق على المستندات الجديدة."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>التعريفات</CardTitle>
            <CardDescription>
              اضغط على أي تعريف لتعديل حالاته وانتقالاته
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>الاسم</TH>
                  <TH>نوع المستند</TH>
                  <TH>الحالات</TH>
                  <TH>الإجراءات</TH>
                  <TH>مستندات مرتبطة</TH>
                  <TH>الحالة</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {definitions.map((definition) => (
                  <TR key={definition.id}>
                    <TD>
                      <Link
                        href={`/dashboard/workflows/${definition.id}`}
                        className="font-medium hover:underline"
                      >
                        {definition.name}
                      </Link>
                    </TD>
                    <TD>{ENTITY_TYPE_LABELS[definition.entityType]}</TD>
                    <TD>{definition._count.states}</TD>
                    <TD>{definition._count.transitions}</TD>
                    <TD>{definition._count.instances}</TD>
                    <TD>
                      <Badge tone={definition.isActive ? "green" : "gray"}>
                        {definition.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TD>
                    <TD>
                      <ActivateButton
                        definitionId={definition.id}
                        isActive={definition.isActive}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <DefinitionForm />
      </div>
    </div>
  );
}
