"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserAction } from "@/lib/session";
import {
  generateCsr,
  EInvoiceCryptoError,
} from "@/lib/modules/einvoice/crypto";
import {
  requestComplianceCsid,
  requestProductionCsid,
  FatooraError,
  type FatooraEnvironment,
} from "@/lib/modules/einvoice/fatoora";
import {
  issueEInvoice,
  submitEInvoice,
  EInvoiceError,
} from "@/lib/modules/einvoice/service";

export type ActionState = { error?: string; success?: string };

const ENVIRONMENTS = ["sandbox", "simulation", "production"] as const;

const onboardSchema = z.object({
  deviceName: z
    .string()
    .trim()
    .min(3, "اسم الجهاز مطلوب")
    .regex(/^[A-Za-z0-9-]+$/, "اسم الجهاز بحروف إنجليزية وأرقام وشرطات فقط"),
  environment: z.enum(ENVIRONMENTS),
  businessCategory: z.string().trim().min(2, "نشاط المنشأة مطلوب"),
  registrationNumber: z.string().trim().min(4, "رقم السجل التجاري مطلوب"),
  invoiceTypes: z.enum(["1100", "1000", "0100"]),
});

/**
 * الخطوة الأولى: توليد مفتاح خاص وطلب شهادة. المفتاح يُحفظ على الخادم
 * ولا يُرسل لأي جهة، والطلب وحده هو ما يُرسل للهيئة.
 */
export async function generateDeviceCsr(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = onboardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const organization = await prisma.organization.findFirst();
  if (!organization?.taxNumber) {
    return { error: "عرّف الرقم الضريبي في إعدادات المنشأة أولاً" };
  }

  try {
    const csr = await generateCsr({
      commonName: parsed.data.deviceName,
      vatNumber: organization.taxNumber,
      organizationName: organization.legalName || organization.name,
      organizationUnit: parsed.data.deviceName,
      registrationNumber: parsed.data.registrationNumber,
      businessCategory: parsed.data.businessCategory,
      address: organization.address ?? "Saudi Arabia",
      invoiceTypes: parsed.data.invoiceTypes,
      environment: parsed.data.environment,
    });

    await prisma.eInvoiceCredential.upsert({
      where: { deviceName: parsed.data.deviceName },
      update: {
        environment: parsed.data.environment,
        privateKeyPem: csr.privateKeyPem,
        publicKeyPem: csr.publicKeyPem,
        csrPem: csr.csrPem,
        complianceCsid: null,
        complianceSecret: null,
        productionCsid: null,
        productionSecret: null,
        certificatePem: null,
        isActive: false,
        onboardedAt: null,
      },
      create: {
        deviceName: parsed.data.deviceName,
        environment: parsed.data.environment,
        privateKeyPem: csr.privateKeyPem,
        publicKeyPem: csr.publicKeyPem,
        csrPem: csr.csrPem,
      },
    });
  } catch (error) {
    if (error instanceof EInvoiceCryptoError) return { error: error.message };
    return { error: "تعذر توليد طلب الشهادة" };
  }

  revalidatePath("/dashboard/einvoicing");
  return { success: "تم توليد المفتاح وطلب الشهادة" };
}

const otpSchema = z.object({
  credentialId: z.string().min(1),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "رمز التحقق ستة أرقام كما يظهر في بوابة فاتورة"),
});

/**
 * الخطوة الثانية: تبادل الطلب برمز OTP للحصول على شهادة التوافق.
 * رمز OTP يصدره صاحب المنشأة من بوابة فاتورة ولا يمكن توليده برمجياً.
 */
