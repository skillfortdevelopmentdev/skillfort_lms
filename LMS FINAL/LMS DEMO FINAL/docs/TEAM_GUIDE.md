# SkillFort LMS — Team Guide (Project Knowledge & Testing)

This document is for developers, QA, and stakeholders who need to understand the platform, run tests, and verify deployments.

---

## 1. Product overview

**SkillFort LMS** is a learning management system with:

- Public marketing website (courses, contact, landing banner, wall of success)
- **Student portal** — enroll, watch lessons (Vimeo), progress, certificates, cart, checkout
- **Admin panel** — courses, lessons, quizzes, orders, users, coupons, certificates, mail settings, website content

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7 |
| Backend | Express (Node.js), TypeScript |
| Database | PostgreSQL (production) or `db.json` (local fallback) |
| Auth | JWT (Bearer token in `localStorage`) |
| Payments | Razorpay (live) or built-in simulator |
| Media uploads | Local disk (dev) or **Cloudinary** (recommended for production) |

---

## 2. Live environment (current split deploy)

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://lmf-final.vercel.app | Public site + admin + student UI |
| **Backend API** | https://lmf-final.onrender.com | Express API + PostgreSQL |
| **Health check** | https://lmf-final.onrender.com/api/health | DB status, course count |

> **Render free tier:** API may sleep after ~15 min idle. First request can take 30–60 seconds.

### How frontend talks to backend

The frontend is on Vercel; the API is on Render. All API calls use `VITE_API_URL` (set at Vercel build time).

```
Browser (Vercel)  →  https://lmf-final.onrender.com/api/...
Images/uploads    →  Cloudinary URLs or Render /uploads/ (if Cloudinary not set)
```

---

## 3. Architecture diagram

```
┌─────────────────────┐         HTTPS + CORS          ┌──────────────────────┐
│  Vercel (SPA)       │ ────────────────────────────► │  Render (Express)    │
│  lmf-final.vercel   │         JWT Authorization     │  lmf-final.onrender    │
└─────────────────────┘                               └──────────┬───────────┘
                                                                   │
                        ┌──────────────────────────────────────────┼──────────────┐
                        │                                          │              │
                        ▼                                          ▼              ▼
                 Render PostgreSQL                          Cloudinary      (local disk
                 (metadata, users,                          (images)         fallback)
                  courses, platform_kv)
```

**Important:** PostgreSQL stores **data and image URLs**, not image files. Image binaries go to **Cloudinary** (production) or **server disk** (local dev only).

---

## 4. Repository structure

```
mahalakshmi-skillfort-lms-platform-main/
├── src/                    # React frontend
│   ├── App.tsx             # Root routes, auth, data bootstrap
│   ├── components/         # UI (AdminPanel, StudentPortal, public site)
│   ├── components/admin/   # Admin sub-pages (dashboard, banner, wall of success)
│   ├── api/                # apiFetch, platform KV, config (VITE_API_URL)
│   ├── routes/             # adminRoutes.ts, studentRoutes.ts
│   └── types.ts            # Shared TypeScript types
├── server.ts               # Express app + all /api routes
├── server/                 # Backend modules
│   ├── auth.ts             # JWT, bcrypt, requireAuth / requireAdmin
│   ├── db/                 # PostgreSQL + JSON engines, schema.sql
│   ├── uploads/            # Image save (local + Cloudinary)
│   ├── payments/           # Razorpay, pricing, refunds
│   └── mail/               # SMTP notifications
├── db.json                 # Seed data (imported into Postgres on first run)
├── scripts/                # migrate, smoke-test, postgres CRUD test
├── docs/                   # This guide
└── vercel.json             # Vercel SPA + vite build config
```

---

## 5. User roles & test accounts

### Development / seeded accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@skillfort.com` | `admin123` | Full admin panel access |
| Student | `student@skillfort.com` | `student123` | Student portal access |

> **Production:** Change default passwords immediately after first login.

### Role capabilities

