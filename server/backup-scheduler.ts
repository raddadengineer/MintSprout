import type { DeploymentSettings } from "@shared/deployment-settings";
import type { IStorage } from "./storage";
import { getAppConfig, recordBackupRun } from "./app-config";
import { getDbBackupStatus, runScheduledBackup } from "./db-backup";
import { log } from "./log";

export function shouldRunDailyBackup(
  config: DeploymentSettings,
  now: Date,
  lastRunAt?: string,
): boolean {
  if (config.backupScheduleEnabled === false) return false;
  if (config.backupDailyEnabled === false) return false;
  const hour = config.backupDailyUtcHour ?? 2;
  if (now.getUTCHours() !== hour || now.getUTCMinutes() > 1) return false;
  const dayKey = now.toISOString().slice(0, 10);
  if (lastRunAt?.startsWith(dayKey)) return false;
  return true;
}

export function shouldRunWeeklyBackup(
  config: DeploymentSettings,
  now: Date,
  lastRunAt?: string,
): boolean {
  if (config.backupScheduleEnabled === false) return false;
  if (config.backupWeeklyEnabled === false) return false;
  const day = config.backupWeeklyUtcDay ?? 0;
  const hour = config.backupWeeklyUtcHour ?? 3;
  if (now.getUTCDay() !== day || now.getUTCHours() !== hour || now.getUTCMinutes() > 1) return false;
  const dayKey = now.toISOString().slice(0, 10);
  if (lastRunAt?.startsWith(dayKey)) return false;
  return true;
}

async function runTier(storage: IStorage, tier: "daily" | "weekly"): Promise<void> {
  const config = getAppConfig();
  try {
    const result = await runScheduledBackup(tier, config);
    await recordBackupRun(storage, tier, true);
    log(`Scheduled ${tier} backup completed: ${result.filename}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordBackupRun(storage, tier, false, message);
    console.error(`Scheduled ${tier} backup failed:`, err);
  }
}

export async function runBackupSchedulerTick(storage: IStorage, now = new Date()): Promise<void> {
  const status = await getDbBackupStatus();
  if (!status.available) return;

  const config = getAppConfig();
  if (shouldRunDailyBackup(config, now, config.backupLastDailyAt)) {
    await runTier(storage, "daily");
  }
  if (shouldRunWeeklyBackup(config, now, config.backupLastWeeklyAt)) {
    await runTier(storage, "weekly");
  }
}

export async function runBackupNow(storage: IStorage, tier: "daily" | "weekly"): Promise<void> {
  const status = await getDbBackupStatus();
  if (!status.available) {
    throw new Error(status.reason ?? "Database backup is unavailable");
  }
  await runTier(storage, tier);
}

export function startBackupScheduler(storage: IStorage): void {
  const tick = () => void runBackupSchedulerTick(storage);
  setTimeout(tick, 10_000);
  setInterval(tick, 30_000);
}
