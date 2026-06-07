import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { getAllowancePeriodStatus, executeAllowancePayout } from "./allowance-payout";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("allowance payout", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("preview math applies floor, variable cap, and missed penalties", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;

    const allowance = await storage.createAllowance({
      familyId: 1,
      childId: child.id,
      amount: "20.00",
      guaranteedMinimum: "10.00",
      penaltyPerIncompleteJob: "2.00",
      cadence: "weekly",
      dayOfWeek: 0,
      enabled: true,
    });

    await storage.createJob({
      title: "Chore 1",
      description: null,
      amount: "0",
      status: "approved",
      recurrence: "weekly",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: allowance.id,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    await storage.createJob({
      title: "Chore 2",
      description: null,
      amount: "0",
      status: "assigned",
      recurrence: "weekly",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: allowance.id,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    const status = await getAllowancePeriodStatus(allowance, storage);

    expect(status.floor).toBe(10);
    expect(status.variableCap).toBe(10);
    expect(status.missedCount).toBe(1);
    expect(status.penaltyTotal).toBe(2);
    expect(status.variablePaid).toBe(8);
    expect(status.payout).toBe(18);
    expect(status.canPay).toBe(true);
    expect(status.alreadyPaidThisPeriod).toBe(false);
  });

  it("executeAllowancePayout deposits to child and blocks duplicate pay in same period", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const startEarned = parseFloat(child.totalEarned || "0");

    const allowance = await storage.createAllowance({
      familyId: 1,
      childId: child.id,
      amount: "15.00",
      guaranteedMinimum: "15.00",
      penaltyPerIncompleteJob: "0.00",
      cadence: "weekly",
      dayOfWeek: 0,
      enabled: true,
    });

    const result = await executeAllowancePayout(allowance, storage);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payout).toBe(15);
      expect(result.periodKey).toBeTruthy();
    }

    const refreshed = await storage.getChild(child.id);
    expect(parseFloat(refreshed!.totalEarned || "0")).toBeCloseTo(startEarned + 15, 2);

    const updatedAllowance = (await storage.getAllowancesByFamily(1)).find((a) => a.id === allowance.id);
    expect(updatedAllowance?.lastRunAt).toBeTruthy();

    const second = await executeAllowancePayout(updatedAllowance!, storage);
    expect(second).toEqual({ ok: false, reason: "already_paid" });
  });

  it("returns zero_payout when allowance is disabled", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;

    const allowance = await storage.createAllowance({
      familyId: 1,
      childId: child.id,
      amount: "10.00",
      guaranteedMinimum: "10.00",
      penaltyPerIncompleteJob: "0.00",
      cadence: "weekly",
      dayOfWeek: 0,
      enabled: false,
    });

    const result = await executeAllowancePayout(allowance, storage);
    expect(result).toEqual({ ok: false, reason: "disabled" });
  });
});
