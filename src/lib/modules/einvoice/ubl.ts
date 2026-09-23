import { createHash, randomUUID } from "node:crypto";

/**
 * توليد فاتورة إلكترونية بمعيار UBL 2.1 وفق مواصفة هيئة الزكاة والضريبة
 * والجمارك للمرحلة الثانية (مرحلة التكامل).
 *
 * الفاتورة القياسية (B2B) تُجاز من الهيئة قبل تسليمها للمشتري، والمبسطة
 * (B2C) تُبلَّغ خلال 24 ساعة من إصدارها.
 */

export type EInvoiceDocumentType = "STANDARD" | "SIMPLIFIED";

/** 388 فاتورة، 381 إشعار دائن، 383 إشعار مدين. */
export type InvoiceTypeCode = "388" | "381" | "383";

export type UblSeller = {
  name: string;
  vatNumber: string;
  /** رقم السجل التجاري أو ما يعادله من المعرّفات المقبولة */
  identificationId?: string | null;
  identificationScheme?: string;
  street?: string | null;
  buildingNumber?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string;
};

export type UblBuyer = {
  name: string;
  vatNumber?: string | null;
  street?: string | null;
  buildingNumber?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
  countryCode?: string;
};

export type UblLine = {
  id: number;
  name: string;
  quantity: number;
  unitCode?: string;
  unitPrice: number;
  /** صافي السطر قبل الضريبة */
  lineExtensionAmount: number;
  taxRate: number;
  taxAmount: number;
};

export type UblInvoiceInput = {
  invoiceNumber: string;
  uuid: string;
  issueDate: Date;
  documentType: EInvoiceDocumentType;
  typeCode: InvoiceTypeCode;
  /** سبب الإشعار، إلزامي لإشعارات الدائن والمدين */
  instructionNote?: string | null;
  /** رقم الفاتورة الأصلية التي يعدّلها الإشعار */
  billingReference?: string | null;
  currencyCode: string;
  icv: bigint | number;
  previousHash: string;
  seller: UblSeller;
  buyer: UblBuyer;
  lines: UblLine[];
  lineExtensionTotal: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  taxTotal: number;
  prepaidAmount?: number;
  payableAmount: number;
};

