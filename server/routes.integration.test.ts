import express from "express";
import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {
    select: () => ({
      from: () => Promise.resolve([]),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

vi.mock("./db-backup", () => ({
  createDatabaseBackup: vi.fn().mockResolvedValue("-- PostgreSQL dump\nSELECT 1;"),
  backupFilename: vi.fn().mockReturnValue("mintsprout-test.sql"),
  normalizeRestoreSql: vi.fn((sql: string) => sql),
  restoreDatabase: vi.fn().mockResolvedValue(undefined),
  getDbBackupStatus: vi.fn().mockResolvedValue({ available: true }),
  getBackupDiskStatus: vi.fn().mockResolvedValue({ writable: true, path: "/tmp" }),
  listBackupFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock("./backup-scheduler", () => ({
  runBackupNow: vi.fn().mockResolvedValue(undefined),
  startBackupScheduler: vi.fn(),
}));

vi.mock("./allowance-scheduler", () => ({
  startAllowanceScheduler: vi.fn(),
}));

vi.mock("./storage", async () => {
  const mod = await import("./storage");
  const instance = new mod.MemStorage();
  await instance.ready;
  return { storage: instance, MemStorage: mod.MemStorage };
});

describe("HTTP routes", () => {
  let app: express.Express;
  let parentToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);
    const { storage } = await import("./storage");
    const parent = await storage.getUserByUsername("parent");
    parentToken = jwt.sign(
      { id: parent!.id, username: parent!.username, role: parent!.role, familyId: parent!.familyId },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" },
    );
  });

  it("rejects invalid login credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "parent", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("accepts valid parent login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "parent", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("parent");
  });

  it("returns current user for authenticated parent", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("parent");
  });

  it("creates and deletes a child", async () => {
    const createRes = await request(app)
      .post("/api/children")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ name: "Route Kid", age: 9, username: "routekid", password: "kidpass1" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Route Kid");
    expect(createRes.body.username).toBe("routekid");

    const childId = createRes.body.id;
    const deleteRes = await request(app)
      .delete(`/api/children/${childId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/children/${childId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    expect(getRes.status).toBe(404);
  });

  it("rejects child access to backup endpoints", async () => {
    const childToken = jwt.sign(
      { id: 99, username: "fakechild", role: "child", familyId: 1 },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" },
    );

    const backupRes = await request(app)
      .post("/api/admin/settings/backup")
      .set("Authorization", `Bearer ${childToken}`);
    expect(backupRes.status).toBe(403);

    const runRes = await request(app)
      .post("/api/admin/settings/backup/run")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ tier: "daily" });
    expect(runRes.status).toBe(200);
    expect(runRes.body.ok).toBe(true);
  });

  it("allows parent to download a database backup", async () => {
    const res = await request(app)
      .post("/api/admin/settings/backup")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("PostgreSQL dump");
  });
});
