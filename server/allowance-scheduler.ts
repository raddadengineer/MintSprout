import type { IStorage } from "./storage";
import { db, supportsInteractiveTransactions } from "./db";
import * as schema from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDue(allowance: any, now: Date): boolean {
  if (!allowance.enabled) return false;
  const lastRunAt = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;
  if (lastRunAt && sameDay(lastRunAt, now)) return false;

  if (allowance.cadence === "weekly") {
    const dow = typeof allowance.dayOfWeek === "number" ? allowance.dayOfWeek : null;
    return dow !== null && now.getDay() === dow;
  }
  if (allowance.cadence === "monthly") {
    const dom = typeof allowance.dayOfMonth === "number" ? allowance.dayOfMonth : null;
    return dom !== null && now.getDate() === dom;
  }
  return false;
}

function isoDayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKeyUTC(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function occurrenceKeyForRecurrence(recurrence: string, now: Date): string {
  if (recurrence === "once") return "once";
  if (recurrence === "daily") return isoDayKeyUTC(now);
  if (recurrence === "weekly") return isoWeekKeyUTC(now);
  if (recurrence === "monthly") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return isoDayKeyUTC(now);
}

function periodStartForAllowance(allowance: any, now: Date): Date {
  const last = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;
  if (last && !Number.isNaN(last.getTime())) return last;
  const days = allowance.cadence === "monthly" ? 31 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function startAllowanceScheduler(storage: IStorage) {
  const tick = async () => {
    const now = new Date();

    try {
      // Roll recurring family responsibilities forward each occurrence window.
      if (supportsInteractiveTransactions) {
        try {
          const familyDutyJobs = await db
            .select()
            .from(schema.jobs)
            .where(eq(schema.jobs.isFamilyDuty, true));
          for (const j of familyDutyJobs) {
            const key = occurrenceKeyForRecurrence(String(j.recurrence), now);
            const done = await db
              .select()
              .from(schema.familyDutyCompletedLog)
              .where(and(eq(schema.familyDutyCompletedLog.jobId, j.id), eq(schema.familyDutyCompletedLog.occurrenceKey, key)));
            const closed = done.length > 0;

            if (closed && j.status !== "approved") {
              await storage.updateJob(j.id, { status: "approved" } as any);
            }
            if (!closed && j.status === "approved") {
              await storage.updateJob(j.id, { status: "assigned" } as any);
            }
          }
        } catch (err) {
          console.error("Family duty rollover failed:", err);
        }
      }

      const allowances = await storage.getEnabledAllowances();

      for (const a of allowances) {
        // Always roll allowance-tied chore availability forward based on recurrence windows.
        try {
          const jobs = await storage.getJobsByChild(a.childId);
          const allowanceJobs = (jobs as any[]).filter((j) => (j as any).allowanceId === a.id);
          if (allowanceJobs.length > 0 && supportsInteractiveTransactions) {
            for (const j of allowanceJobs) {
              const key = occurrenceKeyForRecurrence(String((j as any).recurrence), now);
              const done = await db
                .select()
                .from(schema.allowanceCompletedJobLog)
                .where(and(eq(schema.allowanceCompletedJobLog.jobId, j.id), eq(schema.allowanceCompletedJobLog.occurrenceKey, key)));
              const missed = await db
                .select()
                .from(schema.allowanceMissedJobLog)
                .where(and(eq(schema.allowanceMissedJobLog.jobId, j.id), eq(schema.allowanceMissedJobLog.occurrenceKey, key)));
              const closed = done.length > 0 || missed.length > 0;

              // If closed in this occurrence, keep it out of the active list.
              if (closed && j.status !== "approved") {
                await storage.updateJob(j.id, { status: "approved" } as any);
              }

              // If not closed in this occurrence, make sure it's available.
              if (!closed && j.status === "approved") {
                await storage.updateJob(j.id, { status: "assigned" } as any);
              }
            }
          }
        } catch (err) {
          console.error("Allowance chore rollover failed:", err);
        }

        if (!isDue(a as any, now)) continue;

        const child = await storage.getChild(a.childId);
        if (!child) continue;

        const amountTotal = parseFloat(String(a.amount ?? "0"));
        if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
          await storage.updateAllowance(a.id, { lastRunAt: now } as any);
          continue;
        }

        const floor = Math.min(
          parseFloat(String((a as any).guaranteedMinimum ?? "0")),
          amountTotal,
        );
        const penaltyEach = Math.max(0, parseFloat(String((a as any).penaltyPerIncompleteJob ?? "0")));
        const variableCap = Math.max(0, amountTotal - floor);

        let missed = 0;
        if (supportsInteractiveTransactions) {
          const rows = await db
            .select()
            .from(schema.allowanceMissedJobLog)
            .where(
              and(
                eq(schema.allowanceMissedJobLog.allowanceId, a.id),
                gte(schema.allowanceMissedJobLog.createdAt, periodStartForAllowance(a, now)),
                lte(schema.allowanceMissedJobLog.createdAt, now),
              ),
            );
          missed = rows.length;
        } else {
          // Fallback: older behavior based on allowance-tied jobs that are not approved.
          const jobs = await storage.getJobsByChild(a.childId);
          const allowanceJobs = (jobs as any[]).filter((j) => (j as any).allowanceId === a.id);
          missed = allowanceJobs.filter((j) => j.status !== "approved").length;
        }
        const penalty = Math.min(variableCap, missed * penaltyEach);
        const variablePaid = variableCap - penalty;
        const payout = floor + variablePaid;

        if (!Number.isFinite(payout) || payout <= 0) {
          await storage.updateAllowance(a.id, { lastRunAt: now } as any);
          continue;
        }

        const allocation = await storage.getAllocationSettings(child.id);
        const accountTypes = await storage.getAccountTypes(a.familyId);

        const spendingPct = allocation?.spendingPercentage ?? 0;
        const savingsPct = allocation?.savingsPercentage ?? 0;
        const rothPct = allocation?.rothIraPercentage ?? 0;
        const brokeragePct = allocation?.brokeragePercentage ?? 0;

        let spendingAmount = (spendingPct / 100) * payout;
        let savingsAmount = (savingsPct / 100) * payout;
        let rothAmount = (rothPct / 100) * payout;
        let brokerageAmount = (brokeragePct / 100) * payout;

        if (accountTypes && !accountTypes.savingsEnabled) {
          spendingAmount += savingsAmount;
          savingsAmount = 0;
        }
        if (accountTypes && !accountTypes.rothIraEnabled) {
          spendingAmount += rothAmount;
          rothAmount = 0;
        }
        if (accountTypes && !accountTypes.brokerageEnabled) {
          spendingAmount += brokerageAmount;
          brokerageAmount = 0;
        }

        const note =
          missed > 0 && penaltyEach > 0
            ? `Allowance $${payout.toFixed(2)} (min $${floor.toFixed(2)} + variable $${variablePaid.toFixed(2)}; ${missed} missed chore occurrence(s), -$${penalty.toFixed(2)})`
            : `Allowance $${payout.toFixed(2)} (min $${floor.toFixed(2)} + variable $${variablePaid.toFixed(2)})`;

        const periodKey = isoDayKeyUTC(now);

        if (supportsInteractiveTransactions) {
          try {
            await db.transaction(async (tx) => {
              const claimed = await tx
                .insert(schema.allowancePayoutLog)
                .values({
                  allowanceId: a.id,
                  periodKey,
                })
                .onConflictDoNothing()
                .returning();

              if (claimed.length === 0) return;

              const [c] = await tx.select().from(schema.children).where(eq(schema.children.id, child.id));
              if (!c) return;

              await tx
                .update(schema.children)
                .set({
                  totalEarned: (parseFloat(c.totalEarned || "0") + payout).toFixed(2),
                  spendingBalance: (parseFloat(c.spendingBalance || "0") + spendingAmount).toFixed(2),
                  savingsBalance: (parseFloat(c.savingsBalance || "0") + savingsAmount).toFixed(2),
                  rothIraBalance: (parseFloat(c.rothIraBalance || "0") + rothAmount).toFixed(2),
                  brokerageBalance: (parseFloat(c.brokerageBalance || "0") + brokerageAmount).toFixed(2),
                })
                .where(eq(schema.children.id, child.id));

              const addTx = async (toAccount: string, amt: number) => {
                if (amt <= 0) return;
                await tx.insert(schema.transactions).values({
                  childId: child.id,
                  type: "allowance",
                  amount: amt.toFixed(2),
                  fromAccount: "external",
                  toAccount,
                  note,
                  createdAt: new Date(),
                } as any);
              };

              await addTx("spending", spendingAmount);
              await addTx("savings", savingsAmount);
              await addTx("rothIra", rothAmount);
              await addTx("brokerage", brokerageAmount);

              await tx
                .update(schema.allowances)
                .set({ lastRunAt: now } as any)
                .where(eq(schema.allowances.id, a.id));
            });
          } catch (err) {
            console.error("Allowance payout transaction failed:", err);
          }
          continue;
        }

        await storage.updateChild(child.id, {
          totalEarned: (parseFloat(child.totalEarned || "0") + payout).toFixed(2),
          spendingBalance: (parseFloat(child.spendingBalance || "0") + spendingAmount).toFixed(2),
          savingsBalance: (parseFloat(child.savingsBalance || "0") + savingsAmount).toFixed(2),
          rothIraBalance: (parseFloat(child.rothIraBalance || "0") + rothAmount).toFixed(2),
          brokerageBalance: (parseFloat(child.brokerageBalance || "0") + brokerageAmount).toFixed(2),
        });

        const addTx = async (toAccount: string, amt: number) => {
          if (amt <= 0) return;
          await storage.createTransaction({
            childId: child.id,
            type: "allowance",
            amount: amt.toFixed(2),
            fromAccount: "external",
            toAccount,
            note,
          } as any);
        };

        await addTx("spending", spendingAmount);
        await addTx("savings", savingsAmount);
        await addTx("rothIra", rothAmount);
        await addTx("brokerage", brokerageAmount);

        await storage.updateAllowance(a.id, { lastRunAt: now } as any);
      }
    } catch (err) {
      console.error("Allowance scheduler tick failed:", err);
    }
  };

  setTimeout(() => void tick(), 5000);
  setInterval(() => void tick(), 60_000);
}
