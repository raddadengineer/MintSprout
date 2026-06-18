import { eq } from "drizzle-orm";
import { db, supportsInteractiveTransactions } from "./db";
import * as schema from "@shared/schema";
import type { IStorage } from "./storage";
import type { Job } from "@shared/schema";
import { checkJobAchievements } from "./achievements";

type PaymentAmounts = {
  spendingAmount: string;
  savingsAmount: string;
  rothIraAmount: string;
  brokerageAmount: string;
};

function stripJobBody(body: Record<string, any>): Record<string, any> {
  const { customAllocation: _c, ...rest } = body;
  return rest;
}

function isStandalonePaidJob(job: Job): boolean {
  return (job as any).allowanceId == null && !(job as any).isFamilyDuty;
}

function normalizeJobAmount(raw: unknown): string | undefined {
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n.toFixed(2);
}

function effectiveJobAmount(job: Job, body: Record<string, any>): string {
  if (body.amount != null && body.amount !== "") {
    const normalized = normalizeJobAmount(body.amount);
    if (normalized) return normalized;
  }
  return job.amount;
}

function assertParentCanEditFields(ctx: { role: string }, body: Record<string, any>): void {
  if (ctx.role === "parent") return;
  if (
    body.amount !== undefined ||
    body.title !== undefined ||
    body.description !== undefined
  ) {
    throw Object.assign(new Error("Only parents can edit task details"), { statusCode: 403 });
  }
}

function validateAndNormalizeAmountPatch(job: Job, body: Record<string, any>): void {
  if (body.amount == null) return;

  if (!isStandalonePaidJob(job)) {
    throw Object.assign(new Error("Cannot change amount on allowance or family-duty tasks"), {
      statusCode: 400,
    });
  }

  const normalized = normalizeJobAmount(body.amount);
  if (!normalized) {
    throw Object.assign(new Error("Amount must be a positive number"), { statusCode: 400 });
  }
  body.amount = normalized;
}

async function computePaymentAmounts(
  storage: IStorage,
  job: Job,
  body: any,
): Promise<PaymentAmounts | undefined> {
  const amount = parseFloat(effectiveJobAmount(job, body));
  if (!Number.isFinite(amount)) return undefined;

  if (body.customAllocation) {
    return {
      spendingAmount: Number(body.customAllocation.spendingAmount).toFixed(2),
      savingsAmount: Number(body.customAllocation.savingsAmount).toFixed(2),
      rothIraAmount: Number(body.customAllocation.rothIraAmount).toFixed(2),
      brokerageAmount: Number(body.customAllocation.brokerageAmount).toFixed(2),
    };
  }

  const allocation = await storage.getAllocationSettings(job.assignedToId);
  if (!allocation) return undefined;

  return {
    spendingAmount: (((allocation.spendingPercentage || 0) / 100) * amount).toFixed(2),
    savingsAmount: (((allocation.savingsPercentage || 0) / 100) * amount).toFixed(2),
    rothIraAmount: (((allocation.rothIraPercentage || 0) / 100) * amount).toFixed(2),
    brokerageAmount: (((allocation.brokeragePercentage || 0) / 100) * amount).toFixed(2),
  };
}

