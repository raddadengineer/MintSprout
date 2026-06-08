import type { VoiceLessonStep } from "@shared/catalog/types";
import { buildVoiceStepsFromContent } from "@shared/catalog/build-voice-steps";
import { chatCompletion, checkLlmAvailable } from "./llm-client";

export async function generateVoiceStepsForLesson(
  title: string,
  content: string,
  categoryKey: string,
  quizQuestions: string[],
): Promise<VoiceLessonStep[]> {
  const fallback = () =>
    buildVoiceStepsFromContent(title, content, quizQuestions);

  const available = await checkLlmAvailable();
  if (!available) return fallback();

  const quizHint =
    quizQuestions.length > 0
      ? `Quiz topics to weave in: ${quizQuestions.slice(0, 3).join("; ")}`
      : "Include age-appropriate money concepts.";

  const system = `You create voice lesson scripts for kids ages 5-12 in a family finance app.
Reply with ONLY valid JSON: an array of 3-5 objects with keys:
- narration (string, kid-friendly text Sprout reads aloud)
- prompt (optional string, a voice question for the child)
- acceptKeywords (optional string array, simple words that count as a good answer)
Include 1-2 steps with prompts for voice check-ins. End with a step celebrating they're ready for the quiz.
No markdown.`;

  const user = `Category: ${categoryKey}. Lesson title: "${title}".
Lesson content: ${content.slice(0, 1200)}
${quizHint}`;

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.7, maxTokens: 1200 },
    );
    const trimmed = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback();

    const steps = parsed
      .filter(
        (step): step is VoiceLessonStep =>
          !!step &&
          typeof step === "object" &&
          typeof (step as VoiceLessonStep).narration === "string" &&
          (step as VoiceLessonStep).narration.trim().length > 0,
      )
      .slice(0, 6);

    if (steps.length < 2) return fallback();

    const last = steps[steps.length - 1]!;
    if (!/quiz|ready/i.test(last.narration)) {
      steps.push({ narration: "Great job! You're ready for the quiz!" });
    }

    return steps;
  } catch {
    return fallback();
  }
}
