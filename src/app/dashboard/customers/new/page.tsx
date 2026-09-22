import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  await requireModule("sales");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="عميل جديد" description="أضف بيانات العميل الأساسية" />
      <CustomerForm mode="create" />
    </div>
  );
}
