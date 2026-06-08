import type { Allowance, Job } from "@shared/schema";
import type { IStorage } from "./storage";
import { db, supportsInteractiveTransactions } from "./db";
import * as schema from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  dayOfWeekLabel,
  formatPeriodRange,
  isWeeklyPayDay,
  nextWeeklyPayDate,
  payDayOfWeek,
  periodEndDayOfWeek,
  periodStartDayOfWeek,
  weeklyAllowancePeriod,
} from "@shared/allowance-week";

export function isoDayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeekKeyUTC(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

export function occurrenceKeyForRecurrence(recurrence: string, now: Date): string {
  if (recurrence === "once") return "once";
  if (recurrence === "daily") return isoDayKeyUTC(now);
  if (recurrence === "weekly") return isoWeekKeyUTC(now);
  if (recurrence === "monthly") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return isoDayKeyUTC(now);
}

export function periodStartForAllowance(allowance: Allowance, now: Date): Date {
  if (allowance.cadence === "weekly") {
    return weeklyAllowancePeriod(allowance, now).periodStart;
  }
  const last = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;
  if (last && !Number.isNaN(last.getTime())) return last;
  const days = allowance.cadence === "monthly" ? 31 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function periodEndForAllowance(allowance: Allowance, now: Date): Date | null {
  if (allowance.cadence === "weekly") {
    return weeklyAllowancePeriod(allowance, now).periodEnd;
  }
  if (allowance.cadence === "monthly") {
    const dom = typeof allowance.dayOfMonth === "number" ? allowance.dayOfMonth : null;
    if (dom === null) return null;
    const end = new Date(now.getFullYear(), now.getMonth(), dom, 23, 59, 59, 999);
    return end;
  }
  return null;
}

export function allowancePeriodKey(allowance: Allowance, now: Date): string {
  if (allowance.cadence === "weekly") return weeklyAllowancePeriod(allowance, now).periodKey;
  if (allowance.cadence === "monthly") {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return isoDayKeyUTC(now);
}

export type AllowancePayoutMode = "automatic" | "manual";

export function allowancePayoutMode(allowance: Allowance): AllowancePayoutMode {
  const mode = (allowance as Allowance & { payoutMode?: string }).payoutMode;
  return mode === "manual" ? "manual" : "automatic";
}

export function isAllowanceDue(allowance: Allowance, now: Date): boolean {
  if (!allowance.enabled) return false;
  const lastRunAt = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;
  if (lastRunAt && sameDay(lastRunAt, now)) return false;

  if (allowance.cadence === "weekly") {
    return isWeeklyPayDay(allowance, now);
  }
  if (allowance.cadence === "monthly") {
    const dom = typeof allowance.dayOfMonth === "number" ? allowance.dayOfMonth : null;
    return dom !== null && now.getDate() === dom;
  }
  return false;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Next scheduled automatic payout date (local time), or null for manual mode. */
export function nextAllowanceDueDate(allowance: Allowance, now: Date = new Date()): Date | null {
  if (allowancePayoutMode(allowance) === "manual" || !allowance.enabled) return null;

  const lastRunAt = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;

  if (allowance.cadence === "weekly") {
    let next = nextWeeklyPayDate(allowance, now);
    if (lastRunAt && sameDay(lastRunAt, next)) {
      next = new Date(next);
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  if (allowance.cadence === "monthly") {
    const dom = typeof allowance.dayOfMonth === "number" ? allowance.dayOfMonth : null;
    if (dom === null) return null;
    const next = new Date(now.getFullYear(), now.getMonth(), dom);
    next.setHours(0, 0, 0, 0);
    if (next < now || (sameDay(next, now) && lastRunAt && sameDay(lastRunAt, now))) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(dom);
    }
    return next;
  }

  return null;
}

export type AllowanceChoreStatus = {
  jobId: number;
  title: string;
  recurrence: string;
  jobStatus: string;
  occurrenceKey: string;
  completedThisOccurrence: boolean;
  missedThisOccurrence: boolean;
  awaitingApproval: boolean;
};

export type AllowancePeriodStatus = {
  allowanceId: number;
  childId: number;
  periodKey: string;
  periodStart: string;
  periodEnd: string | null;
  periodLabel: string | null;
  todayDayOfWeek: number;
  todayDayName: string;
  payDayName: string | null;
  periodStartDayName: string | null;
  periodEndDayName: string | null;
  chores: AllowanceChoreStatus[];
  floor: number;
  variableCap: number;
  missedCount: number;
  penaltyTotal: number;
  variablePaid: number;
  payout: number;
  alreadyPaidThisPeriod: boolean;
  canPay: boolean;
  lastRunAt: string | null;
  payoutMode: AllowancePayoutMode;
  nextDueDate: string | null;
};

async function countMissedInPeriod(allowance: Allowance, now: Date, storage: IStorage): Promise<number> {
  const jobs = await storage.getJobsByChild(allowance.childId);
  const allowanceJobs = jobs.filter((j) => (j as Job & { allowanceId?: number }).allowanceId === allowance.id);
  return allowanceJobs.filter((j) => j.status !== "approved").length;
}

async function computePayoutMath(allowance: Allowance, now: Date, storage: IStorage) {
  const amountTotal = parseFloat(String(allowance.amount ?? "0"));
  const floor = Math.min(parseFloat(String(allowance.guaranteedMinimum ?? "0")), amountTotal);
  const penaltyEach = Math.max(0, parseFloat(String(allowance.penaltyPerIncompleteJob ?? "0")));
  const variableCap = Math.max(0, amountTotal - floor);
  const missedCount = await countMissedInPeriod(allowance, now, storage);
  const penaltyTotal = Math.min(variableCap, missedCount * penaltyEach);
  const variablePaid = variableCap - penaltyTotal;
  const payout = floor + variablePaid;
  return { amountTotal, floor, variableCap, missedCount, penaltyTotal, variablePaid, payout };
}

async function buildChoreList(allowance: Allowance, now: Date, storage: IStorage): Promise<AllowanceChoreStatus[]> {
  const jobs = await storage.getJobsByChild(allowance.childId);
  const allowanceJobs = jobs.filter((j) => (j as Job & { allowanceId?: number }).allowanceId === allowance.id);
  const chores: AllowanceChoreStatus[] = [];

  for (const job of allowanceJobs) {
    const recurrence = String(job.recurrence ?? "once");
    const occurrenceKey =
      recurrence === "weekly" && allowance.cadence === "weekly"
        ? weeklyAllowancePeriod(allowance, now).periodKey
        : occurrenceKeyForRecurrence(recurrence, now);
    let completedThisOccurrence = false;
    let missedThisOccurrence = false;

    if (supportsInteractiveTransactions) {
      const done = await db
        .select()
        .from(schema.allowanceCompletedJobLog)
        .where(
          and(
            eq(schema.allowanceCompletedJobLog.jobId, job.id),
            eq(schema.allowanceCompletedJobLog.occurrenceKey, occurrenceKey),
          ),
        );
      const missed = await db
        .select()
        .from(schema.allowanceMissedJobLog)
        .where(
          and(
            eq(schema.allowanceMissedJobLog.jobId, job.id),
            eq(schema.allowanceMissedJobLog.occurrenceKey, occurrenceKey),
          ),
        );
      completedThisOccurrence = done.length > 0 || job.status === "approved";
      missedThisOccurrence = missed.length > 0;
    } else {
      completedThisOccurrence = job.status === "approved";
      missedThisOccurrence = false;
    }

    chores.push({
      jobId: job.id,
      title: job.title,
      recurrence,
      jobStatus: job.status,
      occurrenceKey,
      completedThisOccurrence,
      missedThisOccurrence,
      awaitingApproval: job.status === "completed",
    });
  }

  return chores;
}

async function alreadyPaidForPeriod(allowance: Allowance, now: Date): Promise<boolean> {
  const periodKey = allowancePeriodKey(allowance, now);
  if (supportsInteractiveTransactions) {
    const rows = await db
      .select()
      .from(schema.allowancePayoutLog)
      .where(
        and(
          eq(schema.allowancePayoutLog.allowanceId, allowance.id),
          eq(schema.allowancePayoutLog.periodKey, periodKey),
        ),
      );
    return rows.length > 0;
  }
  const last = allowance.lastRunAt ? new Date(allowance.lastRunAt) : null;
  if (!last) return false;
  const periodStart = periodStartForAllowance(allowance, now);
  return last >= periodStart;
}

export async function getAllowancePeriodStatus(
  allowance: Allowance,
  storage: IStorage,
  now: Date = new Date(),
): Promise<AllowancePeriodStatus> {
  const periodStart = periodStartForAllowance(allowance, now);
  const periodEnd = periodEndForAllowance(allowance, now);
  const periodKey = allowancePeriodKey(allowance, now);
  const weekInfo = allowance.cadence === "weekly" ? weeklyAllowancePeriod(allowance, now) : null;
  const chores = await buildChoreList(allowance, now, storage);
  const math = await computePayoutMath(allowance, now, storage);
  const alreadyPaidThisPeriod = await alreadyPaidForPeriod(allowance, now);
  const canPay = !alreadyPaidThisPeriod && math.payout > 0 && Number.isFinite(math.payout);

  const payoutMode = allowancePayoutMode(allowance);
  const nextDue = nextAllowanceDueDate(allowance, now);

  return {
    allowanceId: allowance.id,
    childId: allowance.childId,
    periodKey,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    periodLabel:
      weekInfo != null ? formatPeriodRange(weekInfo.periodStart, weekInfo.periodEnd) : null,
    todayDayOfWeek: weekInfo?.todayDayOfWeek ?? now.getDay(),
    todayDayName: dayOfWeekLabel(weekInfo?.todayDayOfWeek ?? now.getDay()),
    payDayName: allowance.cadence === "weekly" ? dayOfWeekLabel(payDayOfWeek(allowance)) : null,
    periodStartDayName:
      allowance.cadence === "weekly" ? dayOfWeekLabel(periodStartDayOfWeek(allowance)) : null,
    periodEndDayName:
      allowance.cadence === "weekly" ? dayOfWeekLabel(periodEndDayOfWeek(allowance)) : null,
    chores,
    floor: math.floor,
    variableCap: math.variableCap,
    missedCount: math.missedCount,
    penaltyTotal: math.penaltyTotal,
    variablePaid: math.variablePaid,
    payout: math.payout,
    alreadyPaidThisPeriod,
    canPay,
    lastRunAt: allowance.lastRunAt ? new Date(allowance.lastRunAt).toISOString() : null,
    payoutMode,
    nextDueDate: nextDue ? nextDue.toISOString() : null,
  };
}

export type AllowancePayoutResult =
  | { ok: true; payout: number; periodKey: string }
  | { ok: false; reason: "already_paid" | "zero_payout" | "no_child" | "disabled" };

export async function executeAllowancePayout(
  allowance: Allowance,
  storage: IStorage,
  now: Date = new Date(),
): Promise<AllowancePayoutResult> {
  if (!allowance.enabled) return { ok: false, reason: "disabled" };

  const status = await getAllowancePeriodStatus(allowance, storage, now);
  if (status.alreadyPaidThisPeriod) return { ok: false, reason: "already_paid" };
  if (!status.canPay || status.payout <= 0) return { ok: false, reason: "zero_payout" };

  const child = await storage.getChild(allowance.childId);
  if (!child) return { ok: false, reason: "no_child" };

  const payout = status.payout;
  const floor = status.floor;
  const variablePaid = status.variablePaid;
  const missed = status.missedCount;
  const penaltyEach = Math.max(0, parseFloat(String(allowance.penaltyPerIncompleteJob ?? "0")));
  const penalty = status.penaltyTotal;

  const allocation = await storage.getAllocationSettings(child.id);
  const accountTypes = await storage.getAccountTypes(allowance.familyId);

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

  const periodKey = status.periodKey;

  if (supportsInteractiveTransactions) {
    const claimed = await db
      .insert(schema.allowancePayoutLog)
      .values({ allowanceId: allowance.id, periodKey })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) return { ok: false, reason: "already_paid" };

    await db.transaction(async (tx) => {
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
          createdAt: now,
        } as any);
      };

      await addTx("spending", spendingAmount);
      await addTx("savings", savingsAmount);
      await addTx("rothIra", rothAmount);
      await addTx("brokerage", brokerageAmount);

      await tx
        .update(schema.allowances)
        .set({ lastRunAt: now } as any)
        .where(eq(schema.allowances.id, allowance.id));
    });
  } else {
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
    await storage.updateAllowance(allowance.id, { lastRunAt: now } as any);
  }

  return { ok: true, payout, periodKey };
}
