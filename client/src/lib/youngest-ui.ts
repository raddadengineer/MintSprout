/** Icons and simple labels for kids ages 5–6 who are learning to read. */

export const YOUNGEST_PROMPTS: Record<string, { icon: string; shortLabel: string }> = {
  "What jobs can I do?": { icon: "📋", shortLabel: "Things to do" },
  "I finished making my bed": { icon: "🛏️", shortLabel: "Bed Done" },
  "What did I finish?": { icon: "✅", shortLabel: "I Did" },
  "What is saving?": { icon: "🐷", shortLabel: "Saving?" },
  "What should I do today?": { icon: "📋", shortLabel: "My Day" },
  "Tell me a fun fact!": { icon: "✨", shortLabel: "Fun Fact" },
  "Why do we do chores?": { icon: "🏠", shortLabel: "Chores?" },
  "What lessons do I have?": { icon: "📚", shortLabel: "Lessons" },
  "Explain earning simply": { icon: "💰", shortLabel: "Earn?" },
  "What should I learn next?": { icon: "🎓", shortLabel: "Next?" },
};

export function iconForQuickPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("today") || lower.includes("do first")) return "📋";
  if (lower.includes("saving") || lower.includes("save")) return "🐷";
  if (lower.includes("fun fact") || lower.includes("something fun")) return "✨";
  if (lower.includes("chore") || lower.includes("help")) return "🏠";
  if (lower.includes("allowance")) return "💵";
  if (lower.includes("spending")) return "🛒";
  if (lower.includes("lesson") || lower.includes("learn")) return "📚";
  if (lower.includes("interest")) return "📈";
  if (lower.includes("goal")) return "🎯";
  if (lower.includes("habit")) return "⭐";
  return "💬";
}

export function youngestPromptDisplay(prompt: string): { icon: string; shortLabel: string } {
  return (
    YOUNGEST_PROMPTS[prompt] ?? {
      icon: iconForQuickPrompt(prompt),
      shortLabel: prompt.length > 20 ? `${prompt.slice(0, 18)}…` : prompt,
    }
  );
}

export function youngestJobStatus(status: string): { icon: string; label: string } {
  switch (status) {
    case "assigned":
      return { icon: "📋", label: "To Do" };
    case "in_progress":
      return { icon: "🏃", label: "Doing It" };
    case "completed":
      return { icon: "⏳", label: "Waiting" };
    case "approved":
      return { icon: "✅", label: "All Done!" };
    default:
      return { icon: "📌", label: status };
  }
}

export const YOUNGEST_STATS = {
  earned: { icon: "💰", label: "My Money", hint: "You earned!" },
  jobsDone: { icon: "✅", label: "Done!", hint: "Great job!" },
  goal: { icon: "🎯", label: "My Goal", hint: "Save up!" },
  learning: { icon: "🔥", label: "Learning", hint: "Keep going!" },
} as const;

export const YOUNGEST_NAV = {
  "/dashboard": { icon: "🏠", label: "Home" },
  "/jobs": { icon: "✅", label: "Things to do" },
  "/learn": { icon: "🎓", label: "Learn" },
  "/payments": { icon: "💰", label: "Money" },
} as const;
