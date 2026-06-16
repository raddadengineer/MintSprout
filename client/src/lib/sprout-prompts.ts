import type { KidMode } from "@/hooks/use-kid-mode";
import {
  greetingVoiceOff,
  greetingVoiceOn,
  quickPromptListAvailable,
  quickPromptListAvailableYoungest,
  quickPromptWaitingApproval,
  voiceHintExample,
} from "@shared/kid-task-copy";

const JOB_PROMPTS: Record<KidMode, string[]> = {
  youngest: [
    quickPromptListAvailableYoungest(),
    "I finished making my bed",
    "What did I finish?",
    "What is saving?",
  ],
  younger: [
    quickPromptListAvailable("younger"),
    "I'm done with clean my room",
    quickPromptWaitingApproval("younger"),
    "Give me a saving tip!",
  ],
  older: [
    "Explain compound interest simply",
    "How should I split my money?",
    "Help me plan a savings goal",
    "What's a smart spending habit?",
  ],
  unknown: ["Give me a money tip!", "What should I focus on today?"],
};

const LEARN_PROMPTS: Record<KidMode, string[]> = {
  youngest: [
    "What lessons do I have?",
    "What is saving?",
    "Explain earning simply",
    "What should I learn next?",
  ],
  younger: [
    "What lessons do I have left?",
    "Explain saving to me",
    "What did I learn?",
    "Why is donating good?",
  ],
  older: [
    "What lessons should I complete?",
    "Explain compound interest simply",
    "What's the difference between saving and investing?",
    "What lessons have I finished?",
  ],
  unknown: ["What should I learn next?", "Explain saving simply"],
};

export function quickPromptsForPage(mode: KidMode, page: string): string[] {
  const isLearn = page === "learn" || page.startsWith("learn");
  const prompts = isLearn ? LEARN_PROMPTS : JOB_PROMPTS;
  return prompts[mode] ?? prompts.unknown;
}

export function voiceHintForPage(mode: KidMode, page: string): string {
  const isLearn = page === "learn" || page.startsWith("learn");
  if (isLearn) {
    if (mode === "youngest") {
      return "Try: “What lessons do I have?” or “What is saving?”";
    }
    if (mode === "younger") {
      return "Try: “What lessons do I have left?” or “Explain saving to me”";
    }
    return "Try: “What lessons should I complete?” or ask about any money topic";
  }
  return voiceHintExample(mode);
}

export function greetingForPage(
  mode: KidMode,
  page: string,
  name: string,
  voiceMode: boolean,
): string {
  const isLearn = page === "learn" || page.startsWith("learn");
  if (isLearn) {
    if (mode === "youngest") {
      return voiceMode
        ? `Hi ${name}! Voice mode is on. Ask "what lessons do I have?" or "what is saving?" 🌱`
        : `Hi ${name}! I'm Sprout! Tap Voice Mode to ask about your lessons! 🌱`;
    }
    if (mode === "younger") {
      return voiceMode
        ? `Hey ${name}! Ask what lessons you have left, or say "explain saving to me."`
        : `Hey ${name}! Turn on Voice Mode to ask about lessons hands-free!`;
    }
    return voiceMode
      ? `Hi ${name}. Voice mode on — ask about lessons or any money topic.`
      : `Hi ${name}. Enable Voice Mode to ask what to learn or get quick explanations.`;
  }

  return voiceMode ? greetingVoiceOn(mode, name) : greetingVoiceOff(mode, name);
}
