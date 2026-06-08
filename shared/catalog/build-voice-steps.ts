import type { VoiceLessonStep } from "./types";

function splitIntoChunks(text: string, maxChunks: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) return paragraphs.slice(0, maxChunks);

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [trimmed];
  if (sentences.length <= maxChunks) return sentences;

  const chunkSize = Math.ceil(sentences.length / maxChunks);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize).join(" "));
  }
  return chunks.slice(0, maxChunks);
}

export function parseVoiceSteps(raw: string | null | undefined): VoiceLessonStep[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (step): step is VoiceLessonStep =>
        !!step &&
        typeof step === "object" &&
        typeof (step as VoiceLessonStep).narration === "string" &&
        (step as VoiceLessonStep).narration.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export function serializeVoiceSteps(steps: VoiceLessonStep[]): string {
  return JSON.stringify(steps);
}

export function buildVoiceStepsFromContent(
  title: string,
  content: string,
  quizQuestions: string[] = [],
): VoiceLessonStep[] {
  const body = content.trim() || `Let's learn about ${title}.`;
  const chunks = splitIntoChunks(body, 3);
  const steps: VoiceLessonStep[] = [];

  chunks.forEach((chunk, index) => {
    steps.push({
      narration: index === 0 ? `Hi! Let's learn about ${title}. ${chunk}` : chunk,
    });
  });

  if (steps.length === 0) {
    steps.push({ narration: `Hi! Let's learn about ${title}.` });
  }

  const checkIn: VoiceLessonStep = {
    narration: "Quick check-in!",
    prompt:
      quizQuestions[0] != null
        ? `Think about this: ${quizQuestions[0]} Tell me what you think!`
        : `What's one thing you learned about ${title}? Tell me in your own words!`,
    acceptKeywords: ["save", "money", "earn", "spend", "learn", "help", "goal", "bank", "share", "give"],
  };

  if (steps.length >= 2) {
    steps.splice(1, 0, checkIn);
  } else {
    steps.push(checkIn);
  }

  steps.push({
    narration: "Awesome job! You listened and shared your ideas. You're ready for the quiz!",
  });

  return steps.slice(0, 6);
}
