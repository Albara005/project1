"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@/components/ui";
import {
  ENVIRONMENT_LABELS,
  INVOICE_TYPE_OPTIONS,
} from "./labels";
import {
  generateDeviceCsr,
  requestCompliance,
  requestProduction,
  type ActionState,
} from "./actions";

type CredentialSummary = {
  id: string;
  deviceName: string;
  environment: string;
  hasCompliance: boolean;
  hasProduction: boolean;
  csrPem: string;
};

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? busy : label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        {state.success}
      </p>
    );
  }
  return null;
}

export function OnboardingForms({
  credential,
  portalUrl,
}: {
  credential: CredentialSummary | null;
  portalUrl: string;
}) {
  const [csrState, csrAction] = useActionState<ActionState, FormData>(
    generateDeviceCsr,
    {},
  );
  const [complianceState, complianceAction] = useActionState<ActionState, FormData>(
    requestCompliance,
    {},
  );
  const [productionState, productionAction] = useActionState<ActionState, FormData>(
    requestProduction,
    {},
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1) توليد المفتاح وطلب الشهادة</CardTitle>
          <CardDescription>
            المفتاح الخاص يُحفظ على الخادم ولا يُرسل لأي جهة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={csrAction} className="space-y-3">
            <div>
              <Label htmlFor="deviceName">اسم جهاز الإصدار</Label>
              <Input
                id="deviceName"
                name="deviceName"
                required
                dir="ltr"
                placeholder="ERP-RIYADH-01"
                defaultValue={credential?.deviceName ?? ""}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="environment">البيئة</Label>
              <Select
                id="environment"
                name="environment"
                defaultValue={credential?.environment ?? "sandbox"}
              >
                {Object.entries(ENVIRONMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="registrationNumber">رقم السجل التجاري</Label>
              <Input id="registrationNumber" name="registrationNumber" required dir="ltr" />
            </div>
            <div>
              <Label htmlFor="businessCategory">نشاط المنشأة</Label>
              <Input
                id="businessCategory"
                name="businessCategory"
                required
                placeholder="Retail"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="invoiceTypes">أنواع الفواتير</Label>
              <Select id="invoiceTypes" name="invoiceTypes" defaultValue="1100">
                {INVOICE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <Feedback state={csrState} />
            <Submit label="توليد الطلب" busy="جاري التوليد..." />
          </form>

          {credential ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                عرض طلب الشهادة (CSR)
              </summary>
              <pre
                dir="ltr"
                className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-[10px] leading-tight"
              >
                {credential.csrPem}
              </pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) شهادة التوافق</CardTitle>
          <CardDescription>
            يتطلب رمز تحقق من بوابة فاتورة الخاصة بمنشأتك.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!credential ? (
            <p className="text-sm text-muted-foreground">
              أنشئ طلب الشهادة أولاً.
            </p>
          ) : (
            <form action={complianceAction} className="space-y-3">
              <input type="hidden" name="credentialId" value={credential.id} />
              <div>
                <Label htmlFor="otp">رمز التحقق (OTP)</Label>
                <Input
                  id="otp"
                  name="otp"
                  required
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  يُصدره صاحب المنشأة من بوابة فاتورة، وصلاحيته قصيرة.
                </p>
              </div>

              <Feedback state={complianceState} />
              {credential.hasCompliance ? (
                <Badge tone="green">شهادة التوافق صادرة</Badge>
              ) : null}
              <Submit label="طلب شهادة التوافق" busy="جاري الإرسال..." />
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) شهادة الإنتاج</CardTitle>
          <CardDescription>
            بعد اجتياز فحوص التوافق لدى الهيئة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!credential?.hasCompliance ? (
            <p className="text-sm text-muted-foreground">
              أكمل شهادة التوافق أولاً.
            </p>
          ) : (
            <form action={productionAction} className="space-y-3">
              <input type="hidden" name="credentialId" value={credential.id} />
              <div>
                <Label htmlFor="complianceRequestId">رقم طلب التوافق</Label>
                <Input
                  id="complianceRequestId"
                  name="complianceRequestId"
                  required
                  dir="ltr"
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  الرقم الذي أعادته الهيئة في الخطوة السابقة.
                </p>
              </div>

              <Feedback state={productionState} />
              {credential.hasProduction ? (
                <Badge tone="green">شهادة الإنتاج مفعّلة</Badge>
              ) : null}
              <Submit label="إصدار شهادة الإنتاج" busy="جاري الإصدار..." />
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground" dir="ltr">
        {portalUrl}
      </p>
    </div>
  );
}
