import { db, testConnection } from "./db";
import * as schema from "@shared/schema";
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

    // Create demo family
    const [family] = await db.insert(schema.families).values({
      name: "Demo Family"
    }).returning();

    // Hash password for demo users
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Create demo users
    const [parentUser] = await db.insert(schema.users).values({
      username: "parent",
      password: hashedPassword,
      role: "parent",
      familyId: family.id,
      name: "Demo Parent",
      age: null
    }).returning();

    const [emmaUser] = await db.insert(schema.users).values({
      username: "emma",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Emma",
      age: 8
    }).returning();

    const [jakeUser] = await db.insert(schema.users).values({
      username: "jake",
      password: hashedPassword,
      role: "child",
      familyId: family.id,
      name: "Jake",
      age: 12
    }).returning();

    // Create child records
    const [emma] = await db.insert(schema.children).values({
      userId: emmaUser.id,
      familyId: family.id,
      name: "Emma",
      age: 8,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    }).returning();

    const [jake] = await db.insert(schema.children).values({
      userId: jakeUser.id,
      familyId: family.id,
      name: "Jake",
      age: 12,
      totalEarned: "0.00",
      completedJobs: 0,
      learningStreak: 0
    }).returning();

    // Create allocation settings
    await db.insert(schema.allocationSettings).values([
      {
        childId: emma.id,
        spendingPercentage: 20,
        savingsPercentage: 30,
        rothIraPercentage: 25,
        brokeragePercentage: 25
      },
      {
        childId: jake.id,
        spendingPercentage: 20,
        savingsPercentage: 30,
        rothIraPercentage: 25,
        brokeragePercentage: 25
      }
    ]);

    // Create demo lessons
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

    // Create some demo jobs
    await db.insert(schema.jobs).values([
      {
        title: "Clean Your Room",
        description: "Organize toys, make bed, and vacuum floor",
        amount: "5.00",
        status: "assigned",
        recurrence: "weekly",
        assignedToId: emma.id,
        familyId: family.id,
        createdAt: new Date()
      },
      {
        title: "Take Out Trash",
        description: "Collect trash from all rooms and take to curb",
        amount: "3.00",
        status: "assigned",
        recurrence: "weekly",
        assignedToId: jake.id,
        familyId: family.id,
        createdAt: new Date()
      }
    ]);

    console.log("✅ Database initialized successfully!");
    console.log("🔐 Demo login credentials:");
    console.log("   Parent: username 'parent', password 'password123'");
    console.log("   Child: username 'emma', password 'password123'");
    console.log("   Child: username 'jake', password 'password123'");

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}