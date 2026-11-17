# SkillFort LMS Platform

React 19 + Vite frontend with an Express API backend. Data is stored in **PostgreSQL** (production) or **`db.json`** (local fallback when `DATABASE_URL` is not set).

**Team documentation:** [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md) — project knowledge, environment setup, automated tests, and manual QA checklist.

## Quick Start (JSON file — default)

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Quick Start (PostgreSQL — recommended for production)

**1. Start PostgreSQL:**

```bash
npm run db:up
```

**2. Add to `.env`:**

```
DATABASE_URL=postgresql://skillfort:skillfort_dev@localhost:5432/skillfort_lms
JWT_SECRET=your-strong-secret-here
```

**3. Start the server** (auto-imports `db.json` on first run):

```bash
npm run dev
```

Or migrate manually:

```bash
npm run db:migrate
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | Secret for signing auth tokens |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `FIREBASE_*` | Optional | Firestore cloud sync (JSON mode only) |
| `VIMEO_ACCESS_TOKEN` | Optional | Server-side Vimeo API |

## Dev Credentials

Only shown in development builds:

- **Admin:** `admin@skillfort.com` / `admin123`
- **Student:** `student@skillfort.com` / `student123`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run dev:postgres` | Start Docker Postgres + dev server |
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:migrate` | Import `db.json` into PostgreSQL |
| `npm run build` | Build SPA + server bundle |
| `npm run start` | Run production server (`NODE_ENV=production`) |
| `npm run smoke:prod` | Post-deploy health/auth smoke tests |
| `npm run lint` | TypeScript type-check |
| `npm test` | Run Jest tests |

## Port Already In Use?

If `npm run dev` fails with `EADDRINUSE` on port 3000, stop the existing process:

**PowerShell:**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Then run `npm run dev` again.

## Database Architecture

| Mode | When | Storage |
|------|------|---------|
| **JSON** | No `DATABASE_URL` | `db.json` + `.db_backup.json` |
| **PostgreSQL** | `DATABASE_URL` set | Docker Postgres or managed DB |

PostgreSQL schema: `server/db/schema.sql`

On first PostgreSQL startup, existing `db.json` is imported automatically if the database is empty.

## Platform Data (Server-Backed)

LMS data that previously lived in browser `localStorage` (quizzes, instructors, wishlists, emails, certificate templates, etc.) is now stored in the server database under `platformKv`.

On first login after upgrade, existing browser data is migrated automatically.

**Still client-only:** auth tokens, dark mode preference.

## Security

- Set a strong `JWT_SECRET` before deploying (required in production — server will refuse to start without it)
- Use PostgreSQL (`DATABASE_URL`) for multi-user production (also required in production)
- Set `APP_URL` to your public domain in production (certificate links and emails)
- Rotate any API keys that were ever committed to git or shared publicly

## Split Deploy (Vercel frontend + Render backend)

The app can run as one server (`npm run build` + `npm run start`) or split:

| Host | Role | Build |
|------|------|-------|
| **Vercel** | React SPA | `vite build` (see `vercel.json`) |
| **Render** | Express API + PostgreSQL | `npm run build` + `npm run start` |

**Vercel environment (build time):**

```
VITE_API_URL=https://your-backend.onrender.com
```

**Render environment:**

```
APP_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app
DATABASE_URL=...
JWT_SECRET=...
```

Redeploy **both** after changing env vars. Course banners and uploads are served from the Render host via `VITE_API_URL`.
- Admin routes require a valid JWT with `role: admin`
- Passwords are bcrypt-hashed
- Course Q&A threads are restricted to enrolled students and admins

## Docker (production)

```bash
cp .env.production.example .env
# Edit .env: JWT_SECRET, POSTGRES_PASSWORD, APP_URL

docker compose up --build
```

Open your `APP_URL`. Change the default admin password after first login.

## Production deploy (without Docker)

```bash
cp .env.production.example .env
# Set JWT_SECRET, DATABASE_URL, APP_URL

npm run build
npm run start          # sets NODE_ENV=production
npm run smoke:prod     # optional post-deploy checks
```

See `Dockerfile` for the production image build (`npm run build` → `node dist/server.cjs`).
