import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { importFromLibrary, publishLessonCatalogItem } from "./catalog-publish";

vi.mock("./catalog-generator", () => ({
  generateCatalogItems: vi.fn(async () => []),
}));

describe("catalog import and publish", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
    await storage.createCatalogLibraryItem({
      catalogType: "lesson",
      categoryKey: "saving",
      title: "Test Lesson",
      description: "Save for goals",
      payload: JSON.stringify({
        content: "Saving is smart.",
        videoUrl: null,
        quizStubs: [
          {
            question: "Why save?",
            options: ["For later", "Never", "To lose it", "No reason"],
            correctAnswer: 0,
          },
        ],
      }),
      source: "builtin",
    });
  });

  it("imports a library item into the family catalog", async () => {
    const lib = (await storage.getCatalogLibrary("lesson"))[0]!;
    const item = await importFromLibrary(storage, 1, lib.id);
    expect(item.familyId).toBe(1);
    expect(item.title).toBe("Test Lesson");

    await expect(importFromLibrary(storage, 1, lib.id)).rejects.toMatchObject({ status: 409 });
  });

  it("publishes a lesson catalog item to the lessons table", async () => {
    const lib = (await storage.getCatalogLibrary("lesson"))[0]!;
    const item = await importFromLibrary(storage, 1, lib.id);
    const result = await publishLessonCatalogItem(storage, 1, item.id);

    expect(result.lessonId).toBeGreaterThan(0);
    const updated = await storage.getFamilyCatalogItem(item.id);
    expect(updated?.publishedLessonId).toBe(result.lessonId);

    const quizzes = await storage.getQuizzesByLesson(result.lessonId);
    expect(quizzes.length).toBeGreaterThan(0);
    expect(quizzes[0]!.correctAnswer).toBe(0);
  });

  it("uses built-in quiz stubs when publishing a known lesson title", async () => {
    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "earning",
      categoryId: null,
      title: "How to Earn Money",
      description: "Earn through chores",
      payload: JSON.stringify({ content: "Work earns money.", videoUrl: null }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const quizzes = await storage.getQuizzesByLesson(result.lessonId);
    expect(quizzes.length).toBe(3);
    expect(quizzes[0]!.question).toContain("EARN");
  });
});
