import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { PrintButton } from "./print-button";

export type PrintOrganization = {
  name: string;
  legalName: string | null;
  taxNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
};

export type PrintParty = {
  heading: string;
  name: string;
  code?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type PrintLine = {
  id: string;
  description: string;
  sku?: string | null;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
};

export type PrintMeta = { label: string; value: string };

/**
 * مستند قابل للطباعة بمقاس A4 واتجاه RTL.
 * يُستخدم للفواتير وإشعارات المرتجعات، ويخفي أدوات الشاشة عند الطباعة.
 */
export function PrintDocument({
  organization,
  title,
  subtitle,
  documentNumber,
  party,
  meta,
  lines,
  subtotal,
  taxAmount,
  total,
  extraTotals = [],
  note,
  footerNote,
  qrSvg,
}: {
  organization: PrintOrganization;
  title: string;
  subtitle?: string;
  documentNumber: string;
  party: PrintParty;
  meta: PrintMeta[];
  lines: PrintLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  extraTotals?: Array<{ label: string; value: number; emphasis?: boolean }>;
  note?: string | null;
  footerNote?: string;
  /** رمز ZATCA بصيغة SVG جاهزة للتضمين؛ يُترك فارغاً للمستندات غير الخاضعة له. */
  qrSvg?: string | null;
}) {
  const currency = organization.currency;

  return (
    <div className="mx-auto max-w-[820px] bg-white p-8 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-xl font-bold">{organization.name}</h1>
          {organization.legalName ? (
            <p className="text-sm text-gray-600">{organization.legalName}</p>
          ) : null}
          <div className="mt-2 space-y-0.5 text-xs text-gray-700">
            {organization.taxNumber ? (
              <p>الرقم الضريبي: <span dir="ltr">{organization.taxNumber}</span></p>
            ) : null}
            {organization.address ? <p>{organization.address}</p> : null}
            {organization.phone ? (
              <p>هاتف: <span dir="ltr">{organization.phone}</span></p>
            ) : null}
            {organization.email ? (
              <p>
                البريد: <span dir="ltr">{organization.email}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-end">
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-600">{subtitle}</p> : null}
          <p className="mt-2 text-sm font-semibold" dir="ltr">
            {documentNumber}
          </p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 font-semibold text-gray-800">{party.heading}</p>
          <p className="font-medium">{party.name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-gray-700">
            {party.code ? <p>الرمز: {party.code}</p> : null}
            {party.taxNumber ? (
              <p>الرقم الضريبي: <span dir="ltr">{party.taxNumber}</span></p>
            ) : null}
            {party.address ? <p>{party.address}</p> : null}
            {party.phone ? (
              <p>
                هاتف: <span dir="ltr">{party.phone}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          {meta.map((item) => (
            <div key={item.label} className="flex justify-between gap-3">
              <span className="text-gray-600">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-xs">
            <th className="border border-gray-300 px-2 py-2 text-start">#</th>
            <th className="border border-gray-300 px-2 py-2 text-start">الصنف</th>
            <th className="border border-gray-300 px-2 py-2 text-start">الكمية</th>
            <th className="border border-gray-300 px-2 py-2 text-start">سعر الوحدة</th>
            <th className="border border-gray-300 px-2 py-2 text-start">الضريبة</th>
            <th className="border border-gray-300 px-2 py-2 text-start">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id}>
              <td className="border border-gray-300 px-2 py-1.5 text-xs">{index + 1}</td>
              <td className="border border-gray-300 px-2 py-1.5">
                {line.description}
                {line.sku ? (
                  <span className="block text-xs text-gray-500" dir="ltr">
                    {line.sku}
                  </span>
                ) : null}
              </td>
              <td className="border border-gray-300 px-2 py-1.5">
                {formatNumber(line.quantity, 3)} {line.unit ?? ""}
              </td>
              <td className="border border-gray-300 px-2 py-1.5">
                {formatCurrency(line.unitPrice, currency)}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-xs">
                {formatNumber(line.taxRate, 2)}%
              </td>
              <td className="border border-gray-300 px-2 py-1.5">
                {formatCurrency(line.lineTotal, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <Line label="الإجمالي قبل الضريبة" value={formatCurrency(subtotal, currency)} />
          <Line label="ضريبة القيمة المضافة" value={formatCurrency(taxAmount, currency)} />
          <div className="flex justify-between border-t-2 border-gray-800 pt-1.5 text-base font-bold">
            <span>الإجمالي</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
          {extraTotals.map((item) => (
            <Line
              key={item.label}
              label={item.label}
              value={formatCurrency(item.value, currency)}
              emphasis={item.emphasis}
            />
          ))}
        </div>
      </section>

      {note || qrSvg ? (
        <section className="mt-5 flex items-start justify-between gap-6 border-t border-gray-300 pt-3">
          <div className="text-xs text-gray-700">
            {note ? (
              <>
                <p className="mb-1 font-semibold">ملاحظات</p>
                <p>{note}</p>
              </>
            ) : null}
          </div>

          {qrSvg ? (
            <div className="shrink-0 text-center">
              <div
                className="h-[120px] w-[120px]"
                // الرمز مُولَّد في الخادم من بيانات المستند نفسه، لا من مدخلات المستخدم
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-1 text-[10px] text-gray-500">رمز الفاتورة الإلكترونية</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="mt-8 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
        <p>{footerNote ?? "هذا المستند صادر إلكترونياً من نظام ERP ولا يحتاج إلى ختم أو توقيع."}</p>
        <p className="mt-1">تاريخ الطباعة: {formatDate(new Date())}</p>
      </footer>
    </div>
  );
}

function Line({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? "font-semibold" : ""}`}>
      <span className="text-gray-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
