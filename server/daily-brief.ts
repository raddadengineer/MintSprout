import type { IStorage } from "./storage";
import type { Job } from "@shared/schema";
import { kidModeFromAge, synthesizeSpeech, voiceForKidMode, type KidMode } from "./ai-coach";
import { chatCompletion } from "./llm-client";
import { ensureFamilyJobCategories, groupJobsByCategoryLabel } from "./job-categories";

export type BriefTask = {
  id: number;
  title: string;
  kind: "family" | "paid" | "allowance";
  status: string;
  statusLabel: string;
  amount?: string;
  recurrence?: string;
};

export type BriefReminder = {
  id: string;
  type: "approval" | "chore" | "earn" | "savings" | "learn" | "allowance";
  message: string;
  priority: "high" | "normal";
};

export type BriefCategoryGroup = {
  label: string;
  icon: string;
  tasks: BriefTask[];
};

export type DailyBrief = {
  childName: string;
  age: number | null;
  mode: KidMode;
  generatedAt: string;
  script: string;
  familyDuties: BriefTask[];
  earnJobs: BriefTask[];
  categoryGroups: BriefCategoryGroup[];
  awaitingApproval: BriefTask[];
  reminders: BriefReminder[];
  savingsGoals: { id: number; name: string; target: string; current: string; percent: number }[];
  money: { spending: string; savings: string; totalEarned: string };
};

function statusLabel(status: string): string {
  switch (status) {
    case "assigned":
      return "Ready to start";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Waiting for approval";
    default:
      return status;
  }
}

function jobKind(job: Job): "family" | "paid" | "allowance" {
  if ((job as any).isFamilyDuty) return "family";
  if ((job as any).allowanceId != null) return "allowance";
  return "paid";
}

function kindLabel(kind: BriefTask["kind"]): string {
  if (kind === "family") return "family chore";
  if (kind === "allowance") return "allowance chore";
  return "paid job";
}

function toBriefTask(job: Job): BriefTask {
  const kind = jobKind(job);
  return {
    id: job.id,
    title: job.title,
    kind,
    status: job.status,
    statusLabel: statusLabel(job.status),
    amount: kind === "paid" ? job.amount : undefined,
    recurrence: job.recurrence,
  };
}

function wordLimit(mode: KidMode): number {
  if (mode === "youngest") return 70;
  if (mode === "younger") return 100;
  if (mode === "older") return 130;
  return 90;
}

function ageStyle(mode: KidMode): string {
  if (mode === "youngest") {
    return "Use very simple words for a 5–6 year old. Short sentences. Warm and fun. No lists — sound like a friendly voice speaking.";
  }
  if (mode === "younger") {
    return "Use clear, upbeat language for ages 7–10. Sound like a helpful coach reading their plan out loud.";
  }
  if (mode === "older") {
    return "Talk to an 11+ kid respectfully — not babyish. Be direct and organized but still spoken, not bullet points.";
  }
  return "Keep it friendly and clear.";
}

function buildFactsBlock(brief: Omit<DailyBrief, "script" | "generatedAt">): string {
  const lines: string[] = [
    `Child: ${brief.childName}, age ${brief.age ?? "unknown"}`,
    `Spending: $${brief.money.spending}, Savings: $${brief.money.savings}`,
  ];

  if (brief.categoryGroups.length) {
    for (const group of brief.categoryGroups) {
      const open = group.tasks.filter((t) => t.status !== "completed");
      if (open.length) {
        lines.push(
          `${group.label}: ` + open.map((t) => `${t.title} (${t.statusLabel})`).join("; "),
        );
      }
    }
  } else {
    if (brief.familyDuties.length) {
      lines.push(
        "Family chores (part of the family, no pay): " +
          brief.familyDuties.map((t) => `${t.title} (${t.statusLabel}, ${t.recurrence})`).join("; "),
      );
    }
    if (brief.earnJobs.length) {
      lines.push(
        "Jobs to earn money: " +
          brief.earnJobs.map((t) => `${t.title}${t.amount ? ` $${t.amount}` : ""} (${t.statusLabel})`).join("; "),
      );
    }
  }
  if (brief.awaitingApproval.length) {
    lines.push(
      "Waiting for parent approval: " + brief.awaitingApproval.map((t) => t.title).join("; "),
    );
  }
  if (brief.savingsGoals.length) {
    lines.push(
      "Savings goals: " +
        brief.savingsGoals.map((g) => `${g.name} (${g.percent}% done, $${g.current} of $${g.target})`).join("; "),
    );
  }
  if (brief.reminders.length) {
    lines.push("Reminders: " + brief.reminders.map((r) => r.message).join(" "));
  }
  return lines.join("\n");
}

