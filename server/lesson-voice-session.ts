import type { Lesson, Quiz } from "@shared/schema";
import type { VoiceLessonStep } from "@shared/catalog/types";
import {
  buildVoiceStepsFromContent,
  parseVoiceSteps,
  serializeVoiceSteps,
} from "@shared/catalog/build-voice-steps";
import { generateVoiceStepsForLesson } from "./voice-steps-generator";
import type { IStorage } from "./storage";
import { kidModeFromAge, synthesizeSpeech, voiceForKidMode, type KidMode } from "./ai-coach";

export type VoiceSessionAction = "start" | "advance" | "respond";

export type VoiceSessionRequest = {
  action: VoiceSessionAction;
  stepIndex?: number;
  userMessage?: string;
};

export type VoiceSessionResponse = {
  stepIndex: number;
  totalSteps: number;
  narration: string;
  prompt?: string;
  feedback?: string;
  prepared: boolean;
  audioBase64?: string;
  mimeType?: string;
};

function respondFeedback(mode: KidMode, accepted: boolean): string {
  if (accepted) {
    if (mode === "youngest") return "Great answer! You're doing awesome!";
    if (mode === "younger") return "Nice thinking! That's a solid answer.";
    return "Good response — you clearly paid attention.";
  }
  if (mode === "youngest") return "Good try! Any answer works — let's keep going!";
  return "Thanks for sharing! Let's continue the lesson.";
}

function validateResponse(_step: VoiceLessonStep, userMessage: string): boolean {
  return userMessage.trim().length >= 2;
}

async function resolveVoiceSteps(
  storage: IStorage,
  lesson: Lesson,
  quizzes: Quiz[],
  useAi: boolean,
): Promise<VoiceLessonStep[]> {
  const existing = parseVoiceSteps(lesson.voiceSteps);
  if (existing.length > 0) return existing;

  const quizQuestions = quizzes.map((q) => q.question);
  const steps = useAi
    ? await generateVoiceStepsForLesson(lesson.title, lesson.content, lesson.category, quizQuestions)
    : buildVoiceStepsFromContent(lesson.title, lesson.content, quizQuestions);

  await storage.updateLesson(lesson.id, { voiceSteps: serializeVoiceSteps(steps) });
  return steps;
}

async function attachSpeech(
  narration: string,
  mode: KidMode,
  withSpeech: boolean,
): Promise<{ audioBase64?: string; mimeType?: string }> {
  if (!withSpeech) return {};
  const voice = voiceForKidMode(mode);
  if (!voice) return {};
  try {
    const audio = await synthesizeSpeech(narration, voice, mode === "youngest" ? 400 : 600);
    return { audioBase64: audio.toString("base64"), mimeType: "audio/mpeg" };
  } catch {
    return {};
  }
}

async function markLessonPrepared(
  storage: IStorage,
  childId: number,
  lessonId: number,
): Promise<void> {
  const now = new Date();
  const all = await storage.getLearningProgress(childId);
  const existing = all.find((p) => p.lessonId === lessonId);
  if (existing) {
    await storage.updateLearningProgress(childId, lessonId, { preparedAt: now });
    return;
  }
  await storage.createLearningProgress({
    childId,
    lessonId,
    completed: false,
    quizScore: null,
    preparedAt: now,
  });
}

function stepPayload(
  steps: VoiceLessonStep[],
  index: number,
): Pick<VoiceSessionResponse, "stepIndex" | "totalSteps" | "narration" | "prompt"> {
  const step = steps[index]!;
  return {
    stepIndex: index,
    totalSteps: steps.length,
    narration: step.narration,
    prompt: step.prompt,
  };
}

export async function handleLessonVoiceSession(
  storage: IStorage,
  childId: number,
  childAge: number | null,
  lessonId: number,
  body: VoiceSessionRequest,
  withSpeech: boolean,
): Promise<VoiceSessionResponse> {
  const lesson = await storage.getLessonById(lessonId);
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }

  const quizzes = await storage.getQuizzesByLesson(lessonId);
  const mode = kidModeFromAge(childAge);
  const useAi = body.action === "start";
  const steps = await resolveVoiceSteps(storage, lesson, quizzes, useAi);

  if (steps.length === 0) {
    await markLessonPrepared(storage, childId, lessonId);
    return { stepIndex: 0, totalSteps: 0, narration: "You're ready for the quiz!", prepared: true };
  }

  if (body.action === "start") {
    const payload = stepPayload(steps, 0);
    const speech = await attachSpeech(payload.narration, mode, withSpeech);
    return { ...payload, prepared: false, ...speech };
  }

  const stepIndex = body.stepIndex ?? 0;
  if (stepIndex < 0 || stepIndex >= steps.length) {
    throw Object.assign(new Error("Invalid step index"), { status: 400 });
  }

  if (body.action === "respond") {
    const step = steps[stepIndex]!;
    const userMessage = body.userMessage?.trim() ?? "";
    const accepted = step.prompt ? validateResponse(step, userMessage) : true;
    const feedback = respondFeedback(mode, accepted);

    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      await markLessonPrepared(storage, childId, lessonId);
      return {
        stepIndex: nextIndex,
        totalSteps: steps.length,
        narration: "",
        feedback,
        prepared: true,
      };
    }

    const payload = stepPayload(steps, nextIndex);
    const speech = await attachSpeech(payload.narration, mode, withSpeech);
    return { ...payload, feedback, prepared: false, ...speech };
  }

  // advance — narration-only step finished
  const nextIndex = stepIndex + 1;
  if (nextIndex >= steps.length) {
    await markLessonPrepared(storage, childId, lessonId);
    return {
      stepIndex: nextIndex,
      totalSteps: steps.length,
      narration: "",
      prepared: true,
    };
  }

  const payload = stepPayload(steps, nextIndex);
  const speech = await attachSpeech(payload.narration, mode, withSpeech);
  return { ...payload, prepared: false, ...speech };
}
