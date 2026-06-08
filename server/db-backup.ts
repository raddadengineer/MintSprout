import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { gunzipSync, gzipSync } from "zlib";
import { mkdir, readdir, stat, unlink, writeFile, access } from "fs/promises";
import path from "path";
import { pool, useNeonHttpDriver } from "./db";
import type { DeploymentSettings } from "@shared/deployment-settings";

const execFileAsync = promisify(execFile);

const MAX_RESTORE_BYTES = 50 * 1024 * 1024;

export type DbBackupStatus = {
  available: boolean;
  reason?: string;
};

export type BackupTier = "daily" | "weekly" | "manual";

export type BackupFileInfo = {
  tier: BackupTier;
  name: string;
  size: number;
  mtime: string;
};

export function getBackupRootDir(): string {
  return process.env.BACKUP_DIR || process.env.MINTSPROUT_BACKUPS_DIR || "/app/backups";
}

export async function getBackupDiskStatus(): Promise<{ writable: boolean; path: string; reason?: string }> {
  const dir = getBackupRootDir();
  try {
    await mkdir(dir, { recursive: true });
    await access(dir);
    return { writable: true, path: dir };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { writable: false, path: dir, reason: message };
  }
}

export async function getDbBackupStatus(): Promise<DbBackupStatus> {
  if (useNeonHttpDriver) {
    return { available: false, reason: "Backup requires a direct PostgreSQL connection (not Neon HTTP)." };
  }
  if (!pool) {
    return { available: false, reason: "No PostgreSQL connection configured." };
  }
  if (!process.env.DATABASE_URL) {
    return { available: false, reason: "DATABASE_URL is not set." };
  }
  try {
    await execFileAsync("pg_dump", ["--version"]);
    return { available: true };
  } catch {
    return { available: false, reason: "pg_dump is not installed on the server." };
  }
}

function runCommand(cmd: string, args: string[], stdin?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: process.env });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
    });
    if (stdin !== undefined) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

export async function createDatabaseBackup(): Promise<string> {
  const status = await getDbBackupStatus();
  if (!status.available) {
    throw new Error(status.reason ?? "Database backup is unavailable");
  }
  const { stdout } = await runCommand("pg_dump", [
    "--no-owner",
    "--no-acl",
    "--clean",
    "--if-exists",
    process.env.DATABASE_URL!,
  ]);
  return stdout;
}

export function backupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `mintsprout-${stamp}.sql`;
}

export function backupFilenameGz(): string {
  return backupFilename().replace(/\.sql$/, ".sql.gz");
}

export async function writeBackupToTier(tier: BackupTier): Promise<{ filename: string; path: string }> {
  const sql = await createDatabaseBackup();
  const root = getBackupRootDir();
  const dir = path.join(root, tier);
  await mkdir(dir, { recursive: true });
  const filename = backupFilenameGz();
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, gzipSync(Buffer.from(sql, "utf8")));
  return { filename, path: fullPath };
}

export async function pruneBackups(settings: DeploymentSettings): Promise<{ daily: number; weekly: number }> {
  const root = getBackupRootDir();
  const dailyRetentionMs = (settings.backupDailyRetentionDays ?? 14) * 86400000;
  const weeklyRetentionMs = (settings.backupWeeklyRetentionWeeks ?? 8) * 7 * 86400000;
  const now = Date.now();

  async function pruneTier(tier: "daily" | "weekly", maxAgeMs: number): Promise<number> {
    const dir = path.join(root, tier);
    let removed = 0;
    try {
      const entries = await readdir(dir);
      for (const name of entries) {
        if (!name.endsWith(".sql.gz")) continue;
        const fullPath = path.join(dir, name);
        const info = await stat(fullPath);
        if (now - info.mtimeMs > maxAgeMs) {
          await unlink(fullPath);
          removed++;
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return removed;
  }

  const daily = await pruneTier("daily", dailyRetentionMs);
  const weekly = await pruneTier("weekly", weeklyRetentionMs);
  return { daily, weekly };
}

export async function listBackupFiles(limit = 20): Promise<BackupFileInfo[]> {
  const root = getBackupRootDir();
  const tiers: BackupTier[] = ["daily", "weekly", "manual"];
  const files: BackupFileInfo[] = [];

  for (const tier of tiers) {
    const dir = path.join(root, tier);
    try {
      const entries = await readdir(dir);
      for (const name of entries) {
        if (!name.endsWith(".sql.gz") && !name.endsWith(".sql")) continue;
        const fullPath = path.join(dir, name);
        const info = await stat(fullPath);
        files.push({
          tier,
          name,
          size: info.size,
          mtime: info.mtime.toISOString(),
        });
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  files.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return files.slice(0, limit);
}

export async function runScheduledBackup(
  tier: "daily" | "weekly",
  settings: DeploymentSettings,
): Promise<{ filename: string; path: string }> {
  const result = await writeBackupToTier(tier);
  await pruneBackups(settings);
  return result;
}

export function normalizeRestoreSql(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  if (buf.length > MAX_RESTORE_BYTES) {
    throw new Error(`Backup file is too large (max ${MAX_RESTORE_BYTES / (1024 * 1024)} MB).`);
  }
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    const decompressed = gunzipSync(buf);
    if (decompressed.length > MAX_RESTORE_BYTES) {
      throw new Error(`Decompressed backup is too large (max ${MAX_RESTORE_BYTES / (1024 * 1024)} MB).`);
    }
    return decompressed.toString("utf8");
  }
  return buf.toString("utf8");
}

export function validateRestoreSql(sql: string): void {
  const trimmed = sql.trim();
  if (trimmed.length < 20) {
    throw new Error("Backup file is empty or too small.");
  }
  const lower = trimmed.toLowerCase();
  if (!lower.includes("postgres") && !lower.includes("create table") && !lower.includes("copy ") && !lower.includes("insert into")) {
    throw new Error("File does not look like a PostgreSQL backup.");
  }
}

export async function restoreDatabase(sql: string): Promise<void> {
  const status = await getDbBackupStatus();
  if (!status.available) {
    throw new Error(status.reason ?? "Database restore is unavailable");
  }
  validateRestoreSql(sql);
  await runCommand("psql", ["-v", "ON_ERROR_STOP=1", process.env.DATABASE_URL!], sql);
}
