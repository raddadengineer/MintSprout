## MintSprout Wiki

This is the “in-repo wiki” for MintSprout. It’s meant to answer practical questions about running and maintaining the app.

### App overview

- **Client**: `client/` (React + Vite + TypeScript + Tailwind + TanStack Query)
- **Server**: `server/` (Express)
- **Shared types/schema**: `shared/schema.ts` (Drizzle tables + Zod schemas)
- **Auth**: JWT via `Authorization: Bearer <token>`

### Storage modes (dev vs production)

MintSprout automatically chooses a storage backend:

- **In-memory storage** (default for local dev): `server/storage.ts` (`MemStorage`)
- **PostgreSQL storage** (production / when configured): `server/postgres-storage.ts` (`PostgresStorage`)

Selection logic lives in `server/storage.ts`:

- Uses Postgres when `NODE_ENV === "production"` **or** when `DATABASE_URL` is set.
- Otherwise uses in-memory storage.

### Required environment variables

MintSprout requires:

- **`JWT_SECRET`**: required in *all* environments (dev and prod). Set via `.env` / Docker, or rotate in **Controls → Sprout & App**. The server will refuse to verify/sign tokens without it.

When using PostgreSQL storage (production or when `DATABASE_URL` is set), you also need:

- **`DATABASE_URL`**: Postgres connection string, e.g. `postgresql://user:pass@host:5432/dbname`

### Kiosk mode (single household, PIN-gated parent)

MintSprout supports an optional **kiosk mode** that bypasses username/password login and is intended for a single household on a trusted device.

Enable with:

- **`KIOSK_MODE=true`**: enables kiosk mode
- **`PARENT_PIN=1234`**: required; parent must enter this PIN once when selecting the Parent button
- **`KIOSK_FAMILY_ID=1`**: optional; defaults to `1`

Related endpoints:

- `GET /api/config` → `{ kioskMode: boolean }`
- `GET /api/kiosk/children` → public list of children in the kiosk household
- `POST /api/kiosk/child-session` → `{ childId }` returns a normal JWT session
- `POST /api/kiosk/parent-session` → `{ pin }` returns a normal JWT session (parent-only)

### Sprout & app settings (parent UI)

Parents can manage AI, voice, and kiosk options at **Controls → Sprout & App** (`/controls?tab=sprout`):

- Sprout on/off, Open WebUI URL/key/model, Ollama fallback, Kokoro voice URL, voice profile IDs
- Profile picker (kiosk mode), parent PIN, kiosk family ID, **JWT secret** (rotation logs everyone out)
- **Test LLM** / **Test Voice** buttons for connectivity checks
- **Database backup & restore** — scheduled daily/weekly dumps to disk, download a `.sql` dump, or restore when moving hosts (parent-only)

Settings are stored in the `app_settings` database table and override `.env` defaults immediately (no container restart). API keys, PINs, and JWT secrets are masked in GET responses. `DATABASE_URL` remains environment-only.

Admin API (parent JWT required):

- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- `POST /api/admin/settings/test-llm`
- `POST /api/admin/settings/test-voice`
- `POST /api/admin/settings/backup` — download PostgreSQL dump
- `POST /api/admin/settings/backup/run` — run daily or weekly backup to disk now
- `POST /api/admin/settings/restore` — `{ confirm: "RESTORE", sql: "..." }`

### Default accounts

Initial family login details are documented in `README.md`. Change default passwords after setup.

### API logging behavior

The server logs request method/path/status and duration for `/api/*`, but it does **not** log response JSON bodies. This prevents accidental token leakage in logs.

### Common workflows

**Parents:** see [docs/parent-guide.md](docs/parent-guide.md) for how to use the app (tasks, allowances, lessons, approvals, and Sprout settings).

#### Local dev

```bash
npm install
export JWT_SECRET="change-me-to-a-long-random-string"
npm run dev
```

#### Type checking

```bash
npm run check
```

#### Database schema changes

This repo uses Drizzle. To push schema updates:

```bash
npm run db:push
```

### Troubleshooting

- **Login fails immediately / server errors about JWT**:
  - Ensure `JWT_SECRET` is set in your shell or container environment.
- **Child account created via API can’t login**:
  - Ensure you’re on a version where `PostgresStorage.createUser` hashes plaintext passwords and doesn’t double-hash bcrypt strings.
- **Docker Postgres errors like `column "... " does not exist` after pulling new code**:
  - Your `postgres_data` volume likely contains an older schema (Compose only runs `init-db.sql` on first init).
  - **Back up first:** `./scripts/backup-db.sh manual` or check `data/backups/daily/` from the in-app scheduler (Sprout & App)
  - For a clean local reset: `docker compose down -v` (**deletes all local DB data**), then `docker compose up -d --build`.

### Security model notes (practical)

- **Authorization checks**: for “ID-based” resources (e.g. savings goals / spending log / donations), endpoints should verify the record belongs to the authenticated family before updating/deleting. If you add new routes that accept `:id`, follow the same pattern.
- **JWT storage**: the current client uses a bearer token approach; consider migrating to HttpOnly cookies + CSRF if you plan to harden against XSS.

### Parent controls (approvals + allowances)

- **Controls UI**: parents can manage these at the `/controls` page.

#### Approvals

- **Family settings**: `GET/PUT /api/family-settings/:familyId`
  - `requireSpendingApproval`
  - `requireDonationApproval`
  - `requireGoalFundingApproval`
- When approvals are enabled:
  - Child `POST /api/spending-log`, `POST /api/donations`, and `POST /api/savings-goals/:id/fund` return **`202 Accepted`** with `{ pending: true, requestId }`
  - Parent reviews pending requests in `GET /api/approval-requests?status=pending`
  - Parent decides with `POST /api/approval-requests/:id/decide` body `{ decision: "approve" | "deny" }`

#### Allowance scheduler

- Allowances are configured per child (weekly or monthly):
  - `GET/POST /api/allowances`
  - `PATCH/DELETE /api/allowances/:id`
- The server runs a scheduler loop (boot + every minute) that:
  - Applies due allowances (idempotent per day)
  - Distributes the allowance into buckets using the child’s allocation settings (and moves disabled account portions into spending)
  - Writes ledger entries of type `allowance`

