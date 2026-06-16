import type { Job } from "@shared/schema";
import type { JobCategory } from "@shared/schema";
import type { IStorage } from "./storage";
import {
  voiceCompleteNotFound,
  voiceInProgressEmpty,
  voiceListEmpty,
  voiceListIntro,
  voiceListNotFound,
} from "@shared/kid-task-copy";
import { applyJobPatch } from "./job-approval-payment";
import { db } from "./db";
import * as schema from "@shared/schema";
import type { KidMode } from "./ai-coach";
import { groupJobsByCategoryLabel, kidFriendlyJobList } from "./job-categories";

function isoDayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKeyUTC(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function occurrenceKeyForRecurrence(recurrence: string, now: Date): string {
  if (recurrence === "once") return "once";
  if (recurrence === "daily") return isoDayKeyUTC(now);
  if (recurrence === "weekly") return isoWeekKeyUTC(now);
  if (recurrence === "monthly") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return isoDayKeyUTC(now);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jobKind(job: Job): "family" | "paid" | "allowance" {
  if ((job as any).isFamilyDuty) return "family";
  if ((job as any).allowanceId != null) return "allowance";
  return "paid";
}

function statusLabel(status: string, mode: KidMode): string {
  if (mode === "youngest") {
    switch (status) {
      case "assigned":
        return "to do";
      case "in_progress":
        return "doing it";
      case "completed":
        return "waiting for a grown-up";
      case "approved":
        return "all done";
      default:
        return status;
    }
  }
  switch (status) {
    case "assigned":
      return "ready to start";
    case "in_progress":
      return "in progress";
    case "completed":
      return "waiting for approval";
    case "approved":
      return "approved";
    default:
      return status;
  }
}

function formatJobLine(job: Job, _mode: KidMode): string {
  return job.title;
}

function matchJob(jobs: Job[], phrase: string): Job | null {
  const n = normalize(phrase);
  if (!n) return null;

  let best: Job | null = null;
  let bestScore = 0;

  for (const job of jobs) {
    const title = normalize(job.title);
    if (!title) continue;

    if (n === title || n.includes(title) || title.includes(n)) {
      const score = title.length + 10;
      if (score > bestScore) {
        best = job;
        bestScore = score;
      }
      continue;
    }

    const phraseWords = n.split(" ").filter((w) => w.length > 2);
    const titleWords = title.split(" ").filter((w) => w.length > 2);
    const overlap = phraseWords.filter((w) =>
      titleWords.some((tw) => tw === w || tw.includes(w) || w.includes(tw)),
    ).length;
    if (overlap > bestScore) {
      best = job;
      bestScore = overlap;
    }
  }

  return bestScore > 0 ? best : null;
}

type Intent =
  | { type: "list_available" }
  | { type: "list_done" }
  | { type: "list_in_progress" }
  | { type: "start"; phrase: string }
  | { type: "complete"; phrase: string };

function parseIntent(message: string): Intent | null {
  const m = normalize(message);

  if (
    /\b(what|which|any)\b.*\b(jobs?|chores?|tasks?)\b.*\b(available|can i do|do i have|should i do|need to do)\b/.test(m) ||
    /\b(what can i do|what should i do|what do i need to do|what jobs|what chores|my jobs|my chores)\b/.test(m) ||
    /\b(jobs?|chores?)\s+(available|today|left|remaining)\b/.test(m)
  ) {
    return { type: "list_available" };
  }

  if (
    /\b(waiting|need approval|for (mom|dad|parent)|already done|finished today)\b/.test(m) ||
    /\b(what did i (do|finish|complete)|what have i (done|finished|completed))\b/.test(m) ||
    /\b(jobs?|chores?) (i did|i finished|i completed|waiting)\b/.test(m)
  ) {
    return { type: "list_done" };
  }

  if (/\b(in progress|working on|started|doing now|what am i doing)\b/.test(m)) {
    return { type: "list_in_progress" };
  }

  const completePatterns = [
    /\b(?:i (?:finished|did|completed|done with)|finished|completed|done with|mark .+ (?:done|complete|finished)) (.+)/,
    /\b(?:complete|finish|done with|did) (?:my |the )?(.+)/,
  ];
  for (const re of completePatterns) {
    const match = m.match(re);
    if (match?.[1]) {
      const phrase = match[1].trim();
      if (phrase.length > 2) return { type: "complete", phrase };
    }
  }

  const startPatterns = [
    /\b(?:start(?:ing)?|begin|work(?:ing)? on|doing) (?:my |the )?(.+)/,
    /\bi(?:'m| am) (?:doing|working on|starting) (?:my |the )?(.+)/,
  ];
  for (const re of startPatterns) {
    const match = m.match(re);
    if (match?.[1]) {
      const phrase = match[1].trim();
      if (phrase.length > 2) return { type: "start", phrase };
    }
  }

  return null;
}

async function childSetJobStatus(
  storage: IStorage,
  familyId: number,
  job: Job,
  status: "in_progress" | "completed",
): Promise<Job> {
  if (status === "completed") {
    const allowanceId = (job as any).allowanceId as number | null | undefined;
    const isFamilyDuty = !!(job as any).isFamilyDuty;
    const now = new Date();

    if (allowanceId != null) {
      const occurrenceKey = occurrenceKeyForRecurrence((job as any).recurrence, now);
      const inserted = await db
        .insert(schema.allowanceCompletedJobLog)
        .values({ allowanceId, jobId: job.id, occurrenceKey } as any)
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) {
        throw Object.assign(new Error("Already completed for this occurrence"), { statusCode: 400 });
      }
    } else if (isFamilyDuty) {
      const occurrenceKey = occurrenceKeyForRecurrence((job as any).recurrence, now);
      const inserted = await db
        .insert(schema.familyDutyCompletedLog)
        .values({ jobId: job.id, occurrenceKey } as any)
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) {
        throw Object.assign(new Error("Already completed for this occurrence"), { statusCode: 400 });
      }
    }
  }

  return applyJobPatch(storage, { familyId, role: "child" }, job.id, { status });
}

export type SproutVoiceResult = {
  reply: string;
  jobsChanged: boolean;
  voiceAction?: "list" | "start" | "complete";
};

export async function trySproutVoiceAction(
  storage: IStorage,
  familyId: number,
  jobs: Job[],
  message: string,
  mode: KidMode,
  categories: JobCategory[] = [],
): Promise<SproutVoiceResult | null> {
  const intent = parseIntent(message);
  if (!intent) return null;

  const active = jobs.filter((j) => j.status !== "approved");

  if (intent.type === "list_available") {
    const todo = active.filter((j) => j.status === "assigned" || j.status === "in_progress");
    if (todo.length === 0) {
      const waiting = active.filter((j) => j.status === "completed");
      if (waiting.length > 0) {
        const names = waiting.map((j) => j.title).join(", ");
        return {
          reply:
            mode === "youngest"
              ? `You finished ${names}! A grown-up needs to check them.`
              : `You already marked these done and they're waiting for approval: ${names}.`,
          jobsChanged: false,
          voiceAction: "list",
        };
      }
      return {
        reply: voiceListEmpty(mode),
        jobsChanged: false,
        voiceAction: "list",
      };
    }

    if (categories.length > 0) {
      const groups = groupJobsByCategoryLabel(
        todo,
        categories,
        (j) => j.status === "assigned" || j.status === "in_progress",
      );
      return {
        reply: kidFriendlyJobList(groups, mode),
        jobsChanged: false,
        voiceAction: "list",
      };
    }

    const lines = todo.map((j) => formatJobLine(j, mode)).join(", ");
    return {
      reply: voiceListIntro(mode, lines),
      jobsChanged: false,
      voiceAction: "list",
    };
  }

  if (intent.type === "list_done") {
    const waiting = active.filter((j) => j.status === "completed");
    const inProgress = active.filter((j) => j.status === "in_progress");
    if (waiting.length === 0 && inProgress.length === 0) {
      return {
        reply: mode === "youngest" ? "Nothing waiting right now!" : "Nothing is waiting for approval or in progress.",
        jobsChanged: false,
        voiceAction: "list",
      };
    }
    const parts: string[] = [];
    if (waiting.length) parts.push(`waiting for a grown-up: ${waiting.map((j) => j.title).join(", ")}`);
    if (inProgress.length) parts.push(`still doing: ${inProgress.map((j) => j.title).join(", ")}`);
    return {
      reply: mode === "youngest" ? `Here's what you did: ${parts.join(". ")}.` : `Status — ${parts.join("; ")}.`,
      jobsChanged: false,
      voiceAction: "list",
    };
  }

  if (intent.type === "list_in_progress") {
    const doing = active.filter((j) => j.status === "in_progress");
    if (doing.length === 0) {
      return {
        reply: voiceInProgressEmpty(mode),
        jobsChanged: false,
        voiceAction: "list",
      };
    }
    return {
      reply: `You're working on: ${doing.map((j) => j.title).join(", ")}.`,
      jobsChanged: false,
      voiceAction: "list",
    };
  }

  if (intent.type === "start") {
    const job = matchJob(active, intent.phrase);
    if (!job) {
      return {
        reply: voiceListNotFound(mode, intent.phrase),
        jobsChanged: false,
        voiceAction: "start",
      };
    }
    if (job.status === "in_progress") {
      return { reply: `You're already working on "${job.title}"!`, jobsChanged: false, voiceAction: "start" };
    }
    if (job.status === "completed") {
      return { reply: `"${job.title}" is already done and waiting for approval.`, jobsChanged: false, voiceAction: "start" };
    }
    if (job.status === "approved") {
      return { reply: `"${job.title}" is already finished for now.`, jobsChanged: false, voiceAction: "start" };
    }
    await childSetJobStatus(storage, familyId, job, "in_progress");
    return {
      reply: mode === "youngest" ? `Go go go! "${job.title}" is started! 🚀` : `Started "${job.title}". Say when you're done!`,
      jobsChanged: true,
      voiceAction: "start",
    };
  }

  if (intent.type === "complete") {
    const job = matchJob(active, intent.phrase);
    if (!job) {
      return {
        reply: voiceCompleteNotFound(mode, intent.phrase),
        jobsChanged: false,
        voiceAction: "complete",
      };
    }
    if (job.status === "completed") {
      return {
        reply: `"${job.title}" is already marked done — waiting for a grown-up to check!`,
        jobsChanged: false,
        voiceAction: "complete",
      };
    }
    if (job.status === "approved") {
      return { reply: `"${job.title}" is already all done!`, jobsChanged: false, voiceAction: "complete" };
    }
    try {
      if (job.status === "assigned") {
        await childSetJobStatus(storage, familyId, job, "in_progress");
      }
      await childSetJobStatus(storage, familyId, job, "completed");
    } catch (err: any) {
      const msg =
        err?.message === "Already completed for this occurrence"
          ? `"${job.title}" is already done for today!`
          : `Couldn't mark "${job.title}" done. Try again in a moment.`;
      return { reply: msg, jobsChanged: false, voiceAction: "complete" };
    }
    return {
      reply:
        mode === "youngest"
          ? `Yay! "${job.title}" is done! 🎉 A grown-up will check it soon.`
          : `Marked "${job.title}" complete! It'll show up for parent approval.`,
      jobsChanged: true,
      voiceAction: "complete",
    };
  }

  return null;
}
