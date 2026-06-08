import { describe, it, expect } from "vitest";

const runPostgresSmoke = process.env.CI_POSTGRES === "true" && !!process.env.DATABASE_URL;

describe.skipIf(!runPostgresSmoke)("Postgres smoke", () => {
  it("applies migrations on a real database", async () => {
    const { runMigrations } = await import("./migrations");
    await expect(runMigrations()).resolves.toBeUndefined();
  }, 60_000);
});
