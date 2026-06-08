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

    // Create parent account only — children are added by parents in the app
    await db.insert(schema.users).values({
      username: "parent",
      password: hashedPassword,
      role: "parent",
      familyId: family.id,
      name: "Parent",
      age: null
    });

    const defaultLessons = [
      {
        category: "earning" as const,
        title: "How to Earn Money",
        content: "Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!",
        videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
      },
      {
        category: "saving" as const,
        title: "Why Save Money?",
        content: "Saving money means keeping some of your earnings for later. It's like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.",
        videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
      },
      {
        category: "spending" as const,
        title: "Smart Spending",
        content: "Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!",
        videoUrl: "https://www.youtube.com/embed/6OAqNtueu0U",
      },
      {
        category: "investing" as const,
        title: "Growing Your Money",
        content: "Investing is like planting a money tree! When you invest, you put your money to work so it can grow over time. The earlier you start, the more your money can grow!",
        videoUrl: "https://www.youtube.com/embed/jTW777ENc3c",
      },
      {
        category: "donating" as const,
        title: "Sharing is Caring",
        content: "Donating means giving some of your money to help others. It feels good to help people in need and makes the world a better place!",
        videoUrl: "https://www.youtube.com/embed/BbYRAK_eCvo",
      },
    ];

    const insertedLessons = await db.insert(schema.lessons).values(
      defaultLessons.map((l) => ({
        ...l,
        isCustom: false,
        familyId: null,
      })),
    ).returning();

    const { DEFAULT_LESSON_QUIZZES } = await import("@shared/catalog/lesson-quizzes");
    for (const lesson of insertedLessons) {
      const stubs = DEFAULT_LESSON_QUIZZES[lesson.title] ?? [];
      for (const stub of stubs) {
        await db.insert(schema.quizzes).values({
          lessonId: lesson.id,
          question: stub.question,
          options: stub.options,
          correctAnswer: stub.correctAnswer,
        });
      }
    }

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

    console.log("✅ Database initialized successfully!");
    console.log("Parent account: username `parent`, password `password123` — add children from Family in the app.");

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}