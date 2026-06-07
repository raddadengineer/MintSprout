import type { Child, Job, JobCategory } from "@shared/schema";
import { chatCompletion, checkLlmAvailable, type LlmMessage } from "./llm-client";

export type KidMode = "youngest" | "younger" | "older" | "unknown";

export function kidModeFromAge(age: number | null | undefined): KidMode {
  if (typeof age !== "number" || !Number.isFinite(age)) return "unknown";
  if (age <= 6) return "youngest";
  if (age <= 10) return "younger";
  return "older";
}

export function isAiCoachEnabled(): boolean {
  const raw = process.env.AI_COACH_ENABLED;
  if (raw === "0" || raw === "false" || raw === "FALSE" || raw === "no") return false;
  return true;
}

function voiceBase(): string {
  return (process.env.KIDS_VOICE_BASE_URL || "http://192.168.10.7:8880/v1").replace(/\/$/, "");
}

export function voiceForKidMode(mode: KidMode): string | null {
  if (mode === "youngest") return process.env.AI_VOICE_YOUNGEST || "af_bella";
  if (mode === "younger") return process.env.AI_VOICE_YOUNGER || "af_sky";
  if (mode === "older") return process.env.AI_VOICE_OLDER || null;
  return process.env.AI_VOICE_DEFAULT || "af_nova";
}

export function quickPromptsForMode(mode: KidMode): string[] {
  switch (mode) {
    case "youngest":
      return [
        "What jobs can I do?",
        "I finished making my bed",
        "What did I finish?",
        "What is saving?",
      ];
    case "younger":
      return [
        "What jobs are available?",
        "I'm done with clean my room",
        "What jobs are waiting for approval?",
        "Give me a saving tip!",
      ];
    case "older":
      return [
        "Explain compound interest simply",
        "How should I split my money?",
        "Help me plan a savings goal",
        "What's a smart spending habit?",
      ];
    default:
      return ["Give me a money tip!", "What should I focus on today?"];
  }
}

export function quickPromptsForPage(mode: KidMode, page?: string): string[] {
  const isLearn = page === "learn" || page?.startsWith("learn");
  if (!isLearn) return quickPromptsForMode(mode);
  switch (mode) {
    case "youngest":
      return [
        "What lessons do I have?",
        "What is saving?",
        "Explain earning simply",
        "What should I learn next?",
      ];
    case "younger":
      return [
        "What lessons do I have left?",
        "Explain saving to me",
        "What did I learn?",
        "Why is donating good?",
      ];
    case "older":
      return [
        "What lessons should I complete?",
        "Explain compound interest simply",
        "What's the difference between saving and investing?",
        "What lessons have I finished?",
      ];
    default:
      return ["What should I learn next?", "Explain saving simply"];
  }
}

export function shouldDefaultSpeech(mode: KidMode): boolean {
  return mode === "youngest" || mode === "younger";
}

type CoachContext = {
  childName: string;
  age: number | null;
  mode: KidMode;
  activeJobs: Pick<Job, "title" | "status" | "isFamilyDuty">[];
  activeJobsDetailed?: { id: number; title: string; status: string; categoryLabel?: string }[];
  categoryGroups?: { label: string; titles: string[] }[];
  learnLessons?: { title: string; category: string; completed: boolean }[];
  spendingBalance: string;
  savingsBalance: string;
  completedJobs: number;
  page?: string;
};

