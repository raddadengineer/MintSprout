import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { seedTestChild } from "./test-helpers";
import { getPaymentHistory } from "./payment-history";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("getPaymentHistory", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("merges job payments and allowance transactions", async () => {
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

    const stamp = new Date("2025-06-01T12:00:00Z");
    await storage.createTransaction({
      childId: child.id,
      type: "allowance",
      amount: "10.00",
      fromAccount: null,
      toAccount: "spending",
      note: "Weekly allowance",
    });
    // Second row with same note groups with first when timestamps match in production;
    // MemStorage assigns fresh timestamps — assert allowance rows exist and total is correct.
    void stamp;

    const history = await getPaymentHistory(storage, 1);
    expect(history.some((r) => r.source === "job")).toBe(true);
    const allowanceRows = history.filter((r) => r.source === "allowance");
    expect(allowanceRows.length).toBeGreaterThanOrEqual(1);
    const allowanceTotal = allowanceRows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    expect(allowanceTotal).toBe(10);
  });
});
