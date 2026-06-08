import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { gunzipSync } from "zlib";
import { pool, useNeonHttpDriver } from "./db";

const execFileAsync = promisify(execFile);

const MAX_RESTORE_BYTES = 50 * 1024 * 1024;

export type DbBackupStatus = {
  available: boolean;
  reason?: string;
};

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
