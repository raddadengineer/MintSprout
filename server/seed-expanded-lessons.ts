import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";
import { DEFAULT_LESSON_QUIZZES } from "@shared/catalog/lesson-quizzes";

/** Phase 4 curriculum from init-db.sql — seeded for DBs created before lessons 6–17 existed. */
const EXPANDED_LESSONS: {
  category: "earning" | "saving" | "spending" | "investing" | "donating";
  title: string;
  content: string;
  videoUrl: string;
}[] = [
  {
    category: "earning",
    title: "Making Change — Coin Math",
    content:
      "Do you know all the coins? A penny is 1 cent, a nickel is 5 cents, a dime is 10 cents, and a quarter is 25 cents. When you earn money or buy something, you might need to count change. Practice by pretending to run your own store!",
    videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
  },
  {
    category: "saving",
    title: "Why We Save — The Magic of Goals",
    content:
      "Saving feels hard at first, but here is a trick: pick something you REALLY want. That is your goal! Every time you do a chore and earn money, put some in your savings jar. Watch it grow every week — that is the magic of saving!",
    videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
  },
  {
    category: "earning",
    title: "Earning More Ways",
    content:
      "Did you know there are many ways to earn money besides chores? You can sell lemonade, create artwork, help a neighbor, or even sell toys you no longer use. Being creative about earning money is a great skill!",
    videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
  },
  {
    category: "donating",
    title: "Giving Goals — Pick a Cause",
    content:
      "Donating means giving some of your money to help others. You can help animals at a shelter, provide food for people who are hungry, or help plant trees. Picking a cause you care about makes giving extra special!",
    videoUrl: "https://www.youtube.com/embed/BbYRAK_eCvo",
  },
  {
    category: "spending",
    title: "Comparing Prices — Be a Smart Shopper",
    content:
      "Before you buy something, look for the best deal! Two stores might sell the same toy for different prices. Comparing prices is like being a detective — you find the best deal and save money in the process!",
    videoUrl: "https://www.youtube.com/embed/6OAqNtueu0U",
  },
  {
    category: "saving",
    title: "Banking Basics — Your Money's Safe House",
    content:
      "A bank is like a super-safe house for your money. When you put money in a bank, they keep it safe AND they pay you extra money called interest! It is like getting a reward just for saving.",
    videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
  },
  {
    category: "investing",
    title: "Compound Interest — Money That Grows Itself",
    content:
      "Compound interest is one of the most powerful ideas in all of finance. If you put $100 in a savings account that earns 10% per year, after 1 year you have $110. After 2 years you have $121 — because the interest also earns interest!",
    videoUrl: "https://www.youtube.com/embed/jTW777ENc3c",
  },
  {
    category: "investing",
    title: "What is a Stock?",
    content:
      "A stock is a tiny piece of ownership in a company. If you buy one share of your favorite company, you become a part-owner! If the company does well, your share becomes more valuable.",
    videoUrl: "https://www.youtube.com/embed/p7HKvqRI_Bo",
  },
  {
    category: "spending",
    title: "The 50/30/20 Rule",
    content:
      "The 50/30/20 rule is a simple budget guide: put 50% of your income toward needs, 30% toward wants, and 20% toward savings and giving. It helps make sure you never spend more than you earn!",
    videoUrl: "https://www.youtube.com/embed/OZQQMYfaBT4",
  },
  {
    category: "spending",
    title: "Good Debt vs Bad Debt",
    content:
      "Not all debt is bad! Good debt helps you earn more in the future — like a college loan. Bad debt is borrowing money to buy things that lose value quickly. Understanding the difference is key to staying financially healthy.",
    videoUrl: "https://www.youtube.com/embed/uv_P9yJY9jQ",
  },
  {
    category: "donating",
    title: "Donating Strategically",
    content:
      "Did you know you can research charities before donating? Websites like Charity Navigator show how well organizations use their donations. Strategic giving makes your dollars go even further!",
    videoUrl: "https://www.youtube.com/embed/osCUTGkKVRg",
  },
  {
    category: "investing",
    title: "Roth IRA for Kids — Tax-Free Future",
    content:
      "A Roth IRA is a special retirement account with a huge bonus: the money grows TAX-FREE! If you earn money from chores, you can contribute to a custodial Roth IRA and let it grow for decades.",
    videoUrl: "https://www.youtube.com/embed/3bruQxLmGvY",
  },
];

export async function seedExpandedCurriculum(): Promise<void> {
  for (const lesson of EXPANDED_LESSONS) {
    const existing = await db
      .select()
      .from(schema.lessons)
      .where(and(eq(schema.lessons.title, lesson.title), isNull(schema.lessons.familyId)));
    if (existing.length > 0) continue;

    const [inserted] = await db
      .insert(schema.lessons)
      .values({
        category: lesson.category,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        isCustom: false,
        familyId: null,
      })
      .returning();

    const stubs = DEFAULT_LESSON_QUIZZES[lesson.title] ?? [];
    for (const stub of stubs) {
      await db.insert(schema.quizzes).values({
        lessonId: inserted.id,
        question: stub.question,
        options: stub.options,
        correctAnswer: stub.correctAnswer,
      });
    }
  }
}
