import {
  families, users, children, jobs, payments, allocationSettings, accountTypes, lessons, quizzes, learningProgress, achievements,
  type Family, type User, type Child, type Job, type Payment, type AllocationSettings, type AccountTypes, type Lesson, type Quiz, type LearningProgress, type Achievement,
  type InsertFamily, type InsertUser, type InsertChild, type InsertJob, type InsertPayment, type InsertAllocationSettings, type InsertAccountTypes, type InsertLesson, type InsertQuiz, type InsertLearningProgress, type InsertAchievement
} from "@shared/schema";
import bcrypt from "bcrypt";

export interface IStorage {
  // Auth
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Families
  createFamily(family: InsertFamily): Promise<Family>;
  getFamily(id: number): Promise<Family | undefined>;
  
  // Children
  createChild(child: InsertChild): Promise<Child>;
  getChildrenByFamily(familyId: number): Promise<Child[]>;
  getChild(id: number): Promise<Child | undefined>;
  updateChild(id: number, updates: Partial<Child>): Promise<Child | undefined>;
  deleteChild(id: number): Promise<boolean>;
  
  // Jobs
  createJob(job: InsertJob): Promise<Job>;
  getJobsByFamily(familyId: number): Promise<Job[]>;
  getJobsByChild(childId: number): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  updateJob(id: number, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: number): Promise<boolean>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByChild(childId: number): Promise<Payment[]>;
  getPaymentsByFamily(familyId: number): Promise<Payment[]>;
  updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined>;
  deletePaymentsByJob(jobId: number): Promise<boolean>;
  
  // Allocation Settings
  createAllocationSettings(settings: InsertAllocationSettings): Promise<AllocationSettings>;
  getAllocationSettings(childId: number): Promise<AllocationSettings | undefined>;
  updateAllocationSettings(childId: number, settings: Partial<AllocationSettings>): Promise<AllocationSettings | undefined>;
  
  // Account Types
  createAccountTypes(accountTypes: InsertAccountTypes): Promise<AccountTypes>;
  getAccountTypes(familyId: number): Promise<AccountTypes | undefined>;
  updateAccountTypes(familyId: number, accountTypes: Partial<AccountTypes>): Promise<AccountTypes | undefined>;
  
  // Lessons
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  getLessonsByCategory(category: string): Promise<Lesson[]>;
  getCustomLessons(familyId: number): Promise<Lesson[]>;
  
  // Quizzes
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getQuizzesByLesson(lessonId: number): Promise<Quiz[]>;
  
  // Learning Progress
  createLearningProgress(progress: InsertLearningProgress): Promise<LearningProgress>;
  getLearningProgress(childId: number): Promise<LearningProgress[]>;
  updateLearningProgress(childId: number, lessonId: number, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined>;
  
  // Achievements
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getAchievements(childId: number): Promise<Achievement[]>;
}

export class MemStorage implements IStorage {
  private families: Map<number, Family> = new Map();
  private users: Map<number, User> = new Map();
  private children: Map<number, Child> = new Map();
  private jobs: Map<number, Job> = new Map();
  private payments: Map<number, Payment> = new Map();
  private allocationSettings: Map<number, AllocationSettings> = new Map();
  private accountTypes: Map<number, AccountTypes> = new Map();
  private lessons: Map<number, Lesson> = new Map();
  private quizzes: Map<number, Quiz> = new Map();
  private learningProgress: Map<string, LearningProgress> = new Map(); // childId-lessonId as key
  private achievements: Map<number, Achievement> = new Map();
  
  private currentFamilyId = 1;
  private currentUserId = 1;
  private currentChildId = 1;
  private currentJobId = 1;
  private currentPaymentId = 1;
  private currentAllocationId = 1;
  private currentAccountTypesId = 1;
  private currentLessonId = 1;
  private currentQuizId = 1;
  private currentProgressId = 1;
  private currentAchievementId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default family
    const family = await this.createFamily({ name: "Smith Family" });
    
