import { describe, it, expect, beforeEach } from "vitest";
import {
  settingsFromEnv,
  mergeSettings,
  maskSettings,
  applySettingsPatch,
  resetAppConfigCache,
  getAppConfig,
  loadAppConfig,
  getJwtSecret,
} from "./app-config";
import { MemStorage } from "./storage";

describe("app-config", () => {
  beforeEach(() => {
    resetAppConfigCache();
    process.env.AI_COACH_ENABLED = "true";
    process.env.OPENWEBUI_BASE_URL = "https://env.example.com";
    process.env.OPENWEBUI_API_KEY = "sk-env-key";
    process.env.KIOSK_MODE = "true";
    process.env.PARENT_PIN = "9999";
  });

  it("builds defaults from environment", () => {
    const env = settingsFromEnv();
    expect(env.openWebUiBaseUrl).toBe("https://env.example.com");
    expect(env.aiCoachEnabled).toBe(true);
    expect(env.kioskMode).toBe(true);
  });

  it("merges db overrides over env", () => {
    const merged = mergeSettings(settingsFromEnv(), { aiCoachEnabled: false, openWebUiModel: "custom:model" });
    expect(merged.aiCoachEnabled).toBe(false);
    expect(merged.openWebUiModel).toBe("custom:model");
    expect(merged.openWebUiBaseUrl).toBe("https://env.example.com");
  });

  it("masks secrets for API responses", () => {
    const masked = maskSettings({ openWebUiApiKey: "sk-secret1234", parentPin: "1234", jwtSecret: "jwt-secret-key-123456" });
    expect(masked.openWebUiApiKey).toContain("1234");
    expect(masked.openWebUiApiKey).toContain("•");
    expect(masked.parentPin).toBe("••••");
    expect(masked.jwtSecret).toContain("•");
  });

  it("preserves api key when patch field is blank", () => {
    resetAppConfigCache();
    const current = { openWebUiApiKey: "sk-keep-me", aiCoachEnabled: true };
    const next = applySettingsPatch(current, { openWebUiApiKey: "", aiCoachEnabled: false });
    expect(next.openWebUiApiKey).toBe("sk-keep-me");
    expect(next.aiCoachEnabled).toBe(false);
  });

  it("loads settings from storage", async () => {
    const storage = new MemStorage();
    await storage.ready;
    await storage.upsertAppSettings(
      "deployment",
      JSON.stringify({ openWebUiModel: "from-db" }),
    );
    await loadAppConfig(storage);
    expect(getAppConfig().openWebUiModel).toBe("from-db");
  });

  it("resolves JWT secret from config over env", async () => {
    process.env.JWT_SECRET = "env-secret-key-12345";
    const storage = new MemStorage();
    await storage.ready;
    await storage.upsertAppSettings(
      "deployment",
      JSON.stringify({ jwtSecret: "db-secret-key-123456" }),
    );
    await loadAppConfig(storage);
    expect(getJwtSecret()).toBe("db-secret-key-123456");
  });
});
