import type { Role } from "@/generated/prisma";

export { ROLE_LABELS } from "@/lib/labels";

export type ModuleKey =
  | "dashboard"
  | "inventory"
  | "purchasing"
  | "sales"
  | "crm"
  | "accounting"
  | "hr"
  | "workflows"
  | "settings";

/** الوحدات المسموح بها لكل دور. ADMIN يملك كل شيء. */
const MODULE_ACCESS: Record<Role, ModuleKey[] | "*"> = {
  ADMIN: "*",
  ACCOUNTANT: ["dashboard", "accounting", "sales", "purchasing"],
  SALES: ["dashboard", "sales", "crm", "inventory"],
  PURCHASING: ["dashboard", "purchasing", "inventory"],
  INVENTORY: ["dashboard", "inventory"],
  HR: ["dashboard", "hr"],
  EMPLOYEE: ["dashboard", "hr"],
};

export function canAccessModule(role: Role, module: ModuleKey): boolean {
  const allowed = MODULE_ACCESS[role];
  return allowed === "*" || allowed.includes(module);
}
