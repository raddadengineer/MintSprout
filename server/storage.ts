import {
  families, users, children, jobCategories, jobs, payments, allocationSettings, accountTypes, familySettings, approvalRequests, allowances, lessons, quizzes, learningProgress, achievements, savingsGoals, spendingLog, donations, transactions, catalogLibrary, familyCatalogItems,
  type Family, type User, type Child, type JobCategory, type Job, type Payment, type AllocationSettings, type AccountTypes, type FamilySettings, type ApprovalRequest, type Allowance, type Lesson, type Quiz, type LearningProgress, type Achievement, type SavingsGoal, type SpendingLog, type Donation, type Transaction, type CatalogLibrary, type FamilyCatalogItem,
  type InsertFamily, type InsertUser, type InsertChild, type InsertJobCategory, type InsertJob, type InsertPayment, type InsertAllocationSettings, type InsertAccountTypes, type InsertFamilySettings, type InsertApprovalRequest, type InsertAllowance, type InsertLesson, type InsertQuiz, type InsertLearningProgress, type InsertAchievement, type InsertSavingsGoal, type InsertSpendingLog, type InsertDonation, type InsertTransaction, type InsertCatalogLibrary, type InsertFamilyCatalogItem
} from "@shared/schema";
import bcrypt from "bcrypt";

export interface IStorage {
  // Auth
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
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

  // Job Categories
  createJobCategory(category: InsertJobCategory): Promise<JobCategory>;
  getJobCategoriesByFamily(familyId: number, opts?: { includeDisabled?: boolean }): Promise<JobCategory[]>;
  getJobCategory(id: number): Promise<JobCategory | undefined>;
  updateJobCategory(id: number, updates: Partial<JobCategory>): Promise<JobCategory | undefined>;
  deleteJobCategory(id: number): Promise<boolean>;
  countJobsInCategory(categoryId: number): Promise<number>;

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

  // Family Settings
  getFamilySettings(familyId: number): Promise<FamilySettings | undefined>;
  upsertFamilySettings(settings: InsertFamilySettings): Promise<FamilySettings>;