async function applyPaymentSideEffects(
  storage: IStorage,
  job: Job,
  paymentAmounts: PaymentAmounts,
  payAmount: string,
): Promise<void> {
  const amount = parseFloat(payAmount);
  const existingPayments = await storage.getPaymentsByFamily(job.familyId);
  const existingPayment = existingPayments.find((p) => p.jobId === job.id);
  if (existingPayment) return;

  await storage.createPayment({
    jobId: job.id,
    childId: job.assignedToId,
    amount: payAmount,
    ...paymentAmounts,
  });

  const child = await storage.getChild(job.assignedToId);
  if (!child) return;

  await storage.updateChild(job.assignedToId, {
    totalEarned: (parseFloat(child.totalEarned || "0") + amount).toFixed(2),
    spendingBalance: (parseFloat(child.spendingBalance || "0") + parseFloat(paymentAmounts.spendingAmount)).toFixed(2),
    savingsBalance: (parseFloat(child.savingsBalance || "0") + parseFloat(paymentAmounts.savingsAmount)).toFixed(2),
    rothIraBalance: (parseFloat(child.rothIraBalance || "0") + parseFloat(paymentAmounts.rothIraAmount)).toFixed(2),
    brokerageBalance: (parseFloat(child.brokerageBalance || "0") + parseFloat(paymentAmounts.brokerageAmount)).toFixed(2),
    completedJobs: (child.completedJobs || 0) + 1,
  });

  await checkJobAchievements(storage, job.assignedToId);

  const note = `Payment for job: ${job.title}`;
  const spendingAmt = parseFloat(paymentAmounts.spendingAmount || "0");
  const savingsAmt = parseFloat(paymentAmounts.savingsAmount || "0");
  const rothAmt = parseFloat(paymentAmounts.rothIraAmount || "0");
  const brokerageAmt = parseFloat(paymentAmounts.brokerageAmount || "0");

  if (spendingAmt > 0) {
    await storage.createTransaction({
      childId: job.assignedToId,
      type: "payment",
      amount: spendingAmt.toFixed(2),
      fromAccount: "earnings",
      toAccount: "spending",
      note,
    } as any);
  }
  if (savingsAmt > 0) {
    await storage.createTransaction({
      childId: job.assignedToId,
      type: "payment",
      amount: savingsAmt.toFixed(2),
      fromAccount: "earnings",
      toAccount: "savings",
      note,
    } as any);
  }
  if (rothAmt > 0) {
    await storage.createTransaction({
      childId: job.assignedToId,
      type: "payment",
      amount: rothAmt.toFixed(2),
      fromAccount: "earnings",
      toAccount: "rothIra",
      note,
    } as any);
  }
  if (brokerageAmt > 0) {
    await storage.createTransaction({
      childId: job.assignedToId,
      type: "payment",
      amount: brokerageAmt.toFixed(2),
      fromAccount: "earnings",
      toAccount: "brokerage",
      note,
    } as any);
  }
}

async function approveWithPgTransaction(job: Job, body: any, paymentAmounts: PaymentAmounts | undefined): Promise<Job> {
  return await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
    if (!row) throw Object.assign(new Error("Job not found"), { statusCode: 404 });

    const noPay = (row as any).allowanceId != null || !!(row as any).isFamilyDuty;

    // Allowance-tied chores and family responsibilities are not paid as standalone job payments.
    if (noPay) {
      const patch = stripJobBody(body);
      const [updated] = await tx.update(schema.jobs).set(patch as any).where(eq(schema.jobs.id, row.id)).returning();
      if (!updated) throw Object.assign(new Error("Job update failed"), { statusCode: 500 });

      if ((row as any).isFamilyDuty) {
        const [child] = await tx.select().from(schema.children).where(eq(schema.children.id, row.assignedToId));
        if (child) {
          await tx
            .update(schema.children)
            .set({ completedJobs: (child.completedJobs || 0) + 1 })
            .where(eq(schema.children.id, row.assignedToId));
        }
      }

      return updated;
    }

    const pays = await tx.select().from(schema.payments).where(eq(schema.payments.jobId, row.id));
    const existingPayment = pays[0];
    const payAmount = effectiveJobAmount(row as Job, body);

    if (!existingPayment && paymentAmounts) {
      const amount = parseFloat(payAmount);
      await tx.insert(schema.payments).values({
        jobId: row.id,
        childId: row.assignedToId,
        amount: payAmount,
        ...paymentAmounts,
        createdAt: new Date(),
      } as any);

      const [child] = await tx.select().from(schema.children).where(eq(schema.children.id, row.assignedToId));
      if (child) {
        await tx
          .update(schema.children)
          .set({
            totalEarned: (parseFloat(child.totalEarned || "0") + amount).toFixed(2),
            spendingBalance: (parseFloat(child.spendingBalance || "0") + parseFloat(paymentAmounts.spendingAmount)).toFixed(2),
            savingsBalance: (parseFloat(child.savingsBalance || "0") + parseFloat(paymentAmounts.savingsAmount)).toFixed(2),
            rothIraBalance: (parseFloat(child.rothIraBalance || "0") + parseFloat(paymentAmounts.rothIraAmount)).toFixed(2),
            brokerageBalance: (parseFloat(child.brokerageBalance || "0") + parseFloat(paymentAmounts.brokerageAmount)).toFixed(2),
            completedJobs: (child.completedJobs || 0) + 1,
          })
          .where(eq(schema.children.id, row.assignedToId));

        const note = `Payment for job: ${row.title}`;
        const spendingAmt = parseFloat(paymentAmounts.spendingAmount || "0");
        const savingsAmt = parseFloat(paymentAmounts.savingsAmount || "0");
        const rothAmt = parseFloat(paymentAmounts.rothIraAmount || "0");
        const brokerageAmt = parseFloat(paymentAmounts.brokerageAmount || "0");

        const txs: any[] = [];
        if (spendingAmt > 0) {
          txs.push({
            childId: row.assignedToId,
            type: "payment",
            amount: spendingAmt.toFixed(2),
            fromAccount: "earnings",
            toAccount: "spending",
            note,
          } as any);
        }
        if (savingsAmt > 0) {
          txs.push({
            childId: row.assignedToId,
            type: "payment",
            amount: savingsAmt.toFixed(2),
            fromAccount: "earnings",
            toAccount: "savings",
            note,
          } as any);
        }
        if (rothAmt > 0) {
          txs.push({
            childId: row.assignedToId,
            type: "payment",
            amount: rothAmt.toFixed(2),
            fromAccount: "earnings",
            toAccount: "rothIra",
            note,
          } as any);
        }
        if (brokerageAmt > 0) {
          txs.push({
            childId: row.assignedToId,
            type: "payment",
            amount: brokerageAmt.toFixed(2),
            fromAccount: "earnings",
            toAccount: "brokerage",
            note,
          } as any);
        }
        for (const t of txs) {
          await tx.insert(schema.transactions).values({ ...t, createdAt: new Date() } as any);
        }
      }
    }

    const patch = stripJobBody(body);
    const [updated] = await tx.update(schema.jobs).set(patch as any).where(eq(schema.jobs.id, row.id)).returning();
    if (!updated) throw Object.assign(new Error("Job update failed"), { statusCode: 500 });
    return updated;
  });
}