/** تجزئة الفاتورة الأولى في السلسلة: SHA-256 للنص "0" بترميز base64. */
export const INITIAL_PREVIOUS_HASH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number): string {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function quantity(value: number): string {
  return (Math.round((value + Number.EPSILON) * 1000) / 1000).toFixed(6);
}

/** التاريخ بصيغة YYYY-MM-DD بتوقيت UTC. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** الوقت بصيغة HH:mm:ss بتوقيت UTC. */
function isoTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

function addressBlock(party: UblSeller | UblBuyer, indent: string): string {
  const lines = [
    party.street ? `${indent}  <cbc:StreetName>${escapeXml(party.street)}</cbc:StreetName>` : null,
    party.buildingNumber
      ? `${indent}  <cbc:BuildingNumber>${escapeXml(party.buildingNumber)}</cbc:BuildingNumber>`
      : null,
    party.district
      ? `${indent}  <cbc:CitySubdivisionName>${escapeXml(party.district)}</cbc:CitySubdivisionName>`
      : null,
    party.city ? `${indent}  <cbc:CityName>${escapeXml(party.city)}</cbc:CityName>` : null,
    party.postalCode
      ? `${indent}  <cbc:PostalZone>${escapeXml(party.postalCode)}</cbc:PostalZone>`
      : null,
    `${indent}  <cac:Country>`,
    `${indent}    <cbc:IdentificationCode>${party.countryCode ?? "SA"}</cbc:IdentificationCode>`,
    `${indent}  </cac:Country>`,
  ].filter(Boolean);

  return [`${indent}<cac:PostalAddress>`, ...lines, `${indent}</cac:PostalAddress>`].join("\n");
}

/**
 * يبني الـXML بصيغته غير الموقّعة. عنصر UBLExtensions يُترك فارغاً لأن
 * التوقيع يُدرج فيه لاحقاً، وهو مستثنى من حساب التجزئة أصلاً.
 */
export function buildUblInvoice(input: UblInvoiceInput): string {
  const { seller, buyer } = input;

  const lineXml = input.lines
    .map((line) =>
      [
        `  <cac:InvoiceLine>`,
        `    <cbc:ID>${line.id}</cbc:ID>`,
        `    <cbc:InvoicedQuantity unitCode="${line.unitCode ?? "PCE"}">${quantity(line.quantity)}</cbc:InvoicedQuantity>`,
        `    <cbc:LineExtensionAmount currencyID="${input.currencyCode}">${money(line.lineExtensionAmount)}</cbc:LineExtensionAmount>`,
        `    <cac:TaxTotal>`,
        `      <cbc:TaxAmount currencyID="${input.currencyCode}">${money(line.taxAmount)}</cbc:TaxAmount>`,
        `      <cbc:RoundingAmount currencyID="${input.currencyCode}">${money(line.lineExtensionAmount + line.taxAmount)}</cbc:RoundingAmount>`,
        `    </cac:TaxTotal>`,
        `    <cac:Item>`,
        `      <cbc:Name>${escapeXml(line.name)}</cbc:Name>`,
        `      <cac:ClassifiedTaxCategory>`,
        `        <cbc:ID>${line.taxRate > 0 ? "S" : "Z"}</cbc:ID>`,
        `        <cbc:Percent>${money(line.taxRate)}</cbc:Percent>`,
        `        <cac:TaxScheme>`,
        `          <cbc:ID>VAT</cbc:ID>`,
        `        </cac:TaxScheme>`,
        `      </cac:ClassifiedTaxCategory>`,
        `    </cac:Item>`,
        `    <cac:Price>`,
        `      <cbc:PriceAmount currencyID="${input.currencyCode}">${money(line.unitPrice)}</cbc:PriceAmount>`,
        `    </cac:Price>`,
        `  </cac:InvoiceLine>`,
      ].join("\n"),
    )
    .join("\n");

  // تجميع الضريبة حسب النسبة، فالهيئة تتطلب فئة ضريبية لكل نسبة مستخدمة
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const line of input.lines) {
    const bucket = byRate.get(line.taxRate) ?? { taxable: 0, tax: 0 };
    bucket.taxable += line.lineExtensionAmount;
    bucket.tax += line.taxAmount;
    byRate.set(line.taxRate, bucket);
  }

  const subtotalsXml = [...byRate.entries()]
    .map(([rate, bucket]) =>
      [
        `    <cac:TaxSubtotal>`,
        `      <cbc:TaxableAmount currencyID="${input.currencyCode}">${money(bucket.taxable)}</cbc:TaxableAmount>`,
        `      <cbc:TaxAmount currencyID="${input.currencyCode}">${money(bucket.tax)}</cbc:TaxAmount>`,
        `      <cac:TaxCategory>`,
        `        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${rate > 0 ? "S" : "Z"}</cbc:ID>`,
        `        <cbc:Percent>${money(rate)}</cbc:Percent>`,
        `        <cac:TaxScheme>`,
        `          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>`,
        `        </cac:TaxScheme>`,
        `      </cac:TaxCategory>`,
        `    </cac:TaxSubtotal>`,
      ].join("\n"),
    )
    .join("\n");

  // 0100000 قياسية، 0200000 مبسطة — أول خانتين تحددان نوع المستند
  const invoiceTypeName =
    input.documentType === "STANDARD" ? "0100000" : "0200000";

  const billingReferenceXml = input.billingReference
    ? [
        `  <cac:BillingReference>`,
        `    <cac:InvoiceDocumentReference>`,
        `      <cbc:ID>${escapeXml(input.billingReference)}</cbc:ID>`,
        `    </cac:InvoiceDocumentReference>`,
        `  </cac:BillingReference>`,
      ].join("\n")
    : "";

  const noteXml = input.instructionNote
    ? `  <cbc:Note>${escapeXml(input.instructionNote)}</cbc:Note>`
    : "";

  const buyerVatXml = buyer.vatNumber
    ? [
        `      <cac:PartyTaxScheme>`,
        `        <cbc:CompanyID>${escapeXml(buyer.vatNumber)}</cbc:CompanyID>`,
        `        <cac:TaxScheme>`,
        `          <cbc:ID>VAT</cbc:ID>`,
        `        </cac:TaxScheme>`,
        `      </cac:PartyTaxScheme>`,
      ].join("\n")
    : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">`,
    `  <ext:UBLExtensions></ext:UBLExtensions>`,
    `  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>`,
    `  <cbc:ID>${escapeXml(input.invoiceNumber)}</cbc:ID>`,
    `  <cbc:UUID>${input.uuid}</cbc:UUID>`,
    `  <cbc:IssueDate>${isoDate(input.issueDate)}</cbc:IssueDate>`,
    `  <cbc:IssueTime>${isoTime(input.issueDate)}</cbc:IssueTime>`,
    `  <cbc:InvoiceTypeCode name="${invoiceTypeName}">${input.typeCode}</cbc:InvoiceTypeCode>`,
    noteXml,
    `  <cbc:DocumentCurrencyCode>${input.currencyCode}</cbc:DocumentCurrencyCode>`,
    `  <cbc:TaxCurrencyCode>${input.currencyCode}</cbc:TaxCurrencyCode>`,
    billingReferenceXml,
    `  <cac:AdditionalDocumentReference>`,
    `    <cbc:ID>ICV</cbc:ID>`,
    `    <cbc:UUID>${input.icv.toString()}</cbc:UUID>`,
    `  </cac:AdditionalDocumentReference>`,
    `  <cac:AdditionalDocumentReference>`,
    `    <cbc:ID>PIH</cbc:ID>`,
    `    <cac:Attachment>`,
    `      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${input.previousHash}</cbc:EmbeddedDocumentBinaryObject>`,
    `    </cac:Attachment>`,
    `  </cac:AdditionalDocumentReference>`,
    `  <cac:AccountingSupplierParty>`,
    `    <cac:Party>`,
    seller.identificationId
      ? [
          `      <cac:PartyIdentification>`,
          `        <cbc:ID schemeID="${seller.identificationScheme ?? "CRN"}">${escapeXml(seller.identificationId)}</cbc:ID>`,
          `      </cac:PartyIdentification>`,
        ].join("\n")
      : "",
    addressBlock(seller, "      "),
    `      <cac:PartyTaxScheme>`,
    `        <cbc:CompanyID>${escapeXml(seller.vatNumber)}</cbc:CompanyID>`,
    `        <cac:TaxScheme>`,
    `          <cbc:ID>VAT</cbc:ID>`,
    `        </cac:TaxScheme>`,
    `      </cac:PartyTaxScheme>`,
    `      <cac:PartyLegalEntity>`,
    `        <cbc:RegistrationName>${escapeXml(seller.name)}</cbc:RegistrationName>`,
    `      </cac:PartyLegalEntity>`,
    `    </cac:Party>`,
    `  </cac:AccountingSupplierParty>`,
    `  <cac:AccountingCustomerParty>`,
    `    <cac:Party>`,
    addressBlock(buyer, "      "),
    buyerVatXml,
    `      <cac:PartyLegalEntity>`,
    `        <cbc:RegistrationName>${escapeXml(buyer.name)}</cbc:RegistrationName>`,
    `      </cac:PartyLegalEntity>`,
    `    </cac:Party>`,
    `  </cac:AccountingCustomerParty>`,
    `  <cac:TaxTotal>`,
    `    <cbc:TaxAmount currencyID="${input.currencyCode}">${money(input.taxTotal)}</cbc:TaxAmount>`,
    subtotalsXml,
    `  </cac:TaxTotal>`,
    `  <cac:LegalMonetaryTotal>`,
    `    <cbc:LineExtensionAmount currencyID="${input.currencyCode}">${money(input.lineExtensionTotal)}</cbc:LineExtensionAmount>`,
    `    <cbc:TaxExclusiveAmount currencyID="${input.currencyCode}">${money(input.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>`,
    `    <cbc:TaxInclusiveAmount currencyID="${input.currencyCode}">${money(input.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>`,
    `    <cbc:PrepaidAmount currencyID="${input.currencyCode}">${money(input.prepaidAmount ?? 0)}</cbc:PrepaidAmount>`,
    `    <cbc:PayableAmount currencyID="${input.currencyCode}">${money(input.payableAmount)}</cbc:PayableAmount>`,
    `  </cac:LegalMonetaryTotal>`,
    lineXml,
    `</Invoice>`,
  ]
    .filter((part) => part !== "")
    .join("\n");
}

