import { insertJobSchema, type Allowance, type InsertJob, type JobCategory } from "@shared/schema";
import { z } from "zod";
import { applyCategoryPaymentFields } from "./job-categories";

export type JobPayType = "none" | "allowance" | "standalone" | undefined;

export type BuildJobInsertOptions = {
  payType?: JobPayType;
  familyId: number;
  assignedToId: number;
  category?: JobCategory | null;
  allowances: Allowance[];
};

export type BuildJobInsertResult =
  | { ok: true; data: InsertJob }
  | { ok: false; message: string };

export function buildJobInsertPayload(
  rawBody: Record<string, unknown>,
  opts: BuildJobInsertOptions,
): BuildJobInsertResult {
  const { payType, familyId, assignedToId, category, allowances } = opts;
  let body: Record<string, unknown> = { ...rawBody };
  delete body.payType;
  delete body.assignToAllChildren;

  if (category) {
    const effectiveMode = payType ?? category.paymentMode;
    if (effectiveMode === "allowance") {
      const allowanceId = Number(body.allowanceId);
      if (!Number.isFinite(allowanceId)) {
        return { ok: false, message: "Allowance tasks require selecting an allowance" };
      }
      const allowance = allowances.find((a) => a.id === allowanceId);
      if (!allowance || allowance.childId !== assignedToId) {
        return { ok: false, message: "Allowance does not belong to that child" };
      }
      body.amount = "0.00";
      body.isFamilyDuty = false;
    } else if (effectiveMode === "none") {
      body.amount = "0.00";
      body.isFamilyDuty = true;
      delete body.allowanceId;
    } else {
      body.isFamilyDuty = false;
      delete body.allowanceId;
      const amountError = validateStandaloneAmount(body.amount);
      if (amountError) return { ok: false, message: amountError };
    }
    if (!payType) {
      body = applyCategoryPaymentFields(category, body);
    }
  } else if (payType === "none" || body?.isFamilyDuty === true || body?.isFamilyDuty === "true") {
    body.amount = "0.00";
    body.isFamilyDuty = true;
    delete body.allowanceId;
  } else if (body?.allowanceId != null && body?.allowanceId !== "") {
    const allowanceId = Number(body.allowanceId);
    if (!Number.isFinite(allowanceId)) {
      return { ok: false, message: "Invalid allowance assignment" };
    }
    const allowance = allowances.find((a) => a.id === allowanceId);
    if (!allowance || allowance.childId !== assignedToId) {
      return { ok: false, message: "Allowance does not belong to that child" };
    }
    body.amount = "0.00";
    body.isFamilyDuty = false;
  } else {
    delete body.allowanceId;
    body.isFamilyDuty = false;
  }

  try {
    const data = insertJobSchema.parse({
      ...body,
      assignedToId,
      familyId,
      status: "assigned",
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues?.[0];
      const path = first?.path?.length ? first.path.join(".") : undefined;
      const detail = first?.message ? (path ? `${path}: ${first.message}` : first.message) : "Invalid job data";
      return { ok: false, message: detail };
    }
    throw error;
  }
}

export function resolveEffectivePayType(
  payType: JobPayType,
  category: JobCategory | null | undefined,
): JobPayType {
  return payType ?? category?.paymentMode;
}

export type ResolveAllowanceResult =
  | { ok: true; allowance: Allowance }
  | { ok: false; reason: string };

export function validateStandaloneAmount(amount: unknown): string | null {
  if (amount == null || amount === "") {
    return "One-time payment tasks require an amount";
  }
  const parsed = parseFloat(String(amount));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "One-time payment tasks require a valid amount";
  }
  return null;
}

export function resolveEnabledAllowanceForChild(
  allowances: Allowance[],
  childId: number,
): ResolveAllowanceResult {
  const enabled = allowances.filter((a) => a.childId === childId && (a.enabled ?? true));
  if (enabled.length === 0) {
    return { ok: false, reason: "No enabled allowance" };
  }
  if (enabled.length > 1) {
    return { ok: false, reason: "Multiple enabled allowances — pick one in Controls" };
  }
  return { ok: true, allowance: enabled[0] };
}

/** @deprecated Use resolveEnabledAllowanceForChild */
export function findEnabledAllowanceForChild(
  allowances: Allowance[],
  childId: number,
): Allowance | undefined {
  const resolved = resolveEnabledAllowanceForChild(allowances, childId);
  return resolved.ok ? resolved.allowance : undefined;
}
