import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost:5432/mintsprout";

// Create database connection
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

// Test database connection
export async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}