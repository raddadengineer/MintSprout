import type { DeploymentSettings, DeploymentSettingsPatch } from "@shared/deployment-settings";
import { DEPLOYMENT_SETTINGS_KEY } from "@shared/deployment-settings";
import type { IStorage } from "./storage";

let cached: DeploymentSettings | null = null;

function envFlag(raw: string | undefined, defaultTrue = true): boolean {
  if (raw === undefined || raw === "") return defaultTrue;
  if (raw === "0" || raw === "false" || raw === "FALSE" || raw === "no") return false;
  return true;
}

export function settingsFromEnv(): DeploymentSettings {
  const kioskFamilyRaw = process.env.KIOSK_FAMILY_ID;
  const kioskFamilyId = kioskFamilyRaw ? Number(kioskFamilyRaw) : undefined;

  return {
    aiCoachEnabled: envFlag(process.env.AI_COACH_ENABLED, true),
    openWebUiBaseUrl: process.env.OPENWEBUI_BASE_URL || process.env.AI_BASE_URL || "",
    openWebUiApiKey: process.env.OPENWEBUI_API_KEY || process.env.AI_API_KEY || "",
    openWebUiModel: process.env.OPENWEBUI_MODEL || process.env.AI_MODEL || "gemma3:kids",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://192.168.10.7:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:latest",
    kidsVoiceBaseUrl: process.env.KIDS_VOICE_BASE_URL || "http://192.168.10.7:8880/v1",
    kidsVoiceModel: process.env.KIDS_VOICE_MODEL || "kokoro",
    aiVoiceYoungest: process.env.AI_VOICE_YOUNGEST || "af_bella",
    aiVoiceYounger: process.env.AI_VOICE_YOUNGER || "af_sky",
    aiVoiceOlder: process.env.AI_VOICE_OLDER || "",
    kioskMode: envFlag(process.env.KIOSK_MODE, true),
    parentPin: process.env.PARENT_PIN || "",
    kioskFamilyId: Number.isFinite(kioskFamilyId) ? kioskFamilyId : 1,
    jwtSecret: process.env.JWT_SECRET || "",
    backupScheduleEnabled: envFlag(process.env.BACKUP_SCHEDULE_ENABLED, true),
    backupDailyEnabled: envFlag(process.env.BACKUP_DAILY_ENABLED, true),
    backupWeeklyEnabled: envFlag(process.env.BACKUP_WEEKLY_ENABLED, true),
    backupDailyUtcHour: parseInt(process.env.BACKUP_DAILY_UTC_HOUR || "2", 10),
    backupWeeklyUtcDay: parseInt(process.env.BACKUP_WEEKLY_UTC_DAY || "0", 10),
    backupWeeklyUtcHour: parseInt(process.env.BACKUP_WEEKLY_UTC_HOUR || "3", 10),
    backupDailyRetentionDays: parseInt(process.env.BACKUP_DAILY_RETENTION_DAYS || "14", 10),
    backupWeeklyRetentionWeeks: parseInt(process.env.BACKUP_WEEKLY_RETENTION_WEEKS || "8", 10),
  };
}

export function mergeSettings(
  envDefaults: DeploymentSettings,
  dbOverrides: DeploymentSettings,
): DeploymentSettings {
  const merged = { ...envDefaults };
  for (const [key, value] of Object.entries(dbOverrides) as [keyof DeploymentSettings, unknown][]) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value === "" && key !== "parentPin" && key !== "openWebUiApiKey" && key !== "jwtSecret") continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

export function maskSecret(value: string | undefined, visibleTail = 4): string | undefined {
  if (!value?.trim()) return undefined;
  if (visibleTail === 0) return "••••";
  if (value.length <= visibleTail) return "••••";
  return `${"•".repeat(Math.min(8, value.length - visibleTail))}${value.slice(-visibleTail)}`;
}

export function maskSettings(settings: DeploymentSettings): DeploymentSettings {
  return {
    ...settings,
    openWebUiApiKey: maskSecret(settings.openWebUiApiKey),
    parentPin: settings.parentPin ? "••••" : undefined,
    jwtSecret: settings.jwtSecret ? maskSecret(settings.jwtSecret) : undefined,
  };
}

function parseDbOverrides(raw: string | null | undefined): DeploymentSettings {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as DeploymentSettings;
  } catch {
    return {};
  }
}

export async function loadAppConfig(storage: IStorage): Promise<DeploymentSettings> {
  const row = await storage.getAppSettings(DEPLOYMENT_SETTINGS_KEY);
  cached = mergeSettings(settingsFromEnv(), parseDbOverrides(row?.value));
  return cached;
}

export async function refreshAppConfig(storage: IStorage): Promise<DeploymentSettings> {
  return loadAppConfig(storage);
}

export function getAppConfig(): DeploymentSettings {
  if (!cached) {
    cached = settingsFromEnv();
  }
  return cached;
}

export function getJwtSecret(): string {
  const secret = getAppConfig().jwtSecret?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

/** For tests — reset in-memory cache */
export function resetAppConfigCache(): void {
  cached = null;
}

export function applySettingsPatch(
  current: DeploymentSettings,
  patch: DeploymentSettingsPatch,
): DeploymentSettings {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch) as [keyof DeploymentSettingsPatch, unknown][]) {
    if (value === undefined) continue;
    if (key === "openWebUiApiKey" || key === "parentPin" || key === "jwtSecret") {
      if (typeof value === "string" && value.trim() === "") continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

export async function saveSettingsPatch(
  storage: IStorage,
  patch: DeploymentSettingsPatch,
): Promise<DeploymentSettings> {
  const current = getAppConfig();
  const next = applySettingsPatch(current, patch);
  await storage.upsertAppSettings(DEPLOYMENT_SETTINGS_KEY, JSON.stringify(next));
  cached = next;
  return next;
}

export async function recordBackupRun(
  storage: IStorage,
  tier: "daily" | "weekly",
  ok: boolean,
  error?: string,
): Promise<void> {
  const current = getAppConfig();
  const now = new Date().toISOString();
  const next: DeploymentSettings = { ...current };
  if (tier === "daily") {
    next.backupLastDailyAt = now;
    next.backupLastDailyError = ok ? undefined : (error ?? "failed");
  } else {
    next.backupLastWeeklyAt = now;
    next.backupLastWeeklyError = ok ? undefined : (error ?? "failed");
  }
  await storage.upsertAppSettings(DEPLOYMENT_SETTINGS_KEY, JSON.stringify(next));
  cached = next;
}
