# 🌱 MintSprout

**A family-friendly financial literacy platform that helps kids learn to earn, save, spend, invest, and donate — while parents stay in control.**

[![Docker Hub](https://img.shields.io/docker/pulls/raddadengineer/mintsprout?style=flat-square&logo=docker)](https://hub.docker.com/r/raddadengineer/mintsprout)
[![Multi-arch](https://img.shields.io/badge/arch-linux%2Famd64%20%7C%20linux%2Farm64-blue?style=flat-square)](https://hub.docker.com/r/raddadengineer/mintsprout)

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

## 🚀 Quick Start (Docker)

### Option 1 — Docker Compose (Portainer Stack)

Use the included [`docker-compose.portainer.yml`](docker-compose.portainer.yml) to deploy via Portainer:

```yaml
# Minimal environment variables needed:
POSTGRES_DB: mintsprout
POSTGRES_USER: mintsprout
POSTGRES_PASSWORD: your_secure_password
JWT_SECRET: your_32_char_plus_secret_key
```

> ⚠️ **Never bake `JWT_SECRET` into an image.** Always pass it at runtime via environment variables or Docker secrets.

### Option 2 — Manual Docker Run

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
  -p 5000:5000 \
  --link mintsprout-db:db \
  -e DATABASE_URL=postgresql://mintsprout:your_secure_password@db:5432/mintsprout \
  -e JWT_SECRET=your_secret_key \
  raddadengineer/mintsprout:latest
```

App will be available at **http://localhost:5000**

---

## 🔑 Default Login Credentials

> These are seeded automatically on first run. **Change them in production.**

| Role | Username | Password |
|------|----------|----------|
| Parent | `parent` | `password123` |
| Child | `emma` | `password123` |
| Child | `jake` | `password123` |

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

# Start dev server (frontend + backend with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
node dist/index.js
```

The dev server starts at **http://localhost:5000** and uses in-memory storage (no Postgres needed locally).

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
├── Dockerfile              # Multi-stage production build
└── docker-compose.portainer.yml  # Portainer stack config
```

---

## 🔒 Security Notes

- `JWT_SECRET` must be set at runtime — **never baked into the Docker image**
- Passwords are hashed with bcrypt (10 salt rounds)
- All API routes (except `/api/auth/login` and `/api/auth/register`) require a valid JWT
- Run as non-root user (`mintsprout`) inside the container

---

## 📄 License

MIT — feel free to fork and build on it!
