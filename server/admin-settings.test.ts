import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import { loadAppConfig, saveSettingsPatch, getAppConfig, resetAppConfigCache } from "./app-config";

describe("admin settings persistence", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    resetAppConfigCache();
    storage = new MemStorage();
    await storage.ready;
    await loadAppConfig(storage);
  });

  it("saves patch and updates runtime config", async () => {
    await saveSettingsPatch(storage, { aiCoachEnabled: false, openWebUiModel: "test-model" });
    const cfg = getAppConfig();
    expect(cfg.aiCoachEnabled).toBe(false);
    expect(cfg.openWebUiModel).toBe("test-model");

    const row = await storage.getAppSettings("deployment");
    expect(row?.value).toContain("test-model");
  });

  it("keeps existing api key when patch sends empty string", async () => {
    await saveSettingsPatch(storage, { openWebUiApiKey: "sk-original" });
    await saveSettingsPatch(storage, { openWebUiApiKey: "" });
    expect(getAppConfig().openWebUiApiKey).toBe("sk-original");
  });
});