function templateScript(brief: Omit<DailyBrief, "script" | "generatedAt">): string {
  const name = brief.childName;
  const parts: string[] = [];

  if (brief.mode === "youngest") {
    parts.push(`Hi ${name}!`);
  } else if (brief.mode === "younger") {
    parts.push(`Hey ${name}, here's your plan for today.`);
  } else {
    parts.push(`Hi ${name}. Here's your daily brief.`);
  }

  const categorySections = brief.categoryGroups
    .map((g) => {
      const open = g.tasks.filter((t) => t.status !== "completed");
      if (!open.length) return null;
      return { label: g.label, list: open.map((t) => t.title).join(", ") };
    })
    .filter(Boolean) as { label: string; list: string }[];

  if (categorySections.length) {
    for (const section of categorySections) {
      parts.push(
        brief.mode === "youngest"
          ? `${section.label}: ${section.list}.`
          : `${section.label}: ${section.list}.`,
      );
    }
  } else {
    const chores = brief.familyDuties.filter((t) => t.status !== "completed");
    if (chores.length) {
      const list = chores.map((t) => t.title).join(", ");
      parts.push(
        brief.mode === "youngest"
          ? `First, family jobs: ${list}.`
          : `Family responsibilities: ${list}.`,
      );
    }

    const earn = brief.earnJobs.filter((t) => t.status !== "completed");
    if (earn.length) {
      const list = earn
        .map((t) => (t.amount ? `${t.title} for $${parseFloat(t.amount).toFixed(2)}` : t.title))
        .join(", ");
      parts.push(`Jobs you can earn from: ${list}.`);
    }
  }

  if (brief.awaitingApproval.length) {
    parts.push(
      `Reminder: ${brief.awaitingApproval.map((t) => t.title).join(" and ")} ${brief.awaitingApproval.length === 1 ? "is" : "are"} waiting for a parent to approve.`,
    );
  }

  if (brief.savingsGoals.length) {
    const g = brief.savingsGoals[0];
    parts.push(`Your savings goal "${g.name}" is ${g.percent} percent complete.`);
  }

  const high = brief.reminders.filter((r) => r.priority === "high");
  if (high.length) {
    parts.push(high[0].message);
  }

  if (parts.length === 1) {
    parts.push("You're all caught up! Check Learn for a money adventure, or ask Sprout if you want ideas.");
  } else {
    parts.push(brief.mode === "youngest" ? "You got this!" : "Have a great day!");
  }

  return parts.join(" ");
}

async function scriptWithOllama(brief: Omit<DailyBrief, "script" | "generatedAt">): Promise<string | null> {
  const facts = buildFactsBlock(brief);
  const limit = wordLimit(brief.mode);
  const system = `You are Sprout, the MintSprout voice assistant. Write a single spoken daily briefing for a child.
Use ONLY the facts below — never invent tasks or amounts.
${ageStyle(brief.mode)}
Maximum ${limit} words. Plain text only — no markdown, no bullet characters, no emojis.
Cover: greeting, what to do today (family chores first, then earning jobs), any reminders, brief encouragement.`;

  const user = `Facts:\n${facts}\n\nWrite the spoken briefing now:`;

  try {
    return await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        temperature: 0.5,
        maxTokens: brief.mode === "youngest" ? 120 : 200,
      },
    );
  } catch {
    return null;
  }
}