/**
 * Apply a job PATCH. When approving as parent, creates payment + ledger + balance updates atomically on Postgres.
 */
export async function applyJobPatch(
  storage: IStorage,
  ctx: { familyId: number; role: string },
  jobId: number,
  body: any,
): Promise<Job> {
  const job = await storage.getJob(jobId);
  if (!job || job.familyId !== ctx.familyId) {
    throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  }

  if (body.status !== "approved") {
    assertParentCanEditFields(ctx, body);
    validateAndNormalizeAmountPatch(job, body);
    const updated = await storage.updateJob(jobId, stripJobBody(body));
    if (!updated) throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    return updated;
  }

  if (ctx.role !== "parent") {
    throw Object.assign(new Error("Only parents can approve jobs"), { statusCode: 403 });
  }

  // Allowance-tied chores and family responsibilities are not paid as standalone job payments.
  if ((job as any).allowanceId != null || !!(job as any).isFamilyDuty) {
    const next = stripJobBody(body);
    const updated = await storage.updateJob(jobId, { ...next, status: "approved" } as any);
    if (!updated) throw Object.assign(new Error("Job not found"), { statusCode: 404 });

    if ((job as any).isFamilyDuty) {
      const child = await storage.getChild(job.assignedToId);
      if (child) {
        await storage.updateChild(job.assignedToId, {
          completedJobs: (child.completedJobs || 0) + 1,
        });
        await checkJobAchievements(storage, job.assignedToId);
      }
    }

    return updated;
  }

  if (body.amount != null) {
    const normalized = normalizeJobAmount(body.amount);
    if (!normalized) {
      throw Object.assign(new Error("Amount must be a positive number"), { statusCode: 400 });
    }
    body.amount = normalized;
  }

  const paymentAmounts = await computePaymentAmounts(storage, job, body);
  const payAmount = effectiveJobAmount(job, body);

  if (supportsInteractiveTransactions) {
    return await approveWithPgTransaction(job, body, paymentAmounts);
  }

  if (paymentAmounts) {
    await applyPaymentSideEffects(storage, job, paymentAmounts, payAmount);
  }

  const updated = await storage.updateJob(jobId, stripJobBody(body));
  if (!updated) throw Object.assign(new Error("Job not found"), { statusCode: 404 });
  return updated;
}
