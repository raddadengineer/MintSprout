import type { CatalogType } from "@shared/catalog/types";
import { LESSON_CATEGORY_LABELS } from "@shared/catalog/types";
import { DEFAULT_JOB_CATEGORIES } from "@shared/job-categories";
import { chatCompletion, checkLlmAvailable } from "./llm-client";

export type CatalogProposal = {
  title: string;
  description: string;
  payload: Record<string, unknown>;
};

const JOB_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_JOB_CATEGORIES.map((c) => [c.slug, c.label]),
);

function categoryContext(type: CatalogType, categoryKey: string): string {
  if (type === "job") {
    const label = JOB_CATEGORY_LABELS[categoryKey] ?? categoryKey;
    const seed = DEFAULT_JOB_CATEGORIES.find((c) => c.slug === categoryKey);
    const payment = seed?.paymentMode ?? "none";
    const paymentHint =
      payment === "none"
        ? "These are everyday responsibilities with no pay."
        : payment === "allowance"
          ? "These are allowance-tied chores (no standalone payment)."
          : "These can be one-time paid jobs.";
    return `Job category: "${label}" (${categoryKey}). ${paymentHint}`;
  }
  const label = LESSON_CATEGORY_LABELS[categoryKey as keyof typeof LESSON_CATEGORY_LABELS] ?? categoryKey;
  return `Learn lesson topic for the "${label}" category (${categoryKey}). Kid-friendly ages 5–12.`;
}

export async function generateCatalogItems(
  type: CatalogType,
  categoryKey: string,
  count: number,
): Promise<CatalogProposal[]> {
  const available = await checkLlmAvailable();
  if (!available) {
    const err = new Error("AI is not available. Configure Open WebUI or Ollama.");
    (err as Error & { status?: number }).status = 503;
    throw err;
  }

  const ctx = categoryContext(type, categoryKey);
  const payloadShape =
    type === "job"
      ? '{ "icon": "briefcase|bed|sparkles|bookOpen|gift|trash2|utensils|wind|target|home|sprout", "recurrence": "once|daily|weekly|monthly" }'
      : '{ "content": "2-4 kid-friendly paragraphs", "videoUrl": null, "quizStubs": [{ "question": "...", "options": ["a","b","c","d"], "correctAnswer": 0 }] }';

  const system = `You generate catalog templates for a family finance app for kids. Reply with ONLY valid JSON: an array of objects with keys title, description, payload. payload must match: ${payloadShape}. No markdown.`;

  const user = `Generate ${count} unique ${type} catalog items for ${ctx}. Avoid duplicating common defaults like "Make my bed" unless fresh angle.`;

  const raw = await chatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.8, maxTokens: 2048 },
  );

  let parsed: unknown;
  try {
    const trimmed = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  if (!Array.isArray(parsed)) throw new Error("AI response must be an array");

  return parsed
    .filter((item): item is CatalogProposal => {
      if (!item || typeof item !== "object") return false;
      const o = item as Record<string, unknown>;
      return typeof o.title === "string" && typeof o.description === "string" && o.payload != null;
    })
    .slice(0, count);
}
