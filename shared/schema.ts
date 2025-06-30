import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'parent' | 'child'
  familyId: integer("family_id").notNull(),
  name: text("name").notNull(),
  age: integer("age"),
});

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  familyId: integer("family_id").notNull(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0.00"),
  completedJobs: integer("completed_jobs").default(0),
  learningStreak: integer("learning_streak").default(0),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // 'assigned' | 'in_progress' | 'completed' | 'approved'
  recurrence: text("recurrence").notNull(), // 'once' | 'daily' | 'weekly' | 'monthly'
  assignedToId: integer("assigned_to_id").notNull(),
  familyId: integer("family_id").notNull(),
  icon: text("icon").default("briefcase"), // icon name for the job
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  childId: integer("child_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  spendingAmount: decimal("spending_amount", { precision: 10, scale: 2 }).notNull(),
  savingsAmount: decimal("savings_amount", { precision: 10, scale: 2 }).notNull(),
  rothIraAmount: decimal("roth_ira_amount", { precision: 10, scale: 2 }).notNull(),
  brokerageAmount: decimal("brokerage_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allocationSettings = pgTable("allocation_settings", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  spendingPercentage: integer("spending_percentage").default(20),
  savingsPercentage: integer("savings_percentage").default(30),
  rothIraPercentage: integer("roth_ira_percentage").default(25),
  brokeragePercentage: integer("brokerage_percentage").default(25),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // 'earning' | 'saving' | 'spending' | 'investing' | 'donating'
  title: text("title").notNull(),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  isCustom: boolean("is_custom").default(false),
  familyId: integer("family_id"),
});

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
});

export const learningProgress = pgTable("learning_progress", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  completed: boolean("completed").default(false),
  quizScore: integer("quiz_score"),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

// Insert schemas
export const insertFamilySchema = createInsertSchema(families).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertChildSchema = createInsertSchema(children).omit({ id: true, totalEarned: true, completedJobs: true, learningStreak: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertAllocationSettingsSchema = createInsertSchema(allocationSettings).omit({ id: true });
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true });
export const insertLearningProgressSchema = createInsertSchema(learningProgress).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, earnedAt: true });

// Types
export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Child = typeof children.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AllocationSettings = typeof allocationSettings.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertAllocationSettings = z.infer<typeof insertAllocationSettingsSchema>;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type InsertLearningProgress = z.infer<typeof insertLearningProgressSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
