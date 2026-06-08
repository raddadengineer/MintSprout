import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { importFromLibrary, publishLessonCatalogItem } from "./catalog-publish";
import { defaultVideoUrlForCategory } from "@shared/catalog/category-default-video";

const mockGenerate = vi.fn(async () => []);

vi.mock("./catalog-generator", () => ({
  generateCatalogItems: (...args: unknown[]) => mockGenerate(...args),
}));

describe("catalog import and publish", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue([]);
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

  it("fills content from description when payload content is empty", async () => {
    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "saving",
      categoryId: null,
      title: "My Saving Lesson",
      description: "Saving helps you reach goals.",
      payload: JSON.stringify({
        content: "",
        quizStubs: [{ question: "Why?", options: ["Goals", "No", "Maybe", "Never"], correctAnswer: 0 }],
      }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const lessons = await storage.getCustomLessons(1);
    const lesson = lessons.find((l) => l.id === result.lessonId);
    expect(lesson?.content).toBe("Saving helps you reach goals.");
  });

  it("assigns category default video when videoUrl is missing", async () => {
    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "saving",
      categoryId: null,
      title: "Saving Basics",
      description: "Learn to save",
      payload: JSON.stringify({ content: "Save money for later." }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const lessons = await storage.getCustomLessons(1);
    const lesson = lessons.find((l) => l.id === result.lessonId);
    expect(lesson?.videoUrl).toBe(defaultVideoUrlForCategory("saving"));
  });

  it("keeps explicit video URL over category default", async () => {
    const customUrl = "https://www.youtube.com/embed/custom123";
    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "saving",
      categoryId: null,
      title: "Custom Video Lesson",
      description: "Has custom video",
      payload: JSON.stringify({ content: "Content here.", videoUrl: customUrl }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const lessons = await storage.getCustomLessons(1);
    const lesson = lessons.find((l) => l.id === result.lessonId);
    expect(lesson?.videoUrl).toBe(customUrl);
  });

  it("merges AI-generated content and quizzes when both are missing", async () => {
    mockGenerate.mockResolvedValue([
      {
        title: "AI Lesson",
        description: "From AI",
        payload: {
          content: "AI generated lesson body with enough teaching text for kids.",
          videoUrl: null,
          quizStubs: [
            {
              question: "AI question?",
              options: ["Yes", "No", "Maybe", "Never"],
              correctAnswer: 1,
            },
          ],
        },
      },
    ]);

    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "spending",
      categoryId: null,
      title: "Spending Smart",
      description: "",
      payload: JSON.stringify({ content: "" }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const lessons = await storage.getCustomLessons(1);
    const lesson = lessons.find((l) => l.id === result.lessonId);
    const quizzes = await storage.getQuizzesByLesson(result.lessonId);

    expect(mockGenerate).toHaveBeenCalled();
    expect(lesson?.content).toContain("AI generated lesson body");
    expect(quizzes[0]!.question).toBe("AI question?");
    expect(quizzes[0]!.correctAnswer).toBe(1);
  });

  it("stores voice steps when publishing a lesson", async () => {
    const familyItem = await storage.createFamilyCatalogItem({
      familyId: 1,
      catalogType: "lesson",
      categoryKey: "saving",
      categoryId: null,
      title: "Voice Lesson",
      description: "Save money",
      payload: JSON.stringify({ content: "Saving is smart. Keep money for later goals." }),
      enabled: true,
      sortOrder: 0,
    });

    const result = await publishLessonCatalogItem(storage, 1, familyItem.id);
    const lessons = await storage.getCustomLessons(1);
    const lesson = lessons.find((l) => l.id === result.lessonId);
    expect(lesson?.voiceSteps).toBeTruthy();
    const steps = JSON.parse(lesson!.voiceSteps!);
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });
});
