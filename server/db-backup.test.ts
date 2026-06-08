import { describe, it, expect } from "vitest";
import { normalizeRestoreSql, validateRestoreSql, backupFilename } from "./db-backup";

describe("db-backup", () => {
  it("builds a timestamped filename", () => {
    expect(backupFilename()).toMatch(/^mintsprout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql$/);
  });

  it("accepts plain SQL dumps", () => {
    const sql = "-- PostgreSQL dump\nCREATE TABLE users (id int);\nINSERT INTO users VALUES (1);";
    expect(normalizeRestoreSql(sql)).toBe(sql);
    expect(() => validateRestoreSql(sql)).not.toThrow();
  });

  it("rejects invalid dumps", () => {
    expect(() => validateRestoreSql("hello world invalid file contents")).toThrow(/does not look like/i);
    expect(() => validateRestoreSql("   ")).toThrow(/empty/i);
  });
});