export async function buildDailyBrief(storage: IStorage, childId: number): Promise<DailyBrief> {
  const child = await storage.getChild(childId);
  if (!child) throw Object.assign(new Error("Child not found"), { statusCode: 404 });

  await ensureFamilyJobCategories(storage, child.familyId);
  const categories = await storage.getJobCategoriesByFamily(child.familyId);

  const jobs = await storage.getJobsByChild(childId);
  const goals = await storage.getSavingsGoals(childId);
  const progress = await storage.getLearningProgress(childId);
  const allowances = (await storage.getAllowancesByFamily(child.familyId)).filter(
    (a) => a.childId === childId && (a.enabled ?? true),
  );

  const active = jobs.filter((j) => j.status !== "approved");
  const familyDuties = active.filter((j) => jobKind(j) === "family").map(toBriefTask);
  const earnJobs = active.filter((j) => jobKind(j) !== "family").map(toBriefTask);
  const categoryGroups: BriefCategoryGroup[] = groupJobsByCategoryLabel(active, categories).map((g) => ({
    label: g.label,
    icon: g.icon,
    tasks: g.jobs.map(toBriefTask),
  }));
  const awaitingApproval = jobs.filter((j) => j.status === "completed").map(toBriefTask);

  const mode = kidModeFromAge(child.age);
  const reminders: BriefReminder[] = [];

  for (const t of awaitingApproval) {
    reminders.push({
      id: `approval-${t.id}`,
      type: "approval",
      message: `"${t.title}" is done — ask a parent to approve${t.kind === "paid" ? " and pay" : ""}.`,
      priority: "high",
    });
  }

  const choresNotStarted = familyDuties.filter((t) => t.status === "assigned");
  if (choresNotStarted.length) {
    reminders.push({
      id: "chores-today",
      type: "chore",
      message: `Family chores to do: ${choresNotStarted.map((t) => t.title).join(", ")}.`,
      priority: "high",
    });
  }

  const earnReady = earnJobs.filter((t) => t.status === "assigned" || t.status === "in_progress");
  if (earnReady.length) {
    reminders.push({
      id: "earn-available",
      type: "earn",
      message: `You can earn money from: ${earnReady.map((t) => t.title).join(", ")}.`,
      priority: "normal",
    });
  }

  const savingsGoals = goals
    .filter((g) => !g.completed)
    .map((g) => {
      const target = parseFloat(String(g.targetAmount ?? "0"));
      const current = parseFloat(String(g.currentAmount ?? "0"));
      const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      return {
        id: g.id,
        name: g.name,
        target: target.toFixed(2),
        current: current.toFixed(2),
        percent,
      };
    });

  for (const g of savingsGoals) {
    if (g.percent < 100) {
      reminders.push({
        id: `goal-${g.id}`,
        type: "savings",
        message: `Savings goal "${g.name}": ${g.percent}% complete ($${g.current} of $${g.target}).`,
        priority: "normal",
      });
    }
  }

  const incompleteLessons = progress.filter((p) => !p.completed).length;
  if (incompleteLessons > 0) {
    reminders.push({
      id: "learn",
      type: "learn",
      message: `You have ${incompleteLessons} money lesson${incompleteLessons === 1 ? "" : "s"} to finish in Learn.`,
      priority: "normal",
    });
  }

  for (const a of allowances) {
    const amt = parseFloat(String(a.amount ?? "0")).toFixed(2);
    reminders.push({
      id: `allowance-${a.id}`,
      type: "allowance",
      message: `Your ${a.cadence} allowance is $${amt} — finish allowance chores on time to keep it.`,
      priority: "normal",
    });
  }

  const inProgress = [...familyDuties, ...earnJobs].filter((t) => t.status === "in_progress");
  for (const t of inProgress) {
    reminders.push({
      id: `progress-${t.id}`,
      type: t.kind === "family" ? "chore" : "earn",
      message: `You started "${t.title}" — tap Done when you finish!`,
      priority: "high",
    });
  }

  const core: Omit<DailyBrief, "script" | "generatedAt"> = {
    childName: child.name,
    age: child.age,
    mode,
    familyDuties,
    earnJobs,
    categoryGroups,
    awaitingApproval,
    reminders,
    savingsGoals,
    money: {
      spending: parseFloat(child.spendingBalance || "0").toFixed(2),
      savings: parseFloat(child.savingsBalance || "0").toFixed(2),
      totalEarned: parseFloat(child.totalEarned || "0").toFixed(2),
    },
  };

  const script = (await scriptWithOllama(core)) ?? templateScript(core);

  return {
    ...core,
    script,
    generatedAt: new Date().toISOString(),
  };
}

export async function briefToSpeech(script: string, mode: KidMode): Promise<Buffer | null> {
  const voice = voiceForKidMode(mode);
  if (!voice) return null;
  return synthesizeSpeech(script, voice, 1200);
}
