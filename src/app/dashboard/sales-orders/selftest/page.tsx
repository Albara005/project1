// TEMPORARY self-test page — deleted after verification.
import { redirect } from "next/navigation";
import { WorkflowEntityType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { getWorkflowSnapshot } from "@/lib/workflow";
import { createSalesOrder, runSalesOrderTransition } from "../actions";

export default async function SelfTestPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; qty?: string; msg?: string }>;
}) {
  const user = await requireModule("sales");
  const query = await searchParams;

  const customer = await prisma.customer.findFirstOrThrow({ orderBy: { code: "asc" } });
  const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: "WH-MAIN" } });
  const product = await prisma.product.findFirstOrThrow({ where: { sku: "LAP-001" } });

  const qty = query.qty ?? "2";
  const items = JSON.stringify([
    { productId: product.id, quantity: Number(qty), unitPrice: 3600, taxRate: 15 },
  ]);

  const order = query.order
    ? await prisma.salesOrder.findUnique({ where: { id: query.order } })
    : null;

  const snapshot = order
    ? await getWorkflowSnapshot(WorkflowEntityType.SALES_ORDER, order.id, user.role)
    : null;

  async function doTransition(orderId: string, transitionId: string) {
    "use server";
    const result = await runSalesOrderTransition(orderId, transitionId, "اختبار آلي");
    redirect(
      `/dashboard/sales-orders/selftest?order=${orderId}&msg=${encodeURIComponent(result.error ?? "OK")}`,
    );
  }

  return (
    <div>
      <p data-test="msg">MSG:{query.msg ?? ""}</p>
      <p data-test="status">STATUS:{order?.status ?? ""}</p>

      <form action={createSalesOrder.bind(null, {})}>
        <input type="hidden" name="customerId" value={customer.id} />
        <input type="hidden" name="warehouseId" value={warehouse.id} />
        <input type="hidden" name="note" value="اختبار آلي" />
        <input type="hidden" name="items" value={items} />
        <button type="submit">CREATE</button>
      </form>

      {snapshot?.availableTransitions.map((transition) => (
        <form key={transition.id} action={doTransition.bind(null, order!.id, transition.id)}>
          <button type="submit">GO:{transition.toStateKey}</button>
        </form>
      ))}
    </div>
  );
}
