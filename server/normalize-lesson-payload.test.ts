import { describe, it, expect } from "vitest";
import { defaultVideoUrlForCategory } from "@shared/catalog/category-default-video";
import { normalizeLessonPayload, fallbackLessonContent } from "@shared/catalog/normalize-lesson-payload";

describe("defaultVideoUrlForCategory", () => {
  it("returns the first library video for earning", () => {
    expect(defaultVideoUrlForCategory("earning")).toBe("https://www.youtube.com/embed/0iRbD5rM5qc");
  });

  it("returns the first library video for saving", () => {
    expect(defaultVideoUrlForCategory("saving")).toBe("https://www.youtube.com/embed/oqgtFqd8nHo");
  });

  it("returns null for unknown categories", () => {
    expect(defaultVideoUrlForCategory("unknown")).toBeNull();
  });
});

describe("normalizeLessonPayload", () => {
  it("fills content from description when content is empty", () => {
    const result = normalizeLessonPayload({}, "Save for goals", "saving");
    expect(result.content).toBe("Save for goals");
    expect(result.videoUrl).toBe("https://www.youtube.com/embed/oqgtFqd8nHo");
  });

  it("keeps explicit video URL over category default", () => {
    const result = normalizeLessonPayload(
      { content: "Lesson body", videoUrl: "https://example.com/embed/abc" },
      null,
      "saving",
    );
    expect(result.videoUrl).toBe("https://example.com/embed/abc");
  });

  it("preserves quiz stubs when present", () => {
    const stubs = [{ question: "Q?", options: ["a", "b"], correctAnswer: 0 }];
    const result = normalizeLessonPayload({ content: "Body", quizStubs: stubs }, null, "earning");
    expect(result.quizStubs).toEqual(stubs);
  });
});

describe("fallbackLessonContent", () => {
  it("uses description when available", () => {
    expect(fallbackLessonContent("Saving", "Keep money for later")).toBe("Keep money for later");
  });

  it("generates template when description is missing", () => {
    expect(fallbackLessonContent("Saving", null)).toContain("Saving");
  });
});
