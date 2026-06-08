import { describe, it, expect } from "vitest";
import { buildVoiceStepsFromContent, parseVoiceSteps, serializeVoiceSteps } from "@shared/catalog/build-voice-steps";

describe("buildVoiceStepsFromContent", () => {
  it("creates narration steps with a check-in and quiz-ready ending", () => {
    const steps = buildVoiceStepsFromContent(
      "Saving Money",
      "Saving means keeping money for later. It helps you reach goals.",
      ["Why do we save?"],
    );
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.some((s) => s.prompt)).toBe(true);
    expect(steps[steps.length - 1]!.narration.toLowerCase()).toContain("quiz");
  });

  it("round-trips through serialize and parse", () => {
    const steps = buildVoiceStepsFromContent("Earn", "Work earns money.");
    const raw = serializeVoiceSteps(steps);
    expect(parseVoiceSteps(raw)).toHaveLength(steps.length);
  });
});
