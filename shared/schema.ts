import { pgTable, text, serial, integer, boolean, decimal, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  spendingBalance: decimal("spending_balance", { precision: 10, scale: 2 }).default("0.00"),
  savingsBalance: decimal("savings_balance", { precision: 10, scale: 2 }).default("0.00"),
  rothIraBalance: decimal("roth_ira_balance", { precision: 10, scale: 2 }).default("0.00"),
  brokerageBalance: decimal("brokerage_balance", { precision: 10, scale: 2 }).default("0.00"),
  completedJobs: integer("completed_jobs").default(0),
  learningStreak: integer("learning_streak").default(0),
});

export const jobCategories = pgTable("job_categories", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull(),
  /** Stable key for catalog grouping (self_care, allowance, etc.) */
  slug: text("slug"),
  label: text("label").notNull(),
  description: text("description"),
  icon: text("icon").default("briefcase"),
  sortOrder: integer("sort_order").default(0),
  enabled: boolean("enabled").default(true),
  /** none = family-style duty; allowance = tied to allowance; standalone = paid per job */
  paymentMode: text("payment_mode").notNull().default("none"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const catalogLibrary = pgTable("catalog_library", {
  id: serial("id").primaryKey(),
  catalogType: text("catalog_type").notNull(), // 'job' | 'lesson'
  categoryKey: text("category_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  payload: text("payload").notNull(), // JSON
  source: text("source").notNull().default("builtin"), // 'builtin' | 'ai'
  createdAt: timestamp("created_at").defaultNow(),
});

export const familyCatalogItems = pgTable("family_catalog_items", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull(),
  catalogType: text("catalog_type").notNull(),
  categoryId: integer("category_id"),
  categoryKey: text("category_key").notNull(),
  libraryItemId: integer("library_item_id"),
  title: text("title").notNull(),
  description: text("description"),
  payload: text("payload").notNull(),
  enabled: boolean("enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  publishedLessonId: integer("published_lesson_id"),
  createdAt: timestamp("created_at").defaultNow(),
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
  categoryId: integer("category_id"),
  /** If set, this job is an allowance-tied chore (no standalone payment). */
  allowanceId: integer("allowance_id"),
  /** Everyday responsibilities — no pay, not tied to allowance. */
  isFamilyDuty: boolean("is_family_duty").default(false),
  icon: text("icon").default("briefcase"), // icon name for the job
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().unique(), // Ensure one payment per job
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

export const accountTypes = pgTable("account_types", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull(),
  spendingEnabled: boolean("spending_enabled").default(true),
  savingsEnabled: boolean("savings_enabled").default(true),
  rothIraEnabled: boolean("roth_ira_enabled").default(false),
  brokerageEnabled: boolean("brokerage_enabled").default(false),
});

export const familySettings = pgTable("family_settings", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().unique(),
  requireSpendingApproval: boolean("require_spending_approval").default(false),
  requireDonationApproval: boolean("require_donation_approval").default(false),
  requireGoalFundingApproval: boolean("require_goal_funding_approval").default(false),
});

export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull(),
  childId: integer("child_id").notNull(),
  type: text("type").notNull(), // 'spend' | 'donate' | 'goal_fund'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  details: text("details").notNull(), // JSON string payload for the request
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'denied'
  decidedByUserId: integer("decided_by_user_id"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allowances = pgTable("allowances", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull(),
  childId: integer("child_id").notNull(),
  /** Target allowance for the period (before job penalties). */
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  /**
   * Portion of `amount` that is always paid even if jobs are missed.
   * The rest (amount - guaranteedMinimum) can be reduced by penalties.
   */
  guaranteedMinimum: decimal("guaranteed_minimum", { precision: 10, scale: 2 }).default("0.00"),
  /** For each job still not done (assigned or in_progress), subtract this from the non-guaranteed portion. */
  penaltyPerIncompleteJob: decimal("penalty_per_incomplete_job", { precision: 10, scale: 2 }).default("0.00"),
  cadence: text("cadence").notNull(), // 'weekly' | 'monthly'
  /** Weekly: pay day (0=Sun … 6=Sat). */
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"), // 1-28, monthly
  /** Weekly: first day of the allowance chore period (0=Sun … 6=Sat). Default Monday in app logic. */
  periodStartDayOfWeek: integer("period_start_day_of_week"),
  /** Weekly: last day of the allowance chore period. Default Sunday in app logic. */
  periodEndDayOfWeek: integer("period_end_day_of_week"),
  enabled: boolean("enabled").default(true),
  /** automatic = scheduler pays on due day; manual = parent pays from Tasks & Payments */
  payoutMode: text("payout_mode").notNull().default("automatic"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** One row per allowance per calendar payout day (UTC) — prevents duplicate payouts with multiple app instances. */
export const allowancePayoutLog = pgTable(
  "allowance_payout_log",
  {
    id: serial("id").primaryKey(),
    allowanceId: integer("allowance_id")
      .notNull()
      .references(() => allowances.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    allowancePeriodUnique: uniqueIndex("allowance_payout_log_allowance_period").on(t.allowanceId, t.periodKey),
  }),
);

/** One row per allowance-tied job per calendar day (UTC) that a parent marked as missed. */
export const allowanceMissedJobLog = pgTable(
  "allowance_missed_job_log",
  {
    id: serial("id").primaryKey(),
    allowanceId: integer("allowance_id")
      .notNull()
      .references(() => allowances.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    occurrenceKey: text("occurrence_key").notNull(), // YYYY-MM-DD (UTC)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    jobOccurrenceUnique: uniqueIndex("allowance_missed_job_job_occurrence").on(t.jobId, t.occurrenceKey),
  }),
);

/** One row per allowance-tied job per calendar day (UTC) that a child completed. */
export const allowanceCompletedJobLog = pgTable(
  "allowance_completed_job_log",
  {
    id: serial("id").primaryKey(),
    allowanceId: integer("allowance_id")
      .notNull()
      .references(() => allowances.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    occurrenceKey: text("occurrence_key").notNull(), // YYYY-MM-DD (UTC)
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    jobOccurrenceUnique: uniqueIndex("allowance_completed_job_job_occurrence").on(t.jobId, t.occurrenceKey),
  }),
);

/** One row per family-responsibility job per occurrence window that a child completed. */
export const familyDutyCompletedLog = pgTable(
  "family_duty_completed_log",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    occurrenceKey: text("occurrence_key").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    jobOccurrenceUnique: uniqueIndex("family_duty_completed_job_occurrence").on(t.jobId, t.occurrenceKey),
  }),
);

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // 'earning' | 'saving' | 'spending' | 'investing' | 'donating'
  title: text("title").notNull(),
  content: text("content").notNull(),
  videoUrl: text("video_url"),
  voiceSteps: text("voice_steps"), // JSON array of VoiceLessonStep
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
  preparedAt: timestamp("prepared_at"),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0.00"),
  deadline: text("deadline"), // ISO date string, optional
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spendingLog = pgTable("spending_log", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  item: text("item").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // 'food' | 'toys' | 'clothes' | 'entertainment' | 'other'
  date: text("date").notNull(), // ISO date string
  createdAt: timestamp("created_at").defaultNow(),
});

export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  organization: text("organization").notNull(),
  cause: text("cause").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: text("date").notNull(), // ISO date string
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  type: text("type").notNull(), // 'payment' | 'spend' | 'donate' | 'goal_fund' | refunds
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fromAccount: text("from_account"), // 'earnings' | 'spending' | 'savings' | etc.
  toAccount: text("to_account"), // 'spending' | 'savings' | 'goal' | 'external' | etc.
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertFamilySchema = createInsertSchema(families).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertChildSchema = createInsertSchema(children).omit({ id: true, totalEarned: true, completedJobs: true, learningStreak: true });
export const insertJobCategorySchema = createInsertSchema(jobCategories).omit({ id: true, createdAt: true });
export const insertCatalogLibrarySchema = createInsertSchema(catalogLibrary).omit({ id: true, createdAt: true });
export const insertFamilyCatalogItemSchema = createInsertSchema(familyCatalogItems).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertAllocationSettingsSchema = createInsertSchema(allocationSettings).omit({ id: true });
export const insertAccountTypesSchema = createInsertSchema(accountTypes).omit({ id: true });
export const insertFamilySettingsSchema = createInsertSchema(familySettings).omit({ id: true });
export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({ id: true, createdAt: true, decidedAt: true });
export const insertAllowanceSchema = createInsertSchema(allowances).omit({ id: true, createdAt: true, lastRunAt: true });
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true });
export const insertLearningProgressSchema = createInsertSchema(learningProgress).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, earnedAt: true });
export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({ id: true, createdAt: true });
export const insertSpendingLogSchema = createInsertSchema(spendingLog).omit({ id: true, createdAt: true });
export const insertDonationSchema = createInsertSchema(donations).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

// Types
export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Child = typeof children.$inferSelect;
export type JobCategory = typeof jobCategories.$inferSelect;
export type CatalogLibrary = typeof catalogLibrary.$inferSelect;
export type FamilyCatalogItem = typeof familyCatalogItems.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AllocationSettings = typeof allocationSettings.$inferSelect;
export type AccountTypes = typeof accountTypes.$inferSelect;
export type FamilySettings = typeof familySettings.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type SpendingLog = typeof spendingLog.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type InsertJobCategory = z.infer<typeof insertJobCategorySchema>;
export type InsertCatalogLibrary = z.infer<typeof insertCatalogLibrarySchema>;
export type InsertFamilyCatalogItem = z.infer<typeof insertFamilyCatalogItemSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertAllocationSettings = z.infer<typeof insertAllocationSettingsSchema>;
export type InsertAccountTypes = z.infer<typeof insertAccountTypesSchema>;
export type InsertFamilySettings = z.infer<typeof insertFamilySettingsSchema>;
export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type InsertAllowance = z.infer<typeof insertAllowanceSchema>;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type InsertLearningProgress = z.infer<typeof insertLearningProgressSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type InsertSpendingLog = z.infer<typeof insertSpendingLogSchema>;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

