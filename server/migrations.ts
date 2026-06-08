import { db, pool, runSql } from "./db";
import { sql } from "drizzle-orm";
import { families } from "@shared/schema";

/** Idempotent SQL migrations for existing databases (init-db.sql only runs on first volume create). */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "job_categories_v1",
    sql: `
CREATE TABLE IF NOT EXISTS job_categories (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'briefcase',
    sort_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    payment_mode TEXT NOT NULL DEFAULT 'none' CHECK (payment_mode IN ('none', 'allowance', 'standalone')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_categories_family_id ON job_categories(family_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES job_categories(id) ON DELETE SET NULL;

INSERT INTO job_categories (family_id, label, description, icon, sort_order, payment_mode)
SELECT f.id, v.label, v.description, v.icon, v.sort_order, v.payment_mode
FROM families f
CROSS JOIN (VALUES
    ('Take Care of Yourself', 'Everyday habits for yourself and your space.', 'bed', 0, 'none'),
    ('Earn Your Allowance', 'Extra chores that count toward allowance.', 'dollarSign', 1, 'allowance'),
    ('Grow Your Mind and Body', 'Learning, reading, and skills.', 'bookOpen', 2, 'none'),
    ('Help Others', 'Kind acts for family, friends, or neighbors.', 'gift', 3, 'none')
) AS v(label, description, icon, sort_order, payment_mode)
WHERE NOT EXISTS (
    SELECT 1 FROM job_categories c WHERE c.family_id = f.id LIMIT 1
);

UPDATE jobs j SET category_id = c.id
FROM job_categories c
WHERE j.family_id = c.family_id AND j.category_id IS NULL
  AND j.is_family_duty = TRUE AND c.label = 'Take Care of Yourself';

UPDATE jobs j SET category_id = c.id
FROM job_categories c
WHERE j.family_id = c.family_id AND j.category_id IS NULL
  AND j.allowance_id IS NOT NULL AND c.label = 'Earn Your Allowance';

UPDATE jobs j SET category_id = c.id
FROM job_categories c
WHERE j.family_id = c.family_id AND j.category_id IS NULL
  AND j.is_family_duty = FALSE AND j.allowance_id IS NULL
  AND j.amount::numeric > 0 AND c.label = 'Earn Your Allowance';

UPDATE jobs j SET category_id = c.id
FROM job_categories c
WHERE j.family_id = c.family_id AND j.category_id IS NULL
  AND c.label = 'Take Care of Yourself';
`,
  },
  {
    id: "remove_demo_branding_v1",
    sql: `
UPDATE families SET name = 'Our Family' WHERE name IN ('Demo Family', 'Smith Family');
UPDATE users SET name = 'Parent' WHERE role = 'parent' AND name IN ('Demo Parent', 'Jane Smith');
`,
  },
  {
    id: "catalog_v1",
    sql: `
ALTER TABLE job_categories ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE job_categories SET slug = 'self_care' WHERE slug IS NULL AND label = 'Take Care of Yourself';
UPDATE job_categories SET slug = 'allowance' WHERE slug IS NULL AND label = 'Earn Your Allowance';
UPDATE job_categories SET slug = 'mind_body' WHERE slug IS NULL AND label = 'Grow Your Mind and Body';
UPDATE job_categories SET slug = 'help_others' WHERE slug IS NULL AND label = 'Help Others';

CREATE TABLE IF NOT EXISTS catalog_library (
    id SERIAL PRIMARY KEY,
    catalog_type TEXT NOT NULL CHECK (catalog_type IN ('job', 'lesson')),
    category_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'builtin' CHECK (source IN ('builtin', 'ai')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (catalog_type, category_key, title)
);
CREATE INDEX IF NOT EXISTS idx_catalog_library_type_key ON catalog_library(catalog_type, category_key);

CREATE TABLE IF NOT EXISTS family_catalog_items (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    catalog_type TEXT NOT NULL CHECK (catalog_type IN ('job', 'lesson')),
    category_id INTEGER REFERENCES job_categories(id) ON DELETE SET NULL,
    category_key TEXT NOT NULL,
    library_item_id INTEGER REFERENCES catalog_library(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    published_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_family_catalog_family_type ON family_catalog_items(family_id, catalog_type);
CREATE INDEX IF NOT EXISTS idx_family_catalog_category ON family_catalog_items(category_id);
`,
  },
  {
    id: "core_features_v2",
    sql: `
CREATE TABLE IF NOT EXISTS family_settings (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
    require_spending_approval BOOLEAN DEFAULT FALSE,
    require_donation_approval BOOLEAN DEFAULT FALSE,
    require_goal_funding_approval BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    decided_by_user_id INTEGER REFERENCES users(id),
    decided_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_family_id ON approval_requests(family_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_child_id ON approval_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

CREATE TABLE IF NOT EXISTS allowances (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    guaranteed_minimum DECIMAL(10,2) DEFAULT 0.00,
    penalty_per_incomplete_job DECIMAL(10,2) DEFAULT 0.00,
    cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
    day_of_week INTEGER,
    day_of_month INTEGER,
    enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS guaranteed_minimum DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS penalty_per_incomplete_job DECIMAL(10,2) DEFAULT 0.00;
CREATE INDEX IF NOT EXISTS idx_allowances_family_id ON allowances(family_id);
CREATE INDEX IF NOT EXISTS idx_allowances_child_id ON allowances(child_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS allowance_id INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'briefcase';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_family_duty BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS family_duty_completed_log (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS family_duty_completed_job_occurrence ON family_duty_completed_log(job_id, occurrence_key);

CREATE TABLE IF NOT EXISTS allowance_payout_log (
    id SERIAL PRIMARY KEY,
    allowance_id INTEGER NOT NULL REFERENCES allowances(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS allowance_payout_log_allowance_period ON allowance_payout_log(allowance_id, period_key);

CREATE TABLE IF NOT EXISTS allowance_missed_job_log (
    id SERIAL PRIMARY KEY,
    allowance_id INTEGER NOT NULL REFERENCES allowances(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS allowance_missed_job_job_occurrence ON allowance_missed_job_log(job_id, occurrence_key);

CREATE TABLE IF NOT EXISTS allowance_completed_job_log (
    id SERIAL PRIMARY KEY,
    allowance_id INTEGER NOT NULL REFERENCES allowances(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS allowance_completed_job_job_occurrence ON allowance_completed_job_log(job_id, occurrence_key);

CREATE TABLE IF NOT EXISTS savings_goals (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0.00,
    deadline TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_savings_goals_child_id ON savings_goals(child_id);

CREATE TABLE IF NOT EXISTS spending_log (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('food', 'toys', 'clothes', 'entertainment', 'education', 'other')),
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_spending_log_child_id ON spending_log(child_id);

CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    organization TEXT NOT NULL,
    cause TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_donations_child_id ON donations(child_id);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    from_account TEXT,
    to_account TEXT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_child_id ON transactions(child_id);
`,
  },
  {
    id: "mind_body_flexible_pay_v1",
    sql: `
UPDATE job_categories
SET description = 'Learning, reading, and skills — each task can be paid or unpaid (your choice).'
WHERE slug = 'mind_body' OR label = 'Grow Your Mind and Body';
`,
  },
  {
    id: "allowance_payout_mode_v1",
    sql: `
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS payout_mode TEXT NOT NULL DEFAULT 'automatic';
UPDATE allowances SET payout_mode = 'automatic' WHERE payout_mode IS NULL OR payout_mode NOT IN ('automatic', 'manual');
`,
  },
  {
    id: "allowance_week_period_v1",
    sql: `
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS period_start_day_of_week INTEGER;
ALTER TABLE allowances ADD COLUMN IF NOT EXISTS period_end_day_of_week INTEGER;
UPDATE allowances SET period_start_day_of_week = 1 WHERE cadence = 'weekly' AND period_start_day_of_week IS NULL;
UPDATE allowances SET period_end_day_of_week = 0 WHERE cadence = 'weekly' AND period_end_day_of_week IS NULL;
`,
  },
  {
    id: "voice_lessons_v1",
    sql: `
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS voice_steps TEXT;
ALTER TABLE learning_progress ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
`,
  },
  {
    id: "app_settings_v1",
    sql: `
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
  },
];

async function migrationApplied(id: string): Promise<boolean> {
  if (pool) {
    const existing = await pool.query("SELECT id FROM schema_migrations WHERE id = $1", [id]);
    return (existing.rowCount ?? 0) > 0;
  }
  const result = await db.execute(sql`SELECT id FROM schema_migrations WHERE id = ${id}`);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
  return rows.length > 0;
}

async function markMigrationApplied(id: string): Promise<void> {
  await db.execute(sql`INSERT INTO schema_migrations (id) VALUES (${id})`);
}

export async function runMigrations(): Promise<void> {
  await runSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of MIGRATIONS) {
    if (await migrationApplied(migration.id)) continue;

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
        await client.query("COMMIT");
        console.log(`✅ Migration applied: ${migration.id}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      try {
        await runSql(migration.sql);
        await markMigrationApplied(migration.id);
        console.log(`✅ Migration applied: ${migration.id}`);
      } catch (err) {
        throw err;
      }
    }
  }
}

export async function listFamilyIds(): Promise<number[]> {
  const rows = await db.select({ id: families.id }).from(families);
  return rows.map((r) => r.id);
}
