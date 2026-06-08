import { eq, and, inArray } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { IStorage } from "./storage";
import {
  User, Family, Child, JobCategory, Job, Payment, AllocationSettings, AccountTypes,
  FamilySettings, ApprovalRequest, Allowance,
  Lesson, Quiz, LearningProgress, Achievement, SavingsGoal, SpendingLog, Donation, Transaction,
  CatalogLibrary, FamilyCatalogItem,
  InsertUser, InsertFamily, InsertChild, InsertJobCategory, InsertJob, InsertPayment,
  InsertAllocationSettings, InsertAccountTypes, InsertFamilySettings, InsertApprovalRequest, InsertAllowance, InsertLesson, InsertQuiz,
  InsertLearningProgress, InsertAchievement, InsertSavingsGoal, InsertSpendingLog, InsertDonation, InsertTransaction,
  InsertCatalogLibrary, InsertFamilyCatalogItem,
} from "@shared/schema";
import bcrypt from "bcrypt";

export class PostgresStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0] || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const passwordLooksHashed = /^\$2[aby]\$/.test(insertUser.password);
    const hashedPassword = passwordLooksHashed
      ? insertUser.password
      : await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(schema.users).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    return result[0];
  }

  async updateUser(
    id: number,
    updates: Partial<Pick<User, "username" | "name" | "age">> & { password?: string },
  ): Promise<User | undefined> {
    const patch: Partial<User> = {};
    if (updates.username !== undefined) patch.username = updates.username;
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.age !== undefined) patch.age = updates.age;
    if (updates.password !== undefined) {
      patch.password = /^\$2[aby]\$/.test(updates.password)
        ? updates.password
        : await bcrypt.hash(updates.password, 10);
    }
    if (Object.keys(patch).length === 0) {
      return this.getUserById(id);
    }
    const result = await db.update(schema.users).set(patch).where(eq(schema.users.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
    return result.length > 0;
  }

  async createFamily(insertFamily: InsertFamily): Promise<Family> {
    const result = await db.insert(schema.families).values(insertFamily).returning();
    return result[0];
  }

  async getFamily(id: number): Promise<Family | undefined> {
    const result = await db.select().from(schema.families).where(eq(schema.families.id, id));
    return result[0] || undefined;
  }

  async createChild(insertChild: InsertChild): Promise<Child> {
    const result = await db.insert(schema.children).values({
      ...insertChild,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    }).returning();
    return result[0];
  }

  async getChildrenByFamily(familyId: number): Promise<Child[]> {
    return await db.select().from(schema.children).where(eq(schema.children.familyId, familyId));
  }

  async getChild(id: number): Promise<Child | undefined> {
    const result = await db.select().from(schema.children).where(eq(schema.children.id, id));
    return result[0] || undefined;
  }

  async updateChild(id: number, updates: Partial<Child>): Promise<Child | undefined> {
    const result = await db.update(schema.children)
      .set(updates)
      .where(eq(schema.children.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteChild(id: number): Promise<boolean> {
    const child = await this.getChild(id);
    if (!child) return false;
    const { deleteChildWithUser } = await import("./child-delete");
    return deleteChildWithUser(id, child.userId);
  }

  async createJobCategory(insert: InsertJobCategory): Promise<JobCategory> {
    const result = await db.insert(schema.jobCategories).values({
      ...insert,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getJobCategoriesByFamily(familyId: number, opts?: { includeDisabled?: boolean }): Promise<JobCategory[]> {
    const rows = await db.select().from(schema.jobCategories).where(eq(schema.jobCategories.familyId, familyId));
    const filtered = opts?.includeDisabled ? rows : rows.filter((c) => c.enabled);
    return filtered.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getJobCategory(id: number): Promise<JobCategory | undefined> {
    const result = await db.select().from(schema.jobCategories).where(eq(schema.jobCategories.id, id));
    return result[0] || undefined;
  }

  async updateJobCategory(id: number, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    const result = await db.update(schema.jobCategories)
      .set(updates)
      .where(eq(schema.jobCategories.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteJobCategory(id: number): Promise<boolean> {
    const result = await db.delete(schema.jobCategories).where(eq(schema.jobCategories.id, id)).returning();
    return result.length > 0;
  }

  async countJobsInCategory(categoryId: number): Promise<number> {
    const rows = await db.select().from(schema.jobs).where(eq(schema.jobs.categoryId, categoryId));
    return rows.length;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const result = await db.insert(schema.jobs).values({
      ...insertJob,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async getJobsByFamily(familyId: number): Promise<Job[]> {
    return await db.select().from(schema.jobs).where(eq(schema.jobs.familyId, familyId));
  }

  async getJobsByChild(childId: number): Promise<Job[]> {
    return await db.select().from(schema.jobs).where(eq(schema.jobs.assignedToId, childId));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const result = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return result[0] || undefined;
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<Job | undefined> {
    const result = await db.update(schema.jobs)
      .set(updates)
      .where(eq(schema.jobs.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteJob(id: number): Promise<boolean> {
    const result = await db.delete(schema.jobs).where(eq(schema.jobs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(schema.payments).values({
      ...insertPayment,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async getPaymentsByChild(childId: number): Promise<Payment[]> {
    return await db.select().from(schema.payments).where(eq(schema.payments.childId, childId));
  }

  async getPaymentsByFamily(familyId: number): Promise<Payment[]> {
    const children = await this.getChildrenByFamily(familyId);
    const childIds = children.map(c => c.id);

    if (childIds.length === 0) return [];

    return await db.select().from(schema.payments).where(inArray(schema.payments.childId, childIds));
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined> {
    const result = await db.update(schema.payments)
      .set(updates)
      .where(eq(schema.payments.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deletePaymentsByJob(jobId: number): Promise<boolean> {
    const result = await db.delete(schema.payments).where(eq(schema.payments.jobId, jobId));
    return (result.rowCount ?? 0) > 0;
  }

  async createAllocationSettings(insertSettings: InsertAllocationSettings): Promise<AllocationSettings> {
    const result = await db.insert(schema.allocationSettings).values(insertSettings).returning();
    return result[0];
  }

  async getAllocationSettings(childId: number): Promise<AllocationSettings | undefined> {
    const result = await db.select().from(schema.allocationSettings)
      .where(eq(schema.allocationSettings.childId, childId));
    return result[0] || undefined;
  }

  async updateAllocationSettings(childId: number, updates: Partial<AllocationSettings>): Promise<AllocationSettings | undefined> {
    const result = await db.update(schema.allocationSettings)
      .set(updates)
      .where(eq(schema.allocationSettings.childId, childId))
      .returning();
    return result[0] || undefined;
  }

  async createAccountTypes(insertAccountTypes: InsertAccountTypes): Promise<AccountTypes> {
    const result = await db.insert(schema.accountTypes).values(insertAccountTypes).returning();
    return result[0];
  }

  async getAccountTypes(familyId: number): Promise<AccountTypes | undefined> {
    const result = await db.select().from(schema.accountTypes)
      .where(eq(schema.accountTypes.familyId, familyId));
    return result[0] || undefined;
  }

  async updateAccountTypes(familyId: number, updates: Partial<AccountTypes>): Promise<AccountTypes | undefined> {
    const result = await db.update(schema.accountTypes)
      .set(updates)
      .where(eq(schema.accountTypes.familyId, familyId))
      .returning();
    return result[0] || undefined;
  }

  // Family Settings
  async getFamilySettings(familyId: number): Promise<FamilySettings | undefined> {
    const result = await db.select().from(schema.familySettings).where(eq(schema.familySettings.familyId, familyId));
    return result[0] || undefined;
  }

  async upsertFamilySettings(settings: InsertFamilySettings): Promise<FamilySettings> {
    const existing = await this.getFamilySettings(settings.familyId);
    if (existing) {
      const result = await db.update(schema.familySettings)
        .set(settings)
        .where(eq(schema.familySettings.familyId, settings.familyId))
        .returning();
      return result[0];
    }
    const result = await db.insert(schema.familySettings).values(settings).returning();
    return result[0];
  }

  // Approval Requests
  async createApprovalRequest(insertReq: InsertApprovalRequest): Promise<ApprovalRequest> {
    const result = await db.insert(schema.approvalRequests).values(insertReq).returning();
    return result[0];
  }

  async getApprovalRequestsByFamily(familyId: number, status?: string): Promise<ApprovalRequest[]> {
    if (status) {
      return await db.select().from(schema.approvalRequests).where(and(eq(schema.approvalRequests.familyId, familyId), eq(schema.approvalRequests.status, status)));
    }
    return await db.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.familyId, familyId));
  }

  async getApprovalRequest(id: number): Promise<ApprovalRequest | undefined> {
    const result = await db.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, id));
    return result[0] || undefined;
  }

  async decideApprovalRequest(id: number, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined> {
    const result = await db.update(schema.approvalRequests)
      .set(updates)
      .where(eq(schema.approvalRequests.id, id))
      .returning();
    return result[0] || undefined;
  }

  // Allowances
  async createAllowance(insertAllowance: InsertAllowance): Promise<Allowance> {
    const result = await db.insert(schema.allowances).values(insertAllowance).returning();
    return result[0];
  }

  async getAllowancesByFamily(familyId: number): Promise<Allowance[]> {
    return await db.select().from(schema.allowances).where(eq(schema.allowances.familyId, familyId));
  }

  async getEnabledAllowances(): Promise<Allowance[]> {
    return await db.select().from(schema.allowances).where(eq(schema.allowances.enabled, true));
  }

  async updateAllowance(id: number, updates: Partial<Allowance>): Promise<Allowance | undefined> {
    const result = await db.update(schema.allowances)
      .set(updates)
      .where(eq(schema.allowances.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteAllowance(id: number): Promise<boolean> {
    const result = await db.delete(schema.allowances).where(eq(schema.allowances.id, id)).returning();
    return result.length > 0;
  }

  async createLesson(insertLesson: InsertLesson): Promise<Lesson> {
    const result = await db.insert(schema.lessons).values(insertLesson).returning();
    return result[0];
  }

  async getLessonById(id: number): Promise<Lesson | undefined> {
    const result = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id));
    return result[0];
  }

  async updateLesson(id: number, updates: Partial<Lesson>): Promise<Lesson | undefined> {
    const result = await db.update(schema.lessons).set(updates).where(eq(schema.lessons.id, id)).returning();
    return result[0];
  }

  async getLessonsByCategory(category: string): Promise<Lesson[]> {
    return await db.select().from(schema.lessons)
      .where(and(eq(schema.lessons.category, category), eq(schema.lessons.isCustom, false)));
  }

  async getCustomLessons(familyId: number): Promise<Lesson[]> {
    return await db.select().from(schema.lessons)
      .where(and(eq(schema.lessons.familyId, familyId), eq(schema.lessons.isCustom, true)));
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const result = await db.insert(schema.quizzes).values(insertQuiz).returning();
    return result[0];
  }

  async getQuizzesByLesson(lessonId: number): Promise<Quiz[]> {
    return await db.select().from(schema.quizzes).where(eq(schema.quizzes.lessonId, lessonId));
  }

  async createLearningProgress(insertProgress: InsertLearningProgress): Promise<LearningProgress> {
    const result = await db.insert(schema.learningProgress).values(insertProgress).returning();
    return result[0];
  }

  async getLearningProgress(childId: number): Promise<LearningProgress[]> {
    return await db.select().from(schema.learningProgress)
      .where(eq(schema.learningProgress.childId, childId));
  }

  async updateLearningProgress(childId: number, lessonId: number, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined> {
    const result = await db.update(schema.learningProgress)
      .set(updates)
      .where(and(
        eq(schema.learningProgress.childId, childId),
        eq(schema.learningProgress.lessonId, lessonId)
      ))
      .returning();
    return result[0] || undefined;
  }

  async createAchievement(insertAchievement: InsertAchievement): Promise<Achievement> {
    const result = await db.insert(schema.achievements).values({
      ...insertAchievement,
      earnedAt: new Date()
    }).returning();
    return result[0];
  }

  async getAchievements(childId: number): Promise<Achievement[]> {
    return await db.select().from(schema.achievements)
      .where(eq(schema.achievements.childId, childId));
  }

  // Savings Goals
  async createSavingsGoal(insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const result = await db.insert(schema.savingsGoals).values(insertGoal).returning();
    return result[0];
  }

  async getSavingsGoals(childId: number): Promise<SavingsGoal[]> {
    return await db.select().from(schema.savingsGoals)
      .where(eq(schema.savingsGoals.childId, childId));
  }

  async getSavingsGoal(id: number): Promise<SavingsGoal | undefined> {
    const result = await db.select().from(schema.savingsGoals).where(eq(schema.savingsGoals.id, id));
    return result[0] || undefined;
  }

  async updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal | undefined> {
    const result = await db.update(schema.savingsGoals)
      .set(updates)
      .where(eq(schema.savingsGoals.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteSavingsGoal(id: number): Promise<boolean> {
    const result = await db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.id, id)).returning();
    return result.length > 0;
  }

  // Spending Log
  async createSpendingLog(insertEntry: InsertSpendingLog): Promise<SpendingLog> {
    const result = await db.insert(schema.spendingLog).values(insertEntry).returning();
    return result[0];
  }

  async getSpendingLog(childId: number): Promise<SpendingLog[]> {
    return await db.select().from(schema.spendingLog)
      .where(eq(schema.spendingLog.childId, childId));
  }

  async getSpendingLogEntry(id: number): Promise<SpendingLog | undefined> {
    const result = await db.select().from(schema.spendingLog).where(eq(schema.spendingLog.id, id));
    return result[0] || undefined;
  }

  async deleteSpendingLog(id: number): Promise<boolean> {
    const result = await db.delete(schema.spendingLog).where(eq(schema.spendingLog.id, id)).returning();
    return result.length > 0;
  }

  // Donations
  async createDonation(insertDonation: InsertDonation): Promise<Donation> {
    const result = await db.insert(schema.donations).values(insertDonation).returning();
    return result[0];
  }

  async getDonations(childId: number): Promise<Donation[]> {
    return await db.select().from(schema.donations)
      .where(eq(schema.donations.childId, childId));
  }

  async getDonation(id: number): Promise<Donation | undefined> {
    const result = await db.select().from(schema.donations).where(eq(schema.donations.id, id));
    return result[0] || undefined;
  }

  async deleteDonation(id: number): Promise<boolean> {
    const result = await db.delete(schema.donations).where(eq(schema.donations.id, id)).returning();
    return result.length > 0;
  }

  // Transactions (ledger)
  async createTransaction(insertTx: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(schema.transactions).values(insertTx).returning();
    return result[0];
  }

  async getTransactions(childId: number): Promise<Transaction[]> {
    return await db.select().from(schema.transactions).where(eq(schema.transactions.childId, childId));
  }

  async createCatalogLibraryItem(insert: InsertCatalogLibrary): Promise<CatalogLibrary> {
    const result = await db.insert(schema.catalogLibrary).values({
      ...insert,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getCatalogLibrary(type?: string, categoryKey?: string): Promise<CatalogLibrary[]> {
    const conditions = [];
    if (type) conditions.push(eq(schema.catalogLibrary.catalogType, type));
    if (categoryKey) conditions.push(eq(schema.catalogLibrary.categoryKey, categoryKey));
    const query = db.select().from(schema.catalogLibrary);
    const rows = conditions.length
      ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await query;
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }

  async getCatalogLibraryItem(id: number): Promise<CatalogLibrary | undefined> {
    const result = await db.select().from(schema.catalogLibrary).where(eq(schema.catalogLibrary.id, id));
    return result[0] || undefined;
  }

  async getFamilyCatalogItems(
    familyId: number,
    type: string,
    opts?: { categoryId?: number; categoryKey?: string; enabledOnly?: boolean },
  ): Promise<FamilyCatalogItem[]> {
    const conditions = [
      eq(schema.familyCatalogItems.familyId, familyId),
      eq(schema.familyCatalogItems.catalogType, type),
    ];
    if (opts?.categoryId != null) conditions.push(eq(schema.familyCatalogItems.categoryId, opts.categoryId));
    if (opts?.categoryKey) conditions.push(eq(schema.familyCatalogItems.categoryKey, opts.categoryKey));
    if (opts?.enabledOnly) conditions.push(eq(schema.familyCatalogItems.enabled, true));

    const rows = await db.select().from(schema.familyCatalogItems).where(and(...conditions));
    return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getFamilyCatalogItem(id: number): Promise<FamilyCatalogItem | undefined> {
    const result = await db.select().from(schema.familyCatalogItems).where(eq(schema.familyCatalogItems.id, id));
    return result[0] || undefined;
  }

  async createFamilyCatalogItem(insert: InsertFamilyCatalogItem): Promise<FamilyCatalogItem> {
    const result = await db.insert(schema.familyCatalogItems).values({
      ...insert,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateFamilyCatalogItem(id: number, updates: Partial<FamilyCatalogItem>): Promise<FamilyCatalogItem | undefined> {
    const result = await db.update(schema.familyCatalogItems)
      .set(updates)
      .where(eq(schema.familyCatalogItems.id, id))
      .returning();
    return result[0] || undefined;
  }

  async deleteFamilyCatalogItem(id: number): Promise<boolean> {
    const result = await db.delete(schema.familyCatalogItems).where(eq(schema.familyCatalogItems.id, id)).returning();
    return result.length > 0;
  }

  async getAppSettings(key: string): Promise<schema.AppSettings | undefined> {
    const result = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key));
    return result[0];
  }

  async upsertAppSettings(key: string, value: string): Promise<schema.AppSettings> {
    const existing = await this.getAppSettings(key);
    if (existing) {
      const result = await db.update(schema.appSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(schema.appSettings.key, key))
        .returning();
      return result[0];
    }
    const result = await db.insert(schema.appSettings).values({ key, value }).returning();
    return result[0];
  }
}