export async function requestCompliance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = otpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const credential = await prisma.eInvoiceCredential.findUnique({
    where: { id: parsed.data.credentialId },
  });
  if (!credential) return { error: "بيانات الجهاز غير موجودة" };

  try {
    const result = await requestComplianceCsid(
      credential.environment as FatooraEnvironment,
      Buffer.from(credential.csrPem, "utf8").toString("base64"),
      parsed.data.otp,
    );

    if (!result.ok || !result.data?.binarySecurityToken) {
      const detail = result.errors.join("، ") || result.raw.slice(0, 300);
      return { error: `رفضت الهيئة الطلب (${result.status}): ${detail}` };
    }

    // الشهادة تعود بترميز base64 وتُحفظ بصيغة PEM للاستخدام في التوقيع
    const certificatePem = toPem(result.data.binarySecurityToken);

    await prisma.eInvoiceCredential.update({
      where: { id: credential.id },
      data: {
        complianceCsid: result.data.binarySecurityToken,
        complianceSecret: result.data.secret ?? null,
        certificatePem,
        onboardedAt: new Date(),
      },
    });

    return {
      success: `تم إصدار شهادة التوافق. رقم الطلب: ${result.data.requestID ?? "—"}`,
    };
  } catch (error) {
    if (error instanceof FatooraError) return { error: error.message };
    return { error: "تعذر الاتصال بمنصة فاتورة" };
  } finally {
    revalidatePath("/dashboard/einvoicing");
  }
}

const productionSchema = z.object({
  credentialId: z.string().min(1),
  complianceRequestId: z.string().trim().min(1, "رقم طلب التوافق مطلوب"),
});

/** الخطوة الثالثة: إصدار شهادة الإنتاج بعد اجتياز فحوص التوافق. */
export async function requestProduction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUserAction("settings");

  const parsed = productionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const credential = await prisma.eInvoiceCredential.findUnique({
    where: { id: parsed.data.credentialId },
  });
  if (!credential?.complianceCsid || !credential.complianceSecret) {
    return { error: "أكمل خطوة شهادة التوافق أولاً" };
  }

  try {
    const result = await requestProductionCsid(
      credential.environment as FatooraEnvironment,
      { csid: credential.complianceCsid, secret: credential.complianceSecret },
      parsed.data.complianceRequestId,
    );

    if (!result.ok || !result.data?.binarySecurityToken) {
      const detail = result.errors.join("، ") || result.raw.slice(0, 300);
      return { error: `تعذر إصدار شهادة الإنتاج (${result.status}): ${detail}` };
    }

    await prisma.$transaction([
      // شهادة إنتاج واحدة نشطة في كل وقت حتى لا تتفرّع سلسلة التجزئة
      prisma.eInvoiceCredential.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.eInvoiceCredential.update({
        where: { id: credential.id },
        data: {
          productionCsid: result.data.binarySecurityToken,
          productionSecret: result.data.secret ?? null,
          certificatePem: toPem(result.data.binarySecurityToken),
          isActive: true,
          onboardedAt: new Date(),
        },
      }),
    ]);

    return { success: "تم إصدار شهادة الإنتاج وتفعيلها" };
  } catch (error) {
    if (error instanceof FatooraError) return { error: error.message };
    return { error: "تعذر الاتصال بمنصة فاتورة" };
  } finally {
    revalidatePath("/dashboard/einvoicing");
  }
}

function toPem(base64: string): string {
  const body = base64.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? base64;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

/** يولّد الفاتورة الإلكترونية ويوقّعها دون إرسالها. */
export async function issueForInvoice(invoiceId: string): Promise<ActionState> {
  await requireUserAction("accounting");

  try {
    await issueEInvoice(invoiceId);
  } catch (error) {
    if (error instanceof EInvoiceError || error instanceof EInvoiceCryptoError) {
      return { error: error.message };
    }
    return { error: "تعذر إصدار الفاتورة الإلكترونية" };
  }

  revalidatePath("/dashboard/einvoicing");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { success: "تم إصدار الفاتورة الإلكترونية وتوقيعها" };
}

/** يرسل الفاتورة للهيئة: تبليغ للمبسطة وإجازة للقياسية. */
export async function submitToZatca(eInvoiceId: string): Promise<ActionState> {
  await requireUserAction("accounting");

  try {
    const status = await submitEInvoice(eInvoiceId);
    return { success: `حالة الفاتورة لدى الهيئة: ${status}` };
  } catch (error) {
    if (error instanceof EInvoiceError || error instanceof FatooraError) {
      return { error: error.message };
    }
    return { error: "تعذر إرسال الفاتورة" };
  } finally {
    revalidatePath("/dashboard/einvoicing");
  }
}