    // Create parent user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const parent = await this.createUser({
      username: "parent",
      password: hashedPassword,
      role: "parent",
      familyId: family.id,
      name: "Jane Smith",
      age: undefined
    });

    // Create child users and profiles
    const childUser1 = await this.createUser({
      username: "emma",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Emma",
      age: 8
    });

    const childUser2 = await this.createUser({
      username: "jake",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Jake",
      age: 12
    });

    const child1 = await this.createChild({
      userId: childUser1.id,
      familyId: family.id,
      name: "Emma",
      age: 8
    });

    const child2 = await this.createChild({
      userId: childUser2.id,
      familyId: family.id,
      name: "Jake",
      age: 12
    });

    // Create default allocation settings
    await this.createAllocationSettings({
      childId: child1.id,
      spendingPercentage: 20,
      savingsPercentage: 30,
      rothIraPercentage: 25,
      brokeragePercentage: 25
    });

    await this.createAllocationSettings({
      childId: child2.id,
      spendingPercentage: 20,
      savingsPercentage: 30,
      rothIraPercentage: 25,
      brokeragePercentage: 25
    });

    // Create default account types (basic setup - only spending and savings enabled)
    await this.createAccountTypes({
      familyId: family.id,
      spendingEnabled: true,
      savingsEnabled: true,
      rothIraEnabled: false,
      brokerageEnabled: false
    });

    // Create default lessons
    await this.createLesson({
      category: "earning",
      title: "How to Earn Money",
      content: "Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      isCustom: false,
      familyId: undefined
    });

    await this.createLesson({
      category: "saving",
      title: "Why Save Money?",
      content: "Saving money means keeping some of your earnings for later. It's like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      isCustom: false,
      familyId: undefined
    });

    await this.createLesson({
      category: "spending",
      title: "Smart Spending",
      content: "Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!",
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      isCustom: false,
      familyId: undefined
    });
  }

  // Auth methods
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Family methods
  async createFamily(insertFamily: InsertFamily): Promise<Family> {
    const id = this.currentFamilyId++;
    const family: Family = { ...insertFamily, id };
    this.families.set(id, family);
    return family;
  }

  async getFamily(id: number): Promise<Family | undefined> {
    return this.families.get(id);
  }

  // Children methods
  async createChild(insertChild: InsertChild): Promise<Child> {
    const id = this.currentChildId++;
    const child: Child = {
      ...insertChild,
      id,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    };
    this.children.set(id, child);
    return child;
  }

  async getChildrenByFamily(familyId: number): Promise<Child[]> {
    return Array.from(this.children.values()).filter(child => child.familyId === familyId);
  }

  async getChild(id: number): Promise<Child | undefined> {
    return this.children.get(id);
  }

  async updateChild(id: number, updates: Partial<Child>): Promise<Child | undefined> {
    const child = this.children.get(id);
    if (!child) return undefined;
    
    const updatedChild = { ...child, ...updates };
    this.children.set(id, updatedChild);
    return updatedChild;
  }

  async deleteChild(id: number): Promise<boolean> {
    return this.children.delete(id);
  }

  // Job methods
  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = this.currentJobId++;
    const job: Job = {
      ...insertJob,
      id,
      createdAt: new Date()
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJobsByFamily(familyId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.familyId === familyId);
  }

  async getJobsByChild(childId: number): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.assignedToId === childId);
  }

  async getJob(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: number): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Payment methods
  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = this.currentPaymentId++;
    const payment: Payment = {
      ...insertPayment,
      id,
      createdAt: new Date()
    };
    this.payments.set(id, payment);
    return payment;
  }

  async getPaymentsByChild(childId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => payment.childId === childId);
  }

  async getPaymentsByFamily(familyId: number): Promise<Payment[]> {
    const children = await this.getChildrenByFamily(familyId);
    const childIds = children.map(child => child.id);
    return Array.from(this.payments.values()).filter(payment => childIds.includes(payment.childId));
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    
    const updatedPayment = { ...payment, ...updates };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async deletePaymentsByJob(jobId: number): Promise<boolean> {
    const paymentsToDelete = Array.from(this.payments.values()).filter(payment => payment.jobId === jobId);
    paymentsToDelete.forEach(payment => this.payments.delete(payment.id));
    return paymentsToDelete.length > 0;
  }

  // Allocation settings methods
  async createAllocationSettings(insertSettings: InsertAllocationSettings): Promise<AllocationSettings> {
    const id = this.currentAllocationId++;
    const settings: AllocationSettings = { ...insertSettings, id };
    this.allocationSettings.set(id, settings);
    return settings;
  }

  async getAllocationSettings(childId: number): Promise<AllocationSettings | undefined> {
    return Array.from(this.allocationSettings.values()).find(settings => settings.childId === childId);
  }

  async updateAllocationSettings(childId: number, updates: Partial<AllocationSettings>): Promise<AllocationSettings | undefined> {
    const settings = Array.from(this.allocationSettings.values()).find(s => s.childId === childId);
    if (!settings) return undefined;
    
    const updatedSettings = { ...settings, ...updates };
    this.allocationSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }

  // Account Types methods
  async createAccountTypes(insertAccountTypes: InsertAccountTypes): Promise<AccountTypes> {
    const id = this.currentAccountTypesId++;
    const accountTypes: AccountTypes = { ...insertAccountTypes, id };
    this.accountTypes.set(id, accountTypes);
    return accountTypes;
  }

  async getAccountTypes(familyId: number): Promise<AccountTypes | undefined> {
    return Array.from(this.accountTypes.values()).find(at => at.familyId === familyId);
  }

  async updateAccountTypes(familyId: number, updates: Partial<AccountTypes>): Promise<AccountTypes | undefined> {
    const accountTypes = Array.from(this.accountTypes.values()).find(at => at.familyId === familyId);
    if (!accountTypes) return undefined;
    
    const updatedAccountTypes = { ...accountTypes, ...updates };
    this.accountTypes.set(accountTypes.id, updatedAccountTypes);
    return updatedAccountTypes;
  }

  // Lesson methods
  async createLesson(insertLesson: InsertLesson): Promise<Lesson> {
    const id = this.currentLessonId++;
    const lesson: Lesson = { ...insertLesson, id };
    this.lessons.set(id, lesson);
    return lesson;
  }

  async getLessonsByCategory(category: string): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).filter(lesson => lesson.category === category);
  }

  async getCustomLessons(familyId: number): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).filter(lesson => lesson.familyId === familyId && lesson.isCustom);
  }

  // Quiz methods
  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const id = this.currentQuizId++;
    const quiz: Quiz = { ...insertQuiz, id };
    this.quizzes.set(id, quiz);
    return quiz;
  }

  async getQuizzesByLesson(lessonId: number): Promise<Quiz[]> {
    return Array.from(this.quizzes.values()).filter(quiz => quiz.lessonId === lessonId);
  }

  // Learning progress methods
  async createLearningProgress(insertProgress: InsertLearningProgress): Promise<LearningProgress> {
    const id = this.currentProgressId++;
    const progress: LearningProgress = { ...insertProgress, id };
    const key = `${progress.childId}-${progress.lessonId}`;
    this.learningProgress.set(key, progress);
    return progress;
  }

  async getLearningProgress(childId: number): Promise<LearningProgress[]> {
    return Array.from(this.learningProgress.values()).filter(progress => progress.childId === childId);
  }

  async updateLearningProgress(childId: number, lessonId: number, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined> {
    const key = `${childId}-${lessonId}`;
    const progress = this.learningProgress.get(key);
    if (!progress) return undefined;
    
    const updatedProgress = { ...progress, ...updates };
    this.learningProgress.set(key, updatedProgress);
    return updatedProgress;
  }

  // Achievement methods
  async createAchievement(insertAchievement: InsertAchievement): Promise<Achievement> {
    const id = this.currentAchievementId++;
    const achievement: Achievement = {
      ...insertAchievement,
      id,
      earnedAt: new Date()
    };
    this.achievements.set(id, achievement);
    return achievement;
  }

  async getAchievements(childId: number): Promise<Achievement[]> {
    return Array.from(this.achievements.values()).filter(achievement => achievement.childId === childId);
  }
}

import { PostgresStorage } from "./postgres-storage";

// Use PostgreSQL storage in production or when DATABASE_URL is set, otherwise use in-memory storage for development
export const storage = (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) ? new PostgresStorage() : new MemStorage();
