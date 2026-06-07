import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  insertJobSchema,
  insertJobCategorySchema,
  insertAllocationSettingsSchema,
  insertLessonSchema,
  insertChildSchema,
  insertSavingsGoalSchema,
  insertSpendingLogSchema,
  insertDonationSchema,
  insertAccountTypesSchema,
  insertFamilySettingsSchema,
  insertApprovalRequestSchema,
} from "@shared/schema";
import { z } from "zod";
import { applyJobPatch } from "./job-approval-payment";
import {
  executeAllowancePayout,
  getAllowancePeriodStatus,
} from "./allowance-payout";
import {
  isAiCoachEnabled,
  checkAiServices,
  chatWithSprout,
  synthesizeSpeech,
  buildCoachContext,
  kidModeFromAge,
  quickPromptsForMode,
  quickPromptsForPage,
  shouldDefaultSpeech,
  voiceForKidMode,
  type ChatMessage,
} from "./ai-coach";
import { buildDailyBrief, briefToSpeech } from "./daily-brief";
import { trySproutVoiceAction } from "./sprout-voice";
import { loadLearnLessonsForChild, trySproutLearnVoiceAction } from "./sprout-learn-voice";
import {
  ensureFamilyJobCategories,
  backfillJobCategories,
  backfillCategorySlugs,
  applyCategoryPaymentFields,
} from "./job-categories";
import { generateCatalogItems } from "./catalog-generator";
import { ensureCatalogLibrary, ensureFamilyCatalog } from "./catalog-seed";
import { importFromLibrary, publishLessonCatalogItem } from "./catalog-publish";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

function isoDayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKeyUTC(d: Date): string {
  // ISO week date (weeks start Monday). Compute based on UTC to match logs.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year.
  const day = date.getUTCDay() || 7; // 1..7 (Mon..Sun)
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function occurrenceKeyForRecurrence(recurrence: string, now: Date): string {
  if (recurrence === "once") return "once";
  if (recurrence === "daily") return isoDayKeyUTC(now);
  if (recurrence === "weekly") return isoWeekKeyUTC(now);
  if (recurrence === "monthly") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return isoDayKeyUTC(now);
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

/** Profile picker (kiosk) is on by default; set KIOSK_MODE=false to require username/password login. */
function isProfilePickerEnabled(): boolean {
  const raw = process.env.KIOSK_MODE;
  if (raw === "0" || raw === "false" || raw === "FALSE" || raw === "no") return false;
  return true;
}

function requireProfilePicker(req: any, res: any, next: any) {
  if (!isProfilePickerEnabled()) {
    return res.status(404).json({ message: "Not found" });
  }
  next();
}

function getKioskFamilyId(): number | null {
  const raw = process.env.KIOSK_FAMILY_ID;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Middleware to verify JWT token
function verifyToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public config (safe to expose)
  app.get("/api/config", (_req, res) => {
    res.json({
      profilePicker: isProfilePickerEnabled(),
      kioskMode: isProfilePickerEnabled(),
      requiresParentPin: !!process.env.PARENT_PIN,
    });
  });

  // Profile picker routes (single household — children need no password)
  app.get("/api/kiosk/children", requireProfilePicker, async (_req, res) => {
    try {
      const familyId = getKioskFamilyId() ?? 1;
      const children = await storage.getChildrenByFamily(familyId);
      res.json(children.map((c) => ({ id: c.id, name: c.name, age: c.age })));
    } catch (err) {
      console.error("Kiosk children error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kiosk/child-session", requireProfilePicker, async (req, res) => {
    try {
      const bodySchema = z.object({ childId: z.coerce.number().int().positive() }).strict();
      const { childId } = bodySchema.parse(req.body);

      const familyId = getKioskFamilyId() ?? 1;
      const child = await storage.getChild(childId);
      if (!child || child.familyId !== familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      const user = await storage.getUserById(child.userId);
      if (!user || user.role !== "child" || user.familyId !== familyId) {
        return res.status(404).json({ message: "Child user not found" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, familyId: user.familyId },
        getJwtSecret(),
        { expiresIn: "24h" },
      );

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name } });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/kiosk/parent-session", requireProfilePicker, async (req, res) => {
    try {
      const bodySchema = z.object({ pin: z.string().min(1) }).strict();
      const { pin } = bodySchema.parse(req.body);

      const expectedPin = process.env.PARENT_PIN;
      if (!expectedPin) {
        return res.status(500).json({ message: "PARENT_PIN is not configured" });
      }

      // Allow plain pin or bcrypt hash stored in env
      const pinOk = expectedPin.startsWith("$2")
        ? await bcrypt.compare(pin, expectedPin)
        : pin === expectedPin;

      if (!pinOk) {
        return res.status(401).json({ message: "Invalid PIN" });
      }

      const familyId = getKioskFamilyId() ?? 1;

      // Default parent user is "parent"
      const user = await storage.getUserByUsername("parent");
      if (!user || user.role !== "parent" || user.familyId !== familyId) {
        return res.status(404).json({ message: "Parent user not found" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, familyId: user.familyId },
        getJwtSecret(),
        { expiresIn: "24h" },
      );

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name } });
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, familyId: user.familyId },
        getJwtSecret(),
        { expiresIn: "24h" }
      );

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name } });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({ id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Children routes
  app.get("/api/children", verifyToken, async (req: any, res) => {
    try {
      const children = await storage.getChildrenByFamily(req.user.familyId);
      if (req.user.role === "child") {
        const self = children.find((c) => c.userId === req.user.id);
        return res.json(self ? [self] : []);
      }
      res.json(children);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      const child = await storage.getChild(parseInt(req.params.id));
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }
      if (req.user.role === "child" && child.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(child);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/children", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can add children" });
      }

      const bodySchema = z.object({
        name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
        age: z.coerce.number().int().min(1, "Age must be at least 1").max(18, "Age must be 18 or less"),
      });

      const body = bodySchema.parse(req.body);

      // Create the child's user first so we can satisfy children.userId (NOT NULL)
      const base = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const baseUsername = base || "child";
      let username = baseUsername;
      for (let i = 0; i < 25; i++) {
        const exists = await storage.getUserByUsername(username);
        if (!exists) break;
        username = `${baseUsername}${Math.floor(100 + Math.random() * 900)}`; // 3-digit suffix
      }

      const defaultPassword = "password123";
      const childUser = await storage.createUser({
        username,
        password: defaultPassword,
        role: "child",
        familyId: req.user.familyId,
        name: body.name,
      });

      const child = await storage.createChild({
        userId: childUser.id,
        familyId: req.user.familyId,
        name: body.name,
        age: body.age,
      });

      // Create default allocation settings
      await storage.createAllocationSettings({
        childId: child.id,
        spendingPercentage: 25,
        savingsPercentage: 35,
        rothIraPercentage: 20,
        brokeragePercentage: 20,
      });

      res.status(201).json(child);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid child data" });
      }
      res.status(400).json({ message: (error as any)?.message ?? "Invalid child data" });
    }
  });

  app.patch("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update children" });
      }

      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);

      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      const updateData = {
        name: req.body.name,
        age: req.body.age,
      };

      const updatedChild = await storage.updateChild(childId, updateData);
      res.json(updatedChild);
    } catch (error) {
      res.status(400).json({ message: "Invalid child data" });
    }
  });

  app.delete("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can remove children" });
      }

      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);

      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      // Note: In a real app, you might want to archive instead of delete
      // This is a simplified implementation
      const success = await storage.deleteChild(childId);

      if (success) {
        res.json({ message: "Child removed successfully" });
      } else {
        res.status(500).json({ message: "Failed to remove child" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Job categories (parent-editable buckets)
  app.get("/api/job-categories", verifyToken, async (req: any, res) => {
    try {
      await ensureFamilyJobCategories(storage, req.user.familyId);
      await backfillJobCategories(storage, req.user.familyId);
      await backfillCategorySlugs(storage, req.user.familyId);
      const includeDisabled = req.user.role === "parent" && req.query.all === "1";
      const categories = await storage.getJobCategoriesByFamily(req.user.familyId, {
        includeDisabled,
      });
      res.json(categories);
    } catch (err) {
      console.error("Job categories list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/job-categories", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage categories" });
      }
      const body = insertJobCategorySchema.parse({
        ...req.body,
        familyId: req.user.familyId,
      });
      const existing = await storage.getJobCategoriesByFamily(req.user.familyId, { includeDisabled: true });
      const maxSort = existing.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), -1);
      const category = await storage.createJobCategory({
        ...body,
        sortOrder: body.sortOrder ?? maxSort + 1,
        enabled: body.enabled ?? true,
      });
      res.json(category);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid category data" });
      console.error("Create category error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/job-categories/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage categories" });
      }
      const id = parseInt(req.params.id);
      const category = await storage.getJobCategory(id);
      if (!category || category.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Category not found" });
      }
      const patchSchema = z
        .object({
          label: z.string().min(1).max(80).optional(),
          description: z.string().max(500).nullable().optional(),
          icon: z.string().max(64).optional(),
          sortOrder: z.number().int().optional(),
          enabled: z.boolean().optional(),
          paymentMode: z.enum(["none", "allowance", "standalone"]).optional(),
        })
        .strict();
      const patch = patchSchema.parse(req.body ?? {});
      const updated = await storage.updateJobCategory(id, patch);
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid category data" });
      console.error("Update category error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/job-categories/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage categories" });
      }
      const id = parseInt(req.params.id);
      const category = await storage.getJobCategory(id);
      if (!category || category.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Category not found" });
      }
      const jobCount = await storage.countJobsInCategory(id);
      if (jobCount > 0) {
        await storage.updateJobCategory(id, { enabled: false });
        return res.json({ disabled: true, message: "Category has jobs — disabled instead of deleted" });
      }
      await storage.deleteJobCategory(id);
      res.json({ deleted: true });
    } catch (err) {
      console.error("Delete category error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/job-categories/reorder", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage categories" });
      }
      const bodySchema = z.object({ orderedIds: z.array(z.number().int().positive()) }).strict();
      const { orderedIds } = bodySchema.parse(req.body ?? {});
      for (let i = 0; i < orderedIds.length; i++) {
        const cat = await storage.getJobCategory(orderedIds[i]);
        if (!cat || cat.familyId !== req.user.familyId) continue;
        await storage.updateJobCategory(orderedIds[i], { sortOrder: i });
      }
      const categories = await storage.getJobCategoriesByFamily(req.user.familyId, { includeDisabled: true });
      res.json(categories);
    } catch (err) {
      console.error("Reorder categories error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Catalog (job + lesson templates)
  app.get("/api/catalog/library", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can browse the catalog library" });
      }
      await ensureCatalogLibrary(storage);
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const categoryKey = typeof req.query.categoryKey === "string" ? req.query.categoryKey : undefined;
      const items = await storage.getCatalogLibrary(type, categoryKey);
      res.json(items);
    } catch (err) {
      console.error("Catalog library error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/catalog/items", verifyToken, async (req: any, res) => {
    try {
      const type = req.query.type as string;
      if (!type || (type !== "job" && type !== "lesson")) {
        return res.status(400).json({ message: "type must be job or lesson" });
      }
      await ensureCatalogLibrary(storage);
      if (type === "job") {
        await ensureFamilyJobCategories(storage, req.user.familyId);
        await backfillCategorySlugs(storage, req.user.familyId);
      }
      await ensureFamilyCatalog(storage, req.user.familyId);
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const categoryKey = typeof req.query.categoryKey === "string" ? req.query.categoryKey : undefined;
      const enabledOnly = req.user.role !== "parent" || req.query.enabledOnly === "1";
      const items = await storage.getFamilyCatalogItems(req.user.familyId, type, {
        categoryId,
        categoryKey,
        enabledOnly,
      });
      res.json(items);
    } catch (err) {
      console.error("Catalog items list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/catalog/items", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage catalog items" });
      }
      const bodySchema = z.object({
        catalogType: z.enum(["job", "lesson"]),
        categoryId: z.number().int().positive().optional().nullable(),
        categoryKey: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        payload: z.record(z.unknown()),
        enabled: z.boolean().optional(),
      });
      const body = bodySchema.parse(req.body);
      if (body.catalogType === "job" && body.categoryId) {
        const cat = await storage.getJobCategory(body.categoryId);
        if (!cat || cat.familyId !== req.user.familyId) {
          return res.status(400).json({ message: "Invalid category" });
        }
      }
      const existing = await storage.getFamilyCatalogItems(req.user.familyId, body.catalogType, {
        categoryId: body.categoryId ?? undefined,
        categoryKey: body.categoryKey,
      });
      const maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);
      const item = await storage.createFamilyCatalogItem({
        familyId: req.user.familyId,
        catalogType: body.catalogType,
        categoryId: body.categoryId ?? null,
        categoryKey: body.categoryKey,
        title: body.title,
        description: body.description ?? null,
        payload: JSON.stringify(body.payload),
        enabled: body.enabled ?? true,
        sortOrder: maxSort + 1,
      });
      res.json(item);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid catalog item" });
      console.error("Create catalog item error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/catalog/items/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage catalog items" });
      }
      const id = parseInt(req.params.id);
      const item = await storage.getFamilyCatalogItem(id);
      if (!item || item.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Catalog item not found" });
      }
      const updates: Record<string, unknown> = {};
      if (req.body.title != null) updates.title = req.body.title;
      if (req.body.description != null) updates.description = req.body.description;
      if (req.body.enabled != null) updates.enabled = !!req.body.enabled;
      if (req.body.sortOrder != null) updates.sortOrder = Number(req.body.sortOrder);
      if (req.body.payload != null) updates.payload = JSON.stringify(req.body.payload);
      const updated = await storage.updateFamilyCatalogItem(id, updates);
      res.json(updated);
    } catch (err) {
      console.error("Update catalog item error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/catalog/items/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can manage catalog items" });
      }
      const id = parseInt(req.params.id);
      const item = await storage.getFamilyCatalogItem(id);
      if (!item || item.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Catalog item not found" });
      }
      await storage.deleteFamilyCatalogItem(id);
      res.json({ deleted: true });
    } catch (err) {
      console.error("Delete catalog item error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/catalog/import", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can import catalog items" });
      }
      const bodySchema = z.object({
        libraryItemId: z.number().int().positive(),
        categoryId: z.number().int().positive().optional().nullable(),
      });
      const { libraryItemId, categoryId } = bodySchema.parse(req.body);
      await ensureCatalogLibrary(storage);
      const item = await importFromLibrary(storage, req.user.familyId, libraryItemId, categoryId ?? null);
      res.json(item);
    } catch (err: any) {
      const status = err.status ?? (err instanceof z.ZodError ? 400 : 500);
      res.status(status).json({ message: err.message ?? "Import failed" });
    }
  });

  app.post("/api/catalog/generate", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can generate catalog items" });
      }
      const bodySchema = z.object({
        type: z.enum(["job", "lesson"]),
        categoryKey: z.string().min(1),
        categoryId: z.number().int().positive().optional(),
        count: z.number().int().min(1).max(10).default(3),
      });
      const { type, categoryKey, count } = bodySchema.parse(req.body);
      const proposals = await generateCatalogItems(type, categoryKey, count);
      res.json({ proposals });
    } catch (err: any) {
      const status = err.status ?? (err instanceof z.ZodError ? 400 : 500);
      res.status(status).json({ message: err.message ?? "Generation failed" });
    }
  });

  app.post("/api/catalog/items/batch", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can save catalog items" });
      }
      const itemSchema = z.object({
        catalogType: z.enum(["job", "lesson"]),
        categoryId: z.number().int().positive().optional().nullable(),
        categoryKey: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        payload: z.record(z.unknown()),
      });
      const bodySchema = z.object({ items: z.array(itemSchema).min(1) });
      const { items } = bodySchema.parse(req.body);
      const saved = [];
      for (const body of items) {
        const existing = await storage.getFamilyCatalogItems(req.user.familyId, body.catalogType, {
          categoryId: body.categoryId ?? undefined,
          categoryKey: body.categoryKey,
        });
        if (existing.some((i) => i.title === body.title)) continue;
        const maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), -1);
        const item = await storage.createFamilyCatalogItem({
          familyId: req.user.familyId,
          catalogType: body.catalogType,
          categoryId: body.categoryId ?? null,
          categoryKey: body.categoryKey,
          title: body.title,
          description: body.description ?? null,
          payload: JSON.stringify(body.payload),
          enabled: true,
          sortOrder: maxSort + 1,
        });
        saved.push(item);
      }
      res.json(saved);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid batch data" });
      console.error("Batch catalog save error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/catalog/items/:id/publish-lesson", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can publish lessons" });
      }
      const id = parseInt(req.params.id);
      const result = await publishLessonCatalogItem(storage, req.user.familyId, id);
      res.json(result);
    } catch (err: any) {
      const status = err.status ?? 500;
      res.status(status).json({ message: err.message ?? "Publish failed" });
    }
  });

  // Jobs routes
  app.get("/api/jobs", verifyToken, async (req: any, res) => {
    try {
      let jobs;
      if (req.user.role === "parent") {
        jobs = await storage.getJobsByFamily(req.user.familyId);
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        jobs = await storage.getJobsByChild(child.id);
      }
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/jobs", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create jobs" });
      }

      let body = { ...req.body };
      const payType = body.payType as "none" | "allowance" | "standalone" | undefined;
      delete body.payType;

      if (body.categoryId != null && body.categoryId !== "") {
        const categoryId = Number(body.categoryId);
        const category = await storage.getJobCategory(categoryId);
        if (!category || category.familyId !== req.user.familyId || !category.enabled) {
          return res.status(400).json({ message: "Invalid job category" });
        }
        const effectiveMode = payType ?? category.paymentMode;
        if (effectiveMode === "allowance") {
          const allowanceId = Number(body.allowanceId);
          const assignedToId = Number(body.assignedToId);
          if (!Number.isFinite(allowanceId) || !Number.isFinite(assignedToId)) {
            return res.status(400).json({ message: "Allowance tasks require selecting an allowance" });
          }
          const allowances = await storage.getAllowancesByFamily(req.user.familyId);
          const allowance = allowances.find((a) => a.id === allowanceId);
          if (!allowance || allowance.childId !== assignedToId) {
            return res.status(400).json({ message: "Allowance does not belong to that child" });
          }
          body.amount = "0.00";
          body.isFamilyDuty = false;
        } else if (effectiveMode === "none") {
          body.amount = "0.00";
          body.isFamilyDuty = true;
          delete body.allowanceId;
        } else {
          body.isFamilyDuty = false;
          delete body.allowanceId;
          if (body.amount == null || body.amount === "") {
            return res.status(400).json({ message: "One-time payment tasks require an amount" });
          }
        }
        if (!payType) {
          body = applyCategoryPaymentFields(category, body);
        }
      } else if (payType === "none" || body?.isFamilyDuty === true || body?.isFamilyDuty === "true") {
        body.amount = "0.00";
        body.isFamilyDuty = true;
        delete body.allowanceId;
      } else if (body?.allowanceId != null && body?.allowanceId !== "") {
        const allowanceId = Number(body.allowanceId);
        const assignedToId = Number(body.assignedToId);
        if (!Number.isFinite(allowanceId) || !Number.isFinite(assignedToId)) {
          return res.status(400).json({ message: "Invalid allowance assignment" });
        }
        const allowances = await storage.getAllowancesByFamily(req.user.familyId);
        const allowance = allowances.find((a) => a.id === allowanceId);
        if (!allowance || allowance.childId !== assignedToId) {
          return res.status(400).json({ message: "Allowance does not belong to that child" });
        }
        body.amount = "0.00";
        body.isFamilyDuty = false;
      } else {
        delete body.allowanceId;
        body.isFamilyDuty = false;
      }

      const jobData = insertJobSchema.parse({
        ...body,
        familyId: req.user.familyId,
        status: "assigned",
      });

      const job = await storage.createJob(jobData);
      res.json(job);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const first = error.issues?.[0];
        const path = first?.path?.length ? first.path.join(".") : undefined;
        const detail = first?.message ? (path ? `${path}: ${first.message}` : first.message) : "Invalid job data";
        return res.status(400).json({ message: detail });
      }
      console.error("Create job error:", error);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  // Mark an allowance-tied chore occurrence as missed (counts toward allowance penalty)
  app.post("/api/jobs/:id/missed", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can mark chores as missed" });
      }

      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const allowanceId = (job as any).allowanceId as number | null | undefined;
      if (allowanceId == null) {
        return res.status(400).json({ message: "This job is not tied to an allowance" });
      }

      if (job.status === "approved") {
        return res.status(400).json({ message: "Approved jobs can't be marked missed" });
      }

      // Default to "today" in UTC; optionally allow the client to specify a date key.
      const bodySchema = z.object({ occurrenceKey: z.string().min(1).optional() }).strict();
      const { occurrenceKey } = bodySchema.parse(req.body ?? {});
      const key = occurrenceKey ?? occurrenceKeyForRecurrence((job as any).recurrence, new Date());

      const inserted = await db
        .insert(schema.allowanceMissedJobLog)
        .values({ allowanceId, jobId: job.id, occurrenceKey: key } as any)
        .onConflictDoNothing()
        .returning();

      // Close this occurrence. The scheduler will reopen it when the next occurrence starts.
      await storage.updateJob(job.id, { status: "approved" } as any);

      if (inserted.length === 0) return res.json({ ok: true, message: "Already marked missed for this occurrence" });

      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const first = err.issues?.[0];
        const path = first?.path?.length ? first.path.join(".") : undefined;
        const detail = first?.message ? (path ? `${path}: ${first.message}` : first.message) : "Invalid request";
        return res.status(400).json({ message: detail });
      }
      console.error("Mark missed error:", err);
      res.status(500).json({ message: "Failed to mark missed" });
    }
  });

  app.patch("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      let body = { ...req.body };

      if (req.user.role === "parent" && body.categoryId != null && body.categoryId !== "") {
        const categoryId = Number(body.categoryId);
        const category = await storage.getJobCategory(categoryId);
        if (!category || category.familyId !== req.user.familyId || !category.enabled) {
          return res.status(400).json({ message: "Invalid job category" });
        }
        if (category.paymentMode === "allowance") {
          const job = await storage.getJob(jobId);
          const allowanceId = Number(body.allowanceId ?? job?.allowanceId);
          const assignedToId = Number(body.assignedToId ?? job?.assignedToId);
          if (!Number.isFinite(allowanceId) || !Number.isFinite(assignedToId)) {
            return res.status(400).json({ message: "Allowance category requires an allowance" });
          }
          const allowances = await storage.getAllowancesByFamily(req.user.familyId);
          const allowance = allowances.find((a) => a.id === allowanceId);
          if (!allowance || allowance.childId !== assignedToId) {
            return res.status(400).json({ message: "Allowance does not belong to that child" });
          }
        }
        body = applyCategoryPaymentFields(category, body);
      }

      // Allowance-tied chores: prevent completing more than once per occurrence window.
      if (req.user.role === "child" && req.body?.status === "completed") {
        const job = await storage.getJob(jobId);
        if (job && job.familyId === req.user.familyId) {
          const allowanceId = (job as any).allowanceId as number | null | undefined;
          const isFamilyDuty = !!(job as any).isFamilyDuty;
          if (allowanceId != null) {
            const occurrenceKey = occurrenceKeyForRecurrence((job as any).recurrence, new Date());
            const inserted = await db
              .insert(schema.allowanceCompletedJobLog)
              .values({ allowanceId, jobId: job.id, occurrenceKey } as any)
              .onConflictDoNothing()
              .returning();
            if (inserted.length === 0) {
              return res.status(400).json({ message: "Already completed for this occurrence" });
            }
          } else if (isFamilyDuty) {
            const occurrenceKey = occurrenceKeyForRecurrence((job as any).recurrence, new Date());
            const inserted = await db
              .insert(schema.familyDutyCompletedLog)
              .values({ jobId: job.id, occurrenceKey } as any)
              .onConflictDoNothing()
              .returning();
            if (inserted.length === 0) {
              return res.status(400).json({ message: "Already completed for this occurrence" });
            }
          }
        }
      }

      const updatedJob = await applyJobPatch(storage, { familyId: req.user.familyId, role: req.user.role }, jobId, body);
      res.json(updatedJob);
    } catch (error: any) {
      const status = typeof error?.statusCode === "number" ? error.statusCode : 500;
      const message = typeof error?.message === "string" ? error.message : "Internal server error";
      res.status(status).json({ message });
    }
  });

  app.delete("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);

      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Only parents can delete jobs
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete jobs" });
      }

      // If job was approved, need to reverse the payment and update child balances
      if (job.status === "approved") {
        const payments = await storage.getPaymentsByFamily(req.user.familyId);
        const jobPayment = payments.find(p => p.jobId === jobId);

        if (jobPayment) {
          // Reverse the payment amounts from child balances
          const child = await storage.getChild(job.assignedToId);
          if (child) {
            await storage.updateChild(job.assignedToId, {
              totalEarned: (parseFloat(child.totalEarned || "0") - parseFloat(jobPayment.amount)).toFixed(2),
              spendingBalance: (parseFloat(child.spendingBalance || "0") - parseFloat(jobPayment.spendingAmount)).toFixed(2),
              savingsBalance: (parseFloat(child.savingsBalance || "0") - parseFloat(jobPayment.savingsAmount)).toFixed(2),
              rothIraBalance: (parseFloat(child.rothIraBalance || "0") - parseFloat(jobPayment.rothIraAmount)).toFixed(2),
              brokerageBalance: (parseFloat(child.brokerageBalance || "0") - parseFloat(jobPayment.brokerageAmount)).toFixed(2),
              completedJobs: Math.max((child.completedJobs || 0) - 1, 0)
            });
          }
        }
      }

      // Delete associated payments
      await storage.deletePaymentsByJob(jobId);

      const success = await storage.deleteJob(jobId);

      if (success) {
        res.json({ message: "Job deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete job" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get payment details for a specific job
  app.get("/api/payments/job/:jobId", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);

      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get all payments for the family and filter by jobId
      const payments = await storage.getPaymentsByFamily(req.user.familyId);
      const jobPayment = payments.find(p => p.jobId === jobId);

      if (jobPayment) {
        res.json(jobPayment);
      } else {
        res.status(404).json({ message: "Payment not found for this job" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update payment allocation for a completed job
  app.patch("/api/payments/job/:jobId", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);

      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update payment allocations" });
      }

      if (job.status !== "approved") {
        return res.status(400).json({ message: "Can only update payments for approved jobs" });
      }

      // Get existing payment
      const payments = await storage.getPaymentsByFamily(req.user.familyId);
      const existingPayment = payments.find(p => p.jobId === jobId);

      if (!existingPayment) {
        return res.status(404).json({ message: "Payment not found for this job" });
      }

      const { spendingAmount, savingsAmount, rothIraAmount, brokerageAmount } = req.body;

      // Validate allocation totals match job amount
      const total = parseFloat(spendingAmount) + parseFloat(savingsAmount) + parseFloat(rothIraAmount) + parseFloat(brokerageAmount);
      const jobAmount = parseFloat(job.amount);

      if (Math.abs(total - jobAmount) > 0.01) {
        return res.status(400).json({
          message: `Total allocation ($${total.toFixed(2)}) must equal job amount ($${jobAmount.toFixed(2)})`
        });
      }

      // Calculate differences
      const spendingDiff = parseFloat(spendingAmount) - parseFloat(existingPayment.spendingAmount);
      const savingsDiff = parseFloat(savingsAmount) - parseFloat(existingPayment.savingsAmount);
      const rothIraDiff = parseFloat(rothIraAmount) - parseFloat(existingPayment.rothIraAmount);
      const brokerageDiff = parseFloat(brokerageAmount) - parseFloat(existingPayment.brokerageAmount);

      // Update child balances
      const child = await storage.getChild(job.assignedToId);
      if (child) {
        await storage.updateChild(job.assignedToId, {
          spendingBalance: (parseFloat(child.spendingBalance || "0") + spendingDiff).toFixed(2),
          savingsBalance: (parseFloat(child.savingsBalance || "0") + savingsDiff).toFixed(2),
          rothIraBalance: (parseFloat(child.rothIraBalance || "0") + rothIraDiff).toFixed(2),
          brokerageBalance: (parseFloat(child.brokerageBalance || "0") + brokerageDiff).toFixed(2),
        });
      }

      // Update the existing payment record
      const updatedPayment = await storage.updatePayment(existingPayment.id, {
        spendingAmount: spendingAmount.toString(),
        savingsAmount: savingsAmount.toString(),
        rothIraAmount: rothIraAmount.toString(),
        brokerageAmount: brokerageAmount.toString(),
      });

      res.json({
        message: "Payment allocation updated successfully",
        payment: updatedPayment,
        balanceChanges: {
          spendingDiff,
          savingsDiff,
          rothIraDiff,
          brokerageDiff
        }
      });
    } catch (error) {
      console.error("Error updating payment allocation:", error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Allocation settings routes
  app.get("/api/allocation/:childId", verifyToken, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const child = await storage.getChild(childId);

      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      const settings = await storage.getAllocationSettings(childId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/allocation/:childId", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update allocation settings" });
      }

      const childId = parseInt(req.params.childId);
      const child = await storage.getChild(childId);

      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      // Add childId to the request body for schema validation
      const requestData = { ...req.body, childId };
      const allocationData = insertAllocationSettingsSchema.parse(requestData);

      // Validate percentages sum to 100
      const total = (allocationData.spendingPercentage || 0) + (allocationData.savingsPercentage || 0) +
        (allocationData.rothIraPercentage || 0) + (allocationData.brokeragePercentage || 0);
      if (total !== 100) {
        return res.status(400).json({ message: "Percentages must sum to 100" });
      }

      const updatedSettings = await storage.updateAllocationSettings(childId, allocationData);
      res.json(updatedSettings);
    } catch (error) {
      res.status(400).json({ message: "Invalid allocation data" });
    }
  });

  // Account Types routes
  const updateAccountTypesSchema = insertAccountTypesSchema
    .pick({
      spendingEnabled: true,
      savingsEnabled: true,
      rothIraEnabled: true,
      brokerageEnabled: true,
    })
    .partial();

  app.get("/api/account-types/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);

      // Verify user has access to this family
      if (req.user.familyId !== familyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const accountTypes = await storage.getAccountTypes(familyId);
      if (!accountTypes) {
        // Create default account types if none exist
        const defaultAccountTypes = await storage.createAccountTypes({
          familyId,
          spendingEnabled: true,
          savingsEnabled: true,
          rothIraEnabled: false,
          brokerageEnabled: false
        });
        return res.json(defaultAccountTypes);
      }

      res.json(accountTypes);
    } catch (error) {
      console.error('Account types GET error:', error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/account-types/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);

      // Only parents can update account types
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update account types" });
      }

      // Verify user has access to this family
      if (req.user.familyId !== familyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const accountTypesData = updateAccountTypesSchema.parse(req.body);
      const updatedAccountTypes = await storage.updateAccountTypes(familyId, accountTypesData);

      if (!updatedAccountTypes) {
        return res.status(404).json({ message: "Account types not found" });
      }

      // Update allocation settings for all children in the family when account types change
      const children = await storage.getChildrenByFamily(familyId);

      for (const child of children) {
        // Get current allocation settings
        const currentAllocation = await storage.getAllocationSettings(child.id);

        // Calculate enabled accounts and redistribute percentages
        const enabledAccounts = [];
        if (accountTypesData.spendingEnabled) enabledAccounts.push('spending');
        if (accountTypesData.savingsEnabled) enabledAccounts.push('savings');
        if (accountTypesData.rothIraEnabled) enabledAccounts.push('rothIra');
        if (accountTypesData.brokerageEnabled) enabledAccounts.push('brokerage');

        if (enabledAccounts.length > 0) {
          // Calculate equal distribution
          const equalPercentage = Math.floor(100 / enabledAccounts.length);
          const remainder = 100 - (equalPercentage * enabledAccounts.length);

          const newAllocation = {
            spendingPercentage: accountTypesData.spendingEnabled
              ? equalPercentage + (enabledAccounts[0] === 'spending' ? remainder : 0)
              : 0,
            savingsPercentage: accountTypesData.savingsEnabled
              ? equalPercentage + (enabledAccounts[0] === 'savings' ? remainder : 0)
              : 0,
            rothIraPercentage: accountTypesData.rothIraEnabled
              ? equalPercentage + (enabledAccounts[0] === 'rothIra' ? remainder : 0)
              : 0,
            brokeragePercentage: accountTypesData.brokerageEnabled
              ? equalPercentage + (enabledAccounts[0] === 'brokerage' ? remainder : 0)
              : 0,
          };

          if (currentAllocation) {
            await storage.updateAllocationSettings(child.id, newAllocation);
          } else {
            await storage.createAllocationSettings({
              childId: child.id,
              ...newAllocation,
            });
          }
        }
      }

      res.json(updatedAccountTypes);
    } catch (error) {
      console.error('Account types PUT error:', error);
      res.status(400).json({ message: "Invalid account types data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Family Settings (parent controls)
  const familySettingsUpdateSchema = insertFamilySettingsSchema
    .pick({
      requireSpendingApproval: true,
      requireDonationApproval: true,
      requireGoalFundingApproval: true,
    })
    .partial()
    .strict();

  app.get("/api/family-settings/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can view settings" });
      if (req.user.familyId !== familyId) return res.status(403).json({ message: "Access denied" });

      const settings = await storage.getFamilySettings(familyId);
      if (!settings) {
        const created = await storage.upsertFamilySettings({ familyId });
        return res.json(created);
      }
      res.json(settings);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/family-settings/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can update settings" });
      if (req.user.familyId !== familyId) return res.status(403).json({ message: "Access denied" });

      const updates = familySettingsUpdateSchema.parse(req.body);
      const updated = await storage.upsertFamilySettings({ familyId, ...updates });
      res.json(updated);
    } catch {
      res.status(400).json({ message: "Invalid settings" });
    }
  });

  // Approval requests
  const approvalCreateSchema = insertApprovalRequestSchema
    .pick({ type: true, amount: true, details: true })
    .strict();

  app.get("/api/approval-requests", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can view requests" });
      const status = req.query.status ? String(req.query.status) : "pending";
      const requests = await storage.getApprovalRequestsByFamily(req.user.familyId, status);
      requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(requests);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/approval-requests", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "child") return res.status(403).json({ message: "Only children can create requests" });
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const body = approvalCreateSchema.parse(req.body);

      const created = await storage.createApprovalRequest({
        familyId: req.user.familyId,
        childId,
        type: body.type,
        amount: body.amount,
        details: body.details,
        status: "pending",
        decidedByUserId: null,
      } as any);
      res.status(201).json(created);
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/approval-requests/:id/decide", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can decide requests" });
      const id = parseInt(req.params.id);
      const decisionSchema = z.object({ decision: z.enum(["approve", "deny"]) }).strict();
      const { decision } = decisionSchema.parse(req.body);
      const existing = await storage.getApprovalRequest(id);
      if (!existing || existing.familyId !== req.user.familyId) return res.status(404).json({ message: "Request not found" });
      if (existing.status !== "pending") return res.status(400).json({ message: "Request already decided" });

      // If approved, execute the action
      if (decision === "approve") {
        const child = await storage.getChild(existing.childId);
        if (!child || child.familyId !== req.user.familyId) return res.status(404).json({ message: "Child not found" });

        const details = JSON.parse(existing.details) as any;
        const amount = parseFloat(existing.amount || "0");
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

        if (existing.type === "spend") {
          const spendingBalance = parseFloat(child.spendingBalance || "0");
          if (spendingBalance < amount) return res.status(400).json({ message: "Insufficient spending balance" });
          await storage.updateChild(child.id, { spendingBalance: (spendingBalance - amount).toFixed(2) });
          const entry = await storage.createSpendingLog({
            childId: child.id,
            item: String(details.item || "Spending"),
            amount: amount.toFixed(2),
            category: String(details.category || "other"),
            date: String(details.date || new Date().toISOString().split("T")[0]),
          } as any);
          await storage.createTransaction({
            childId: child.id,
            type: "spend",
            amount: amount.toFixed(2),
            fromAccount: "spending",
            toAccount: "external",
            note: `Approved spend: ${entry.item} (${entry.category})`,
          });
        } else if (existing.type === "donate") {
          const spendingBalance = parseFloat(child.spendingBalance || "0");
          if (spendingBalance < amount) return res.status(400).json({ message: "Insufficient spending balance" });
          await storage.updateChild(child.id, { spendingBalance: (spendingBalance - amount).toFixed(2) });
          const donation = await storage.createDonation({
            childId: child.id,
            organization: String(details.organization || "Donation"),
            cause: String(details.cause || "cause"),
            amount: amount.toFixed(2),
            date: String(details.date || new Date().toISOString().split("T")[0]),
          } as any);
          await storage.createTransaction({
            childId: child.id,
            type: "donate",
            amount: amount.toFixed(2),
            fromAccount: "spending",
            toAccount: "external",
            note: `Approved donation: ${donation.organization} (${donation.cause})`,
          });
        } else if (existing.type === "goal_fund") {
          const goalId = Number(details.goalId);
          const goal = await storage.getSavingsGoal(goalId);
          if (!goal || goal.childId !== child.id) return res.status(404).json({ message: "Goal not found" });
          const savingsBalance = parseFloat(child.savingsBalance || "0");
          if (savingsBalance < amount) return res.status(400).json({ message: "Insufficient savings balance" });
          const currentAmount = parseFloat(goal.currentAmount || "0");
          const targetAmount = Math.max(0.01, parseFloat(goal.targetAmount || "0.01"));
          const nextCurrent = currentAmount + amount;
          await storage.updateChild(child.id, { savingsBalance: (savingsBalance - amount).toFixed(2) });
          await storage.updateSavingsGoal(goal.id, { currentAmount: nextCurrent.toFixed(2), completed: nextCurrent >= targetAmount });
          await storage.createTransaction({
            childId: child.id,
            type: "goal_fund",
            amount: amount.toFixed(2),
            fromAccount: "savings",
            toAccount: "goal",
            note: `Approved goal funding: ${goal.name}`,
          });
        }
      }

      const updated = await storage.decideApprovalRequest(id, {
        status: decision === "approve" ? "approved" : "denied",
        decidedByUserId: req.user.id,
        decidedAt: new Date(),
      } as any);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Allowances (target amount + optional guaranteed floor + penalty per incomplete job)
  const moneyField = z.union([z.string(), z.number()]).transform((v) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!Number.isFinite(n) || n < 0) return "0.00";
    return n.toFixed(2);
  });

  const allowanceCreateSchema = z
    .object({
      childId: z.coerce.number().int().positive(),
      amount: moneyField,
      cadence: z.enum(["weekly", "monthly"]),
      dayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
      dayOfMonth: z.union([z.coerce.number().int().min(1).max(28), z.null()]).optional(),
      enabled: z.boolean().optional(),
      guaranteedMinimum: z.union([z.string(), z.number()]).optional().transform((v) => {
        if (v === undefined) return "0.00";
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n < 0) return "0.00";
        return n.toFixed(2);
      }),
      penaltyPerIncompleteJob: z.union([z.string(), z.number()]).optional().transform((v) => {
        if (v === undefined) return "0.00";
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n < 0) return "0.00";
        return n.toFixed(2);
      }),
      payoutMode: z.enum(["automatic", "manual"]).optional().default("automatic"),
      periodStartDayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
      periodEndDayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
    })
    .strict()
    .superRefine((d, ctx) => {
      const total = parseFloat(d.amount);
      const min = parseFloat(d.guaranteedMinimum);
      if (min > total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guaranteed minimum cannot exceed total allowance",
          path: ["guaranteedMinimum"],
        });
      }
      if (d.cadence === "weekly" && (d.dayOfWeek === undefined || d.dayOfWeek === null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weekly allowance requires dayOfWeek (0=Sun … 6=Sat)",
          path: ["dayOfWeek"],
        });
      }
      if (d.cadence === "monthly" && (d.dayOfMonth === undefined || d.dayOfMonth === null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Monthly allowance requires dayOfMonth (1-28)",
          path: ["dayOfMonth"],
        });
      }
    });

  const allowancePatchSchema = z
    .object({
      amount: moneyField.optional(),
      cadence: z.enum(["weekly", "monthly"]).optional(),
      dayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
      dayOfMonth: z.union([z.coerce.number().int().min(1).max(28), z.null()]).optional(),
      enabled: z.boolean().optional(),
      guaranteedMinimum: z.union([z.string(), z.number()]).optional().transform((v) => {
        if (v === undefined) return undefined;
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n < 0) return "0.00";
        return n.toFixed(2);
      }),
      penaltyPerIncompleteJob: z.union([z.string(), z.number()]).optional().transform((v) => {
        if (v === undefined) return undefined;
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!Number.isFinite(n) || n < 0) return "0.00";
        return n.toFixed(2);
      }),
      payoutMode: z.enum(["automatic", "manual"]).optional(),
      periodStartDayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
      periodEndDayOfWeek: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
    })
    .strict();

  app.get("/api/allowances", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can view allowances" });
      const allowances = await storage.getAllowancesByFamily(req.user.familyId);
      res.json(allowances);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/allowances", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can create allowances" });
      const body = allowanceCreateSchema.parse(req.body);
      const child = await storage.getChild(body.childId);
      if (!child || child.familyId !== req.user.familyId) return res.status(404).json({ message: "Child not found" });
      const created = await storage.createAllowance({ ...body, familyId: req.user.familyId } as any);
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const first = err.issues?.[0];
        const path = first?.path?.length ? first.path.join(".") : undefined;
        const detail = first?.message ? (path ? `${path}: ${first.message}` : first.message) : "Invalid allowance";
        return res.status(400).json({ message: detail });
      }
      console.error("Create allowance error:", err);
      res.status(400).json({ message: "Invalid allowance" });
    }
  });

  app.patch("/api/allowances/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can update allowances" });
      const id = parseInt(req.params.id);
      const existing = (await storage.getAllowancesByFamily(req.user.familyId)).find(a => a.id === id);
      if (!existing) return res.status(404).json({ message: "Allowance not found" });
      const updates = allowancePatchSchema.parse(req.body);
      const merged = { ...existing, ...updates } as any;
      const total = parseFloat(String(merged.amount ?? "0"));
      const min = parseFloat(String(merged.guaranteedMinimum ?? "0"));
      if (!Number.isFinite(total) || total <= 0) {
        return res.status(400).json({ message: "Allowance amount must be positive" });
      }
      if (!Number.isFinite(min) || min < 0 || min > total) {
        return res.status(400).json({ message: "Guaranteed minimum must be between 0 and total allowance" });
      }
      if (merged.cadence === "weekly" && (merged.dayOfWeek === undefined || merged.dayOfWeek === null)) {
        return res.status(400).json({ message: "Weekly allowance requires dayOfWeek" });
      }
      if (merged.cadence === "monthly" && (merged.dayOfMonth === undefined || merged.dayOfMonth === null)) {
        return res.status(400).json({ message: "Monthly allowance requires dayOfMonth" });
      }
      const updated = await storage.updateAllowance(id, updates as any);
      res.json(updated);
    } catch {
      res.status(400).json({ message: "Invalid allowance update" });
    }
  });

  app.delete("/api/allowances/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can delete allowances" });
      const id = parseInt(req.params.id);
      const existing = (await storage.getAllowancesByFamily(req.user.familyId)).find(a => a.id === id);
      if (!existing) return res.status(404).json({ message: "Allowance not found" });
      const deleted = await storage.deleteAllowance(id);
      res.json({ success: deleted });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/allowances/period-status", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can view allowance status" });
      const allowances = await storage.getAllowancesByFamily(req.user.familyId);
      const children = await storage.getChildrenByFamily(req.user.familyId);
      const childNames = new Map(children.map((c) => [c.id, c.name]));
      const statuses = await Promise.all(
        allowances.filter((a) => a.enabled).map(async (a) => {
          const status = await getAllowancePeriodStatus(a, storage);
          return {
            allowance: a,
            childName: childNames.get(a.childId) ?? `Child ${a.childId}`,
            ...status,
          };
        }),
      );
      res.json(statuses);
    } catch (err) {
      console.error("Allowance period status error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/allowances/:id/period-status", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can view allowance status" });
      const id = parseInt(req.params.id);
      const existing = (await storage.getAllowancesByFamily(req.user.familyId)).find((a) => a.id === id);
      if (!existing) return res.status(404).json({ message: "Allowance not found" });
      const status = await getAllowancePeriodStatus(existing, storage);
      const child = await storage.getChild(existing.childId);
      res.json({ allowance: existing, childName: child?.name ?? null, ...status });
    } catch (err) {
      console.error("Allowance period status error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/allowances/:id/pay", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Only parents can pay allowances" });
      const id = parseInt(req.params.id);
      const existing = (await storage.getAllowancesByFamily(req.user.familyId)).find((a) => a.id === id);
      if (!existing) return res.status(404).json({ message: "Allowance not found" });
      const result = await executeAllowancePayout(existing, storage);
      if (!result.ok) {
        const messages: Record<string, string> = {
          already_paid: "Allowance already paid for this period",
          zero_payout: "Nothing to pay for this period",
          no_child: "Child not found",
          disabled: "Allowance is disabled",
        };
        return res.status(400).json({ message: messages[result.reason] ?? "Could not pay allowance" });
      }
      res.json({ success: true, payout: result.payout, periodKey: result.periodKey });
    } catch (err) {
      console.error("Allowance pay error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Payments routes
  app.get("/api/payments", verifyToken, async (req: any, res) => {
    try {
      let payments;
      if (req.user.role === "parent") {
        payments = await storage.getPaymentsByFamily(req.user.familyId);
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        payments = await storage.getPaymentsByChild(child.id);
      }
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Lessons routes
  app.get("/api/lessons", verifyToken, async (req: any, res) => {
    try {
      const { category } = req.query;
      let lessons;

      if (category) {
        lessons = await storage.getLessonsByCategory(category as string);
      } else {
        // Get all default lessons and custom lessons for this family
        const defaultLessons = Array.from(["earning", "saving", "spending", "investing", "donating"])
          .flatMap(async cat => await storage.getLessonsByCategory(cat));
        const customLessons = await storage.getCustomLessons(req.user.familyId);
        lessons = [...await Promise.all(defaultLessons), ...customLessons].flat();
      }

      res.json(lessons);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/lessons", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create custom lessons" });
      }

      const lessonData = insertLessonSchema.parse({
        ...req.body,
        isCustom: true,
        familyId: req.user.familyId
      });

      const lesson = await storage.createLesson(lessonData);
      res.json(lesson);
    } catch (error) {
      res.status(400).json({ message: "Invalid lesson data" });
    }
  });

  // Quiz routes
  app.get("/api/quizzes/:lessonId", verifyToken, async (req: any, res) => {
    try {
      const lessonId = parseInt(req.params.lessonId);
      const quizzes = await storage.getQuizzesByLesson(lessonId);
      res.json(quizzes);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/learning-progress", verifyToken, async (req: any, res) => {
    try {
      let childId;

      if (req.user.role === "child") {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      } else {
        return res.status(403).json({ message: "Only children can submit quiz progress" });
      }

      const { lessonId, completed, quizScore } = req.body;

      // Check if progress already exists
      const existingProgress = await storage.getLearningProgress(childId);
      const existing = existingProgress.find(p => p.lessonId === lessonId);

      if (existing) {
        // Update existing progress
        const updated = await storage.updateLearningProgress(childId, lessonId, {
          completed: completed || existing.completed,
          quizScore: quizScore !== undefined ? quizScore : existing.quizScore
        });
        res.json(updated);
      } else {
        // Create new progress
        const progress = await storage.createLearningProgress({
          childId,
          lessonId,
          completed: completed || false,
          quizScore: quizScore || null
        });
        res.json(progress);
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Learning progress routes
  app.get("/api/learning-progress", verifyToken, async (req: any, res) => {
    try {
      let childId;

      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          return res.status(400).json({ message: "Child ID required for parents" });
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      const progress = await storage.getLearningProgress(childId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Achievements routes
  app.get("/api/achievements", verifyToken, async (req: any, res) => {
    try {
      let childId;

      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          return res.status(400).json({ message: "Child ID required for parents" });
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      const achievements = await storage.getAchievements(childId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats route
  app.get("/api/dashboard-stats", verifyToken, async (req: any, res) => {
    try {
      let childId;

      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          const children = await storage.getChildrenByFamily(req.user.familyId);
          childId = children[0]?.id;
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      if (!childId) {
        return res.status(404).json({ message: "No child found" });
      }

      const child = await storage.getChild(childId);
      const allocation = await storage.getAllocationSettings(childId);
      const jobs = await storage.getJobsByChild(childId);
      const payments = await storage.getPaymentsByChild(childId);
      const achievements = await storage.getAchievements(childId);
      const progress = await storage.getLearningProgress(childId);

      const activeJobs = jobs.filter(job => job.status !== "approved");
      const totalEarned = parseFloat(child?.totalEarned || "0");

      res.json({
        child,
        allocation,
        activeJobs,
        totalEarned,
        completedJobs: child?.completedJobs || 0,
        learningStreak: child?.learningStreak || 0,
        achievements: achievements.slice(0, 3),
        learningProgress: progress
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── SAVINGS GOALS ────────────────────────────────────────────────

  const savingsGoalUpdateSchema = insertSavingsGoalSchema
    .omit({ childId: true })
    .partial()
    .strict();

  const fundGoalSchema = z.object({
    amount: z.coerce.number().positive(),
  }).strict();

  // Helper to resolve child ID from authenticated user
  async function resolveChildId(req: any): Promise<number | null> {
    if (req.user.role === "parent") {
      const children = await storage.getChildrenByFamily(req.user.familyId);
      const childIdParam = req.query.childId ? parseInt(req.query.childId as string) : null;
      return childIdParam ? children.find(c => c.id === childIdParam)?.id ?? null : children[0]?.id ?? null;
    }
    const children = await storage.getChildrenByFamily(req.user.familyId);
    const child = children.find(c => c.userId === req.user.id);
    return child?.id ?? null;
  }

  app.get("/api/transactions", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const txs = await storage.getTransactions(childId);
      txs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(txs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/savings-goals", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const goals = await storage.getSavingsGoals(childId);
      res.json(goals);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/savings-goals", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const goalData = insertSavingsGoalSchema.parse({ ...req.body, childId });
      const goal = await storage.createSavingsGoal(goalData);
      res.json(goal);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.patch("/api/savings-goals/:id", verifyToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getSavingsGoal(id);
      if (!existing) return res.status(404).json({ message: "Goal not found" });
      const child = await storage.getChild(existing.childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Goal not found" });
      }
      if (req.user.role === "child" && child.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (req.user.role === "parent" && req.body?.childId != null && Number(req.body.childId) !== child.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updates = savingsGoalUpdateSchema.parse(req.body);
      const goal = await storage.updateSavingsGoal(id, updates);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      res.json(goal);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  // Fund a goal from the child's savings balance
  app.post("/api/savings-goals/:id/fund", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "child") {
        return res.status(403).json({ message: "Only children can fund goals" });
      }

      const id = parseInt(req.params.id);
      const { amount } = fundGoalSchema.parse(req.body);

      const goal = await storage.getSavingsGoal(id);
      if (!goal) return res.status(404).json({ message: "Goal not found" });

      const child = await storage.getChild(goal.childId);
      if (!child || child.familyId !== req.user.familyId || child.userId !== req.user.id) {
        return res.status(404).json({ message: "Goal not found" });
      }

      const settings = await storage.getFamilySettings(req.user.familyId);
      if (settings?.requireGoalFundingApproval) {
        const created = await storage.createApprovalRequest({
          familyId: req.user.familyId,
          childId: child.id,
          type: "goal_fund",
          amount: amount.toFixed(2),
          details: JSON.stringify({ goalId: goal.id, amount }),
          status: "pending",
          decidedByUserId: null,
        } as any);
        return res.status(202).json({ pending: true, requestId: created.id });
      }

      const savingsBalance = parseFloat(child.savingsBalance || "0");
      if (savingsBalance < amount) {
        return res.status(400).json({ message: "Insufficient savings balance" });
      }

      const currentAmount = parseFloat(goal.currentAmount || "0");
      const targetAmount = Math.max(0.01, parseFloat(goal.targetAmount || "0.01"));
      const nextCurrent = (currentAmount + amount);
      const nextCompleted = nextCurrent >= targetAmount;

      await storage.updateChild(child.id, {
        savingsBalance: (savingsBalance - amount).toFixed(2),
      });

      const updated = await storage.updateSavingsGoal(goal.id, {
        currentAmount: nextCurrent.toFixed(2),
        completed: nextCompleted,
      });

      await storage.createTransaction({
        childId: child.id,
        type: "goal_fund",
        amount: amount.toFixed(2),
        fromAccount: "savings",
        toAccount: "goal",
        note: `Fund goal: ${goal.name}`,
      });

      res.json(updated);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/savings-goals/:id", verifyToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getSavingsGoal(id);
      if (!existing) return res.json({ success: false });
      const child = await storage.getChild(existing.childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.json({ success: false });
      }
      if (req.user.role === "child" && child.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteSavingsGoal(id);
      res.json({ success: deleted });
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── SPENDING LOG ──────────────────────────────────────────────────

  const spendingLogCreateSchema = insertSpendingLogSchema.omit({ childId: true }).strict();

  app.get("/api/spending-log", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const entries = await storage.getSpendingLog(childId);
      res.json(entries);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/spending-log", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const entryBody = spendingLogCreateSchema.parse(req.body);

      const settings = await storage.getFamilySettings(req.user.familyId);
      if (req.user.role === "child" && settings?.requireSpendingApproval) {
        const created = await storage.createApprovalRequest({
          familyId: req.user.familyId,
          childId,
          type: "spend",
          amount: entryBody.amount,
          details: JSON.stringify(entryBody),
          status: "pending",
          decidedByUserId: null,
        } as any);
        return res.status(202).json({ pending: true, requestId: created.id });
      }

      // Deduct from spending balance
      const child = await storage.getChild(childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }
      const spendingBalance = parseFloat(child.spendingBalance || "0");
      const amount = parseFloat(entryBody.amount || "0");
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      if (spendingBalance < amount) {
        return res.status(400).json({ message: "Insufficient spending balance" });
      }

      await storage.updateChild(childId, {
        spendingBalance: (spendingBalance - amount).toFixed(2),
      });

      const entry = await storage.createSpendingLog({ ...entryBody, childId });

      await storage.createTransaction({
        childId,
        type: "spend",
        amount: amount.toFixed(2),
        fromAccount: "spending",
        toAccount: "external",
        note: `Spent on ${entry.item} (${entry.category})`,
      });
      res.json(entry);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.delete("/api/spending-log/:id", verifyToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getSpendingLogEntry(id);
      if (!existing) return res.json({ success: false });
      const child = await storage.getChild(existing.childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.json({ success: false });
      }
      const deleted = await storage.deleteSpendingLog(id);
      if (deleted) {
        const spendingBalance = parseFloat(child.spendingBalance || "0");
        const amount = parseFloat(existing.amount || "0");
        if (Number.isFinite(amount) && amount > 0) {
          await storage.updateChild(existing.childId, {
            spendingBalance: (spendingBalance + amount).toFixed(2),
          });
          await storage.createTransaction({
            childId: existing.childId,
            type: "refund_spend",
            amount: amount.toFixed(2),
            fromAccount: "external",
            toAccount: "spending",
            note: `Refund: ${existing.item} (${existing.category})`,
          });
        }
      }
      res.json({ success: deleted });
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── DONATIONS ────────────────────────────────────────────────────

  const donationCreateSchema = insertDonationSchema.omit({ childId: true }).strict();

  app.get("/api/donations", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const donations = await storage.getDonations(childId);
      res.json(donations);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.post("/api/donations", verifyToken, async (req: any, res) => {
    try {
      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child not found" });
      const donationBody = donationCreateSchema.parse(req.body);

      const settings = await storage.getFamilySettings(req.user.familyId);
      if (req.user.role === "child" && settings?.requireDonationApproval) {
        const created = await storage.createApprovalRequest({
          familyId: req.user.familyId,
          childId,
          type: "donate",
          amount: donationBody.amount,
          details: JSON.stringify(donationBody),
          status: "pending",
          decidedByUserId: null,
        } as any);
        return res.status(202).json({ pending: true, requestId: created.id });
      }

      // Deduct from spending balance
      const child = await storage.getChild(childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }
      const spendingBalance = parseFloat(child.spendingBalance || "0");
      const amount = parseFloat(donationBody.amount || "0");
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      if (spendingBalance < amount) {
        return res.status(400).json({ message: "Insufficient spending balance" });
      }

      await storage.updateChild(childId, {
        spendingBalance: (spendingBalance - amount).toFixed(2),
      });

      const donation = await storage.createDonation({ ...donationBody, childId });

      await storage.createTransaction({
        childId,
        type: "donate",
        amount: amount.toFixed(2),
        fromAccount: "spending",
        toAccount: "external",
        note: `Donated to ${donation.organization} (${donation.cause})`,
      });
      res.json(donation);
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  app.delete("/api/donations/:id", verifyToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getDonation(id);
      if (!existing) return res.json({ success: false });
      const child = await storage.getChild(existing.childId);
      if (!child || child.familyId !== req.user.familyId) {
        return res.json({ success: false });
      }
      const deleted = await storage.deleteDonation(id);
      if (deleted) {
        const spendingBalance = parseFloat(child.spendingBalance || "0");
        const amount = parseFloat(existing.amount || "0");
        if (Number.isFinite(amount) && amount > 0) {
          await storage.updateChild(existing.childId, {
            spendingBalance: (spendingBalance + amount).toFixed(2),
          });
          await storage.createTransaction({
            childId: existing.childId,
            type: "refund_donate",
            amount: amount.toFixed(2),
            fromAccount: "external",
            toAccount: "spending",
            note: `Refund donation: ${existing.organization} (${existing.cause})`,
          });
        }
      }
      res.json({ success: deleted });
    } catch { res.status(500).json({ message: "Internal server error" }); }
  });

  // ─── AI COACH (Ollama + kids voice) ───────────────────────────────

  app.get("/api/ai/config", verifyToken, async (req: any, res) => {
    try {
      const enabled = isAiCoachEnabled();
      if (!enabled) {
        return res.json({
          enabled: false,
          voiceAvailable: false,
          speechDefault: false,
          briefAvailable: false,
          voice: null,
          quickPrompts: [],
          mascotName: "Sprout",
        });
      }

      let mode = "unknown" as ReturnType<typeof kidModeFromAge>;
      if (req.user.role === "child") {
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find((c) => c.userId === req.user.id);
        mode = kidModeFromAge(child?.age);
      }

      const services = await checkAiServices();
      const voice = voiceForKidMode(mode);
      const page = typeof req.query.page === "string" ? req.query.page : undefined;

      res.json({
        enabled: true,
        llmAvailable: services.ollama,
        voiceAvailable: services.voice && voice != null,
        speechDefault: shouldDefaultSpeech(mode),
        briefAvailable: services.ollama && req.user.role === "child",
        voiceModeAvailable: req.user.role === "child" && services.voice && voice != null,
        voice,
        quickPrompts: req.user.role === "child" ? quickPromptsForPage(mode, page) : [],
        mascotName: "Sprout",
      });
    } catch (err) {
      console.error("AI config error:", err);
      res.json({ enabled: false, voiceAvailable: false, speechDefault: false, briefAvailable: false, voice: null, quickPrompts: [], mascotName: "Sprout" });
    }
  });

  app.post("/api/ai/chat", verifyToken, async (req: any, res) => {
    try {
      if (!isAiCoachEnabled()) {
        return res.status(503).json({ message: "Sprout is not available right now" });
      }

      if (req.user.role !== "child") {
        return res.status(403).json({ message: "Sprout is for kids only" });
      }

      const bodySchema = z
        .object({
          message: z.string().min(1).max(500),
          history: z
            .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
            .max(12)
            .optional(),
          page: z.string().max(64).optional(),
          withSpeech: z.boolean().optional(),
          voiceMode: z.boolean().optional(),
        })
        .strict();

      const { message, history = [], page, withSpeech, voiceMode } = bodySchema.parse(req.body ?? {});

      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child profile not found" });

      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });

      const jobs = await storage.getJobsByChild(childId);
      await ensureFamilyJobCategories(storage, req.user.familyId);
      const categories = await storage.getJobCategoriesByFamily(req.user.familyId);

      const isLearnPage = page === "learn" || page?.startsWith("learn");
      const learnLessons = isLearnPage
        ? await loadLearnLessonsForChild(storage, req.user.familyId, childId, child.age)
        : undefined;

      const ctx = buildCoachContext(child, jobs, page, categories, learnLessons);

      let reply: string;
      let jobsChanged = false;
      let voiceAction: string | undefined;

      const learnVoiceResult =
        isLearnPage && learnLessons
          ? trySproutLearnVoiceAction(learnLessons, message, ctx.mode)
          : null;

      const voiceResult =
        !learnVoiceResult
          ? await trySproutVoiceAction(
              storage,
              req.user.familyId,
              jobs,
              message,
              ctx.mode,
              categories,
            )
          : null;

      if (learnVoiceResult) {
        reply = learnVoiceResult.reply;
        jobsChanged = learnVoiceResult.jobsChanged;
        voiceAction = learnVoiceResult.voiceAction;
      } else if (voiceResult) {
        reply = voiceResult.reply;
        jobsChanged = voiceResult.jobsChanged;
        voiceAction = voiceResult.voiceAction;
      } else {
        reply = await chatWithSprout(ctx, message, history as ChatMessage[]);
      }

      let audioBase64: string | undefined;
      let mimeType: string | undefined;

      const wantSpeech = withSpeech ?? voiceMode ?? shouldDefaultSpeech(ctx.mode);
      const voice = voiceForKidMode(ctx.mode);
      if (wantSpeech && voice) {
        try {
          const audio = await synthesizeSpeech(reply, voice);
          audioBase64 = audio.toString("base64");
          mimeType = "audio/mpeg";
        } catch (speechErr) {
          console.error("TTS failed:", speechErr);
        }
      }

      res.json({ reply, audioBase64, mimeType, jobsChanged, voiceAction });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request" });
      }
      console.error("AI chat error:", err);
      res.status(503).json({ message: "Sprout couldn't answer right now. Try again soon!" });
    }
  });

  app.get("/api/ai/brief", verifyToken, async (req: any, res) => {
    try {
      if (!isAiCoachEnabled()) {
        return res.status(503).json({ message: "Daily brief is not available" });
      }
      if (req.user.role !== "child") {
        return res.status(403).json({ message: "Daily brief is for kids only" });
      }

      const childId = await resolveChildId(req);
      if (!childId) return res.status(404).json({ message: "Child profile not found" });

      const withSpeech = req.query.speech === "1" || req.query.speech === "true";
      const brief = await buildDailyBrief(storage, childId);

      let audioBase64: string | undefined;
      let mimeType: string | undefined;

      if (withSpeech) {
        try {
          const audio = await briefToSpeech(brief.script, brief.mode);
          if (audio) {
            audioBase64 = audio.toString("base64");
            mimeType = "audio/mpeg";
          }
        } catch (speechErr) {
          console.error("Brief TTS failed:", speechErr);
        }
      }

      res.json({ ...brief, audioBase64, mimeType });
    } catch (err: any) {
      const status = typeof err?.statusCode === "number" ? err.statusCode : 503;
      console.error("Daily brief error:", err);
      res.status(status).json({ message: "Could not build your daily brief. Try again soon!" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

