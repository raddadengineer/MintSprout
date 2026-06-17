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

  it("creates one family-duty task per child when assignToAllChildren is set", async () => {
    const { storage } = await import("./storage");
    const { ensureFamilyJobCategories } = await import("./job-categories");
    const parent = await storage.getUserByUsername("parent");
    const familyId = parent!.familyId;

    await ensureFamilyJobCategories(storage, familyId);
    const categories = await storage.getJobCategoriesByFamily(familyId);
    const dutyCategory = categories.find((c) => c.slug === "self_care");
    expect(dutyCategory).toBeTruthy();

    const kid1 = await storage.createChild({
      familyId,
      name: "Bulk Kid A",
      age: 8,
      username: "bulkkida",
      password: "kidpass1",
    });
    const kid2 = await storage.createChild({
      familyId,
      name: "Bulk Kid B",
      age: 10,
      username: "bulkkidb",
      password: "kidpass1",
    });

    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({
        title: "Make bed",
        description: "Daily habit",
        amount: "0.00",
        recurrence: "daily",
        icon: "bed",
        categoryId: dutyCategory!.id,
        payType: "none",
        assignToAllChildren: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.jobs).toHaveLength(2);
    const assignedIds = res.body.jobs.map((j: { assignedToId: number }) => j.assignedToId).sort((a: number, b: number) => a - b);
    expect(assignedIds).toEqual([kid1.id, kid2.id].sort((a, b) => a - b));
  });

  it("creates paid tasks for all children with assignToAllChildren", async () => {
    const { storage } = await import("./storage");
    const { ensureFamilyJobCategories } = await import("./job-categories");
    const parent = await storage.getUserByUsername("parent");
    const familyId = parent!.familyId;

    await ensureFamilyJobCategories(storage, familyId);
    const categories = await storage.getJobCategoriesByFamily(familyId);
    const paidCategory = categories.find((c) => c.slug === "bonus_tasks");
    expect(paidCategory).toBeTruthy();

    await storage.createChild({
      familyId,
      name: "Paid Kid A",
      age: 9,
      username: "paidkida",
      password: "kidpass1",
    });
    await storage.createChild({
      familyId,
      name: "Paid Kid B",
      age: 11,
      username: "paidkidb",
      password: "kidpass1",
    });

    const childCount = (await storage.getChildrenByFamily(familyId)).length;

    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({
        title: "Wash car",
        description: "Extra job",
        amount: "15.00",
        recurrence: "once",
        icon: "car",
        categoryId: paidCategory!.id,
        payType: "standalone",
        assignToAllChildren: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(childCount);
    expect(res.body.jobs).toHaveLength(childCount);
    expect(res.body.jobs.every((j: { amount: string }) => j.amount === "15.00")).toBe(true);
  });

  it("skips children without allowance on bulk allowance create", async () => {
    const { storage } = await import("./storage");
    const { ensureFamilyJobCategories } = await import("./job-categories");
    const parent = await storage.getUserByUsername("parent");
    const familyId = parent!.familyId;

    await ensureFamilyJobCategories(storage, familyId);
    const categories = await storage.getJobCategoriesByFamily(familyId);
    const allowanceCategory = categories.find((c) => c.slug === "allowance");
    expect(allowanceCategory).toBeTruthy();

    const withAllowance = await storage.createChild({
      familyId,
      name: "Allow Kid",
      age: 9,
      username: "allowkid",
      password: "kidpass1",
    });
    const withoutAllowance = await storage.createChild({
      familyId,
      name: "No Allow Kid",
      age: 10,
      username: "noallowkid",
      password: "kidpass1",
    });

    await storage.createAllowance({
      familyId,
      childId: withAllowance.id,
      amount: "10.00",
      cadence: "weekly",
      dayOfWeek: 0,
      enabled: true,
    });

    const familyChildren = await storage.getChildrenByFamily(familyId);
    const familyAllowances = await storage.getAllowancesByFamily(familyId);
    const childrenWithAllowance = familyChildren.filter((c) =>
      familyAllowances.some((a) => a.childId === c.id && (a.enabled ?? true)),
    ).length;

    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({
        title: "Take out trash",
        description: "Weekly chore",
        amount: "0.00",
        recurrence: "weekly",
        icon: "trash2",
        categoryId: allowanceCategory!.id,
        payType: "allowance",
        assignToAllChildren: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(childrenWithAllowance);
    expect(res.body.skipped).toHaveLength(familyChildren.length - childrenWithAllowance);
    expect(res.body.jobs.some((j: { assignedToId: number }) => j.assignedToId === withAllowance.id)).toBe(true);
    expect(
      res.body.skipped.some((s: { childId: number }) => s.childId === withoutAllowance.id),
    ).toBe(true);
  });

  it("still creates a single task when assignToAllChildren is not set", async () => {
    const { storage } = await import("./storage");
    const { ensureFamilyJobCategories } = await import("./job-categories");
    const parent = await storage.getUserByUsername("parent");
    const familyId = parent!.familyId;

    await ensureFamilyJobCategories(storage, familyId);
    const categories = await storage.getJobCategoriesByFamily(familyId);
    const dutyCategory = categories.find((c) => c.slug === "self_care");
    const child = await storage.createChild({
      familyId,
      name: "Single Kid",
      age: 7,
      username: "singlekid",
      password: "kidpass1",
    });

    const res = await request(app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({
        title: "Brush teeth",
        description: "Morning and night",
        amount: "0.00",
        recurrence: "daily",
        icon: "sparkles",
        categoryId: dutyCategory!.id,
        payType: "none",
        assignedToId: child.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.assignedToId).toBe(child.id);
    expect(res.body.created).toBeUndefined();
  });
});
