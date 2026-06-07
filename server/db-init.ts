import { db, testConnection } from "./db";
import * as schema from "@shared/schema";
import { DEFAULT_JOB_CATEGORIES } from "@shared/job-categories";
import bcrypt from "bcrypt";

export async function initializeDatabase() {
  try {
    console.log("🔄 Initializing database...");

    // Wait for database to be ready (important for Docker containers)
    let retries = 10;
    let connected = false;

    while (retries > 0 && !connected) {
      connected = await testConnection();
      if (!connected) {
        console.log(`⏳ Waiting for database... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    }

    if (!connected) {
      throw new Error("Database connection failed after multiple attempts");
    }

    // Check if data already exists
    const existingFamilies = await db.select().from(schema.families);
    if (existingFamilies.length > 0) {
      console.log("✅ Database already initialized");
      return;
    }

    // Create initial family
    const [family] = await db.insert(schema.families).values({
      name: "Our Family"
    }).returning();

    // Hash password for default users
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create default users
    const [parentUser] = await db.insert(schema.users).values({
      username: "parent",
      password: hashedPassword,
      role: "parent",
      familyId: family.id,
      name: "Parent",
      age: null
    }).returning();

    const [brysonUser] = await db.insert(schema.users).values({
      username: "bryson",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Bryson",
      age: 10
    }).returning();

    const [edisonUser] = await db.insert(schema.users).values({
      username: "edison",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Edison",
      age: 5
    }).returning();

    // Create child records
    const [bryson] = await db.insert(schema.children).values({
      userId: brysonUser.id,
      familyId: family.id,
      name: "Bryson",
      age: 10,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    }).returning();

    const [edison] = await db.insert(schema.children).values({
      userId: edisonUser.id,
      familyId: family.id,
      name: "Edison",
      age: 5,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    }).returning();

    // Create allocation settings
    await db.insert(schema.allocationSettings).values([
      {
        childId: bryson.id,
        spendingPercentage: 20,
        savingsPercentage: 30,
        rothIraPercentage: 25,
        brokeragePercentage: 25
      },
      {
        childId: edison.id,
        spendingPercentage: 20,
        savingsPercentage: 30,
        rothIraPercentage: 25,
        brokeragePercentage: 25
      }
    ]);

    // Create default lessons
    await db.insert(schema.lessons).values([
      {
        category: "earning",
        title: "How to Earn Money",
        content: "Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        isCustom: false,
        familyId: null
      },
      {
        category: "saving",
        title: "Why Save Money?",
        content: "Saving money means keeping some of your earnings for later. It's like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        isCustom: false,
        familyId: null
      },
      {
        category: "spending",
        title: "Smart Spending",
        content: "Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        isCustom: false,
        familyId: null
      },
      {
        category: "investing",
        title: "Growing Your Money",
        content: "Investing is like planting a money tree! When you invest, you put your money to work so it can grow over time. The earlier you start, the more your money can grow!",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        isCustom: false,
        familyId: null
      },
      {
        category: "donating",
        title: "Sharing is Caring",
        content: "Donating means giving some of your money to help others. It feels good to help people in need and makes the world a better place!",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        isCustom: false,
        familyId: null
      }
    ]);

    const seededCategories = [];
    for (const seed of DEFAULT_JOB_CATEGORIES) {
      const [cat] = await db.insert(schema.jobCategories).values({
        familyId: family.id,
        slug: seed.slug,
        label: seed.label,
        description: seed.description,
        icon: seed.icon,
        sortOrder: seed.sortOrder,
        enabled: true,
        paymentMode: seed.paymentMode,
      }).returning();
      seededCategories.push(cat);
    }
    const selfCareCat = seededCategories.find((c) => c.label === "Take Care of Yourself");
    const allowanceCat = seededCategories.find((c) => c.label === "Earn Your Allowance");

    // Create initial jobs
    await db.insert(schema.jobs).values([
      {
        title: "Clean Your Room",
        description: "Organize toys, make bed, and vacuum floor",
        amount: "5.00",
        status: "assigned",
        recurrence: "weekly",
        assignedToId: bryson.id,
        familyId: family.id,
        categoryId: selfCareCat?.id,
        isFamilyDuty: true,
        createdAt: new Date()
      },
      {
        title: "Take Out Trash",
        description: "Collect trash from all rooms and take to curb",
        amount: "3.00",
        status: "assigned",
        recurrence: "weekly",
        assignedToId: edison.id,
        familyId: family.id,
        categoryId: allowanceCat?.id,
        createdAt: new Date()
      }
    ]);

    console.log("✅ Database initialized successfully!");
    console.log("Initial accounts created (see README for usernames).");

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}