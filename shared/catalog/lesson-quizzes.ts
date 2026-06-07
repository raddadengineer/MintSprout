import type { LessonCatalogPayload } from "./types";

export type LessonQuizStub = NonNullable<LessonCatalogPayload["quizStubs"]>[number];

/** Kid-friendly quiz questions keyed by lesson title (0-indexed correctAnswer). */
export const DEFAULT_LESSON_QUIZZES: Record<string, LessonQuizStub[]> = {
  "How to Earn Money": [
    {
      question: "What does it mean to EARN money?",
      options: [
        "Finding money on the ground",
        "Getting money for doing work or a job",
        "Borrowing money from a friend",
        "Printing your own money",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which is a good example of earning money?",
      options: [
        "Wishing for money",
        "Doing your chores to get your allowance",
        "Taking money without asking",
        "Winning a prize every day",
      ],
      correctAnswer: 1,
    },
    {
      question: "Why is earning money important?",
      options: [
        "So you can buy everything you see",
        "So you never have to go to school",
        "So you can pay for things you need and save for goals",
        "So adults leave you alone",
      ],
      correctAnswer: 2,
    },
  ],
  "Why Save Money?": [
    {
      question: "What does saving money mean?",
      options: [
        "Spending all your money right away",
        "Keeping some money for later",
        "Giving all your money away",
        "Hiding money under your bed forever",
      ],
      correctAnswer: 1,
    },
    {
      question: "If you earn ten dollars and save three dollars, how much did you save?",
      options: ["Ten dollars", "Seven dollars", "Three dollars", "Thirteen dollars"],
      correctAnswer: 2,
    },
    {
      question: "Which is the BEST reason to save money?",
      options: [
        "To never spend any money again",
        "So you can buy something special you want later",
        "To make your piggy bank look full",
        "Because adults told you to",
      ],
      correctAnswer: 1,
    },
  ],
  "Smart Spending": [
    {
      question: "What is the difference between a NEED and a WANT?",
      options: [
        "They are exactly the same thing",
        "A need is something required to live; a want is something extra",
        "A want is more important than a need",
        "Needs cost more than wants",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which is a NEED?",
      options: [
        "A new video game",
        "Shoes to wear to school",
        "A toy from the store",
        "A second bicycle",
      ],
      correctAnswer: 1,
    },
    {
      question: "You have five dollars. A snack costs two dollars. What is a smart choice?",
      options: [
        "Buy something you cannot afford",
        "Buy the snack since you can afford it",
        "Spend nothing and keep all five dollars forever",
        "Ask for more money immediately",
      ],
      correctAnswer: 1,
    },
  ],
  "Growing Your Money": [
    {
      question: "What does investing mean?",
      options: [
        "Spending all your money at once",
        "Putting money to work so it can grow over time",
        "Giving money to a friend to hold",
        "Spending money on food",
      ],
      correctAnswer: 1,
    },
    {
      question: "Why is it better to start investing EARLY?",
      options: [
        "Because you get a trophy",
        "Because the earlier you start, the more time your money has to grow",
        "Because older people are not allowed to invest",
        "It does not matter when you start",
      ],
      correctAnswer: 1,
    },
    {
      question: "Investing is like…",
      options: [
        "Throwing money in a trash can",
        "Planting a seed that grows into a tree",
        "Spending money at the store",
        "Keeping money under your mattress",
      ],
      correctAnswer: 1,
    },
  ],
  "Sharing is Caring": [
    {
      question: "What does it mean to donate?",
      options: [
        "To loan money and expect it back",
        "To give some of your money or things to help others",
        "To spend money on yourself",
        "To save money in a bank",
      ],
      correctAnswer: 1,
    },
    {
      question: "Why do people donate to charity?",
      options: [
        "To get more allowance",
        "To help others and make the world a better place",
        "Because they have too much money",
        "To buy things for themselves",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which of these is a way to donate?",
      options: [
        "Spending money on candy",
        "Giving food to a food bank",
        "Buying the newest game",
        "Saving money for a bike",
      ],
      correctAnswer: 1,
    },
  ],
  "Making Change — Coin Math": [
    {
      question: "How much is a quarter worth?",
      options: ["One cent", "Five cents", "Ten cents", "Twenty-five cents"],
      correctAnswer: 3,
    },
    {
      question: "You buy a toy for fifty cents and pay with one dollar. How much change do you get?",
      options: ["Twenty-five cents", "Fifty cents", "One dollar", "Nothing"],
      correctAnswer: 1,
    },
  ],
  "Savings Jars and Buckets": [
    {
      question: "Why use separate savings jars?",
      options: [
        "So money gets lost",
        "To remember what each pile of money is for",
        "Because banks require it",
        "To hide money from parents",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which jar might hold money for a big goal?",
      options: ["Spend today jar", "Dream goal jar", "Trash jar", "Mystery jar"],
      correctAnswer: 1,
    },
  ],
};

export function quizStubsForLessonTitle(title: string): LessonQuizStub[] {
  return DEFAULT_LESSON_QUIZZES[title] ?? [];
}
