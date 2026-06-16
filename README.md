# 🌱 MintSprout

**A family-friendly financial literacy platform that helps kids learn to earn, save, spend, invest, and donate — while parents stay in control.**

## For parents

See **[docs/parent-guide.md](docs/parent-guide.md)** for a full manual on using MintSprout — tasks, allowances, lessons, approvals, Sprout AI, and day-to-day workflows.

---

## ✨ Features

### 👨‍👩‍👧‍👦 For Families
- **Job & Chore Management** — Parents create jobs, kids mark them complete, parents approve & pay
- **Automatic Money Allocation** — Payments are split into Spending, Savings, Future Fund (Roth IRA), and Grow Fund (Brokerage) buckets based on configurable percentages
- **Multi-child Support** — Switch between children with a single tap; each child has their own profile
- **Family Dashboard** — Parents see the big picture; kids see their own progress

### 🎯 For Kids
- **Savings Goals** — Set and track goals (e.g. "New bike — $40 saved / $120 needed")
- **Spending Log** — Record what you buy by category (food, toys, clothes, entertainment, education)
- **Donations Tracker** — Log charitable giving and pick causes you care about
- **Achievements** — Earn badges for completing jobs and finishing lessons
- **Confetti Celebrations** 🎉 — Bursts of color when you complete a job or earn a payment

### 📚 Financial Education
- **17 curated lessons** across 5 categories — Earning, Saving, Spending, Investing, Donating
- **2 age-track curricula** — Money Grower (ages 7–10) and Money Builder (ages 11–15)
- **Real YouTube videos** from Learn Bright, TED-Ed, Sesame Workshop, One Minute Economics, and more
- **51 quiz questions** (3 per lesson) to reinforce key concepts

---

## 🚀 Docker setup (Docker Compose)

This is the recommended way to run MintSprout on a home server, NAS, or dev machine.

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2 (`docker compose`, not legacy `docker-compose`)
- ~2 GB RAM and ~5 GB disk

### 1. Get the project

```bash
git clone https://github.com/raddadengineer/MintSprout.git
cd MintSprout
```

### 2. Create your `.env` file

Docker Compose reads a `.env` file in the project root automatically and substitutes `${VAR}` values into [`docker-compose.yml`](docker-compose.yml).

```bash
cp .env.example .env
```

Edit `.env` before your first `docker compose up`. See [`.env.example`](.env.example) for a copy-paste template.

> ⚠️ **Never commit `.env` or bake secrets into the Docker image.** Pass them at runtime only. Several Sprout/kiosk settings can be changed later in **Controls → Sprout & App** without editing `.env` again.

#### Required variables

These must be set in `.env` before the app container will start (Compose fails fast if `JWT_SECRET` is missing).

| Variable | What it does | Example / notes |
|----------|--------------|-----------------|
| **`JWT_SECRET`** | Secret key the server uses to **sign and verify login tokens** (parent, child, and kiosk sessions). If you change it, everyone is logged out. Minimum 32 random characters. Can also be rotated in **Controls → Sprout & App**. | `openssl rand -base64 48` |
| **`POSTGRES_PASSWORD`** | Password for the **PostgreSQL database**. Compose uses this for both the `postgres` service (`POSTGRES_PASSWORD`) and the app’s **`DATABASE_URL`** — they must stay in sync. Choose a strong password; this is not the parent login password. | `my-family-db-secret-2024` |
| **`ALLOWED_ORIGINS`** | Comma-separated list of **browser URLs** that may access the API (scheme + host + port, no trailing slash). Prevents other websites from calling your MintSprout API with a stolen token. For local dev use localhost; in production add your real domain(s). | `http://localhost:8080,http://127.0.0.1:8080` or `https://mintsprout.example.com` |

**How they connect in Compose**

- `POSTGRES_PASSWORD` → Postgres container + `DATABASE_URL=postgresql://mintsprout:PASSWORD@postgres:5432/mintsprout` inside the app.
- `JWT_SECRET` → read only by the app (not stored in the DB unless you save a new value via the parent UI).
- `ALLOWED_ORIGINS` → CORS / origin checks on API requests from the browser.

