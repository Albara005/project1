import type { LeaveStatus, LeaveType } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "سنوية",
  SICK: "مرضية",
  UNPAID: "بدون راتب",
  EMERGENCY: "اضطرارية",
  MATERNITY: "أمومة",
};

export const LEAVE_TYPE_VALUES = [
  "ANNUAL",
  "SICK",
  "UNPAID",
  "EMERGENCY",
  "MATERNITY",
] as const;

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "معلّق",
  APPROVED: "موافق عليه",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
};

export const LEAVE_STATUS_TONES: Record<LeaveStatus, BadgeTone> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};