| Feature | Student | Admin |
|---------|---------|-------|
| Browse public courses | ✅ | ✅ |
| Enroll / purchase | ✅ | — |
| Watch lessons & save progress | ✅ | — |
| Certificates | ✅ | — |
| Course CRUD | — | ✅ |
| Orders, refunds, coupons | — | ✅ |
| Landing banner & wall of success | — | ✅ |
| User / admin management | — | ✅ |
| Mail & Razorpay settings | — | ✅ |

---

## 6. Environment variables

### Render (backend) — required

| Variable | Example | Description |
|----------|---------|-------------|
| `JWT_SECRET` | long random string | Auth token signing |
| `DATABASE_URL` | `postgresql://...` | Render Postgres connection |
| `APP_URL` | `https://lmf-final.vercel.app` | Public site URL (emails, certificates) |
| `CORS_ORIGINS` | `https://lmf-final.vercel.app` | Allowed frontend origins |
| `NODE_ENV` | `production` | Set automatically on Render |

### Render (backend) — recommended

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RAZORPAY_KEY_SECRET` | Live payments (omit = simulator mode) |
| `VIMEO_ACCESS_TOKEN` | Optional Vimeo API |

### Vercel (frontend) — required for split deploy

| Variable | Example | When |
|----------|---------|------|
| `VITE_API_URL` | `https://lmf-final.onrender.com` | **Production + Preview**, build time |

> Do **not** put `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, or `DATABASE_URL` on Vercel — backend only.

### Local development

Copy `.env.example` → `.env`. Minimum for local:

```
JWT_SECRET=dev-secret-change-me
APP_URL=http://localhost:3000
```

Add `DATABASE_URL` to use Postgres locally, or omit it to use `db.json`.

---

## 7. Local setup (developers)

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env

# 3. Run (JSON mode — simplest)
npm run dev
# → http://localhost:3000

# 4. Or with PostgreSQL
npm run db:up
# Add DATABASE_URL to .env, then:
npm run dev
```

### Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (frontend + API on port 3000) |
| `npm run build` | Production build (SPA + server bundle) |
| `npm run start` | Run production server locally |
| `npm run lint` | TypeScript check |
| `npm test` | Jest unit/integration tests |
| `npm run smoke:prod` | Post-deploy API smoke tests |
| `npm run db:migrate` | Import db.json → Postgres |

---

## 8. Deployment checklist

### Vercel (frontend)

1. Connect GitHub repo
2. Build command: `vite build`
3. Output directory: `dist`
4. Env: `VITE_API_URL=https://lmf-final.onrender.com` (**Production** enabled)
5. Redeploy after any env change

### Render (backend)

1. Web service: `npm run build` → `npm run start`
2. Set env vars (see section 6)
3. Attach Render PostgreSQL → `DATABASE_URL`
4. Add Cloudinary vars for persistent images
5. Redeploy after code or env changes

### Post-deploy verification

```bash
# Against live API
SMOKE_BASE_URL=https://lmf-final.onrender.com npm run smoke:prod

# Or against full public URL (monolith mode only)
SMOKE_BASE_URL=https://lmf-final.vercel.app npm run smoke:prod
```

Manual checks:
- [ ] https://lmf-final.onrender.com/api/health returns `"ok": true`
- [ ] Login at https://lmf-final.vercel.app/login
- [ ] Admin dashboard loads
- [ ] Upload landing banner → preview shows
- [ ] Upload wall of success → images visible on home page
- [ ] Student can open a course and save progress

---

## 9. Automated testing

### Run all tests

```bash
npm test
```

### Test suites

| File | Area covered |
|------|----------------|
| `server/__tests__/wallOfSuccess.test.ts` | Wall of success add/remove |
| `server/__tests__/landingBanner.test.ts` | Landing banner config |
| `server/__tests__/courseBanner.test.ts` | Course banner upload (local disk) |
| `server/__tests__/courseReviews.test.ts` | Review submit/moderation |
| `server/__tests__/passwordReset.test.ts` | Forgot/reset password flow |
| `server/__tests__/refund.test.ts` | Payment refunds |
| `server/__tests__/sessions.test.ts` | Student single-session |
| `server/__tests__/platformKvAccess.test.ts` | Platform KV permissions |
| `server/__tests__/startupValidation.test.ts` | Production env validation |
| `server/__tests__/emailLookup.test.ts` | Email lookup helpers |
| `src/__tests__/criticalPaths.test.tsx` | React student portal flows |
| `src/__tests__/courseValidity.test.ts` | Course access expiry utils |

