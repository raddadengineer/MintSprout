import type { CatalogLibraryEntry, LessonCategoryKey } from "./types";
import { quizStubsForLessonTitle } from "./lesson-quizzes";

export type LessonLibraryItem = {
  title: string;
  description: string;
  content: string;
  videoUrl?: string | null;
  quizStubs?: { question: string; options: string[]; correctAnswer: number }[];
};

export const LESSON_LIBRARY_BY_CATEGORY: Record<LessonCategoryKey, LessonLibraryItem[]> = {
  earning: [
    {
      title: "How to Earn Money",
      description: "Ways kids can earn through chores and helping.",
      content: "Money is earned by doing work and providing value. When you complete chores or help your family, you earn money as a reward for your hard work!",
      videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
    },
    {
      title: "Making Change — Coin Math",
      description: "Practice counting coins and making change.",
      content: "A penny is 1 cent, a nickel is 5, a dime is 10, and a quarter is 25. Practice counting change when you buy something or run a pretend store!",
      videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
    },
    {
      title: "Earning More Ways",
      description: "Extra jobs and side hustles for kids.",
      content: "Beyond regular chores, you can earn by helping neighbors, selling crafts, running a lemonade stand, or doing special projects for your family.",
      videoUrl: "https://www.youtube.com/embed/0iRbD5rM5qc",
    },
    {
      title: "What Is an Allowance?",
      description: "How allowance connects to responsibilities.",
      content: "An allowance is money your family gives you on a schedule when you finish agreed chores. It teaches consistency and responsibility.",
    },
    {
      title: "Work Before Play",
      description: "Finish responsibilities before fun spending.",
      content: "Earning teaches that effort comes first. When you complete your jobs, you can enjoy spending knowing you worked for it.",
    },
    {
      title: "Tracking What You Earn",
      description: "Keep a simple log of jobs and pay.",
      content: "Write down each chore you finish and how much you earned. Tracking helps you see progress toward goals and spot patterns in your work.",
    },
    {
      title: "Barter and Trade",
      description: "Swapping skills instead of cash.",
      content: "Sometimes you trade help instead of money — like swapping dog-walking for lawn mowing. Both sides get value without spending cash.",
    },
    {
      title: "First Job Ideas for Kids",
      description: "Age-appropriate ways to earn.",
      content: "Pet sitting, yard work, organizing, tutoring younger kids, and helping with tech are great starter jobs when you're ready for bigger responsibilities.",
    },
    {
      title: "Quality Work Pays Off",
      description: "Doing a job well builds trust.",
      content: "When you do careful, complete work, adults notice. Good reputation leads to more opportunities and sometimes better pay.",
    },
  ],
  saving: [
    {
      title: "Why Save Money?",
      description: "The habit of keeping money for later.",
      content: "Saving money means keeping some of your earnings for later. It is like planting seeds that grow into bigger goals!",
      videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
    },
    {
      title: "Why We Save — The Magic of Goals",
      description: "Saving toward something you want.",
      content: "Pick something you really want — that is your goal! Each time you save a little, you get closer. Watching it grow feels amazing.",
      videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
    },
    {
      title: "Banking Basics — Your Money's Safe House",
      description: "Where savings can live safely.",
      content: "Banks and savings jars keep money safe. Some accounts even pay you interest — a small reward for saving.",
      videoUrl: "https://www.youtube.com/embed/oqgtFqd8nHo",
    },
    {
      title: "Pay Yourself First",
      description: "Save before you spend.",
      content: "When you earn money, put some in savings first — even a small amount — before spending the rest.",
    },
    {
      title: "Emergency Fund for Kids",
      description: "Saving for surprises.",
      content: "An emergency fund is money set aside for unexpected needs — like replacing something you lost. Even $5–$10 helps build the habit.",
    },
    {
      title: "Savings Jars and Buckets",
      description: "Split savings by purpose.",
      content: "Use separate jars: one for spending soon, one for a big goal, one for giving. Labels help you remember what each pile is for.",
    },
    {
      title: "Delayed Gratification",
      description: "Waiting makes rewards sweeter.",
      content: "Waiting to buy something you want builds patience. Often you'll still want it — or realize you saved money by waiting.",
    },
    {
      title: "Interest — Free Money for Savers",
      description: "How banks reward saving.",
      content: "Interest is extra money the bank pays you for keeping savings there. The longer you save, the more interest can add up.",
    },
    {
      title: "Saving for Big Dreams",
      description: "Long-term goals like college or a car.",
      content: "Big dreams take time. Break them into smaller weekly savings targets so they feel possible instead of impossible.",
    },
  ],
  spending: [
    {
      title: "Smart Spending",
      description: "Think before you buy.",
      content: "Spending wisely means asking: Do I need this? Will it make me happy for a long time? Smart spending helps you get the most value.",
      videoUrl: "https://www.youtube.com/embed/6OAqNtueu0U",
    },
    {
      title: "Comparing Prices — Be a Smart Shopper",
      description: "Find the best deal.",
      content: "Compare prices at different stores or wait for sales. A little research saves money for things that matter more.",
      videoUrl: "https://www.youtube.com/embed/6OAqNtueu0U",
    },
    {
      title: "The 50/30/20 Rule",
      description: "A simple way to split money.",
      content: "Some families split money: about half for needs, some for wants, and some for savings and giving. MintSprout jars help you practice this.",
      videoUrl: "https://www.youtube.com/embed/OZQQMYfaBT4",
    },
    {
      title: "Needs vs Wants",
      description: "Tell the difference before buying.",
      content: "Needs are things you must have. Wants are extras. Learning the difference helps you spend on what matters most.",
    },
    {
      title: "Good Debt vs Bad Debt",
      description: "Borrowing wisely as you grow older.",
      content: "Good debt can help you earn more later (like education). Bad debt buys things that lose value fast. Understanding the difference keeps you healthy financially.",
      videoUrl: "https://www.youtube.com/embed/uv_P9yJY9jQ",
    },
    {
      title: "The 24-Hour Rule",
      description: "Pause before impulse buys.",
      content: "Wait a day before buying something you suddenly want. If you still want it tomorrow, it might be worth it. If not, you saved money!",
    },
    {
      title: "Budgeting Your Allowance",
      description: "Plan spending for the week.",
      content: "Before the week starts, decide how much goes to snacks, fun, and savings. A simple plan stops you from running out by Wednesday.",
    },
    {
      title: "Sales and Marketing Tricks",
      description: "Don't let ads decide for you.",
      content: "Stores use bright signs and 'limited time' offers to make you buy fast. Slow down and ask if you would want it without the hype.",
    },
    {
      title: "Sharing Costs with Friends",
      description: "Splitting purchases fairly.",
      content: "When you and friends buy something together, split the cost evenly and agree upfront. Clear math keeps friendships happy.",
    },
  ],
  investing: [
    {
      title: "Growing Your Money",
      description: "Introduction to investing for kids.",
      content: "Investing is putting money to work so it can grow over time. The earlier you start learning, the more time your money has to grow.",
      videoUrl: "https://www.youtube.com/embed/jTW777ENc3c",
    },
    {
      title: "Compound Interest — Money That Makes Money",
      description: "How small amounts grow big over time.",
      content: "Compound interest means you earn interest on your interest. Starting early matters — even small amounts add up over many years.",
      videoUrl: "https://www.youtube.com/embed/jTW777ENc3c",
    },
    {
      title: "What Is the Stock Market?",
      description: "Owning tiny pieces of companies.",
      content: "When you invest in stocks, you own a small piece of a company. If the company does well over time, your investment can grow.",
      videoUrl: "https://www.youtube.com/embed/p7HKvqRI_Bo",
    },
    {
      title: "What Is a Stock?",
      description: "Shares explained simply.",
      content: "A stock is a tiny ownership slice of a business. Prices go up and down, so investors usually use money they won't need right away.",
      videoUrl: "https://www.youtube.com/embed/p7HKvqRI_Bo",
    },
    {
      title: "Roth IRA for Kids — Tax-Free Future",
      description: "A head start on retirement saving.",
      content: "A custodial Roth IRA lets earned money grow tax-free for decades. Starting young gives compound interest huge runway.",
      videoUrl: "https://www.youtube.com/embed/3bruQxLmGvY",
    },
    {
      title: "Risk and Reward",
      description: "Higher growth often means more ups and downs.",
      content: "Safer savings grow slowly. Stocks can grow faster but swing up and down. Matching risk to your timeline is part of investing.",
    },
    {
      title: "Diversification — Don't Put All Eggs in One Basket",
      description: "Spreading investments.",
      content: "Owning many types of investments reduces the hurt if one company struggles. Variety smooths the ride over time.",
    },
    {
      title: "Index Funds for Beginners",
      description: "Owning a little of many companies at once.",
      content: "An index fund buys hundreds of companies in one package. It is a simple way beginners often start investing.",
    },
    {
      title: "Long-Term Thinking",
      description: "Investing is a marathon.",
      content: "Markets bounce daily, but decades of history show growth for patient investors. Time in the market beats trying to time the market.",
    },
  ],
  donating: [
    {
      title: "Sharing is Caring",
      description: "Why giving helps others and you.",
      content: "Donating means giving some of your money or time to help others. It feels good and makes the world better.",
      videoUrl: "https://www.youtube.com/embed/BbYRAK_eCvo",
    },
    {
      title: "Choosing Causes You Care About",
      description: "Pick charities that match your values.",
      content: "Think about what matters to you — animals, food banks, hospitals — and learn how your donation helps.",
    },
    {
      title: "Giving Time, Not Just Money",
      description: "Volunteering counts too.",
      content: "You can help others with your time and kindness, not only money. Both are important ways to give back.",
    },
    {
      title: "Giving Goals — Pick a Cause",
      description: "Save specifically to donate.",
      content: "Set a giving goal — like $10 for an animal shelter. Saving toward a cause makes donating intentional and meaningful.",
      videoUrl: "https://www.youtube.com/embed/BbYRAK_eCvo",
    },
    {
      title: "Donating Strategically",
      description: "Research where money goes.",
      content: "Good charities use donations efficiently. Ask adults to help you check ratings so your dollars do the most good.",
      videoUrl: "https://www.youtube.com/embed/osCUTGkKVRg",
    },
    {
      title: "Random Acts of Kindness",
      description: "Small gifts that matter.",
      content: "Buy lunch for a friend, donate books you outgrew, or leave a nice note. Kindness doesn't always require lots of money.",
    },
    {
      title: "Community Helpers",
      description: "Local places that need support.",
      content: "Food banks, libraries, and shelters often need supplies and volunteers. Your family can pick one to support together.",
    },
    {
      title: "Giving Without Expecting Back",
      description: "True generosity.",
      content: "The best giving doesn't ask for praise or payback. You give because it helps someone else — and that is enough.",
    },
    {
      title: "Matching Gifts",
      description: "When employers or parents multiply donations.",
      content: "Some workplaces match charity donations dollar for dollar. Ask if a parent can match your giving to stretch your impact.",
    },
  ],
};

export function lessonLibraryAsCatalogEntries(): CatalogLibraryEntry[] {
  const entries: CatalogLibraryEntry[] = [];
  for (const [categoryKey, items] of Object.entries(LESSON_LIBRARY_BY_CATEGORY)) {
    for (const item of items) {
      const quizStubs = item.quizStubs ?? quizStubsForLessonTitle(item.title);
      entries.push({
        catalogType: "lesson",
        categoryKey,
        title: item.title,
        description: item.description,
        payload: {
          content: item.content,
          videoUrl: item.videoUrl ?? null,
          ...(quizStubs.length > 0 ? { quizStubs } : {}),
        },
        source: "builtin",
      });
    }
  }
  return entries;
}

export function findLessonLibraryEntry(
  categoryKey: string,
  title: string,
): LessonLibraryItem | undefined {
  const items = LESSON_LIBRARY_BY_CATEGORY[categoryKey as LessonCategoryKey];
  return items?.find((i) => i.title === title);
}
