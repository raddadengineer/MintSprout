import type { LessonCatalogPayload } from "@shared/catalog/types";
import type { IStorage } from "./storage";
import { parsePayload } from "./catalog-seed";
import { generateCatalogItems } from "./catalog-generator";
import { quizStubsForLessonTitle } from "@shared/catalog/lesson-quizzes";

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

  const payload = parsePayload(item.payload) as LessonCatalogPayload;

  const lesson = await storage.createLesson({
    category: item.categoryKey,
    title: item.title,
    content: payload.content,
    videoUrl: payload.videoUrl ?? null,
    isCustom: true,
    familyId,
  });

  let quizStubs = payload.quizStubs ?? [];
  if (quizStubs.length === 0) {
    quizStubs = quizStubsForLessonTitle(item.title);
  }
  if (quizStubs.length === 0) {
    try {
      const proposals = await generateCatalogItems("lesson", item.categoryKey, 1);
      const genPayload = proposals[0]?.payload as LessonCatalogPayload | undefined;
      quizStubs = genPayload?.quizStubs ?? [];
    } catch {
      quizStubs = [
        {
          question: `What is one main idea from "${item.title}"?`,
          options: ["Saving is important", "Spending everything is best", "Money does not matter", "Only adults use money"],
          correctAnswer: 0,
        },
      ];
    }
  }

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