### Smoke tests (production)

```bash
SMOKE_BASE_URL=https://lmf-final.onrender.com \
SMOKE_ADMIN_EMAIL=admin@skillfort.com \
SMOKE_ADMIN_PASSWORD=admin123 \
npm run smoke:prod
```

Checks: health, public courses API, settings, admin login, unauthorized access blocked.

### Type checking

```bash
npm run lint
```

---

## 10. Manual QA test plan

Use this checklist for release testing. Test on **live** (Vercel + Render) and optionally **local**.

### 10.1 Authentication

| # | Test | Expected |
|---|------|----------|
| A1 | Admin login with valid credentials | Redirect to `/admin/dashboard` |
| A2 | Student login with valid credentials | Redirect to `/student/dashboard` |
| A3 | Wrong password | Error message, no redirect |
| A4 | Logout | Token cleared, redirected to login |
| A5 | Forgot password (student) | Reset flow or dev link shown |
| A6 | Session replaced (login on 2 devices as student) | Second session kicks first |

### 10.2 Public website

| # | Test | Expected |
|---|------|----------|
| P1 | Home page loads | Banner, courses, wall of success (if data exists) |
| P2 | Course catalog | Published courses listed |
| P3 | Course detail page | Title, price, enroll/add to cart |
| P4 | Contact form | Submits without error |
| P5 | Certificate verify `/verify/:certNo` | Valid cert shows details; invalid shows error |

### 10.3 Student portal

| # | Test | Expected |
|---|------|----------|
| S1 | My courses | Enrolled courses visible |
| S2 | Lesson player (Vimeo) | Video loads, progress saves |
| S3 | Free enrollment | Enrolls without payment |
| S4 | Cart + checkout | Simulator or Razorpay flow completes |
| S5 | Coupon at checkout | Discount applied when valid |
| S6 | Certificate | Issued when course completion criteria met |
| S7 | Profile update | Name/details saved |
| S8 | Change password | Works with current password |

### 10.4 Admin panel

| # | Test | Expected |
|---|------|----------|
| AD1 | Dashboard | Stats, charts load |
| AD2 | Create / edit course | Saves; appears on public site if published |
| AD3 | Upload course banner | Preview updates |
| AD4 | Add modules & lessons | Structure saved |
| AD5 | Quiz admin | Questions saved on lesson |
| AD6 | Course coupon fields | Coupon linked to course |
| AD7 | Orders / payments | List loads; refund works (captured only) |
| AD8 | Landing banner upload | Preview shows; home page updates |
| AD9 | Wall of success upload | Images in admin grid + home carousel |
| AD10 | Wall of success delete | Inline confirm → image removed |
| AD11 | Student directory | List, block, manual enroll |
| AD12 | Course reviews | Approve/reject/delete |
| AD13 | Mail settings | SMTP verify (if configured) |
| AD14 | Certificate builder | Template saves |

### 10.5 Split-deploy specific

| # | Test | Expected |
|---|------|----------|
| D1 | Network tab on login | Requests go to `onrender.com`, not `vercel.app/api` |
| D2 | Image URLs | `res.cloudinary.com/...` or Render `/uploads/` with 200 |
| D3 | CORS | No CORS errors in browser console |
| D4 | Cold start | After idle, first API call may be slow but succeeds |

---

## 11. Key API endpoints (reference)

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + DB status |
| GET | `/api/courses` | Published courses |
| GET | `/api/landing-banner` | Home page banner config |
| GET | `/api/wall-of-success` | Placement carousel images |
| POST | `/api/auth/login` | Login → `{ token, user }` |
| POST | `/api/auth/register` | Student registration |
| POST | `/api/contact` | Contact form |

