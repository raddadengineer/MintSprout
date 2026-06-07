import type { IStorage } from "./storage";
import { db, supportsInteractiveTransactions } from "./db";
import * as schema from "@shared/schema";
import { and, eq } from "drizzle-orm";
import {
  executeAllowancePayout,
  isAllowanceDue,
  occurrenceKeyForRecurrence,
} from "./allowance-payout";

export function startAllowanceScheduler(storage: IStorage) {
  const tick = async () => {
    const now = new Date();

    try {
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

              if (closed && j.status !== "approved") {
                await storage.updateJob(j.id, { status: "approved" } as any);
              }
              if (!closed && j.status === "approved") {
                await storage.updateJob(j.id, { status: "assigned" } as any);
              }
            }
          }
        } catch (err) {
          console.error("Allowance chore rollover failed:", err);
        }

        if (!isAllowanceDue(a as any, now)) continue;

        const result = await executeAllowancePayout(a, storage, now);
        if (!result.ok && result.reason !== "already_paid" && result.reason !== "zero_payout") {
          console.error("Allowance scheduler payout failed:", result);
        }
      }
    } catch (err) {
      console.error("Allowance scheduler tick failed:", err);
    }
  };

  setTimeout(() => void tick(), 5000);
  setInterval(() => void tick(), 60_000);
}
