import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { verifyChain } from "@/lib/modules/einvoice/service";
import { fatooraBaseUrl } from "@/lib/modules/einvoice/fatoora";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  EINVOICE_STATUS_LABELS,
  EINVOICE_STATUS_TONES,
  EINVOICE_TYPE_LABELS,
  ENVIRONMENT_LABELS,
} from "./labels";
import { OnboardingForms } from "./onboarding-forms";
import { SubmitButton } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function EInvoicingPage() {
  await requireModule("accounting");

  const [credentials, records, chain, organization] = await Promise.all([
    prisma.eInvoiceCredential.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.eInvoice.findMany({
      orderBy: { icv: "desc" },
      take: 50,
      include: { invoice: { select: { id: true, number: true, total: true } } },
    }),
    verifyChain(),
    prisma.organization.findFirst(),
  ]);

  const active = credentials.find((credential) => credential.isActive);
  const pending = credentials.find((credential) => !credential.isActive);

  return (
    <div>
      <PageHeader
        title="الفوترة الإلكترونية — مرحلة التكامل"
        description="إصدار الفواتير بمعيار UBL 2.1 موقّعة تشفيرياً ومربوطة بسلسلة تجزئة، ثم تبليغها أو إجازتها لدى منصة فاتورة."
      />

      {!organization?.taxNumber ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          الرقم الضريبي غير معرّف.{" "}
          <Link href="/dashboard/settings" className="underline">
            عرّفه في إعدادات المنشأة
          </Link>{" "}
          قبل بدء الانضمام.
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">حالة الانضمام</p>
            <div className="mt-1.5">
              <Badge tone={active ? "green" : "amber"}>
                {active ? "شهادة إنتاج مفعّلة" : "لم يكتمل"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {active
                ? `${ENVIRONMENT_LABELS[active.environment]} · ${active.deviceName}`
                : "أكمل الخطوات الثلاث أدناه"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">فواتير إلكترونية</p>
            <p className="mt-1.5 text-xl font-bold">{chain.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              مرتبطة بسلسلة تجزئة متصلة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">سلامة السلسلة</p>
            <div className="mt-1.5">
              <Badge tone={chain.broken.length === 0 ? "green" : "red"}>
                {chain.broken.length === 0
                  ? "متصلة"
                  : `${chain.broken.length} كسر`}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              العدّاد والتجزئة ومحتوى كل فاتورة
            </p>
          </CardContent>
        </Card>
      </div>

      {chain.broken.length > 0 ? (
        <Card className="mb-6 border-red-300">
          <CardHeader>
            <CardTitle>كسور في سلسلة التجزئة</CardTitle>
            <CardDescription>
              كسر السلسلة يعني أن فاتورة حُذفت أو عُدّل محتواها بعد إصدارها.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {chain.broken.map((item, index) => (
                <li key={`${item.icv}-${index}`} className="text-red-700 dark:text-red-400">
                  العدّاد {item.icv} ({item.number}): {item.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <OnboardingForms
          credential={
            active
              ? {
                  id: active.id,
                  deviceName: active.deviceName,
                  environment: active.environment,
                  hasCompliance: Boolean(active.complianceCsid),
                  hasProduction: Boolean(active.productionCsid),
                  csrPem: active.csrPem,
                }
              : pending
                ? {
                    id: pending.id,
                    deviceName: pending.deviceName,
                    environment: pending.environment,
                    hasCompliance: Boolean(pending.complianceCsid),
                    hasProduction: Boolean(pending.productionCsid),
                    csrPem: pending.csrPem,
                  }
                : null
          }
          portalUrl={fatooraBaseUrl(
            (active?.environment ?? pending?.environment ?? "sandbox") as
              | "sandbox"
              | "simulation"
              | "production",
          )}
        />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>كيف يعمل الربط</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">1) طلب الشهادة:</span>{" "}
              يُولَّد مفتاح خاص على الخادم ولا يغادره، ويُرسل الطلب فقط.
            </p>
            <p>
              <span className="font-medium text-foreground">2) شهادة التوافق:</span>{" "}
              تحتاج رمز تحقق من بوابة فاتورة الخاصة بمنشأتك — يصدره صاحب المنشأة
              ولا يمكن توليده من النظام.
            </p>
            <p>
              <span className="font-medium text-foreground">3) شهادة الإنتاج:</span>{" "}
              تُصدر بعد اجتياز فحوص التوافق لدى الهيئة.
            </p>
            <p className="border-t border-border pt-3">
              بعد التفعيل: الفاتورة المبسطة تُبلَّغ خلال 24 ساعة، والقياسية تُجاز
              قبل تسليمها للمشتري.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>الفواتير الإلكترونية</CardTitle>
          <CardDescription>
            مرتبة بعدّاد الإصدار تنازلياً
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <EmptyState
              title="لم تُصدر فواتير إلكترونية بعد"
              description="أصدر فاتورة إلكترونية من صفحة أي فاتورة مبيعات بعد اكتمال الانضمام."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>العدّاد</TH>
                  <TH>الفاتورة</TH>
                  <TH>النوع</TH>
                  <TH>التجزئة</TH>
                  <TH>الحالة</TH>
                  <TH>التاريخ</TH>
                  <TH> </TH>
                </TR>
              </THead>
              <TBody>
                {records.map((record) => (
                  <TR key={record.id}>
                    <TD className="font-mono text-xs">{record.icv.toString()}</TD>
                    <TD>
                      <Link
                        href={`/dashboard/invoices/${record.invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {record.invoice.number}
                      </Link>
                    </TD>
                    <TD className="text-xs">
                      {EINVOICE_TYPE_LABELS[record.type] ?? record.type}
                    </TD>
                    <TD className="font-mono text-[11px] text-muted-foreground">
                      {record.hash.slice(0, 16)}…
                    </TD>
                    <TD>
                      <Badge tone={EINVOICE_STATUS_TONES[record.status] ?? "gray"}>
                        {EINVOICE_STATUS_LABELS[record.status] ?? record.status}
                      </Badge>
                      {record.errors ? (
                        <span className="mt-1 block text-[11px] text-red-600">
                          {record.errors.slice(0, 90)}
                        </span>
                      ) : null}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {formatDate(record.createdAt)}
                    </TD>
                    <TD>
                      {record.status === "SIGNED" ||
                      record.status === "FAILED" ||
                      record.status === "REJECTED" ? (
                        <SubmitButton eInvoiceId={record.id} disabled={!active} />
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
