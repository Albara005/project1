import type { EmployeeStatus } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "على رأس العمل",
  ON_LEAVE: "في إجازة",
  TERMINATED: "منتهية خدمته",
};

export const EMPLOYEE_STATUS_TONES: Record<EmployeeStatus, BadgeTone> = {
  ACTIVE: "green",
  ON_LEAVE: "amber",
  TERMINATED: "red",
};

export const EMPLOYEE_STATUS_VALUES = [
  "ACTIVE",
  "ON_LEAVE",
  "TERMINATED",
] as const;