/**
 * تجزئة الفاتورة: تُحذف العناصر المستثناة ثم يُوحَّد النص ثم SHA-256.
 *
 * الاستثناء مقصود في المواصفة: التوقيع ورمز QR يُحسبان من التجزئة نفسها،
 * فلو دخلا فيها لصار الحساب دائرياً.
 */
export function computeInvoiceHash(xml: string): string {
  const canonical = canonicalizeForHash(xml);
  return createHash("sha256").update(canonical, "utf8").digest("base64");
}

/** التجزئة بصيغتها السداسية عشرية، وهي الصيغة المطلوبة داخل عنصر التوقيع. */
export function computeInvoiceHashHex(xml: string): string {
  const canonical = canonicalizeForHash(xml);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * توحيد النص قبل التجزئة: حذف ext:UBLExtensions وcac:Signature ومرجع
 * رمز QR، ثم تطبيع المسافات بين العناصر وإزالة إعلان الترميز.
 */
export function canonicalizeForHash(xml: string): string {
  let result = xml;

  result = result.replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>\s*/g, "");
  result = result.replace(/<ext:UBLExtensions\s*\/>\s*/g, "");
  result = result.replace(/<cac:Signature>[\s\S]*?<\/cac:Signature>\s*/g, "");
  result = result.replace(
    /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>\s*/g,
    "",
  );
  result = result.replace(/<\?xml[^?]*\?>\s*/g, "");

  // تطبيع فواصل الأسطر والمسافات بين الوسوم حتى لا تغيّر التنسيقات التجزئة
  return result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("");
}

export function newInvoiceUuid(): string {
  return randomUUID();
}
