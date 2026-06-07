/**
 * Optional: seed catalog_library with AI-generated items when LLM is available.
 * Usage: CATALOG_AI_SEED=1 npx tsx server/scripts/seed-catalog-ai.ts
 */
import { storage } from "../storage";
import { ensureCatalogLibrary } from "../catalog-seed";
import { generateCatalogItems } from "../catalog-generator";
import { DEFAULT_JOB_CATEGORIES } from "@shared/job-categories";
import { LESSON_CATEGORY_KEYS } from "@shared/catalog/types";

async function main() {
  await ensureCatalogLibrary(storage);

  for (const seed of DEFAULT_JOB_CATEGORIES) {
    try {
      const proposals = await generateCatalogItems("job", seed.slug, 5);
      for (const p of proposals) {
        const existing = await storage.getCatalogLibrary("job", seed.slug);
        if (existing.some((e) => e.title === p.title)) continue;
        await storage.createCatalogLibraryItem({
          catalogType: "job",
          categoryKey: seed.slug,
          title: p.title,
          description: p.description,
          payload: JSON.stringify(p.payload),
          source: "ai",
        });
        console.log(`+ job/${seed.slug}: ${p.title}`);
      }
    } catch (err) {
      console.warn(`Skip job/${seed.slug}:`, (err as Error).message);
    }
  }

  for (const key of LESSON_CATEGORY_KEYS) {
    try {
      const proposals = await generateCatalogItems("lesson", key, 3);
      for (const p of proposals) {
        const existing = await storage.getCatalogLibrary("lesson", key);
        if (existing.some((e) => e.title === p.title)) continue;
        await storage.createCatalogLibraryItem({
          catalogType: "lesson",
          categoryKey: key,
          title: p.title,
          description: p.description,
          payload: JSON.stringify(p.payload),
          source: "ai",
        });
        console.log(`+ lesson/${key}: ${p.title}`);
      }
    } catch (err) {
      console.warn(`Skip lesson/${key}:`, (err as Error).message);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
