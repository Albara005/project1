import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { getExchangeRate, listActiveCurrencies } from "@/lib/modules/currency";
import { Button, PageHeader } from "@/components/ui";
import {
  getBranchScope,
  listBranchOptions,
} from "@/app/dashboard/warehouses/branch-scope";
import { PurchaseOrderForm } from "./purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const user = await requireModule("purchasing");
  const scope = await getBranchScope(user);

  const [suppliers, warehouses, products, currencies, branches] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: {
        isActive: true,
        ...(scope.restrictToBranchId ? { branchId: scope.restrictToBranchId } : {}),
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        costPrice: true,
        taxRate: true,
      },
    }),
    listActiveCurrencies(),
    listBranchOptions(scope),
  ]);

  // سعر الصرف الساري اليوم لكل عملة، لعرض ما يعادله المستند بعملة الأساس قبل الحفظ.
  // العملة التي لا سعر لها تُعرض بلا مُعادل والخادم يرفض الحفظ برسالة واضحة.
  const currencyOptions = await Promise.all(
    currencies.map(async (currency) => {
      let rate: number | null = null;
      try {
        rate = await getExchangeRate(currency.id);
      } catch {
        rate = null;
      }
      return {
        id: currency.id,
        code: currency.code,
        name: currency.name,
        isBase: currency.isBase,
        rate,
      };
    }),
  );

  const baseCurrency = currencyOptions.find((currency) => currency.isBase);

  return (
    <div>
      <PageHeader
        title="أمر شراء جديد"
        description="يُحفظ الأمر كمسودة ويبدأ سير العمل الخاص به"
        action={
          <Link href="/dashboard/purchase-orders">
            <Button type="button" variant="outline">
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <PurchaseOrderForm
        suppliers={suppliers}
        warehouses={warehouses}
        currencies={currencyOptions}
        branches={branches}
        defaultCurrencyId={baseCurrency?.id ?? currencyOptions[0]?.id ?? ""}
        defaultBranchId={scope.userBranchId ?? ""}
        baseCurrencyCode={baseCurrency?.code ?? ""}
        canChooseBranch={scope.canSeeAllBranches}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          costPrice: toNumber(product.costPrice),
          taxRate: toNumber(product.taxRate),
        }))}
      />
    </div>
  );
}