  // Approval Requests
  createApprovalRequest(req: InsertApprovalRequest): Promise<ApprovalRequest>;
  getApprovalRequestsByFamily(familyId: number, status?: string): Promise<ApprovalRequest[]>;
  getApprovalRequest(id: number): Promise<ApprovalRequest | undefined>;
  decideApprovalRequest(id: number, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined>;

  // Allowances
  createAllowance(allowance: InsertAllowance): Promise<Allowance>;
  getAllowancesByFamily(familyId: number): Promise<Allowance[]>;
  getEnabledAllowances(): Promise<Allowance[]>;
  updateAllowance(id: number, updates: Partial<Allowance>): Promise<Allowance | undefined>;
  deleteAllowance(id: number): Promise<boolean>;

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

  // Savings Goals
  createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal>;
  getSavingsGoals(childId: number): Promise<SavingsGoal[]>;
  getSavingsGoal(id: number): Promise<SavingsGoal | undefined>;
  updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal | undefined>;
  deleteSavingsGoal(id: number): Promise<boolean>;

  // Spending Log
  createSpendingLog(entry: InsertSpendingLog): Promise<SpendingLog>;
  getSpendingLog(childId: number): Promise<SpendingLog[]>;
  getSpendingLogEntry(id: number): Promise<SpendingLog | undefined>;
  deleteSpendingLog(id: number): Promise<boolean>;

  // Donations
  createDonation(donation: InsertDonation): Promise<Donation>;
  getDonations(childId: number): Promise<Donation[]>;
  getDonation(id: number): Promise<Donation | undefined>;
  deleteDonation(id: number): Promise<boolean>;

  // Transactions (ledger)
  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  getTransactions(childId: number): Promise<Transaction[]>;

  // Catalog
  createCatalogLibraryItem(item: InsertCatalogLibrary): Promise<CatalogLibrary>;
  getCatalogLibrary(type?: string, categoryKey?: string): Promise<CatalogLibrary[]>;
  getCatalogLibraryItem(id: number): Promise<CatalogLibrary | undefined>;
  getFamilyCatalogItems(
    familyId: number,
    type: string,
    opts?: { categoryId?: number; categoryKey?: string; enabledOnly?: boolean },
  ): Promise<FamilyCatalogItem[]>;
  getFamilyCatalogItem(id: number): Promise<FamilyCatalogItem | undefined>;
  createFamilyCatalogItem(item: InsertFamilyCatalogItem): Promise<FamilyCatalogItem>;
  updateFamilyCatalogItem(id: number, updates: Partial<FamilyCatalogItem>): Promise<FamilyCatalogItem | undefined>;
  deleteFamilyCatalogItem(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private families: Map<number, Family> = new Map();
  private users: Map<number, User> = new Map();
  private children: Map<number, Child> = new Map();
  private jobCategories: Map<number, JobCategory> = new Map();
  private jobs: Map<number, Job> = new Map();
  private payments: Map<number, Payment> = new Map();
  private allocationSettings: Map<number, AllocationSettings> = new Map();
  private accountTypes: Map<number, AccountTypes> = new Map();
  private familySettings: Map<number, FamilySettings> = new Map();
  private approvalRequests: Map<number, ApprovalRequest> = new Map();
  private allowances: Map<number, Allowance> = new Map();
  private lessons: Map<number, Lesson> = new Map();
  private quizzes: Map<number, Quiz> = new Map();
  private learningProgress: Map<string, LearningProgress> = new Map();
  private achievements: Map<number, Achievement> = new Map();
  private savingsGoals: Map<number, SavingsGoal> = new Map();
  private spendingLog: Map<number, SpendingLog> = new Map();
  private donations: Map<number, Donation> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  private catalogLibraryItems: Map<number, CatalogLibrary> = new Map();
  private familyCatalogItemsMap: Map<number, FamilyCatalogItem> = new Map();
  private currentCatalogLibraryId = 1;
  private currentFamilyCatalogItemId = 1;

  private currentFamilyId = 1;
  private currentUserId = 1;
  private currentChildId = 1;
  private currentJobCategoryId = 1;
  private currentJobId = 1;
  private currentPaymentId = 1;
  private currentAllocationId = 1;
  private currentAccountTypesId = 1;
  private currentFamilySettingsId = 1;
  private currentApprovalRequestId = 1;
  private currentAllowanceId = 1;
  private currentLessonId = 1;
  private currentQuizId = 1;
  private currentProgressId = 1;
  private currentAchievementId = 1;
  private currentSavingsGoalId = 1;
  private currentSpendingLogId = 1;
  private currentDonationId = 1;
  private currentTransactionId = 1;

  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default family
    const family = await this.createFamily({ name: "Our Family" });

    // Create parent user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const parent = await this.createUser({
      username: "parent",
      password: hashedPassword,
      role: "parent",
      familyId: family.id,
      name: "Parent",
      age: undefined
    });

    // Create child users and profiles
    const childUser1 = await this.createUser({
      username: "bryson",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Bryson",
      age: 10
    });

    const childUser2 = await this.createUser({
      username: "edison",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Edison",
      age: 5
    });

    const child1 = await this.createChild({
      userId: childUser1.id,
      familyId: family.id,
      name: "Bryson",
      age: 10
    });

