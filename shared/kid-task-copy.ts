export type KidMode = "youngest" | "younger" | "older" | "unknown";

/** Singular or plural user-facing noun for assigned work items. */
export function taskNoun(mode: KidMode, plural = false): string {
  if (mode === "youngest") return plural ? "things to do" : "thing to do";
  return plural ? "tasks" : "task";
}

export function voiceListEmpty(mode: KidMode): string {
  if (mode === "youngest") return "Nothing to do right now! You're all caught up!";
  return `You don't have any ${taskNoun(mode, true)} to do right now — nice work!`;
}

export function voiceListIntro(mode: KidMode, titles: string): string {
  if (mode === "youngest") {
    return `You can do: ${titles}. Say "I finished" plus the name when you're done!`;
  }
  return `Here are your available ${taskNoun(mode, true)}: ${titles}. Say "I'm done with" plus the ${taskNoun(mode)} name to update one.`;
}

export function voiceNameHint(mode: KidMode): string {
  if (mode === "youngest") return 'Say "I finished" plus the name when you\'re done!';
  return `Say "I'm done with" plus the ${taskNoun(mode)} name to mark it complete.`;
}

export function voiceListNotFoundYoungest(): string {
  return 'Ask "what can I do?" to hear your list.';
}

export function voiceListNotFound(mode: KidMode, phrase: string): string {
  if (mode === "youngest") {
    return `I couldn't find "${phrase}". ${voiceListNotFoundYoungest()}`;
  }
  return `I couldn't find a ${taskNoun(mode)} matching "${phrase}". Try asking what ${taskNoun(mode, true)} are available.`;
}

export function voiceCompleteNotFoundYoungest(phrase: string): string {
  return `Hmm, I couldn't find "${phrase}". What did you finish?`;
}

export function voiceCompleteNotFound(mode: KidMode, phrase: string): string {
  if (mode === "youngest") return voiceCompleteNotFoundYoungest(phrase);
  return `I couldn't find a ${taskNoun(mode)} matching "${phrase}".`;
}

export function voiceInProgressEmpty(mode: KidMode): string {
  if (mode === "youngest") return "You're not doing anything right now.";
  return `You don't have any ${taskNoun(mode, true)} in progress.`;
}

export function briefEarnFactsLabel(): string {
  return "Tasks to earn money:";
}

export function briefFamilySection(mode: KidMode, list: string): string {
  if (mode === "youngest") return `First, family things to do: ${list}.`;
  return `Family responsibilities: ${list}.`;
}

export function briefEarnSection(mode: KidMode, list: string): string {
  if (mode === "youngest") return `Things you can earn from: ${list}.`;
  return `Tasks you can earn from: ${list}.`;
}

export function briefKindLabel(kind: "family" | "paid" | "allowance"): string {
  if (kind === "family") return "family chore";
  if (kind === "allowance") return "allowance chore";
  return "paid task";
}

/** Example voice/chat prompts shown to kids. */
export function quickPromptListAvailable(mode: KidMode): string {
  if (mode === "youngest") return "What can I do?";
  if (mode === "younger") return "What tasks are available?";
  return "What tasks are available?";
}

export function quickPromptListAvailableYoungest(): string {
  return "What can I do?";
}

export function quickPromptWaitingApproval(mode: KidMode): string {
  if (mode === "younger") return "What tasks are waiting for approval?";
  return "What tasks are waiting for approval?";
}

export function voiceHintExample(mode: KidMode): string {
  if (mode === "youngest") return 'Try: "What can I do?" or "I finished my bed"';
  if (mode === "younger") {
    return 'Try: "What tasks are available?" or "I\'m done with clean my room"';
  }
  return 'Try: "What tasks are available?" or "I\'m done with…" plus a task name';
}

export function greetingVoiceOn(mode: KidMode, name: string): string {
  if (mode === "youngest") {
    return `Hi ${name}! Voice mode is on. Ask "what can I do?" or say "I finished" plus a chore name! 🌱`;
  }
  if (mode === "younger") {
    return `Hey ${name}! Voice mode on — ask about your tasks or say "I'm done with" a chore name.`;
  }
  return `Hi ${name}. Voice mode on — list tasks or mark them complete by voice.`;
}

export function greetingVoiceOff(mode: KidMode, name: string): string {
  if (mode === "youngest") {
    return `Hi ${name}! I'm Sprout! Tap Voice Mode or the mic to talk about your things to do! 🌱`;
  }
  if (mode === "younger") {
    return `Hey ${name}! I'm Sprout — turn on Voice Mode to ask about tasks hands-free!`;
  }
  return `Hi ${name}. I'm Sprout — enable Voice Mode to list tasks or mark them complete by voice.`;
}

export function sproutVoiceSubtitle(mode: KidMode): string {
  if (mode === "youngest") return "Ask about things to do & mark them done";
  if (mode === "younger") return "List tasks & mark complete by voice";
  return "Voice commands for tasks";
}

export function sproutVoicePlaceholder(): string {
  return "Or type a task command…";
}

/** LLM instruction: never use "jobs" in kid-facing output. */
export function llmTaskTerminologyRule(mode: KidMode): string {
  const noun = taskNoun(mode, true);
  return `Never say "jobs" — always say "${noun}" (or "chores" for family duties).`;
}

export function llmActiveTasksLabel(mode: KidMode): string {
  if (mode === "youngest") return "Active things to do";
  return "Active tasks";
}

export function llmTasksCompletedLabel(mode: KidMode): string {
  if (mode === "youngest") return "Things completed";
  return "Tasks completed";
}
