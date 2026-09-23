import { createHash } from "node:crypto";
import {
  readCertificateInfo,
  signInvoiceHash,
  type CertificateInfo,
} from "./crypto";
import { computeInvoiceHash } from "./ubl";
import { buildPhase2QrPayload } from "./qr";

/**
 * إدراج التوقيع الرقمي (XAdES) ورمز QR في فاتورة UBL.
 *
 * ترتيب العمليات مقصود: تُحسب التجزئة على الفاتورة بعد حذف عنصر التوقيع
 * ومرجع QR، ثم يُبنى التوقيع منها، ثم يُدرج التوقيع والرمز في الفاتورة.
 * فلو أُدرجا قبل الحساب لتغيّرت التجزئة بإدراجهما.
 */

export type SignedInvoice = {
  signedXml: string;
  invoiceHash: string;
  signature: string;
  qrPayload: string;
  signingTime: string;
};

export type SignInvoiceInput = {
  xml: string;
  privateKeyPem: string;
  certificatePem: string;
  sellerName: string;
  vatNumber: string;
  issueDate: Date;
  total: number;
  vatTotal: number;
  /** الفواتير المبسطة تحمل الحقل التاسع في رمز QR */
  includeIssuerSignature?: boolean;
};

function digestBase64(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

/** كتلة التوقيع بصيغة XAdES كما تتطلبها مواصفة الهيئة. */
function buildSignatureBlock(params: {
  invoiceHash: string;
  signature: string;
  certificate: CertificateInfo;
  signingTime: string;
}): string {
  const { invoiceHash, signature, certificate, signingTime } = params;

  const signedProperties = [
    `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">`,
    `<xades:SignedSignatureProperties>`,
    `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
    `<xades:SigningCertificate>`,
    `<xades:Cert>`,
    `<xades:CertDigest>`,
    `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificate.hashBase64}</ds:DigestValue>`,
    `</xades:CertDigest>`,
    `<xades:IssuerSerial>`,
    `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificate.issuerName}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certificate.serialNumber}</ds:X509SerialNumber>`,
    `</xades:IssuerSerial>`,
    `</xades:Cert>`,
    `</xades:SigningCertificate>`,
    `</xades:SignedSignatureProperties>`,
    `</xades:SignedProperties>`,
  ].join("");

  const signedPropertiesDigest = digestBase64(signedProperties);

  return [
    `  <ext:UBLExtensions>`,
    `    <ext:UBLExtension>`,
    `      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>`,
    `      <ext:ExtensionContent>`,
    `        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">`,
    `          <sac:SignatureInformation>`,
    `            <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>`,
    `            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>`,
    `            <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">`,
    `              <ds:SignedInfo>`,
    `                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>`,
    `                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>`,
    `                <ds:Reference Id="invoiceSignedData" URI="">`,
    `                  <ds:Transforms>`,
    `                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `                      <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>`,
    `                    </ds:Transform>`,
    `                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `                      <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>`,
    `                    </ds:Transform>`,
    `                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">`,
    `                      <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>`,
    `                    </ds:Transform>`,
    `                    <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>`,
    `                  </ds:Transforms>`,
    `                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `                  <ds:DigestValue>${invoiceHash}</ds:DigestValue>`,
    `                </ds:Reference>`,
    `                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">`,
    `                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `                  <ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>`,
    `                </ds:Reference>`,
    `              </ds:SignedInfo>`,
    `              <ds:SignatureValue>${signature}</ds:SignatureValue>`,
    `              <ds:KeyInfo>`,
    `                <ds:X509Data>`,
    `                  <ds:X509Certificate>${certificate.base64}</ds:X509Certificate>`,
    `                </ds:X509Data>`,
    `              </ds:KeyInfo>`,
    `              <ds:Object>`,
    `                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">`,
    `                  ${signedProperties}`,
    `                </xades:QualifyingProperties>`,
    `              </ds:Object>`,
    `            </ds:Signature>`,
    `          </sac:SignatureInformation>`,
    `        </sig:UBLDocumentSignatures>`,
    `      </ext:ExtensionContent>`,
    `    </ext:UBLExtension>`,
    `  </ext:UBLExtensions>`,
  ].join("\n");
}

/** مرجع رمز QR داخل الفاتورة، يُدرج بعد حساب التجزئة. */
function buildQrReference(qrPayload: string): string {
  return [
    `  <cac:AdditionalDocumentReference>`,
    `    <cbc:ID>QR</cbc:ID>`,
    `    <cac:Attachment>`,
    `      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrPayload}</cbc:EmbeddedDocumentBinaryObject>`,
    `    </cac:Attachment>`,
    `  </cac:AdditionalDocumentReference>`,
    `  <cac:Signature>`,
    `    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>`,
    `    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>`,
    `  </cac:Signature>`,
  ].join("\n");
}

/** يوقّع الفاتورة ويدرج التوقيع ورمز QR فيها. */
export async function signInvoice(
  input: SignInvoiceInput,
): Promise<SignedInvoice> {
  const invoiceHash = computeInvoiceHash(input.xml);
  const signature = signInvoiceHash(invoiceHash, input.privateKeyPem);
  const certificate = await readCertificateInfo(input.certificatePem);
  const signingTime = `${input.issueDate.toISOString().split(".")[0]}Z`;

  const qrPayload = buildPhase2QrPayload({
    sellerName: input.sellerName,
    vatNumber: input.vatNumber,
    timestamp: input.issueDate,
    total: input.total,
    vatTotal: input.vatTotal,
    invoiceHash,
    signature,
    publicKeyDerBase64: certificate.publicKeyDerBase64,
    issuerSignatureBase64: input.includeIssuerSignature
      ? certificate.issuerSignatureBase64
      : undefined,
  });

  const signatureBlock = buildSignatureBlock({
    invoiceHash,
    signature,
    certificate,
    signingTime,
  });

  let signedXml = input.xml.replace(
    /  <ext:UBLExtensions><\/ext:UBLExtensions>/,
    signatureBlock,
  );

  // مرجع QR يُدرج قبل بيانات البائع حفاظاً على ترتيب عناصر UBL
  signedXml = signedXml.replace(
    /(  <cac:AccountingSupplierParty>)/,
    `${buildQrReference(qrPayload)}\n$1`,
  );

  return { signedXml, invoiceHash, signature, qrPayload, signingTime };
}
