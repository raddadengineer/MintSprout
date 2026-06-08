import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { seedTestChild } from "./test-helpers";
import { runAllowanceSchedulerTick } from "./allowance-scheduler";
import * as allowancePayout from "./allowance-payout";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("allowance scheduler payout mode", () => {
  let storage: MemStorage;
  let paySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
    await seedTestChild(storage);
    paySpy = vi.spyOn(allowancePayout, "executeAllowancePayout").mockResolvedValue({
      ok: true,
      payout: 10,
      periodKey: "2026-W01",
    });
  });

  it("skips automatic payout for manual-mode allowances on due day", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const dueDay = new Date().getDay();

    await storage.createAllowance({
      familyId: 1,
      childId: child.id,
      amount: "10.00",
      guaranteedMinimum: "10.00",
      penaltyPerIncompleteJob: "0.00",
      cadence: "weekly",
      dayOfWeek: dueDay,
      enabled: true,
      payoutMode: "manual",
    } as any);

    await runAllowanceSchedulerTick(storage, new Date());

    expect(paySpy).not.toHaveBeenCalled();
  });

  it("runs automatic payout for automatic-mode allowances on due day", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const dueDay = new Date().getDay();

    await storage.createAllowance({
      familyId: 1,
      childId: child.id,
      amount: "10.00",
      guaranteedMinimum: "10.00",
      penaltyPerIncompleteJob: "0.00",
      cadence: "weekly",
      dayOfWeek: dueDay,
      enabled: true,
      payoutMode: "automatic",
    } as any);

    await runAllowanceSchedulerTick(storage, new Date());

    expect(paySpy).toHaveBeenCalledTimes(1);
  });
});
