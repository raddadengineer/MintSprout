import { eq, and } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { IStorage } from "./storage";
import {
  User, Family, Child, Job, Payment, AllocationSettings,
  Lesson, Quiz, LearningProgress, Achievement,
  InsertUser, InsertFamily, InsertChild, InsertJob, InsertPayment,
  InsertAllocationSettings, InsertLesson, InsertQuiz,
  InsertLearningProgress, InsertAchievement
} from "@shared/schema";
import bcrypt from "bcrypt";

export class PostgresStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(schema.users).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    return result[0];
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
    return result.rowCount > 0;
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
    
    // Get payments for all children in the family
    const payments = await db.select().from(schema.payments);
    return payments.filter(payment => childIds.includes(payment.childId));
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

  async createLesson(insertLesson: InsertLesson): Promise<Lesson> {
    const result = await db.insert(schema.lessons).values(insertLesson).returning();
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
}