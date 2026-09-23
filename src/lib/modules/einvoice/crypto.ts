import { execFile } from "node:child_process";
import { createHash, createSign, createVerify } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * التوقيع التشفيري للفوترة الإلكترونية (المرحلة الثانية).
 *
 * الهيئة تشترط منحنى secp256k1 مع SHA-256، وطلب توقيع شهادة (CSR) يحمل
 * امتدادات خاصة تعرّف جهاز الإصدار. تُولَّد الشهادة عبر openssl لأن واجهة
 * node البرمجية لا تُنشئ CSR.
 */

export class EInvoiceCryptoError extends Error {}

export type CsrSubject = {
  /** اسم الجهاز كما سيُسجَّل لدى الهيئة */
  commonName: string;
  /** الرقم الضريبي للمنشأة (15 رقماً) */
  vatNumber: string;
  organizationName: string;
  /** اسم الوحدة/الفرع */
  organizationUnit: string;
  /** رقم السجل التجاري أو المعرّف البديل */
  registrationNumber: string;
  /** صناعة المنشأة، مثل: تجزئة */
  businessCategory: string;
  /** العنوان المختصر للمنشأة */
  address: string;
  /** 1100 فاتورة قياسية ومبسطة، 1000 قياسية فقط، 0100 مبسطة فقط */
  invoiceTypes?: string;
  environment?: "sandbox" | "simulation" | "production";
};

/** معرّف القالب يختلف باختلاف بيئة الهيئة. */
const TEMPLATE_BY_ENVIRONMENT: Record<string, string> = {
  sandbox: "TSTZATCA-Code-Signing",
  simulation: "PREZATCA-Code-Signing",
  production: "ZATCA-Code-Signing",
};

