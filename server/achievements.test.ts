import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { seedTestChild } from "./test-helpers";
import {
  checkJobAchievements,
  checkLessonAchievements,
  checkSavingsGoalAchievement,
} from "./achievements";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("achievements", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("awards First Payday after updating completed job count", async () => {
    const child = await seedTestChild(storage);
    await storage.updateChild(child.id, { completedJobs: 1 });
    await checkJobAchievements(storage, child.id);
    const badges = await storage.getAchievements(child.id);
    expect(badges.some((b) => b.title === "First Payday")).toBe(true);
  });

  it("does not duplicate achievements", async () => {
    const child = await seedTestChild(storage);
    await storage.updateChild(child.id, { completedJobs: 1 });
    await checkJobAchievements(storage, child.id);
    await checkJobAchievements(storage, child.id);
    const badges = await storage.getAchievements(child.id);
    expect(badges.filter((b) => b.title === "First Payday")).toHaveLength(1);
  });

  it("awards Lesson Learner when a lesson is completed", async () => {
    const child = await seedTestChild(storage);
    const lesson = await storage.createLesson({
      familyId: null,
      category: "earning",
      title: "Test lesson",
      content: "Content",
      videoUrl: null,
      isCustom: false,
    });
    await storage.createLearningProgress({
      childId: child.id,
      lessonId: lesson.id,
      completed: true,
      quizScore: 100,
      preparedAt: new Date(),
    });
    await checkLessonAchievements(storage, child.id);
    const badges = await storage.getAchievements(child.id);
    expect(badges.some((b) => b.title === "Lesson Learner")).toBe(true);
  });

  it("awards Goal Getter when a savings goal is completed", async () => {
    const child = await seedTestChild(storage);
    const goal = await storage.createSavingsGoal({
      childId: child.id,
      name: "Bike",
      targetAmount: "100.00",
      currentAmount: "100.00",
    });
    await storage.updateSavingsGoal(goal.id, { completed: true });
    await checkSavingsGoalAchievement(storage, child.id);
    const badges = await storage.getAchievements(child.id);
    expect(badges.some((b) => b.title === "Goal Getter")).toBe(true);
  });
});
