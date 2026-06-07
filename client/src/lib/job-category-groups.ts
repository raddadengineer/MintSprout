import type { JobCategoryPaymentMode } from "@shared/job-categories";
import { legacyCategoryLabel } from "@shared/job-categories";

export type JobCategoryRow = {
  id: number;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
  paymentMode: JobCategoryPaymentMode;
};

export function sortJobCategories(categories: JobCategoryRow[]): JobCategoryRow[] {
  return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function groupJobsByCategory<T extends {
  categoryId?: number | null;
  isFamilyDuty?: boolean | null;
  allowanceId?: number | null;
  amount?: string;
}>(
  jobs: T[],
  categories: JobCategoryRow[],
): { category: JobCategoryRow | null; label: string; icon: string; jobs: T[] }[] {
  const sorted = sortJobCategories(categories.filter((c) => c.enabled !== false));
  const byId = new Map(sorted.map((c) => [c.id, c]));
  const buckets = new Map<number, T[]>();

  for (const job of jobs) {
    const id = job.categoryId ?? 0;
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id)!.push(job);
  }

  const result: { category: JobCategoryRow | null; label: string; icon: string; jobs: T[] }[] = [];

  for (const cat of sorted) {
    const list = buckets.get(cat.id);
    if (list?.length) {
      result.push({ category: cat, label: cat.label, icon: cat.icon ?? "briefcase", jobs: list });
      buckets.delete(cat.id);
    }
  }

  const uncategorized = buckets.get(0);
  if (uncategorized?.length) {
    const fallbackLabel = legacyCategoryLabel(uncategorized[0] ?? {});
    result.push({
      category: null,
      label: fallbackLabel === "Other" ? "Other" : fallbackLabel,
      icon: "briefcase",
      jobs: uncategorized,
    });
  }

  return result;
}