    const child2 = await this.createChild({
      userId: childUser2.id,
      familyId: family.id,
      name: "Edison",
      age: 5
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

    // Create default lessons + quizzes
    const lesson1 = await this.createLesson({
      category: "earning",
      title: "How to Earn Money",
      content: "Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!",
      videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
      isCustom: false,
      familyId: undefined
    });
    await this.createQuiz({ lessonId: lesson1.id, question: "What does it mean to EARN money?", options: ["Finding money on the ground", "Getting money for doing work or a job", "Borrowing money from a friend", "Printing your own money"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson1.id, question: "Which is a good example of earning money?", options: ["Wishing for money", "Doing your chores to get your allowance", "Taking money without asking", "Winning a prize every day"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson1.id, question: "Why is earning money important?", options: ["So you can buy everything you see", "So you never have to go to school", "So you can pay for things you need and save for goals", "So adults leave you alone"], correctAnswer: 2 });

    const lesson2 = await this.createLesson({
      category: "saving",
      title: "Why Save Money?",
      content: "Saving money means keeping some of your earnings for later. It's like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.",
      videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
      isCustom: false,
      familyId: undefined
    });
    await this.createQuiz({ lessonId: lesson2.id, question: "What does saving money mean?", options: ["Spending all your money right away", "Keeping some money for later", "Giving all your money away", "Hiding money under your bed forever"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson2.id, question: "If Bryson earns $10 and saves $3, how much did he save?", options: ["$10", "$7", "$3", "$13"], correctAnswer: 2 });
    await this.createQuiz({ lessonId: lesson2.id, question: "Which is the BEST reason to save money?", options: ["To never spend any money again", "So you can buy something special you want later", "To make your piggy bank look full", "Because adults told you to"], correctAnswer: 1 });

    const lesson3 = await this.createLesson({
      category: "spending",
      title: "Smart Spending",
      content: "Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!",
      videoUrl: "https://www.youtube.com/embed/6OAqNtueu0U",
      isCustom: false,
      familyId: undefined
    });
    await this.createQuiz({ lessonId: lesson3.id, question: "What is the difference between a NEED and a WANT?", options: ["They are exactly the same thing", "A need is something required to live; a want is something extra", "A want is more important than a need", "Needs cost more than wants"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson3.id, question: "Which is a NEED?", options: ["A new video game", "A pair of shoes to wear to school", "A toy from the store", "A second bicycle"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson3.id, question: "Edison has $5. A snack costs $2 and a toy costs $6. What should Edison do first?", options: ["Buy the toy by borrowing money", "Buy the snack since he can afford it", "Spend nothing and keep all $5", "Ask for more money immediately"], correctAnswer: 1 });

    const lesson4 = await this.createLesson({
      category: "investing",
      title: "Growing Your Money",
      content: "Investing is like planting a money tree! When you invest, you put your money to work so it can grow over time. The earlier you start, the more your money can grow!",
      videoUrl: "https://www.youtube.com/embed/jTW777ENc3c",
      isCustom: false,
      familyId: undefined
    });
    await this.createQuiz({ lessonId: lesson4.id, question: "What does investing mean?", options: ["Spending all your money at once", "Putting money to work so it can grow over time", "Giving money to a friend to hold", "Spending money on food"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson4.id, question: "Why is it better to start investing EARLY?", options: ["Because you get a trophy", "Because the earlier you start, the more time your money has to grow", "Because older people are not allowed to invest", "It does not matter when you start"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson4.id, question: "Investing is like…", options: ["Throwing money in a trash can", "Planting a seed that grows into a tree", "Spending money at the store", "Keeping money under your mattress"], correctAnswer: 1 });

    const lesson5 = await this.createLesson({
      category: "donating",
      title: "Sharing is Caring",
      content: "Donating means giving some of your money to help others. It feels good to help people in need and makes the world a better place!",
      videoUrl: "https://www.youtube.com/embed/BbYRAK_eCvo",
      isCustom: false,
      familyId: undefined
    });
    await this.createQuiz({ lessonId: lesson5.id, question: "What does it mean to donate?", options: ["To loan money and expect it back", "To give some of your money or things to help others", "To spend money on yourself", "To save money in a bank"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson5.id, question: "Why do people donate to charity?", options: ["To get more allowance", "To help others and make the world a better place", "Because they have too much money", "To buy things for themselves"], correctAnswer: 1 });
    await this.createQuiz({ lessonId: lesson5.id, question: "Which of these is a way to donate?", options: ["Spending money on candy", "Giving food to a food bank", "Buying the newest game", "Saving money for a bike"], correctAnswer: 1 });
  }


  // Auth methods
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, age: insertUser.age ?? null };
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
      spendingBalance: insertChild.spendingBalance ?? null,
      savingsBalance: insertChild.savingsBalance ?? null,
      rothIraBalance: insertChild.rothIraBalance ?? null,
      brokerageBalance: insertChild.brokerageBalance ?? null,
      completedJobs: 0,
      learningStreak: 0,
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

  async createJobCategory(insert: InsertJobCategory): Promise<JobCategory> {
    const id = this.currentJobCategoryId++;
    const category: JobCategory = {
      ...insert,
      id,
      slug: insert.slug ?? null,
      description: insert.description ?? null,
      icon: insert.icon ?? "briefcase",
      sortOrder: insert.sortOrder ?? 0,
      enabled: insert.enabled ?? true,
      paymentMode: insert.paymentMode ?? "none",
      createdAt: new Date(),
    };
    this.jobCategories.set(id, category);
    return category;
  }

  async getJobCategoriesByFamily(familyId: number, opts?: { includeDisabled?: boolean }): Promise<JobCategory[]> {
    let list = Array.from(this.jobCategories.values()).filter((c) => c.familyId === familyId);
    if (!opts?.includeDisabled) list = list.filter((c) => c.enabled);
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getJobCategory(id: number): Promise<JobCategory | undefined> {
    return this.jobCategories.get(id);
  }

  async updateJobCategory(id: number, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    const cat = this.jobCategories.get(id);
    if (!cat) return undefined;
    const updated = { ...cat, ...updates };
    this.jobCategories.set(id, updated);
    return updated;
  }

  async deleteJobCategory(id: number): Promise<boolean> {
    return this.jobCategories.delete(id);
  }

  async countJobsInCategory(categoryId: number): Promise<number> {
    return Array.from(this.jobs.values()).filter((j) => j.categoryId === categoryId).length;
  }

  // Job methods
  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = this.currentJobId++;
    const job: Job = {
      ...insertJob,
      id,
      description: insertJob.description ?? null,
      icon: insertJob.icon ?? null,
      categoryId: insertJob.categoryId ?? null,
      allowanceId: (insertJob as any).allowanceId ?? null,
      isFamilyDuty: (insertJob as any).isFamilyDuty ?? false,
      createdAt: new Date(),
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
    const settings: AllocationSettings = {
      ...insertSettings,
      id,
      spendingPercentage: insertSettings.spendingPercentage ?? null,
      savingsPercentage: insertSettings.savingsPercentage ?? null,
      rothIraPercentage: insertSettings.rothIraPercentage ?? null,
      brokeragePercentage: insertSettings.brokeragePercentage ?? null,
    };
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
    const accountTypes: AccountTypes = {
      ...insertAccountTypes,
      id,
      spendingEnabled: insertAccountTypes.spendingEnabled ?? null,
      savingsEnabled: insertAccountTypes.savingsEnabled ?? null,
      rothIraEnabled: insertAccountTypes.rothIraEnabled ?? null,
      brokerageEnabled: insertAccountTypes.brokerageEnabled ?? null,
    };
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

  // Family Settings
  async getFamilySettings(familyId: number): Promise<FamilySettings | undefined> {
    return Array.from(this.familySettings.values()).find(s => s.familyId === familyId);
  }

  async upsertFamilySettings(settings: InsertFamilySettings): Promise<FamilySettings> {
    const existing = await this.getFamilySettings(settings.familyId);
    if (existing) {
      const updated = { ...existing, ...settings };
      this.familySettings.set(existing.id, updated);
      return updated;
    }
    const id = this.currentFamilySettingsId++;
    const created: FamilySettings = {
      ...settings,
      id,
      requireSpendingApproval: settings.requireSpendingApproval ?? null,
      requireDonationApproval: settings.requireDonationApproval ?? null,
      requireGoalFundingApproval: settings.requireGoalFundingApproval ?? null,
    };
    this.familySettings.set(id, created);
    return created;
  }

  // Approval Requests
  async createApprovalRequest(insertReq: InsertApprovalRequest): Promise<ApprovalRequest> {
    const id = this.currentApprovalRequestId++;
    const req: ApprovalRequest = {
      ...insertReq,
      id,
      status: insertReq.status ?? "pending",
      decidedByUserId: insertReq.decidedByUserId ?? null,
      createdAt: new Date(),
      decidedAt: null,
    };
    this.approvalRequests.set(id, req);
    return req;
  }

  async getApprovalRequestsByFamily(familyId: number, status?: string): Promise<ApprovalRequest[]> {
    return Array.from(this.approvalRequests.values()).filter(r => r.familyId === familyId && (!status || r.status === status));
  }

  async getApprovalRequest(id: number): Promise<ApprovalRequest | undefined> {
    return this.approvalRequests.get(id);
  }

  async decideApprovalRequest(id: number, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined> {
    const existing = this.approvalRequests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.approvalRequests.set(id, updated);
    return updated;
  }

  // Allowances
  async createAllowance(insertAllowance: InsertAllowance): Promise<Allowance> {
    const id = this.currentAllowanceId++;
    const allowance: Allowance = {
      ...insertAllowance,
      guaranteedMinimum: (insertAllowance as any).guaranteedMinimum ?? "0.00",
      penaltyPerIncompleteJob: (insertAllowance as any).penaltyPerIncompleteJob ?? "0.00",
      id,
      dayOfWeek: insertAllowance.dayOfWeek ?? null,
      dayOfMonth: insertAllowance.dayOfMonth ?? null,
      enabled: insertAllowance.enabled ?? true,
      createdAt: new Date(),
      lastRunAt: null,
    };
    this.allowances.set(id, allowance);
    return allowance;
  }

  async getAllowancesByFamily(familyId: number): Promise<Allowance[]> {
    return Array.from(this.allowances.values()).filter(a => a.familyId === familyId);
  }

  async getEnabledAllowances(): Promise<Allowance[]> {
    return Array.from(this.allowances.values()).filter(a => a.enabled);
  }

  async updateAllowance(id: number, updates: Partial<Allowance>): Promise<Allowance | undefined> {
    const existing = this.allowances.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.allowances.set(id, updated);
    return updated;
  }

  async deleteAllowance(id: number): Promise<boolean> {
    return this.allowances.delete(id);
  }

  // Lesson methods
  async createLesson(insertLesson: InsertLesson): Promise<Lesson> {
    const id = this.currentLessonId++;
    const lesson: Lesson = {
      ...insertLesson,
      id,
      familyId: insertLesson.familyId ?? null,
      videoUrl: insertLesson.videoUrl ?? null,
      isCustom: insertLesson.isCustom ?? null,
    };
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
    const progress: LearningProgress = {
      ...insertProgress,
      id,
      completed: insertProgress.completed ?? null,
      quizScore: insertProgress.quizScore ?? null,
    };
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

  // Savings Goals
  async createSavingsGoal(insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const id = this.currentSavingsGoalId++;
    const goal: SavingsGoal = { ...insertGoal, id, currentAmount: insertGoal.currentAmount ?? "0.00", completed: false, createdAt: new Date(), deadline: insertGoal.deadline ?? null };
    this.savingsGoals.set(id, goal);
    return goal;
  }

  async getSavingsGoals(childId: number): Promise<SavingsGoal[]> {
    return Array.from(this.savingsGoals.values()).filter(g => g.childId === childId);
  }

  async getSavingsGoal(id: number): Promise<SavingsGoal | undefined> {
    return this.savingsGoals.get(id);
  }

  async updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal | undefined> {
    const goal = this.savingsGoals.get(id);
    if (!goal) return undefined;
    const updated = { ...goal, ...updates };
    this.savingsGoals.set(id, updated);
    return updated;
  }

  async deleteSavingsGoal(id: number): Promise<boolean> {
    return this.savingsGoals.delete(id);
  }

  // Spending Log
  async createSpendingLog(insertEntry: InsertSpendingLog): Promise<SpendingLog> {
    const id = this.currentSpendingLogId++;
    const entry: SpendingLog = { ...insertEntry, id, createdAt: new Date() };
    this.spendingLog.set(id, entry);
    return entry;
  }

  async getSpendingLog(childId: number): Promise<SpendingLog[]> {
    return Array.from(this.spendingLog.values()).filter(e => e.childId === childId);
  }

  async getSpendingLogEntry(id: number): Promise<SpendingLog | undefined> {
    return this.spendingLog.get(id);
  }

  async deleteSpendingLog(id: number): Promise<boolean> {
    return this.spendingLog.delete(id);
  }

  // Donations
  async createDonation(insertDonation: InsertDonation): Promise<Donation> {
    const id = this.currentDonationId++;
    const donation: Donation = { ...insertDonation, id, createdAt: new Date() };
    this.donations.set(id, donation);
    return donation;
  }

  async getDonations(childId: number): Promise<Donation[]> {
    return Array.from(this.donations.values()).filter(d => d.childId === childId);
  }

  async getDonation(id: number): Promise<Donation | undefined> {
    return this.donations.get(id);
  }

  async deleteDonation(id: number): Promise<boolean> {
    return this.donations.delete(id);
  }

  // Transactions (ledger)
  async createTransaction(insertTx: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const tx: Transaction = {
      ...insertTx,
      id,
      fromAccount: insertTx.fromAccount ?? null,
      toAccount: insertTx.toAccount ?? null,
      note: insertTx.note ?? null,
      createdAt: new Date(),
    };
    this.transactions.set(id, tx);
    return tx;
  }

  async getTransactions(childId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(t => t.childId === childId);
  }

  async createCatalogLibraryItem(insert: InsertCatalogLibrary): Promise<CatalogLibrary> {
    const id = this.currentCatalogLibraryId++;
    const item: CatalogLibrary = {
      ...insert,
      id,
      description: insert.description ?? null,
      source: insert.source ?? "builtin",
      createdAt: new Date(),
    };
    this.catalogLibraryItems.set(id, item);
    return item;
  }

  async getCatalogLibrary(type?: string, categoryKey?: string): Promise<CatalogLibrary[]> {
    let list = Array.from(this.catalogLibraryItems.values());
    if (type) list = list.filter((i) => i.catalogType === type);
    if (categoryKey) list = list.filter((i) => i.categoryKey === categoryKey);
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }

  async getCatalogLibraryItem(id: number): Promise<CatalogLibrary | undefined> {
    return this.catalogLibraryItems.get(id);
  }

  async getFamilyCatalogItems(
    familyId: number,
    type: string,
    opts?: { categoryId?: number; categoryKey?: string; enabledOnly?: boolean },
  ): Promise<FamilyCatalogItem[]> {
    let list = Array.from(this.familyCatalogItemsMap.values()).filter(
      (i) => i.familyId === familyId && i.catalogType === type,
    );
    if (opts?.categoryId != null) list = list.filter((i) => i.categoryId === opts.categoryId);
    if (opts?.categoryKey) list = list.filter((i) => i.categoryKey === opts.categoryKey);
    if (opts?.enabledOnly) list = list.filter((i) => i.enabled);
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async getFamilyCatalogItem(id: number): Promise<FamilyCatalogItem | undefined> {
    return this.familyCatalogItemsMap.get(id);
  }

  async createFamilyCatalogItem(insert: InsertFamilyCatalogItem): Promise<FamilyCatalogItem> {
    const id = this.currentFamilyCatalogItemId++;
    const item: FamilyCatalogItem = {
      ...insert,
      id,
      categoryId: insert.categoryId ?? null,
      libraryItemId: insert.libraryItemId ?? null,
      description: insert.description ?? null,
      enabled: insert.enabled ?? true,
      sortOrder: insert.sortOrder ?? 0,
      publishedLessonId: insert.publishedLessonId ?? null,
      createdAt: new Date(),
    };
    this.familyCatalogItemsMap.set(id, item);
    return item;
  }

  async updateFamilyCatalogItem(id: number, updates: Partial<FamilyCatalogItem>): Promise<FamilyCatalogItem | undefined> {
    const item = this.familyCatalogItemsMap.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.familyCatalogItemsMap.set(id, updated);
    return updated;
  }

  async deleteFamilyCatalogItem(id: number): Promise<boolean> {
    return this.familyCatalogItemsMap.delete(id);
  }
}

import { PostgresStorage } from "./postgres-storage";

// Use PostgreSQL storage in production or when DATABASE_URL is set, otherwise use in-memory storage for development
export const storage = (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) ? new PostgresStorage() : new MemStorage();
