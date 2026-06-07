import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Get database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

function shouldUseNeonHttp(url: string) {
  // Neon HTTP driver only works for Neon-hosted databases.
  // In Docker/local Postgres, use the standard `pg` driver.
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host.endsWith(".neon.tech") || host.includes("neon.tech");
  } catch {
    return false;
  }
}

export const useNeonHttpDriver = shouldUseNeonHttp(databaseUrl);

/** `node-postgres` supports interactive transactions; Neon HTTP driver does not. */
export const supportsInteractiveTransactions = !useNeonHttpDriver;

const useNeonHttp = useNeonHttpDriver;

// Create database connection
const sql = useNeonHttp ? neon(databaseUrl) : null;
const pool = useNeonHttp ? null : new Pool({ connectionString: databaseUrl });

export { pool };

export async function runSql(statement: string): Promise<void> {
  if (pool) {
    await pool.query(statement);
    return;
  }
  const { sql: drizzleSql } = await import("drizzle-orm");
  await db.execute(drizzleSql.raw(statement));
}

export const db = useNeonHttp
  ? drizzleNeon(sql!, { schema })
  : drizzlePg(pool!, { schema });

// Test database connection
export async function testConnection() {
  try {
    if (useNeonHttp) {
      await sql!`SELECT 1`;
    } else {
      await pool!.query("SELECT 1");
    }
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}