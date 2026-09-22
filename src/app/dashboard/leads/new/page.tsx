import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "../lead-form";

export default async function NewLeadPage() {
  await requireModule("crm");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="فرصة بيعية جديدة" description="سجّل عميلاً محتملاً وتابعه في مسار البيع" />
      <LeadForm mode="create" />
    </div>
  );
}
