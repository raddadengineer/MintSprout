import type { KidMode } from "./ai-coach";
import type { SproutVoiceResult } from "./sprout-voice";

export type LearnLessonRow = {
  id: number;
  title: string;
  category: string;
  completed: boolean;
  quizScore?: number | null;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  earning: ["earn", "earning", "money", "work", "job"],
  saving: ["save", "saving", "savings", "piggy bank"],
  spending: ["spend", "spending", "buy", "shopping"],
  investing: ["invest", "investing", "grow money", "compound"],
  donating: ["donate", "donating", "give", "giving", "charity", "help others"],
};

type LearnIntent =
  | { type: "list_todo" }
  | { type: "list_done" }
  | { type: "explain"; phrase: string };

function parseLearnIntent(message: string): LearnIntent | null {
  const m = normalize(message);

  if (
    /\b(what|which)\b.*\b(lessons?|learn|learning)\b.*\b(left|todo|to do|need|have|should)\b/.test(m) ||
    /\b(what should i learn|what do i need to learn|lessons left|learning left|what lessons)\b/.test(m) ||
    /\b(what can i learn|what to learn next)\b/.test(m)
  ) {
    return { type: "list_todo" };
  }

  if (
    /\b(what did i learn|lessons i finished|lessons i completed|what have i learned)\b/.test(m) ||
    /\b(lessons? (i did|i finished|i completed|done))\b/.test(m)
  ) {
    return { type: "list_done" };
  }

  const explainPatterns = [
    /\b(?:what is|what's|explain|tell me about|help me understand|teach me about) (.+)/,
    /\bwhy (?:is|do|does) (.+)/,
  ];
  for (const re of explainPatterns) {
    const match = m.match(re);
    if (match?.[1]) {
      const phrase = match[1].trim();
      if (phrase.length > 2) return { type: "explain", phrase };
    }
  }

  return null;
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    earning: "Earning",
    saving: "Saving",
    spending: "Spending",
    investing: "Investing",
    donating: "Donating",
  };
  return labels[category] ?? category;
}

function matchLesson(lessons: LearnLessonRow[], phrase: string): LearnLessonRow | null {
  const n = normalize(phrase);
  if (!n) return null;

  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => n.includes(a) || a.includes(n))) {
      const inCat = lessons.filter((l) => l.category === cat);
      if (inCat.length) return inCat[0];
    }
  }

  let best: LearnLessonRow | null = null;
  let bestScore = 0;
  for (const lesson of lessons) {
    const title = normalize(lesson.title);
    if (n.includes(title) || title.includes(n)) {
      const score = title.length + 10;
      if (score > bestScore) {
        best = lesson;
        bestScore = score;
      }
    }
  }
  return bestScore > 0 ? best : null;
}

function summarizeLesson(lesson: LearnLessonRow, mode: KidMode): string {
  const cat = categoryLabel(lesson.category);
  if (mode === "youngest") {
    return `${lesson.title} is about ${cat.toLowerCase()}. Watch the video and try the quiz when you're ready!`;
  }
  if (mode === "younger") {
    return `"${lesson.title}" is in the ${cat} section. Open it on the Learn page to watch and take the quiz!`;
  }
  return `"${lesson.title}" (${cat}) — open it on Learn to read more and take the quiz.`;
}

export function trySproutLearnVoiceAction(
  lessons: LearnLessonRow[],
  message: string,
  mode: KidMode,
): SproutVoiceResult | null {
  const intent = parseLearnIntent(message);
  if (!intent) return null;

  if (intent.type === "list_todo") {
    const todo = lessons.filter((l) => !l.completed);
    if (!todo.length) {
      return {
        reply:
          mode === "youngest"
            ? "You finished all your lessons! You're a money star!"
            : "You've completed all your lessons — amazing! Ask me to explain any topic again if you want a refresher.",
        jobsChanged: false,
        voiceAction: "list",
      };
    }
    const byCat = new Map<string, string[]>();
    for (const l of todo) {
      const label = categoryLabel(l.category);
      if (!byCat.has(label)) byCat.set(label, []);
      byCat.get(label)!.push(l.title);
    }
    const body = Array.from(byCat.entries()).map(([cat, titles]) => `${cat}: ${titles.join(", ")}`).join(". ");
    return {
      reply:
        mode === "youngest"
          ? `${body}. Pick one and tap the quiz when you're ready!`
          : `${body}. Open Learn to watch and quiz on any of these.`,
      jobsChanged: false,
      voiceAction: "list",
    };
  }

  if (intent.type === "list_done") {
    const done = lessons.filter((l) => l.completed);
    if (!done.length) {
      return {
        reply:
          mode === "youngest"
            ? "You haven't finished a lesson yet — let's pick one!"
            : "You haven't completed any lessons yet. Ask what lessons you have left!",
        jobsChanged: false,
        voiceAction: "list",
      };
    }
    const names = done.map((l) => l.title).join(", ");
    return {
      reply:
        mode === "youngest"
          ? `You learned: ${names}! Great job!`
          : `Lessons you've completed: ${names}.`,
      jobsChanged: false,
      voiceAction: "list",
    };
  }

  if (intent.type === "explain") {
    const lesson = matchLesson(lessons, intent.phrase);
    if (lesson) {
      return {
        reply: summarizeLesson(lesson, mode),
        jobsChanged: false,
        voiceAction: "list",
      };
    }
    const catKey = Object.entries(CATEGORY_ALIASES).find(([, aliases]) =>
      aliases.some((a) => normalize(intent.phrase).includes(a)),
    )?.[0];
    if (catKey) {
      const inCat = lessons.filter((l) => l.category === catKey);
      if (inCat.length) {
        const titles = inCat.map((l) => l.title).join(", ");
        return {
          reply:
            mode === "youngest"
              ? `${categoryLabel(catKey)} lessons: ${titles}. Tap one on Learn!`
              : `${categoryLabel(catKey)} lessons on Learn: ${titles}.`,
          jobsChanged: false,
          voiceAction: "list",
        };
      }
    }
    return null;
  }

  return null;
}

export async function loadLearnLessonsForChild(
  storage: import("./storage").IStorage,
  familyId: number,
  childId: number,
  age: number | null,
): Promise<LearnLessonRow[]> {
  const categories = ["earning", "saving", "spending", "investing", "donating"];
  const defaultLessons = (await Promise.all(categories.map((cat) => storage.getLessonsByCategory(cat)))).flat();
  const customLessons = await storage.getCustomLessons(familyId);
  const all = [...defaultLessons, ...customLessons];

  const mode: KidMode =
    typeof age === "number" && age <= 6
      ? "youngest"
      : typeof age === "number" && age <= 10
        ? "younger"
        : "older";

  const filtered = all.filter((lesson) => {
    if (mode === "youngest") return ["earning", "saving", "spending"].includes(lesson.category);
    if (mode === "younger") return lesson.category !== "investing";
    return true;
  });

  const progress = await storage.getLearningProgress(childId);
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

  return filtered.map((lesson) => {
    const p = byLesson.get(lesson.id);
    return {
      id: lesson.id,
      title: lesson.title,
      category: lesson.category,
      completed: !!(p?.completed),
      quizScore: p?.quizScore ?? null,
    };
  });
}