`DATABASE_URL` itself is **built automatically** in `docker-compose.yml` — you normally do not set it in `.env` unless you customize the compose file for an external database.

#### Profile picker (kiosk mode)

Used when the login screen shows child names instead of username/password. Overridable in **Controls → Sprout & App → Login and profiles**.

| Variable | Default | What it does |
|----------|---------|--------------|
| **`KIOSK_MODE`** | `true` | When `true`, the app shows the **profile picker** (tap a child’s name or Parent). When `false`, everyone uses username/password on `/login`. |
| **`PARENT_PIN`** | `1234` | PIN the parent enters on the profile picker to open a **parent session**. Required when kiosk mode is on. Change from the default immediately. |
| **`KIOSK_FAMILY_ID`** | `1` | Which **family row** in the database kiosk mode uses. Leave at `1` for a single-household install; only change if you know you have multiple families in one DB. |

#### Sprout AI coach (optional)

Sprout powers chat, daily briefs, and voice-led lessons. If you disable AI or leave URLs empty, the rest of MintSprout still works. All of these can be updated in **Controls → Sprout & App** after deploy.

| Variable | Default (compose) | What it does |
|----------|-------------------|--------------|
| **`AI_COACH_ENABLED`** | `true` | Master switch for Sprout features in the kid UI. Set `false` to hide Sprout if you have no LLM/voice server. |
| **`OPENWEBUI_BASE_URL`** | (see compose) | Base URL of your **[Open WebUI](https://github.com/open-webui/open-webui)** instance — primary LLM for Sprout chat. |
| **`OPENWEBUI_API_KEY`** | *(empty)* | API key Open WebUI expects in the `Authorization` header. Required if your Open WebUI instance is not open. |
| **`OPENWEBUI_MODEL`** | `gemma3:kids` | Model id/name as Open WebUI lists it (e.g. a fine-tuned kids model). |
| **`OLLAMA_BASE_URL`** | (see compose) | Direct **Ollama** URL (e.g. `http://192.168.1.10:11434`). Used as fallback when Open WebUI URL or key is not set. |
| **`OLLAMA_MODEL`** | `llama3.1:latest` | Ollama model tag to use for fallback requests. |
| **`KIDS_VOICE_BASE_URL`** | (see compose) | Base URL for **text-to-speech** (Kokoro-compatible API, often `http://host:8880/v1`). Powers Sprout voice and quiz read-aloud. |
| **`KIDS_VOICE_MODEL`** | `kokoro` | Voice API model identifier. |
| **`AI_VOICE_YOUNGEST`** | `af_bella` | Voice profile id for children **age 6 and under**. |
| **`AI_VOICE_YOUNGER`** | `af_sky` | Voice profile id for children **ages 7–10**. |
| **`AI_VOICE_OLDER`** | *(empty)* | Voice profile id for children **11+**. Optional; falls back to younger voice if unset. |

#### Data paths and volumes

Compose bind-mounts host directories so data survives `docker compose down` and is easy to back up. Set paths in `.env` (relative to the project root, or use absolute paths like `/srv/mintsprout/...` on a NAS).

| Variable | Default | What it stores |
|----------|---------|----------------|
| **`MINTSPROUT_DATA_DIR`** | `./data` | Conventional base folder (documented default; other paths can live under it). |
| **`MINTSPROUT_POSTGRES_DIR`** | `./data/postgres` | PostgreSQL database files (family accounts, jobs, payments, lessons, settings). |
| **`MINTSPROUT_LOGS_DIR`** | `./data/logs` | Application log files from the MintSprout container. |
| **`MINTSPROUT_BACKUPS_DIR`** | `./data/backups` | Database dump files written by the app scheduler and manual scripts. |

Layout after backups run:

```text
data/
├── postgres/          # live database (do not edit by hand)
├── logs/              # app logs
└── backups/
    ├── daily/         # automatic daily dumps (02:00 UTC)
    ├── weekly/        # automatic weekly dumps (Sunday 03:00 UTC)
    └── manual/        # optional: ./scripts/backup-db.sh manual
```

> **Migrating from named Docker volumes:** If you previously used `postgres_data` / `app_logs` volumes, copy data into these host paths once, then recreate the stack. See [DEPLOYMENT.md](DEPLOYMENT.md).

#### Scheduled backups

The MintSprout app runs **daily** and **weekly** `pg_dump` jobs internally and writes compressed dumps to `MINTSPROUT_BACKUPS_DIR` (mounted at `/app/backups` in Docker). Configure schedule, retention, and “run now” from **Controls → Sprout & App → Database backup & restore**. Defaults (UTC): daily at 02:00, weekly on Sunday at 03:00.

| Schedule | Default time (UTC) | Setting in Sprout & App |
|----------|------------------|-------------------------|
| Daily | 02:00 every day | Daily backup + retention days |
| Weekly | 03:00 every Sunday | Weekly backup + day/hour + retention weeks |

First-boot defaults can also come from env vars (`BACKUP_SCHEDULE_ENABLED`, `BACKUP_DAILY_UTC_HOUR`, etc.) until you save settings in the UI.

```bash
# One-off manual backup on the Docker host
./scripts/backup-db.sh manual
```

#### Variables set in Compose (not in `.env.example`)

These are fixed in [`docker-compose.yml`](docker-compose.yml) for the standard stack — listed here so you know what they mean if you read the compose file:

| Variable | Value | What it does |
|----------|-------|--------------|
| `POSTGRES_DB` | `mintsprout` | Database name created inside Postgres. |
| `POSTGRES_USER` | `mintsprout` | Database user name (paired with `POSTGRES_PASSWORD`). |
| `NODE_ENV` | `production` | Runs the app in production mode (Postgres storage, static frontend). |
| `PORT` | `5000` | Port the Node server listens on **inside** the container (mapped to `8080` on your host). |

#### Example `.env` files

**Minimal local install**

```bash
JWT_SECRET=your-long-random-secret-from-openssl-rand-base64-48
POSTGRES_PASSWORD=your-strong-db-password
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

MINTSPROUT_POSTGRES_DIR=./data/postgres
MINTSPROUT_LOGS_DIR=./data/logs
MINTSPROUT_BACKUPS_DIR=./data/backups

KIOSK_MODE=true
PARENT_PIN=5678
```

**With Sprout on a home LAN** (replace IPs with your LLM/TTS hosts)

```bash
JWT_SECRET=your-long-random-secret
POSTGRES_PASSWORD=your-strong-db-password
ALLOWED_ORIGINS=https://mintsprout.home.local

KIOSK_MODE=true
PARENT_PIN=8642

AI_COACH_ENABLED=true
OPENWEBUI_BASE_URL=https://ai.example.com
OPENWEBUI_API_KEY=sk-your-key-here
OPENWEBUI_MODEL=gemma3:kids
OLLAMA_BASE_URL=http://192.168.1.10:11434
OLLAMA_MODEL=llama3.1:latest
KIDS_VOICE_BASE_URL=http://192.168.1.10:8880/v1
KIDS_VOICE_MODEL=kokoro
AI_VOICE_YOUNGEST=af_bella
AI_VOICE_YOUNGER=af_sky
```

**What you cannot put in `.env` (by design)**

| Item | Where to configure |
|------|-------------------|
| Parent/child **login passwords** | Default users are seeded in the DB; reset with `npm run passwords:reset` in the app container, or manage via your workflow. |
| **JWT secret** (after first run) | Optional: **Controls → Sprout & App** (overrides `.env` in the database). |
| Kiosk PIN, Sprout URLs, models | **Controls → Sprout & App** (overrides `.env` at runtime). |
| **Database backup/restore** | **Controls → Sprout & App** (scheduled + download/restore), or `./scripts/backup-db.sh`. |

### 3. Start the stack

Build the app image and start Postgres and MintSprout:

```bash
docker compose up -d --build
```

This creates host directories for `MINTSPROUT_POSTGRES_DIR`, `MINTSPROUT_LOGS_DIR`, and `MINTSPROUT_BACKUPS_DIR` on first run.

Check status:

```bash
docker compose ps
docker compose logs -f mintsprout
```

The app waits for Postgres to become healthy before starting. First boot runs database migrations and seeds default family data.

### 4. Open the app

| Service | URL |
|---------|-----|
| MintSprout | **http://localhost:8080** |
| PostgreSQL | `localhost:5432` (only if you need external DB tools) |

### 5. First login

Default parent account on first run — **change the password immediately**, then add children from the app:

| Role | Username | Password |
|------|----------|----------|
| Parent | `parent` | `password123` |

After login as parent:

1. **Family → Add Child** — create each child's profile with username and password.
2. Change the parent password (`npm run passwords:reset` inside the app container).
3. Open **Controls → Sprout & App** to tune kiosk PIN, JWT secret, Sprout/LLM/voice, and **database backup/restore**.

### Common commands

```bash
# Stop (keeps data in MINTSPROUT_*_DIR folders)
docker compose down

# Rebuild after pulling code changes
docker compose up -d --build

# App logs
docker compose logs -f mintsprout

# Shell into the app container
docker exec -it mintsprout-app sh

# Reset passwords (inside app container)
docker exec -it mintsprout-app npm run passwords:reset
```

> **Warning:** Deleting `MINTSPROUT_POSTGRES_DIR` (e.g. `rm -rf ./data/postgres`) destroys all family data. Back up first.

### Portainer

To deploy from Portainer without building locally, use [`docker-compose.portainer.yml`](docker-compose.portainer.yml) — it pulls `raddadengineer/mintsprout:latest` instead of building. Set the same environment variables in the stack editor (`JWT_SECRET`, `POSTGRES_PASSWORD`, `ALLOWED_ORIGINS`, `MINTSPROUT_*_DIR` paths, plus optional Sprout/kiosk vars). Mount `MINTSPROUT_BACKUPS_DIR` on the app container for on-disk scheduled backups.

No host-mounted `init-db.sql` is required — the app applies the base schema automatically on first start when Postgres is empty. To reset from scratch, stop the stack and wipe `MINTSPROUT_POSTGRES_DIR`, then redeploy.

**Important:** Portainer will not pick up code fixes until the Hub image is rebuilt and pushed. After pulling new code, rebuild/push the image (below), then in Portainer use **Pull and redeploy** on the stack.

Rebuild and push the image after code changes:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t raddadengineer/mintsprout:latest --push .
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for HTTPS, backups, and production checklist.

### Manual Docker run (advanced)

```bash
# 1. Start Postgres
docker run -d \
  --name mintsprout-db \
  -e POSTGRES_DB=mintsprout \
  -e POSTGRES_USER=mintsprout \
  -e POSTGRES_PASSWORD=your_secure_password \
  postgres:15-alpine

# 2. Run the app
docker run -d \
  --name mintsprout \
  -p 8080:5000 \
  --link mintsprout-db:postgres \
  -e DATABASE_URL=postgresql://mintsprout:your_secure_password@postgres:5432/mintsprout \
  -e JWT_SECRET=your_secret_key \
  -e ALLOWED_ORIGINS=http://localhost:8080 \
  raddadengineer/mintsprout:latest
```

---

## 🧷 Kiosk Mode (no username/password)

MintSprout can run in a **single-household “kiosk mode”** where the login screen is replaced by:

- **Parent** button → prompts for a **PIN** once → enters parent session
- **Child** button → pick a child → enters child session

Enable it via environment variables:

- **`KIOSK_MODE=true`**: turns kiosk mode on
- **`PARENT_PIN=1234`**: required in kiosk mode (parent-only)
- **`KIOSK_FAMILY_ID=1`**: optional (defaults to `1`)

Example (Docker Compose):

```yaml
environment:
  KIOSK_MODE: "true"
  PARENT_PIN: "1234"
  KIOSK_FAMILY_ID: "1"
```

**Parent UI:** After login, open **Controls → Sprout & App** to change kiosk mode, parent PIN, JWT secret, Sprout/LLM/voice URLs, and models without restarting Docker. Values saved in the UI override `.env` at runtime. `DATABASE_URL` stays in `.env` only.

---

## 🗄️ Database

MintSprout uses **PostgreSQL** with **Drizzle ORM**. The `init-db.sql` file seeds:

- Default family, users, and children
- Default allocation settings (20% Spend / 30% Save / 25% Future Fund / 25% Grow Fund)
- 17 lessons with real educational videos
- 51 quiz questions (3 per lesson)
- 3 new feature tables: `savings_goals`, `spending_log`, `donations`

### Adding Quiz/Lesson Data to an Existing DB

```bash
# Run only the new sections against your existing database
psql -U mintsprout -d mintsprout -f init-db.sql
```

All inserts use `ON CONFLICT DO NOTHING` and `CREATE TABLE IF NOT EXISTS` — safe to re-run.

### Backups

Automatic **daily** and **weekly** dumps run inside the MintSprout app into `MINTSPROUT_BACKUPS_DIR` (default `./data/backups/daily` and `.../weekly`). Configure in **Controls → Sprout & App**.

```bash
# Manual backup on the Docker host
./scripts/backup-db.sh manual
```

Also available in **Controls → Sprout & App → Database backup & restore** (scheduled backups, download, and upload restore).

> **Warning:** Deleting `MINTSPROUT_POSTGRES_DIR` permanently removes all database data. See [DEPLOYMENT.md](DEPLOYMENT.md) for restore steps.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, TanStack Query |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 15, Drizzle ORM |
| Auth | JWT (JSON Web Tokens) |
| Build | Vite (client), esbuild (server) |
| Container | Docker multi-arch (linux/amd64, linux/arm64) |
| Font | Nunito (Google Fonts) |

---

## 📖 Lesson Curriculum

### 🌱 Money Grower Track (Ages 7–10)
| Lesson | Video Source |
|--------|-------------|
| How to Earn Money | Learn Bright |
| Why Save Money? | Sesame Workshop |
| Smart Spending — Needs vs Wants | BuzzWithBee |
| Growing Your Money | One Minute Economics |
| Sharing is Caring | Bubbles and Friends |
| Making Change — Coin Math | Learn Bright |
| Why We Save — The Magic of Goals | Sesame Workshop |
| Earning More Ways | Learn Bright |
| Giving Goals — Pick a Cause | Bubbles and Friends |
| Comparing Prices — Be a Smart Shopper | BuzzWithBee |
| Banking Basics — Your Money's Safe House | Sesame Workshop |

### 🚀 Money Builder Track (Ages 11–15)
| Lesson | Video Source |
|--------|-------------|
| Compound Interest — Money That Grows Itself | One Minute Economics |
| What is a Stock? | TED-Ed |
| The 50/30/20 Rule | Miacademy |
| Good Debt vs Bad Debt | Student's Life |
| Donating Strategically | Easy Peasy Finance |
| Roth IRA for Kids — Tax-Free Future | Noel Lorenzana, CPA |

---

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Required env var for auth
export JWT_SECRET="change-me-to-a-long-random-string"

# Start dev server (frontend + backend with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
node dist/index.js
```

The dev server starts at **http://localhost:5000** and uses in-memory storage by default (no Postgres needed locally). If `DATABASE_URL` is set, it will use PostgreSQL storage.

---

## 🐳 Building & Pushing Multi-arch Image

```bash
# Build and push for both amd64 and arm64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t raddadengineer/mintsprout:latest \
  --push .
```

---

## 📁 Project Structure

```
MintSprout/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route-level page components
│       └── index.css       # Global styles & Nunito font
├── server/                 # Express backend
│   ├── routes.ts           # All REST API endpoints
│   ├── storage.ts          # IStorage interface + MemStorage (dev)
│   └── postgres-storage.ts # PostgresStorage (production)
├── shared/
│   └── schema.ts           # Drizzle ORM schema (shared types)
├── init-db.sql             # PostgreSQL seed data
├── docs/
│   └── parent-guide.md     # Parent usage manual
├── docker-compose.yml      # Local / self-hosted Compose stack
├── Dockerfile              # Multi-stage production build
└── docker-compose.portainer.yml  # Portainer stack (pre-built image)
```

---

## 🔒 Security Notes

- `JWT_SECRET` must be set at runtime — **never baked into the Docker image**
- Passwords are hashed with bcrypt (10 salt rounds)
- All API routes (except `/api/auth/login`) require a valid JWT
- Sensitive auth data is not logged in server request logs
- Run as non-root user (`mintsprout`) inside the container

---

## 📄 License

MIT — feel free to fork and build on it!
