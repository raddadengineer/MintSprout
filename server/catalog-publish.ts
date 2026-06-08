import type { LessonCatalogPayload } from "@shared/catalog/types";
import { fallbackLessonContent, normalizeLessonPayload } from "@shared/catalog/normalize-lesson-payload";
import type { IStorage } from "./storage";
import { parsePayload } from "./catalog-seed";
import { generateCatalogItems } from "./catalog-generator";
import { quizStubsForLessonTitle } from "@shared/catalog/lesson-quizzes";
import { serializeVoiceSteps } from "@shared/catalog/build-voice-steps";
import { generateVoiceStepsForLesson } from "./voice-steps-generator";

async function enrichLessonFromAi(
  categoryKey: string,
  needsContent: boolean,
  needsQuizzes: boolean,
): Promise<Partial<LessonCatalogPayload>> {
  try {
    const proposals = await generateCatalogItems("lesson", categoryKey, 1);
    const genPayload = proposals[0]?.payload as LessonCatalogPayload | undefined;
    const result: Partial<LessonCatalogPayload> = {};
    if (needsContent) {
      const genContent = genPayload?.content?.trim() || proposals[0]?.description?.trim();
      if (genContent) result.content = genContent;
    }
    if (needsQuizzes && genPayload?.quizStubs?.length) {
      result.quizStubs = genPayload.quizStubs;
    }
    if (genPayload?.videoUrl?.trim()) {
      result.videoUrl = genPayload.videoUrl.trim();
    }
    return result;
  } catch {
    return {};
  }
}

export async function publishLessonCatalogItem(
  storage: IStorage,
  familyId: number,
  itemId: number,
): Promise<{ lessonId: number; itemId: number }> {
  const item = await storage.getFamilyCatalogItem(itemId);
  if (!item || item.familyId !== familyId || item.catalogType !== "lesson") {
    throw Object.assign(new Error("Catalog item not found"), { status: 404 });
  }
  if (item.publishedLessonId) {
    return { lessonId: item.publishedLessonId, itemId: item.id };
  }

  const rawPayload = parsePayload(item.payload) as Record<string, unknown>;
  let normalized = normalizeLessonPayload(rawPayload, item.description, item.categoryKey);

  let content = normalized.content?.trim() ?? "";
  let videoUrl = normalized.videoUrl ?? null;
  let quizStubs = normalized.quizStubs ?? [];

  const needsContent = !content;
  const needsQuizzes = quizStubs.length === 0;

  if (needsContent || needsQuizzes) {
    const enriched = await enrichLessonFromAi(item.categoryKey, needsContent, needsQuizzes);
    if (needsContent && enriched.content) content = enriched.content;
    if (needsQuizzes && enriched.quizStubs?.length) quizStubs = enriched.quizStubs;
    if (!rawPayload.videoUrl && enriched.videoUrl) videoUrl = enriched.videoUrl;
  }

  if (!content) {
    content = fallbackLessonContent(item.title, item.description);
  }

  if (quizStubs.length === 0) {
    quizStubs = quizStubsForLessonTitle(item.title);
  }
  if (quizStubs.length === 0) {
    quizStubs = [
      {
        question: `What is one main idea from "${item.title}"?`,
        options: ["Saving is important", "Spending everything is best", "Money does not matter", "Only adults use money"],
        correctAnswer: 0,
      },
    ];
  }

  let voiceSteps = normalized.voiceSteps ?? [];
  if (voiceSteps.length === 0) {
    voiceSteps = await generateVoiceStepsForLesson(
      item.title,
      content,
      item.categoryKey,
      quizStubs.map((stub) => stub.question),
    );
  }

  const lesson = await storage.createLesson({
    category: item.categoryKey,
    title: item.title,
    content,
    videoUrl,
    voiceSteps: serializeVoiceSteps(voiceSteps),
    isCustom: true,
    familyId,
  });

  for (const stub of quizStubs.slice(0, 5)) {
    await storage.createQuiz({
      lessonId: lesson.id,
      question: stub.question,
      options: stub.options,
      correctAnswer: stub.correctAnswer,
    });
  }

  await storage.updateFamilyCatalogItem(item.id, { publishedLessonId: lesson.id });
  return { lessonId: lesson.id, itemId: item.id };
}

export async function importFromLibrary(
  storage: IStorage,
  familyId: number,
  libraryItemId: number,
  categoryId?: number | null,
): Promise<Awaited<ReturnType<IStorage["createFamilyCatalogItem"]>>> {
  const lib = await storage.getCatalogLibraryItem(libraryItemId);
  if (!lib) throw Object.assign(new Error("Library item not found"), { status: 404 });

  const existing = await storage.getFamilyCatalogItems(familyId, lib.catalogType, {
    categoryId: lib.catalogType === "job" ? categoryId ?? undefined : undefined,
    categoryKey: lib.categoryKey,
  });
  if (existing.some((i) => i.title === lib.title)) {
    throw Object.assign(new Error("This item is already in your catalog"), { status: 409 });
  }

  const maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);

  return storage.createFamilyCatalogItem({
    familyId,
    catalogType: lib.catalogType,
    categoryId: lib.catalogType === "job" ? categoryId ?? null : null,
    categoryKey: lib.categoryKey,
    libraryItemId: lib.id,
    title: lib.title,
    description: lib.description,
    payload: lib.payload,
    enabled: true,
    sortOrder: maxSort + 1,
  });
}
