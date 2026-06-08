import type { IStorage } from "./storage";

type AchievementDef = {
  title: string;
  description: string;
  icon: string;
};

async function awardOnce(storage: IStorage, childId: number, def: AchievementDef): Promise<void> {
  const existing = await storage.getAchievements(childId);
  if (existing.some((a) => a.title === def.title)) return;
  await storage.createAchievement({ childId, ...def });
}

export async function checkJobAchievements(storage: IStorage, childId: number): Promise<void> {
  const child = await storage.getChild(childId);
  if (!child) return;
  const jobs = child.completedJobs || 0;
  if (jobs >= 1) {
    await awardOnce(storage, childId, {
      title: "First Payday",
      description: "Completed your first approved task.",
      icon: "💵",
    });
  }
  if (jobs >= 5) {
    await awardOnce(storage, childId, {
      title: "Hard Worker",
      description: "Completed 5 approved tasks.",
      icon: "⭐",
    });
  }
  if (jobs >= 10) {
    await awardOnce(storage, childId, {
      title: "Super Saver",
      description: "Completed 10 approved tasks.",
      icon: "🏆",
    });
  }
}

export async function checkLessonAchievements(storage: IStorage, childId: number): Promise<void> {
  const progress = await storage.getLearningProgress(childId);
  const completed = progress.filter((p) => p.completed).length;
  if (completed >= 1) {
    await awardOnce(storage, childId, {
      title: "Lesson Learner",
      description: "Passed your first lesson quiz.",
      icon: "📚",
    });
  }
  if (completed >= 5) {
    await awardOnce(storage, childId, {
      title: "Money Scholar",
      description: "Passed 5 lesson quizzes.",
      icon: "🎓",
    });
  }
}

export async function checkSavingsGoalAchievement(storage: IStorage, childId: number): Promise<void> {
  const goals = await storage.getSavingsGoals(childId);
  if (goals.some((g) => g.completed)) {
    await awardOnce(storage, childId, {
      title: "Goal Getter",
      description: "Reached a savings goal.",
      icon: "🎯",
    });
  }
}