### Student (requires `Authorization: Bearer <token>`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/progress/:userId/:courseId` | Lesson progress |
| POST | `/api/progress/save` | Save progress |
| POST | `/api/enrollments/free` | Free course enroll |
| GET/POST | `/api/cart` | Shopping cart |
| POST | `/api/payments/...` | Checkout flow |

### Admin (requires admin JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/landing-banner` | Banner settings |
| POST | `/api/admin/landing-banner/image` | Upload banner |
| GET/POST/DELETE | `/api/admin/wall-of-success` | Wall of success CRUD |
| CRUD | `/api/admin/courses`, `/modules`, `/lessons` | Course structure |
| GET | `/api/admin/enrollments` | Enrollment list + student counts |
| CRUD | `/api/admin/coupons` | Coupons |

Full route list: search `app.get/post/put/delete` in `server.ts`.

---

## 12. Admin panel routes

| URL path | Section |
|----------|---------|
| `/admin/dashboard` | Dashboard & analytics |
| `/admin/courses-all` | All courses |
| `/admin/courses-add` | Create course wizard |
| `/admin/orders-all` | Payments & orders |
| `/admin/landing-banner` | Home page banner |
| `/admin/wall-of-success` | Placement photos |
| `/admin/students-all` | Student directory |
| `/admin/admins-all` | Administrator accounts |
| `/admin/settings` | System & payment settings |
| `/admin/courses-cert-template` | Certificate builder |

---

## 13. Data model (high level)

| Store | Contents |
|-------|----------|
| `users` / `passwords` | Accounts (bcrypt hashes) |
| `courses`, `modules`, `lessons` | Course structure |
| `enrollments` | Student ↔ course access |
| `progress` | Per-lesson completion |
| `payments` | Orders, Razorpay IDs, refunds |
| `coupons` | Discount codes (global or per-course) |
| `certificates` | Issued certificates |
| `platform_kv` | Quizzes, templates, wall of success, landing banner, wishlists, etc. |

Schema: `server/db/schema.sql`

---

## 14. Known limitations & troubleshooting

### Images broken after redeploy

**Cause:** Render disk is temporary; files in `/uploads/` are lost on redeploy.  
**Fix:** Set Cloudinary env vars on Render; re-upload images once.

### "Network server configuration anomaly" on login

**Cause:** `VITE_API_URL` not set for Vercel **Production**, or missing redeploy.  
**Fix:** Set `VITE_API_URL=https://lmf-final.onrender.com` on Vercel Production → redeploy.

### "Failed to fetch" on admin pages looping

**Cause:** Fixed in code — unstable notify callback caused re-fetch loops.  
**Fix:** Ensure latest frontend is deployed.

### Wall of success delete feels slow (INP warning)

**Cause:** Browser performance tool measuring click-to-response; was worsened by `window.confirm` + slow API.  
**Fix:** Latest code uses inline confirm + optimistic delete. Redeploy Vercel + Render.

### Render API slow first time

**Cause:** Free tier cold start.  
**Fix:** Wait 30–60s; retry. Upgrade Render plan for always-on.

### Postgres "full"?

**Unlikely** for this app size. Image URLs in Postgres are small. Large binaries should be in Cloudinary, not Postgres.

---

## 15. Security reminders for the team

- Never commit `.env` with real secrets
- Rotate `JWT_SECRET` if ever exposed
- Use strong admin passwords in production
- Keep backend secrets on **Render only**
- Keep `VITE_*` vars on **Vercel only** (they are public in the browser bundle)
- Razorpay webhook URL must point to Render: `https://lmf-final.onrender.com/api/payments/webhook`

---

## 16. Cloudinary setup (recommended)

1. Create free account at [cloudinary.com](https://cloudinary.com)
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret**
3. Add to **Render** environment:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
4. Redeploy Render
5. Re-upload banner and wall of success images in admin

Upload folders in Cloudinary:
- `skillfort-lms/landing-banner`
- `skillfort-lms/placements`
- `skillfort-lms/course-banners`

---

## 17. Document history

| Date | Notes |
|------|-------|
| 2026-06-27 | Initial team guide — split Vercel/Render deploy, Cloudinary, QA checklist |

For technical README and quick start, see [../README.md](../README.md).
