export type CatalogType = "job" | "lesson";

export type CatalogSource = "builtin" | "ai" | "custom";

export type JobCatalogPayload = {
  icon: string;
  recurrence: "once" | "daily" | "weekly" | "monthly";
};

export type VoiceLessonStep = {
  narration: string;
  prompt?: string;
  acceptKeywords?: string[];
};

export type LessonCatalogPayload = {
  content: string;
  videoUrl?: string | null;
  quizStubs?: { question: string; options: string[]; correctAnswer: number }[];
  voiceSteps?: VoiceLessonStep[];
};

export type CatalogPayload = JobCatalogPayload | LessonCatalogPayload;

export type CatalogLibraryEntry = {
  catalogType: CatalogType;
  categoryKey: string;
  title: string;
  description: string;
  payload: CatalogPayload;
  source: "builtin" | "ai";
};

export type FamilyCatalogItemInput = {
  familyId: number;
  catalogType: CatalogType;
  categoryId?: number | null;
  categoryKey: string;
  libraryItemId?: number | null;
  title: string;
  description?: string | null;
  payload: CatalogPayload;
  enabled?: boolean;
  sortOrder?: number;
  publishedLessonId?: number | null;
};

export const LESSON_CATEGORY_KEYS = ["earning", "saving", "spending", "investing", "donating"] as const;
export type LessonCategoryKey = (typeof LESSON_CATEGORY_KEYS)[number];

export const LESSON_CATEGORY_LABELS: Record<LessonCategoryKey, string> = {
  earning: "Earning",
  saving: "Saving",
  spending: "Spending",
  investing: "Investing",
  donating: "Donating",
};

export const JOB_CATEGORY_SLUGS = ["self_care", "allowance", "mind_body", "help_others"] as const;
export type JobCategorySlug = (typeof JOB_CATEGORY_SLUGS)[number];