function escapeConfigValue(value: string): string {
  // قيم ملف إعداد openssl لا تحتمل أسطراً جديدة ولا محارف التحكم
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * حقول subjectAltName تُكتب بمحارف لاتينية فقط.
 *
 * openssl يعالج قسم dirName بترميز latin-1 ثم يعيد ترميزه UTF-8، فتخرج
 * القيم العربية مشوّهة بترميز مضاعف، وقد يُسقط الحقل كاملاً دون أي خطأ
 * ودون رمز خروج غير صفري. المواصفة أصلاً تستخدم قيماً لاتينية في هذه
 * الحقول، فتُنقَّى هنا بدل أن تفسد الشهادة بصمت.
 */
function asciiOnly(value: string, fallback: string): string {
  const cleaned = escapeConfigValue(value)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export type GeneratedCsr = {
  privateKeyPem: string;
  publicKeyPem: string;
  csrPem: string;
  /** الصيغة المطلوبة في طلبات الهيئة: CSR بترميز base64 */
  csrBase64: string;
};

/**
 * يولّد مفتاحاً خاصاً وطلب توقيع شهادة يحمل امتدادات الهيئة.
 * المفتاح الخاص لا يغادر الخادم ولا يُرسل للهيئة.
 */
export async function generateCsr(subject: CsrSubject): Promise<GeneratedCsr> {
  const environment = subject.environment ?? "sandbox";
  const template = TEMPLATE_BY_ENVIRONMENT[environment];
  if (!template) {
    throw new EInvoiceCryptoError(`بيئة غير معروفة: ${environment}`);
  }

  if (!/^\d{15}$/.test(subject.vatNumber)) {
    throw new EInvoiceCryptoError("الرقم الضريبي يجب أن يكون 15 رقماً");
  }

  const workDir = await mkdtemp(join(tmpdir(), "zatca-csr-"));
  const keyPath = join(workDir, "private.key");
  const csrPath = join(workDir, "request.csr");
  const configPath = join(workDir, "csr.cnf");

  // SN يحمل معرّف البائع والحل ورقم الجهاز، وهي القيم التي تربط الشهادة بالجهاز
  const solutionName = asciiOnly(subject.organizationName, "ERP");
  const serialName = `1-${solutionName}|2-ERP|3-${asciiOnly(subject.commonName, "DEVICE")}`;

  const config = [
    "[req]",
    "prompt = no",
    "utf8 = yes",
    // بدونه تُرمَّز القيم غير اللاتينية في الموضوع بصيغة خاطئة
    "string_mask = utf8only",
    "distinguished_name = dn",
    "req_extensions = v3_req",
    "",
    "[dn]",
    `CN = ${escapeConfigValue(subject.commonName)}`,
    `OU = ${escapeConfigValue(subject.organizationUnit)}`,
    `O = ${escapeConfigValue(subject.organizationName)}`,
    "C = SA",
    "",
    "[v3_req]",
    `1.3.6.1.4.1.311.20.2 = ASN1:PRINTABLESTRING:${template}`,
    "subjectAltName = dirName:alt_names",
    "",
    "[alt_names]",
    `SN = ${serialName}`,
    `UID = ${subject.vatNumber}`,
    `title = ${subject.invoiceTypes ?? "1100"}`,
    `registeredAddress = ${asciiOnly(subject.address, "Saudi Arabia")}`,
    `businessCategory = ${asciiOnly(subject.businessCategory, "General")}`,
    "",
  ].join("\n");

  try {
    await writeFile(configPath, config, "utf8");

    await run("openssl", [
      "ecparam",
      "-name",
      "secp256k1",
      "-genkey",
      "-noout",
      "-out",
      keyPath,
    ]);

    await run("openssl", [
      "req",
      "-new",
      "-sha256",
      "-key",
      keyPath,
      "-config",
      configPath,
      "-out",
      csrPath,
    ]);

    const [privateKeyPem, csrPem] = await Promise.all([
      readFile(keyPath, "utf8"),
      readFile(csrPath, "utf8"),
    ]);

    const { stdout: publicKeyPem } = await run("openssl", [
      "ec",
      "-in",
      keyPath,
      "-pubout",
    ]);

    // openssl يُخرج طلباً ناقصاً بصمت وبرمز خروج صفري إذا تعذّر ترميز أحد
    // حقول subjectAltName، فيُرفض الطلب لاحقاً لدى الهيئة بلا سبب واضح.
    // التحقق هنا يحوّل الفشل الصامت إلى خطأ مفهوم عند التوليد.
    await assertCsrCarriesRequiredFields(csrPath, subject.vatNumber, template);

    return {
      privateKeyPem,
      publicKeyPem,
      csrPem,
      csrBase64: Buffer.from(csrPem, "utf8").toString("base64"),
    };
  } catch (error) {
    throw new EInvoiceCryptoError(
      `تعذر توليد طلب الشهادة: ${(error as Error).message}`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** يتأكد أن الطلب يحمل الحقول التي تشترطها الهيئة قبل اعتماده. */
async function assertCsrCarriesRequiredFields(
  csrPath: string,
  vatNumber: string,
  template: string,
): Promise<void> {
  const { stdout } = await run("openssl", [
    "req",
    "-in",
    csrPath,
    "-noout",
    "-text",
  ]);

  const missing: string[] = [];
  if (!stdout.includes(vatNumber)) missing.push("الرقم الضريبي (UID)");
  if (!stdout.includes("1.3.6.1.4.1.311.20.2")) missing.push("امتداد قالب الهيئة");
  if (!/DirName:\s*\/.+/.test(stdout)) missing.push("بيانات جهاز الإصدار (subjectAltName)");

  if (missing.length > 0) {
    throw new EInvoiceCryptoError(
      `طلب الشهادة نقص منه: ${missing.join("، ")}. تأكد أن بيانات المنشأة لا تحتوي محارف غير مدعومة.`,
    );
  }

  void template;
}

/** يوقّع تجزئة الفاتورة بالمفتاح الخاص؛ يعيد التوقيع بترميز base64. */
export function signInvoiceHash(hashBase64: string, privateKeyPem: string): string {
  try {
    const signer = createSign("SHA256");
    // يُوقَّع النص السداسي عشري للتجزئة كما تتطلب المواصفة، لا بايتاتها
    signer.update(Buffer.from(hashBase64, "base64").toString("utf8"), "utf8");
    signer.end();
    return signer.sign(privateKeyPem, "base64");
  } catch (error) {
    throw new EInvoiceCryptoError(
      `تعذر توقيع الفاتورة: ${(error as Error).message}`,
    );
  }
}

/** يتحقق من التوقيع بالمفتاح العام — يُستخدم في الاختبار والمراجعة. */
export function verifyInvoiceSignature(
  hashBase64: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = createVerify("SHA256");
    verifier.update(Buffer.from(hashBase64, "base64").toString("utf8"), "utf8");
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, "base64");
  } catch {
    return false;
  }
}

/** بيانات الشهادة اللازمة لبناء رمز QR وكتلة التوقيع. */
export type CertificateInfo = {
  /** الشهادة بترميز base64 دون أسطر PEM */
  base64: string;
  /** تجزئة الشهادة SHA-256 بترميز base64 للنص السداسي عشري */
  hashBase64: string;
  publicKeyDerBase64: string;
  /** توقيع جهة الإصدار على الشهادة، الحقل التاسع في رمز QR */
  issuerSignatureBase64: string;
  issuerName: string;
  serialNumber: string;
};

function stripPem(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

/** يستخرج من الشهادة ما يلزم للتوقيع ورمز QR. */
export async function readCertificateInfo(
  certificatePem: string,
): Promise<CertificateInfo> {
  const workDir = await mkdtemp(join(tmpdir(), "zatca-cert-"));
  const certPath = join(workDir, "cert.pem");

  try {
    await writeFile(certPath, certificatePem, "utf8");

    const [{ stdout: subjectOut }, { stdout: serialOut }, { stdout: pubOut }] =
      await Promise.all([
        run("openssl", ["x509", "-in", certPath, "-noout", "-issuer", "-nameopt", "RFC2253"]),
        run("openssl", ["x509", "-in", certPath, "-noout", "-serial"]),
        run("openssl", ["x509", "-in", certPath, "-noout", "-pubkey"]),
      ]);

    const base64 = stripPem(certificatePem);

    // الهيئة تحسب تجزئة الشهادة على نصها بترميز base64، لا على بايتاتها
    const hashHex = createHash("sha256").update(base64, "utf8").digest("hex");

    const { stdout: asn1Out } = await run("openssl", [
      "asn1parse",
      "-in",
      certPath,
      "-strparse",
      "4",
    ]).catch(() => ({ stdout: "" }));
    void asn1Out;

    // توقيع جهة الإصدار هو آخر حقل BIT STRING في بنية الشهادة
    const { stdout: fullAsn1 } = await run("openssl", ["asn1parse", "-in", certPath]);
    const bitStringLines = fullAsn1
      .split("\n")
      .filter((line) => line.includes("BIT STRING"));
    const lastBitString = bitStringLines[bitStringLines.length - 1] ?? "";
    const offsetMatch = lastBitString.match(/^\s*(\d+):/);

    let issuerSignatureBase64 = "";
    if (offsetMatch) {
      const { stdout: sigOut } = await run("openssl", [
        "asn1parse",
        "-in",
        certPath,
        "-offset",
        offsetMatch[1],
        "-noout",
        "-out",
        "-",
      ]).catch(() => ({ stdout: "" }));
      issuerSignatureBase64 = Buffer.from(sigOut, "binary").toString("base64");
    }

    return {
      base64,
      hashBase64: Buffer.from(hashHex, "utf8").toString("base64"),
      publicKeyDerBase64: stripPem(pubOut),
      issuerSignatureBase64,
      issuerName: subjectOut.replace(/^issuer=/, "").trim(),
      serialNumber: serialOut.replace(/^serial=/, "").trim(),
    };
  } catch (error) {
    throw new EInvoiceCryptoError(
      `تعذر قراءة الشهادة: ${(error as Error).message}`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
