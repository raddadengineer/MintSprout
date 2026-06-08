import { describe, it, expect } from "vitest";
import { shouldRunDailyBackup, shouldRunWeeklyBackup } from "./backup-scheduler";
import type { DeploymentSettings } from "@shared/deployment-settings";

const base: DeploymentSettings = {
  backupScheduleEnabled: true,
  backupDailyEnabled: true,
  backupWeeklyEnabled: true,
  backupDailyUtcHour: 2,
  backupWeeklyUtcDay: 0,
  backupWeeklyUtcHour: 3,
};

describe("backup-scheduler", () => {
  it("runs daily backup at configured hour once per UTC day", () => {
    const now = new Date("2026-06-08T02:00:30.000Z");
    expect(shouldRunDailyBackup(base, now)).toBe(true);
    expect(shouldRunDailyBackup(base, now, "2026-06-08T02:05:00.000Z")).toBe(false);
    expect(shouldRunDailyBackup(base, new Date("2026-06-08T03:00:00.000Z"))).toBe(false);
  });

  it("skips daily backup when disabled", () => {
    const now = new Date("2026-06-08T02:00:00.000Z");
    expect(shouldRunDailyBackup({ ...base, backupDailyEnabled: false }, now)).toBe(false);
    expect(shouldRunDailyBackup({ ...base, backupScheduleEnabled: false }, now)).toBe(false);
  });

  it("runs weekly backup on configured day and hour once per UTC day", () => {
    const sunday = new Date("2026-06-07T03:00:15.000Z");
    expect(shouldRunWeeklyBackup(base, sunday)).toBe(true);
    expect(shouldRunWeeklyBackup(base, sunday, "2026-06-07T03:10:00.000Z")).toBe(false);
    expect(shouldRunWeeklyBackup(base, new Date("2026-06-08T03:00:00.000Z"))).toBe(false);
  });

  it("skips weekly backup when disabled", () => {
    const sunday = new Date("2026-06-07T03:00:00.000Z");
    expect(shouldRunWeeklyBackup({ ...base, backupWeeklyEnabled: false }, sunday)).toBe(false);
  });
});
