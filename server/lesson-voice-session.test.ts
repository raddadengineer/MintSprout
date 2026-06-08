import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { handleLessonVoiceSession } from "./lesson-voice-session";
import { serializeVoiceSteps, buildVoiceStepsFromContent } from "@shared/catalog/build-voice-steps";

vi.mock("./ai-coach", () => ({
  kidModeFromAge: () => "younger",
  voiceForKidMode: () => null,
  synthesizeSpeech: vi.fn(),
}));

describe("lesson voice session", () => {
  let storage: MemStorage;
  let lessonId: number;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
    const lesson = await storage.createLesson({
      category: "saving",
      title: "Test Saving Lesson",
      content: "Saving helps you reach goals. Put money aside before spending.",
      videoUrl: null,
      voiceSteps: serializeVoiceSteps(
        buildVoiceStepsFromContent("Test Saving Lesson", "Saving helps you reach goals.", ["Why save?"]),
      ),
      isCustom: true,
      familyId: 1,
    });
    lessonId = lesson.id;
    await storage.createQuiz({
      lessonId,
      question: "Why save?",
      options: ["Goals", "Never", "Spend all", "Ignore"],
      correctAnswer: 0,
    });
  });

  it("starts at step 0 without marking prepared", async () => {
    const result = await handleLessonVoiceSession(storage, 1, 8, lessonId, { action: "start" }, false);
    expect(result.stepIndex).toBe(0);
    expect(result.prepared).toBe(false);
    expect(result.narration.length).toBeGreaterThan(0);
  });

  it("advances through narration-only steps", async () => {
    const start = await handleLessonVoiceSession(storage, 1, 8, lessonId, { action: "start" }, false);
    const next = await handleLessonVoiceSession(
      storage,
      1,
      8,
      lessonId,
      { action: "advance", stepIndex: start.stepIndex },
      false,
    );
    expect(next.stepIndex).toBeGreaterThan(start.stepIndex);
    expect(next.prepared).toBe(false);
  });

  it("marks prepared after completing all steps", async () => {
    let stepIndex = 0;
    let prepared = false;
    const start = await handleLessonVoiceSession(storage, 1, 8, lessonId, { action: "start" }, false);
    stepIndex = start.stepIndex;
    const total = start.totalSteps;

    while (!prepared && stepIndex < total + 2) {
      const step = await storage.getLessonById(lessonId);
      const steps = JSON.parse(step!.voiceSteps!);
      const current = steps[stepIndex];
      if (current?.prompt) {
        const res = await handleLessonVoiceSession(
          storage,
          1,
          8,
          lessonId,
          { action: "respond", stepIndex, userMessage: "I would save for a bike" },
          false,
        );
        prepared = res.prepared;
        stepIndex = res.stepIndex;
      } else {
        const res = await handleLessonVoiceSession(
          storage,
          1,
          8,
          lessonId,
          { action: "advance", stepIndex },
          false,
        );
        prepared = res.prepared;
        stepIndex = res.stepIndex;
      }
    }

    expect(prepared).toBe(true);
    const progress = await storage.getLearningProgress(1);
    expect(progress.some((p) => p.lessonId === lessonId && p.preparedAt)).toBe(true);
  });

  it("generates voice steps on the fly when missing", async () => {
    const bare = await storage.createLesson({
      category: "earning",
      title: "Earn Basics",
      content: "You can earn money by doing chores.",
      videoUrl: null,
      voiceSteps: null,
      isCustom: true,
      familyId: 1,
    });
    const result = await handleLessonVoiceSession(storage, 1, 8, bare.id, { action: "start" }, false);
    expect(result.totalSteps).toBeGreaterThan(0);
    const updated = await storage.getLessonById(bare.id);
    expect(updated?.voiceSteps).toBeTruthy();
  });
});
