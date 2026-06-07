import type { LessonCatalogPayload } from "./types";
import { defaultVideoUrlForCategory } from "./category-default-video";

export function normalizeLessonPayload(
  payload: Record<string, unknown>,
  description?: string | null,
  categoryKey?: string,
): LessonCatalogPayload {
  const rawContent = typeof payload.content === "string" ? payload.content.trim() : "";
  const desc = description?.trim() ?? "";
  const content = rawContent || desc;

  const explicitVideo =
    typeof payload.videoUrl === "string" && payload.videoUrl.trim()
      ? payload.videoUrl.trim()
      : null;
  const videoUrl = explicitVideo ?? (categoryKey ? defaultVideoUrlForCategory(categoryKey) : null);

  const quizStubs = Array.isArray(payload.quizStubs)
    ? (payload.quizStubs as LessonCatalogPayload["quizStubs"])
    : undefined;

  return {
    content,
    videoUrl,
    ...(quizStubs && quizStubs.length > 0 ? { quizStubs } : {}),
  };
}

export function fallbackLessonContent(title: string, description?: string | null): string {
  const desc = description?.trim();
  if (desc) return desc;
  return `Let's learn about ${title}. Read through this lesson, watch the video if there is one, then take the quiz to show what you learned!`;
}
