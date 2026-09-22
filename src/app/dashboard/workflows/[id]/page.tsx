import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { ENTITY_TYPE_LABELS } from "@/lib/workflow";
import { formatCurrency } from "@/lib/utils";
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
import { StateForm } from "./state-form";
import { TransitionForm } from "./transition-form";
import { DeleteStateButton, DeleteTransitionButton } from "./delete-buttons";

const COLOR_TONES = {
  gray: "gray",
  blue: "blue",
  amber: "amber",
  green: "green",
  red: "red",
  purple: "purple",
} as const;

export default async function WorkflowDefinitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("workflows");
  const { id } = await params;

  const definition = await prisma.workflowDefinition.findUnique({
    where: { id },
    include: {
      states: { orderBy: { sortOrder: "asc" } },
      transitions: {
        orderBy: { sortOrder: "asc" },
        include: { fromState: true, toState: true },
      },
    },
  });

  if (!definition) notFound();

  return (
    <div>
      <PageHeader
        title={definition.name}
        description={`${ENTITY_TYPE_LABELS[definition.entityType]} · ${definition.description ?? "بدون وصف"}`}
        action={
          <Link href="/dashboard/workflows" className="text-sm text-muted-foreground hover:underline">
            ← عودة للتعريفات
          </Link>
        }
      />

      {!definition.isActive ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          هذا التعريف غير نشط، ولن يُطبَّق على المستندات الجديدة حتى تفعّله من صفحة التعريفات.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>الحالات</CardTitle>
              <CardDescription>
                الحالة الابتدائية تُسند تلقائياً لكل مستند جديد، والحالة النهائية تُنهي سير العمل.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>المفتاح</TH>
                    <TH>الاسم</TH>
                    <TH>النوع</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {definition.states.map((state) => (
                    <TR key={state.id}>
                      <TD className="font-mono text-xs">{state.key}</TD>
                      <TD>
                        <Badge tone={COLOR_TONES[state.color as keyof typeof COLOR_TONES] ?? "gray"}>
                          {state.label}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {state.isInitial ? "ابتدائية" : state.isFinal ? "نهائية" : "وسيطة"}
                      </TD>
                      <TD>
                        <DeleteStateButton stateId={state.id} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الانتقالات (الإجراءات)</CardTitle>
              <CardDescription>
                كل انتقال يمثل زراً يظهر للمستخدم في المستند، بحسب دوره وقيمة المستند.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>الإجراء</TH>
                    <TH>من</TH>
                    <TH>إلى</TH>
                    <TH>الأدوار المسموحة</TH>
                    <TH>شروط</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {definition.transitions.map((transition) => (
                    <TR key={transition.id}>
                      <TD className="font-medium">{transition.label}</TD>
                      <TD className="text-xs">{transition.fromState.label}</TD>
                      <TD className="text-xs">{transition.toState.label}</TD>
                      <TD className="text-xs text-muted-foreground">
                        {transition.allowedRoles.length === 0
                          ? "الجميع"
                          : transition.allowedRoles
                              .map((role) => ROLE_LABELS[role])
                              .join("، ")}
                      </TD>
                      <TD className="text-xs text-muted-foreground">
                        {[
                          transition.minAmount
                            ? `≥ ${formatCurrency(Number(transition.minAmount))}`
                            : null,
                          transition.requiresNote ? "ملاحظة مطلوبة" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TD>
                      <TD>
                        <DeleteTransitionButton transitionId={transition.id} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <StateForm definitionId={definition.id} />
          <TransitionForm definitionId={definition.id} states={definition.states} />
        </div>
      </div>
    </div>
  );
}
