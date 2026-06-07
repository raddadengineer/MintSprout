import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { applyJobPatch } from "./job-approval-payment";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("applyJobPatch payment allocation", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("creates payment and updates balances when parent approves a paid job", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Wash dishes",
      description: "Kitchen cleanup",
      amount: "10.00",
      status: "completed",
      recurrence: "once",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: null,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    const updated = await applyJobPatch(storage, { familyId: 1, role: "parent" }, job.id, {
      status: "approved",
    });

    expect(updated.status).toBe("approved");

    const payments = await storage.getPaymentsByChild(child.id);
    expect(payments).toHaveLength(1);
    expect(parseFloat(payments[0]!.amount)).toBe(10);

    const refreshed = await storage.getChild(child.id);
    expect(parseFloat(refreshed!.totalEarned || "0")).toBeGreaterThan(parseFloat(child.totalEarned || "0"));
  });

  it("rejects approval from child role", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Tidy room",
      description: null,
      amount: "5.00",
      status: "completed",
      recurrence: "once",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: null,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    await expect(
      applyJobPatch(storage, { familyId: 1, role: "child" }, job.id, { status: "approved" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
