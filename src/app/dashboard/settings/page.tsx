import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await requireModule("settings");

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!organization) notFound();

  return (
    <div>
      <PageHeader
        title="إعدادات المنشأة"
        description="البيانات الأساسية التي تظهر في المستندات والتقارير"
      />
      <SettingsForm
        organization={{
          name: organization.name,
          legalName: organization.legalName ?? "",
          taxNumber: organization.taxNumber ?? "",
          currency: organization.currency,
          email: organization.email ?? "",
          phone: organization.phone ?? "",
          address: organization.address ?? "",
          fiscalYearStartMonth: organization.fiscalYearStartMonth,
        }}
      />
    </div>
  );
}
