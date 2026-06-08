import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { seedTestChild } from "./test-helpers";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("deleteChild cascade", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("removes child, user, jobs, payments, and allocation settings", async () => {
    const child = await seedTestChild(storage);
    const job = await storage.createJob({
      title: "Dishes",
      description: null,
      amount: "5.00",
      status: "approved",
      recurrence: "once",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: null,
      isFamilyDuty: false,
      icon: "briefcase",
    });
    await storage.createPayment({
      jobId: job.id,
      childId: child.id,
      amount: "5.00",
      spendingAmount: "5.00",
      savingsAmount: "0.00",
      rothIraAmount: "0.00",
      brokerageAmount: "0.00",
    });

    const userBefore = await storage.getUserById(child.userId);
    expect(userBefore).toBeDefined();

    const ok = await storage.deleteChild(child.id);
    expect(ok).toBe(true);
    expect(await storage.getChild(child.id)).toBeUndefined();
    expect(await storage.getUserById(child.userId)).toBeUndefined();
    expect(await storage.getJobsByChild(child.id)).toHaveLength(0);
    expect(await storage.getPaymentsByChild(child.id)).toHaveLength(0);
    expect(await storage.getAllocationSettings(child.id)).toBeUndefined();
  });
});
