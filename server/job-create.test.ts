import { describe, it, expect } from "vitest";
import { buildJobInsertPayload, findEnabledAllowanceForChild } from "./job-create";
import type { Allowance, JobCategory } from "@shared/schema";

const category: JobCategory = {
  id: 1,
  familyId: 1,
  slug: "self_care",
  label: "Take Care of Yourself",
  description: null,
  icon: "bed",
  sortOrder: 0,
  enabled: true,
  paymentMode: "none",
  createdAt: new Date(),
};

const allowances: Allowance[] = [
  {
    id: 10,
    familyId: 1,
    childId: 2,
    amount: "5.00",
    guaranteedMinimum: "0.00",
    penaltyPerIncompleteJob: "0.00",
    cadence: "weekly",
    dayOfWeek: 0,
    dayOfMonth: null,
    enabled: true,
    createdAt: new Date(),
  },
];

describe("buildJobInsertPayload", () => {
  it("builds a family duty job for a child", () => {
    const result = buildJobInsertPayload(
      {
        title: "Make bed",
        description: "Daily",
        recurrence: "daily",
        icon: "bed",
        categoryId: 1,
      },
      { payType: "none", familyId: 1, assignedToId: 2, category, allowances },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assignedToId).toBe(2);
      expect(result.data.isFamilyDuty).toBe(true);
      expect(result.data.amount).toBe("0.00");
    }
  });

  it("rejects allowance when child has no matching allowance", () => {
    const result = buildJobInsertPayload(
      {
        title: "Trash",
        recurrence: "weekly",
        icon: "trash2",
        categoryId: 1,
        allowanceId: 10,
      },
      { payType: "allowance", familyId: 1, assignedToId: 3, category: { ...category, paymentMode: "allowance" }, allowances },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Allowance does not belong");
    }
  });
});

describe("findEnabledAllowanceForChild", () => {
  it("returns enabled allowance for child", () => {
    expect(findEnabledAllowanceForChild(allowances, 2)?.id).toBe(10);
    expect(findEnabledAllowanceForChild(allowances, 3)).toBeUndefined();
  });
});
