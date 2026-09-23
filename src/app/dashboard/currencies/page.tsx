import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { formatDate, formatNumber, toNumber } from "@/lib/utils";
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
import { CurrencyForm } from "./currency-form";
import { RateForm } from "./rate-form";
import { CurrencyRowActions, DeleteRateButton } from "./row-actions";

export default async function CurrenciesPage() {
  await requireModule("settings");

  const [currencies, rates, entryCount] = await Promise.all([
    prisma.currency.findMany({
      orderBy: [{ isBase: "desc" }, { code: "asc" }],
      include: { _count: { select: { rates: true } } },
    }),
    prisma.exchangeRate.findMany({
      orderBy: [{ validFrom: "desc" }],
      take: 50,
      include: { currency: { select: { code: true, name: true } } },
    }),
    prisma.journalEntry.count(),
  ]);

  const base = currencies.find((currency) => currency.isBase);

  return (
    <div>
      <PageHeader
        title="العملات وأسعار الصرف"
        description="الدفاتر تُمسك بعملة الأساس، والمستندات بعملات أخرى تُحوَّل إليها بسعر الصرف المثبّت على المستند وقت إصداره."
      />

      {!base ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          لم تُحدَّد عملة أساس؛ لن يعمل الترحيل المحاسبي حتى تحدّدها.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>العملات</CardTitle>
              <CardDescription>
                {entryCount > 0
                  ? "لا يمكن تغيير عملة الأساس بعد وجود قيود محاسبية."
                  : "يمكنك تحديد عملة الأساس ما دامت الدفاتر خالية من القيود."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>الرمز</TH>
                    <TH>الاسم</TH>
                    <TH>الرمز المعروض</TH>
                    <TH>الخانات العشرية</TH>
                    <TH>أسعار مسجّلة</TH>
                    <TH>الحالة</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {currencies.map((currency) => (
                    <TR key={currency.id}>
                      <TD className="font-mono text-xs font-semibold">{currency.code}</TD>
                      <TD>{currency.name}</TD>
                      <TD>{currency.symbol}</TD>
                      <TD className="text-xs">{currency.decimals}</TD>
                      <TD className="text-xs text-muted-foreground">
                        {currency.isBase ? "—" : currency._count.rates}
                      </TD>
                      <TD className="space-x-1 space-x-reverse">
                        {currency.isBase ? <Badge tone="blue">عملة الأساس</Badge> : null}
                        <Badge tone={currency.isActive ? "green" : "gray"}>
                          {currency.isActive ? "مفعّلة" : "معطّلة"}
                        </Badge>
                      </TD>
                      <TD>
                        <CurrencyRowActions
                          currencyId={currency.id}
                          isActive={currency.isActive}
                          isBase={currency.isBase}
                          canChangeBase={entryCount === 0}
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
              <CardTitle>أسعار الصرف</CardTitle>
              <CardDescription>
                السعر = كم وحدة من {base?.code ?? "عملة الأساس"} تساوي وحدة واحدة من العملة.
                يظل السعر سارياً حتى يُسجَّل سعر أحدث منه.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rates.length === 0 ? (
                <EmptyState
                  title="لا توجد أسعار صرف"
                  description="سجّل سعراً لكل عملة أجنبية قبل إصدار مستندات بها."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>العملة</TH>
                      <TH>السعر</TH>
                      <TH>سارٍ من</TH>
                      <TH> </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rates.map((rate) => (
                      <TR key={rate.id}>
                        <TD>
                          <span className="font-mono text-xs font-semibold">
                            {rate.currency.code}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {rate.currency.name}
                          </span>
                        </TD>
                        <TD>{formatNumber(toNumber(rate.rate), 6)}</TD>
                        <TD className="text-xs text-muted-foreground">
                          {formatDate(rate.validFrom)}
                        </TD>
                        <TD>
                          <DeleteRateButton rateId={rate.id} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <CurrencyForm />
          <RateForm
            currencies={currencies
              .filter((currency) => !currency.isBase && currency.isActive)
              .map((currency) => ({
                id: currency.id,
                code: currency.code,
                name: currency.name,
              }))}
            baseCode={base?.code ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
