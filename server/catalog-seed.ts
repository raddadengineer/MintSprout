import type { CatalogPayload, CatalogType } from "@shared/catalog/types";
import { jobLibraryAsCatalogEntries } from "@shared/catalog/job-library";
import { lessonLibraryAsCatalogEntries } from "@shared/catalog/lesson-library";
import { DEFAULT_JOB_CATEGORIES } from "@shared/job-categories";
import { LESSON_CATEGORY_KEYS } from "@shared/catalog/types";
import type { IStorage } from "./storage";

function serializePayload(payload: CatalogPayload): string {
  return JSON.stringify(payload);
}

function parsePayload(raw: string): CatalogPayload {
  return JSON.parse(raw) as CatalogPayload;
}

/** Idempotent insert of builtin rows into catalog_library. */
export async function ensureCatalogLibrary(storage: IStorage): Promise<void> {
  const entries = [...jobLibraryAsCatalogEntries(), ...lessonLibraryAsCatalogEntries()];
  for (const entry of entries) {
    const existing = await storage.getCatalogLibrary(entry.catalogType, entry.categoryKey);
    if (existing.some((r) => r.title === entry.title)) continue;
    await storage.createCatalogLibraryItem({
      catalogType: entry.catalogType,
      categoryKey: entry.categoryKey,
      title: entry.title,
      description: entry.description,
      payload: serializePayload(entry.payload),
      source: entry.source,
    });
  }
}

/** Copy default job presets into family_catalog_items if none exist for that category. */
export async function seedFamilyCatalogFromDefaults(storage: IStorage, familyId: number): Promise<void> {
  const categories = await storage.getJobCategoriesByFamily(familyId, { includeDisabled: true });
  const bySlug = new Map(categories.filter((c) => c.slug).map((c) => [c.slug!, c]));

  for (const seed of DEFAULT_JOB_CATEGORIES) {
    const category = bySlug.get(seed.slug);
    if (!category) continue;

    const existing = await storage.getFamilyCatalogItems(familyId, "job", { categoryId: category.id });
    if (existing.length > 0) continue;

    const libraryItems = await storage.getCatalogLibrary("job", seed.slug);
    let sortOrder = 0;
    for (const lib of libraryItems) {
      const payload = typeof lib.payload === "string" ? lib.payload : JSON.stringify(lib.payload);
      await storage.createFamilyCatalogItem({
        familyId,
        catalogType: "job",
        categoryId: category.id,
        categoryKey: seed.slug,
        libraryItemId: lib.id,
        title: lib.title,
        description: lib.description,
        payload,
        enabled: true,
        sortOrder: sortOrder++,
      });
    }
  }
}

/** Copy lesson library templates into family_catalog_items if none exist for that category. */
export async function seedFamilyLessonCatalogFromDefaults(storage: IStorage, familyId: number): Promise<void> {
  for (const categoryKey of LESSON_CATEGORY_KEYS) {
    const existing = await storage.getFamilyCatalogItems(familyId, "lesson", { categoryKey });
    if (existing.length > 0) continue;

    const libraryItems = await storage.getCatalogLibrary("lesson", categoryKey);
    let sortOrder = 0;
    for (const lib of libraryItems) {
      const payload = typeof lib.payload === "string" ? lib.payload : JSON.stringify(lib.payload);
      await storage.createFamilyCatalogItem({
        familyId,
        catalogType: "lesson",
        categoryId: null,
        categoryKey,
        libraryItemId: lib.id,
        title: lib.title,
        description: lib.description,
        payload,
        enabled: true,
        sortOrder: sortOrder++,
      });
    }
  }
}

export async function ensureFamilyCatalog(storage: IStorage, familyId: number): Promise<void> {
  await seedFamilyCatalogFromDefaults(storage, familyId);
  await seedFamilyLessonCatalogFromDefaults(storage, familyId);
}

export { parsePayload, serializePayload };
