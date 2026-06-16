import fs from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { db, pool, runSql } from "./db";

const INIT_DB_SQL_PATH = path.join(process.cwd(), "init-db.sql");

async function baseSchemaReady(): Promise<boolean> {
  if (pool) {
    const table = await pool.query(
      "SELECT to_regclass('public.families') AS rel",
    );
    if (!table.rows[0]?.rel) {
      return false;
    }
    const result = await pool.query("SELECT 1 FROM families LIMIT 1");
    return (result.rowCount ?? 0) > 0;
  }

  const table = await db.execute(
    sql`SELECT to_regclass('public.families') AS rel`,
  );
  const tableRows = Array.isArray(table)
    ? table
    : ((table as { rows?: { rel: string | null }[] }).rows ?? []);
  if (!tableRows[0]?.rel) {
    return false;
  }

  const result = await db.execute(sql`SELECT 1 FROM families LIMIT 1`);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return rows.length > 0;
}

/** Apply init-db.sql when Postgres has no base tables (e.g. Portainer without init mount). */
export async function ensureBaseSchema(): Promise<void> {
  if (await baseSchemaReady()) {
    return;
  }

  const initSql = await fs.readFile(INIT_DB_SQL_PATH, "utf8");

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(initSql);
      await client.query("COMMIT");
      console.log("✅ Base schema applied from init-db.sql");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    await runSql(initSql);
    console.log("✅ Base schema applied from init-db.sql");
  }
}
