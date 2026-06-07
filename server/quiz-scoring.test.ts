import { describe, it, expect } from "vitest";
import { isQuizAnswerCorrect } from "@shared/quiz-utils";
import { quizStubsForLessonTitle } from "@shared/catalog/lesson-quizzes";

describe("quiz scoring", () => {
  it("uses 0-indexed correctAnswer", () => {
    expect(isQuizAnswerCorrect(1, 1)).toBe(true);
    expect(isQuizAnswerCorrect(0, 1)).toBe(false);
    expect(isQuizAnswerCorrect(2, 2)).toBe(true);
  });
});

describe("lesson quiz stubs", () => {
  it("includes kid-friendly quizzes for default lesson titles", () => {
    for (const title of [
      "How to Earn Money",
      "Why Save Money?",
      "Smart Spending",
      "Growing Your Money",
      "Sharing is Caring",
    ]) {
      const stubs = quizStubsForLessonTitle(title);
      expect(stubs.length).toBeGreaterThanOrEqual(3);
      for (const stub of stubs) {
        expect(stub.options[stub.correctAnswer]).toBeTruthy();
      }
    }
  });
});
