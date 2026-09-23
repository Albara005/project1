/**
 * عميل منصة فاتورة لدى هيئة الزكاة والضريبة والجمارك.
 *
 * مسار الانضمام: طلب شهادة توافق برمز OTP من بوابة فاتورة، ثم اجتياز
 * فحوص التوافق بإرسال عينات فواتير، ثم إصدار شهادة الإنتاج.
 *
 * بعد الانضمام: الفواتير المبسطة تُبلَّغ (reporting) خلال 24 ساعة،
 * والقياسية تُجاز (clearance) قبل تسليمها للمشتري.
 */

export type FatooraEnvironment = "sandbox" | "simulation" | "production";

const BASE_URLS: Record<FatooraEnvironment, string> = {
  sandbox:
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  simulation: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  production: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
};

export class FatooraError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

export type FatooraCredentials = {
  /** معرّف الشهادة، يُستخدم اسم مستخدم في المصادقة الأساسية */
  csid: string;
  secret: string;
};

export type FatooraResult<T> = {
  ok: boolean;
  status: number;
  /** حالة الرد كما تصفها الهيئة: مقبولة، مقبولة بملاحظات، مرفوضة */
  reportingStatus?: string;
  clearanceStatus?: string;
  warnings: string[];
  errors: string[];
  raw: string;
  data?: T;
};

type ZatcaValidationMessage = {
  type?: string;
  code?: string;
  category?: string;
  message?: string;
  status?: string;
};

function collectMessages(body: unknown): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const results = (body as Record<string, unknown>)?.validationResults as
    | Record<string, unknown>
    | undefined;

  const push = (items: unknown, target: string[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items as ZatcaValidationMessage[]) {
      const text = [item.code, item.message].filter(Boolean).join(": ");
      if (text) target.push(text);
    }
  };

  if (results) {
    push(results.warningMessages, warnings);
    push(results.errorMessages, errors);
  }

  return { warnings, errors };
}

async function request<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 30000,
): Promise<FatooraResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();

    let parsed: unknown = undefined;
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch {
      // بعض الأخطاء تعود بنص غير JSON، ويُحفظ كما هو للتشخيص
    }

    const { warnings, errors } = collectMessages(parsed);
    const record = parsed as Record<string, unknown> | undefined;

    return {
      ok: response.ok,
      status: response.status,
      reportingStatus: record?.reportingStatus as string | undefined,
      clearanceStatus: record?.clearanceStatus as string | undefined,
      warnings,
      errors,
      raw,
      data: parsed as T | undefined,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new FatooraError("انتهت مهلة الاتصال بمنصة فاتورة");
    }
    throw new FatooraError(
      `تعذر الاتصال بمنصة فاتورة: ${(error as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function authHeader(credentials: FatooraCredentials): string {
  const token = Buffer.from(
    `${credentials.csid}:${credentials.secret}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept-Version": "V2",
    Accept: "application/json",
  };
}

export type ComplianceCsidResponse = {
  requestID?: string | number;
  binarySecurityToken?: string;
  secret?: string;
};

/**
 * الخطوة الأولى في الانضمام: تبادل طلب الشهادة برمز OTP من بوابة فاتورة
 * للحصول على شهادة توافق مؤقتة. رمز OTP يُصدره صاحب المنشأة من البوابة
 * ولا يمكن توليده برمجياً.
 */
export async function requestComplianceCsid(
  environment: FatooraEnvironment,
  csrBase64: string,
  otp: string,
): Promise<FatooraResult<ComplianceCsidResponse>> {
  return request<ComplianceCsidResponse>(
    `${BASE_URLS[environment]}/compliance`,
    {
      method: "POST",
      headers: { ...baseHeaders(), OTP: otp },
      body: JSON.stringify({ csr: csrBase64 }),
    },
  );
}

/**
 * فحص التوافق: تُرسل عينات من كل نوع مستند تنوي المنشأة إصداره،
 * ويجب أن تجتاز جميعها قبل طلب شهادة الإنتاج.
 */
export async function submitComplianceInvoice(
  environment: FatooraEnvironment,
  credentials: FatooraCredentials,
  payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
): Promise<FatooraResult<unknown>> {
  return request(`${BASE_URLS[environment]}/compliance/invoices`, {
    method: "POST",
    headers: { ...baseHeaders(), Authorization: authHeader(credentials) },
    body: JSON.stringify({
      invoiceHash: payload.invoiceHash,
      uuid: payload.uuid,
      invoice: payload.invoiceBase64,
    }),
  });
}

/** إصدار شهادة الإنتاج بعد اجتياز فحوص التوافق. */
export async function requestProductionCsid(
  environment: FatooraEnvironment,
  credentials: FatooraCredentials,
  complianceRequestId: string,
): Promise<FatooraResult<ComplianceCsidResponse>> {
  return request<ComplianceCsidResponse>(
    `${BASE_URLS[environment]}/production/csids`,
    {
      method: "POST",
      headers: { ...baseHeaders(), Authorization: authHeader(credentials) },
      body: JSON.stringify({ compliance_request_id: complianceRequestId }),
    },
  );
}

/** تبليغ فاتورة مبسطة — خلال 24 ساعة من إصدارها. */
export async function reportInvoice(
  environment: FatooraEnvironment,
  credentials: FatooraCredentials,
  payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
): Promise<FatooraResult<unknown>> {
  return request(`${BASE_URLS[environment]}/invoices/reporting/single`, {
    method: "POST",
    headers: {
      ...baseHeaders(),
      Authorization: authHeader(credentials),
      "Clearance-Status": "0",
    },
    body: JSON.stringify({
      invoiceHash: payload.invoiceHash,
      uuid: payload.uuid,
      invoice: payload.invoiceBase64,
    }),
  });
}

/** إجازة فاتورة قياسية — قبل تسليمها للمشتري. */
export async function clearInvoice(
  environment: FatooraEnvironment,
  credentials: FatooraCredentials,
  payload: { invoiceHash: string; uuid: string; invoiceBase64: string },
): Promise<FatooraResult<unknown>> {
  return request(`${BASE_URLS[environment]}/invoices/clearance/single`, {
    method: "POST",
    headers: {
      ...baseHeaders(),
      Authorization: authHeader(credentials),
      "Clearance-Status": "1",
    },
    body: JSON.stringify({
      invoiceHash: payload.invoiceHash,
      uuid: payload.uuid,
      invoice: payload.invoiceBase64,
    }),
  });
}

export function fatooraBaseUrl(environment: FatooraEnvironment): string {
  return BASE_URLS[environment];
}