function buildSystemPrompt(ctx: CoachContext): string {
  const jobLines =
    ctx.categoryGroups && ctx.categoryGroups.length > 0
      ? ctx.categoryGroups
          .map((g) => `- ${g.label}: ${g.titles.join(", ") || "none"}`)
          .join("\n")
      : ctx.activeJobs.length > 0
        ? ctx.activeJobs
            .slice(0, 8)
            .map((j) => `- ${j.title}`)
            .join("\n")
        : "- none right now";

  const learnLines =
    ctx.learnLessons && ctx.learnLessons.length > 0
      ? ctx.learnLessons
          .slice(0, 12)
          .map((l) => `- ${l.title} (${l.category}${l.completed ? ", done" : ", not done"})`)
          .join("\n")
      : null;

  const pageHint =
    ctx.page === "learn"
      ? "The child is on the Learn page — prioritize lessons, quizzes, and money concepts. Help them pick what to study next."
      : ctx.page
        ? `Current page: ${ctx.page}.`
        : "";

  const base = `You are Sprout 🌱, the friendly money coach inside MintSprout.
You help kids learn about earning, saving, spending, and being responsible — never shame, always encourage.
Child: ${ctx.childName}${ctx.age != null ? `, age ${ctx.age}` : ""}.
Spending jar: $${ctx.spendingBalance}. Savings jar: $${ctx.savingsBalance}. Jobs completed: ${ctx.completedJobs}.
Active jobs:\n${jobLines}
${learnLines ? `Lessons:\n${learnLines}\n` : ""}${pageHint}
Stay on topic: money, chores, goals, and kindness — but happily answer other kid-friendly questions too. Gently connect off-topic questions back to learning and growing. No adult topics, no scary content, no asking for personal info.`;

  if (ctx.mode === "youngest") {
    return `${base}
Use very simple words (like talking to a 5–6 year old). Max 2 short sentences. Use 1 emoji max. Be playful and warm.`;
  }
  if (ctx.mode === "younger") {
    return `${base}
Use clear, friendly language for ages 7–10. Max 3 sentences. Give one concrete example. You may use 1 emoji.`;
  }
  if (ctx.mode === "older") {
    return `${base}
Talk to a tween/teen (11+). Be respectful, not babyish. Up to 4 sentences. Use real examples and optional numbers. No emojis unless they used one first.`;
  }
  return `${base}\nKeep answers brief and encouraging.`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function chatWithSprout(
  ctx: CoachContext,
  message: string,
  history: ChatMessage[] = [],
): Promise<string> {
  const system = buildSystemPrompt(ctx);
  const messages: LlmMessage[] = [
    { role: "system", content: system },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const maxTokens = ctx.mode === "youngest" ? 80 : ctx.mode === "younger" ? 120 : 180;
  return chatCompletion(messages, { temperature: 0.7, maxTokens });
}

export async function synthesizeSpeech(text: string, voice: string, maxChars = 500): Promise<Buffer> {
  const res = await fetch(`${voiceBase()}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.KIDS_VOICE_MODEL || "kokoro",
      input: text.slice(0, maxChars),
      voice,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Voice error ${res.status}: ${errText.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function checkAiServices(): Promise<{ ollama: boolean; voice: boolean }> {
  const ollama = await checkLlmAvailable();
  let voice = false;
  try {
    const r = await fetch(`${voiceBase()}/models`, { signal: AbortSignal.timeout(3000) });
    voice = r.ok;
  } catch {
    /* ignore */
  }
  return { ollama, voice };
}

export function buildCoachContext(
  child: Child,
  jobs: Job[],
  page?: string,
  categories: JobCategory[] = [],
  learnLessons?: { title: string; category: string; completed: boolean }[],
): CoachContext {
  const mode = kidModeFromAge(child.age);
  const active = jobs.filter((j) => j.status !== "approved");
  const catById = new Map(categories.map((c) => [c.id, c]));

  const categoryGroups =
    categories.length > 0
      ? [...categories]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((cat) => ({
            label: cat.label,
            titles: active
              .filter((j) => j.categoryId === cat.id && (j.status === "assigned" || j.status === "in_progress"))
              .map((j) => j.title),
          }))
          .filter((g) => g.titles.length > 0)
      : undefined;

  return {
    childName: child.name,
    age: child.age,
    mode,
    activeJobs: active.map((j) => ({
      title: j.title,
      status: j.status,
      isFamilyDuty: (j as any).isFamilyDuty ?? false,
    })),
    activeJobsDetailed: active.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      categoryLabel: j.categoryId ? catById.get(j.categoryId)?.label : undefined,
    })),
    categoryGroups,
    learnLessons,
    spendingBalance: child.spendingBalance || "0.00",
    savingsBalance: child.savingsBalance || "0.00",
    completedJobs: child.completedJobs || 0,
    page,
  };
}
