import { LESSON_LIBRARY_BY_CATEGORY } from "./lesson-library";
import type { LessonCategoryKey } from "./types";

export function defaultVideoUrlForCategory(categoryKey: string): string | null {
  const items = LESSON_LIBRARY_BY_CATEGORY[categoryKey as LessonCategoryKey];
  if (!items) return null;
  const withVideo = items.find((item) => item.videoUrl?.trim());
  return withVideo?.videoUrl?.trim() ?? null;
}
