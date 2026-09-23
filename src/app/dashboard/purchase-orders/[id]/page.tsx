import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowEntityType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { getWorkflowHistory, getWorkflowSnapshot } from "@/lib/workflow";
import { formatDate, formatNumber, toNumber } from "@/lib/utils";
import { formatMoney, getBaseCurrency } from "@/lib/modules/currency";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { WorkflowPanel } from "@/components/workflow-panel";
import { getBranchScope } from "@/app/dashboard/warehouses/branch-scope";
import { runPurchaseOrderTransition } from "../actions";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_TONES,
} from "../labels";

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("purchasing");
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      branch: { select: { code: true, name: true } },
      currency: { select: { code: true, name: true, decimals: true, isBase: true } },
      items: {
        include: {
          product: { select: { sku: true, name: true, unit: true } },
        },
      },
      journalEntries: { select: { id: true, number: true, description: true } },
    },
  });

  if (!order) notFound();

  // المستخدم المقيّد بفرع لا يطّلع على مستندات الفروع الأخرى
  const scope = await getBranchScope(user);
  if (
    scope.restrictToBranchId &&
    order.branchId &&
    order.branchId !== scope.restrictToBranchId
  ) {
    notFound();
  }

  const [snapshot, history, baseCurrency] = await Promise.all([
    getWorkflowSnapshot(WorkflowEntityType.PURCHASE_ORDER, order.id, user.role),
    getWorkflowHistory(WorkflowEntityType.PURCHASE_ORDER, order.id),
    getBaseCurrency(),
  ]);

  // المبالغ تُعرض بعملة المستند، ويُضاف ما يعادلها بعملة الأساس عند اختلافها
  const currency = order.currency ?? baseCurrency;
  const exchangeRate = toNumber(order.exchangeRate) || 1;
  const isForeign = !currency.isBase;
  const docMoney = (value: unknown) => formatMoney(toNumber(value), currency);
  const baseMoney = (value: unknown) => formatMoney(toNumber(value), baseCurrency);

  const details: Array<{ label: string; value: string }> = [
    { label: "المورد", value: `${order.supplier.code} — ${order.supplier.name}` },
    { label: "المسؤول لدى المورد", value: order.supplier.contactName || "—" },
    { label: "هاتف المورد", value: order.supplier.phone || "—" },
    { label: "الرقم الضريبي للمورد", value: order.supplier.taxNumber || "—" },
    {
      label: "الفرع",
      value: order.branch ? `${order.branch.code} — ${order.branch.name}` : "—",
    },
    {
      label: "المستودع المستلم",
      value: `${order.warehouse.code} — ${order.warehouse.name}`,
    },
    {
      label: "العملة",
      value: isForeign
        ? `${currency.code} — ${currency.name ?? ""}`.trim()
        : `${currency.code} (عملة الأساس)`,
    },
    ...(isForeign
      ? [
          {
            label: "سعر الصرف المثبّت",
            value: `1 ${currency.code} = ${formatNumber(exchangeRate, 6)} ${baseCurrency.code}`,
          },
        ]
      : []),
    { label: "تاريخ الأمر", value: formatDate(order.orderDate) },
    { label: "تاريخ الاستلام المتوقع", value: formatDate(order.expectedDate) },
    { label: "تاريخ الاستلام الفعلي", value: formatDate(order.receivedAt) },
  ];

  return (
    <div>
      <PageHeader
        title={`أمر شراء ${order.number}`}
        description={order.note || "تفاصيل أمر الشراء وبنوده"}
        action={
          <Link href="/dashboard/purchase-orders">
            <Button type="button" variant="outline">
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                بيانات المستند
                <Badge tone={PURCHASE_ORDER_STATUS_TONES[order.status]}>
                  {PURCHASE_ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                    <dd className="text-sm font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>البنود</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>#</TH>
                    <TH>المنتج</TH>
                    <TH>الكمية</TH>
                    <TH>سعر الوحدة</TH>
                    <TH>الضريبة %</TH>
                    <TH>إجمالي البند</TH>
                  </TR>
                </THead>
                <TBody>
                  {order.items.map((item, index) => (
                    <TR key={item.id}>
                      <TD className="text-muted-foreground">{index + 1}</TD>
                      <TD>
                        <span dir="ltr">{item.product.sku}</span> — {item.product.name}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatNumber(toNumber(item.quantity), 2)} {item.product.unit}
                      </TD>
                      <TD className="whitespace-nowrap">{docMoney(item.unitPrice)}</TD>
                      <TD>{formatNumber(toNumber(item.taxRate), 2)}%</TD>
                      <TD className="whitespace-nowrap font-medium">
                        {docMoney(item.lineTotal)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                  <span>
                    {docMoney(order.subtotal)}
                    {isForeign ? (
                      <span className="block text-xs text-muted-foreground">
                        = {baseMoney(order.baseSubtotal)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة</span>
                  <span>
                    {docMoney(order.taxAmount)}
                    {isForeign ? (
                      <span className="block text-xs text-muted-foreground">
                        = {baseMoney(order.baseTaxAmount)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>الإجمالي</span>
                  <span>
                    {docMoney(order.total)}
                    {isForeign ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        = {baseMoney(order.baseTotal)}
                      </span>
                    ) : null}
                  </span>
                </div>
                {isForeign ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    القيود المحاسبية وتقييم المخزون تُرحَّل بعملة الأساس بسعر الصرف
                    المثبّت على هذا الأمر.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {order.journalEntries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>القيود المحاسبية المرتبطة</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {order.journalEntries.map((entry) => (
                    <li key={entry.id} className="text-sm">
                      <span dir="ltr" className="font-medium">
                        {entry.number}
                      </span>{" "}
                      <span className="text-muted-foreground">— {entry.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <WorkflowPanel
          snapshot={snapshot}
          history={history}
          onTransition={runPurchaseOrderTransition.bind(null, order.id)}
        />
      </div>
    </div>
  );
}
