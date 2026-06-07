/** Helpers for task payment / approval type (UI only). */

export type TaskPayKind = "family_duty" | "allowance" | "one_time";

export function taskPayKind(job: {
  isFamilyDuty?: boolean | null;
  allowanceId?: number | null;
  amount?: string;
}): TaskPayKind {
  if (job.isFamilyDuty) return "family_duty";
  if (job.allowanceId) return "allowance";
  if (parseFloat(job.amount || "0") > 0) return "one_time";
  return "family_duty";
}

export function taskPayLabel(job: {
  isFamilyDuty?: boolean | null;
  allowanceId?: number | null;
  amount?: string;
}): string {
  const kind = taskPayKind(job);
  if (kind === "family_duty") return "Family responsibility";
  if (kind === "allowance") return "Allowance chore";
  return `$${parseFloat(job.amount || "0").toFixed(2)} one-time`;
}

export function needsPaymentModal(job: {
  isFamilyDuty?: boolean | null;
  allowanceId?: number | null;
  amount?: string;
}): boolean {
  return taskPayKind(job) === "one_time";
}
