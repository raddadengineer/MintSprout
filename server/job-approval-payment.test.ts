import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { seedTestChild } from "./test-helpers";
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
    await seedTestChild(storage);
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

  it("allows parent to patch amount on an in_progress job without creating payment", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Mow lawn",
      description: null,
      amount: "10.00",
      status: "in_progress",
      recurrence: "once",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: null,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    const updated = await applyJobPatch(storage, { familyId: 1, role: "parent" }, job.id, {
      amount: "12.50",
    });

    expect(updated.amount).toBe("12.50");
    expect(updated.status).toBe("in_progress");

    const payments = await storage.getPaymentsByChild(child.id);
    expect(payments).toHaveLength(0);
  });

  it("rejects amount patch from child role", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Sweep porch",
      description: null,
      amount: "4.00",
      status: "in_progress",
      recurrence: "once",
      assignedToId: child.id,
      familyId: 1,
      categoryId: null,
      allowanceId: null,
      isFamilyDuty: false,
      icon: "briefcase",
    });

    await expect(
      applyJobPatch(storage, { familyId: 1, role: "child" }, job.id, { amount: "8.00" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("uses body.amount when parent approves with a new price in the same request", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Wash car",
      description: null,
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
      amount: "15.00",
    });

    expect(updated.status).toBe("approved");
    expect(updated.amount).toBe("15.00");

    const payments = await storage.getPaymentsByChild(child.id);
    expect(payments).toHaveLength(1);
    expect(parseFloat(payments[0]!.amount)).toBe(15);
  });

  it("uses customAllocation when parent approves with a custom split", async () => {
    const children = await storage.getChildrenByFamily(1);
    const child = children[0]!;
    const job = await storage.createJob({
      title: "Extra yard work",
      description: null,
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

    await applyJobPatch(storage, { familyId: 1, role: "parent" }, job.id, {
      status: "approved",
      customAllocation: {
        spendingAmount: 7,
        savingsAmount: 3,
        rothIraAmount: 0,
        brokerageAmount: 0,
      },
    });

    const payments = await storage.getPaymentsByChild(child.id);
    expect(payments).toHaveLength(1);
    expect(parseFloat(payments[0]!.spendingAmount)).toBe(7);
    expect(parseFloat(payments[0]!.savingsAmount)).toBe(3);
    expect(parseFloat(payments[0]!.rothIraAmount)).toBe(0);
    expect(parseFloat(payments[0]!.brokerageAmount)).toBe(0);

    const refreshed = await storage.getChild(child.id);
    expect(parseFloat(refreshed!.spendingBalance || "0")).toBe(7);
    expect(parseFloat(refreshed!.savingsBalance || "0")).toBe(3);
  });
});
