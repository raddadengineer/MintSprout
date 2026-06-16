import type { JobCategory } from "@shared/schema";
import type { JobCategoryPaymentMode } from "@shared/job-categories";
import { DEFAULT_JOB_CATEGORIES } from "@shared/job-categories";
import { voiceListEmpty, voiceNameHint, type KidMode } from "@shared/kid-task-copy";
import type { IStorage } from "./storage";

export type JobCategoryInput = {
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  enabled?: boolean;
  paymentMode: JobCategoryPaymentMode;
};

/** Ensure default categories exist for a family (idempotent). */
export async function backfillCategorySlugs(storage: IStorage, familyId: number): Promise<void> {
  const categories = await storage.getJobCategoriesByFamily(familyId, { includeDisabled: true });
  for (const cat of categories) {
    if (cat.slug) continue;
    const seed = DEFAULT_JOB_CATEGORIES.find((c) => c.label === cat.label);
    if (seed) {
      await storage.updateJobCategory(cat.id, { slug: seed.slug });
    }
  }
}

export async function ensureFamilyJobCategories(storage: IStorage, familyId: number): Promise<JobCategory[]> {
  const existing = await storage.getJobCategoriesByFamily(familyId, { includeDisabled: true });
  if (existing.length > 0) {
    await ensureMissingDefaultCategories(storage, familyId);
    return storage.getJobCategoriesByFamily(familyId);
  }

  for (const seed of DEFAULT_JOB_CATEGORIES) {
    await storage.createJobCategory({
      familyId,
      slug: seed.slug,
      label: seed.label,
      description: seed.description,
      icon: seed.icon,
      sortOrder: seed.sortOrder,
      enabled: true,
      paymentMode: seed.paymentMode,
    });
  }
  const categories = await storage.getJobCategoriesByFamily(familyId);
  const { ensureFamilyCatalog } = await import("./catalog-seed");
  await ensureFamilyCatalog(storage, familyId);
  return categories;
}

/** Add any new default categories (e.g. bonus_tasks) missing from older families. */
export async function ensureMissingDefaultCategories(storage: IStorage, familyId: number): Promise<void> {
  const existing = await storage.getJobCategoriesByFamily(familyId, { includeDisabled: true });
  const slugs = new Set(existing.map((c) => c.slug).filter(Boolean));
  for (const seed of DEFAULT_JOB_CATEGORIES) {
    if (slugs.has(seed.slug)) {
      const cat = existing.find((c) => c.slug === seed.slug);
      if (cat && seed.description && cat.description !== seed.description) {
        await storage.updateJobCategory(cat.id, { description: seed.description });
      }
      continue;
    }
    await storage.createJobCategory({
      familyId,
      slug: seed.slug,
      label: seed.label,
      description: seed.description,
      icon: seed.icon,
      sortOrder: seed.sortOrder,
      enabled: true,
      paymentMode: seed.paymentMode,
    });
  }
}

/** Map legacy jobs to categories after migration or first load. */
export async function backfillJobCategories(storage: IStorage, familyId: number): Promise<void> {
  const categories = await ensureFamilyJobCategories(storage, familyId);
  const byLabel = new Map(categories.map((c) => [c.label, c]));
  const selfCare = byLabel.get("Take Care of Yourself");
  const allowance = byLabel.get("Earn Your Allowance");
  const bonus = categories.find((c) => c.slug === "bonus_tasks") ?? byLabel.get("Extra Earning");

  const jobs = await storage.getJobsByFamily(familyId);
  for (const job of jobs) {
    if (job.categoryId) continue;
    let categoryId: number | undefined;
    if (job.isFamilyDuty && selfCare) categoryId = selfCare.id;
    else if (job.allowanceId != null && allowance) categoryId = allowance.id;
    else if (parseFloat(job.amount || "0") > 0 && bonus) categoryId = bonus.id;
    else if (parseFloat(job.amount || "0") > 0 && allowance) categoryId = allowance.id;
    else if (selfCare) categoryId = selfCare.id;
    if (categoryId) {
      await storage.updateJob(job.id, { categoryId });
    }
  }
}

export function applyCategoryPaymentFields(
  category: JobCategory,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body, categoryId: category.id };

  if (category.paymentMode === "none") {
    next.amount = "0.00";
    next.isFamilyDuty = true;
    delete next.allowanceId;
  } else if (category.paymentMode === "allowance") {
    next.amount = "0.00";
    next.isFamilyDuty = false;
    if (next.allowanceId == null || next.allowanceId === "") {
      delete next.allowanceId;
    }
  } else {
    next.isFamilyDuty = false;
    delete next.allowanceId;
    if (next.amount == null || next.amount === "") {
      next.amount = "0.00";
    }
  }

  return next;
}

export function groupJobsByCategoryLabel<T extends { categoryId?: number | null; title: string; status: string }>(
  jobs: T[],
  categories: JobCategory[],
  filter?: (job: T) => boolean,
): { label: string; icon: string; jobs: T[] }[] {
  const groups = new Map<number, T[]>();

  for (const job of jobs) {
    if (filter && !filter(job)) continue;
    const catId = job.categoryId ?? 0;
    if (!groups.has(catId)) groups.set(catId, []);
    groups.get(catId)!.push(job);
  }

  const sortedCats = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const result: { label: string; icon: string; jobs: T[] }[] = [];

  for (const cat of sortedCats) {
    const list = groups.get(cat.id);
    if (list?.length) {
      result.push({ label: cat.label, icon: cat.icon ?? "briefcase", jobs: list });
      groups.delete(cat.id);
    }
  }

  const uncategorized = groups.get(0);
  if (uncategorized?.length) {
    result.push({ label: "Other", icon: "briefcase", jobs: uncategorized });
  }

  return result;
}

export function kidFriendlyJobList(
  groups: { label: string; jobs: { title: string; status: string }[] }[],
  mode: KidMode,
): string {
  const active = groups
    .map((g) => {
      const titles = g.jobs
        .filter((j) => j.status === "assigned" || j.status === "in_progress")
        .map((j) => j.title);
      if (!titles.length) return null;
      return `${g.label}: ${titles.join(", ")}`;
    })
    .filter(Boolean);

  if (!active.length) {
    return voiceListEmpty(mode);
  }

  const body = active.join(". ");
  return `${body}. ${voiceNameHint(mode)}`;
}
