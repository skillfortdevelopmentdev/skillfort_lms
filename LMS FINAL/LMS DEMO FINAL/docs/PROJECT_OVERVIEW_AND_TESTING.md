# SkillFort LMS — Project Overview & Testing Guide

---

## Part 1: Project Overview

### 1.1 What is SkillFort LMS?

SkillFort LMS is a full learning management platform with:

- **Public website** — course catalog, contact form, landing banner, wall of success (placement photos)
- **Student portal** — enroll in courses, watch video lessons, track progress, certificates, cart & checkout
- **Admin panel** — manage courses, lessons, quizzes, orders, users, coupons, certificates, email settings, and website content

### 1.2 Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router 7 |
| Backend | Express (Node.js), TypeScript |
| Database | PostgreSQL (production) or `db.json` (local dev) |
| Authentication | JWT (Bearer token stored in browser) |
| Payments | Razorpay (live) or built-in simulator |
| Image storage | Cloudinary (production) or local disk (development) |

### 1.3 Live environment

| Service | URL | Role |
|---------|-----|------|
| Frontend | https://lmf-final.vercel.app | Website, admin UI, student UI |
| Backend API | https://lmf-final.onrender.com | API + PostgreSQL |
| Health check | https://lmf-final.onrender.com/api/health | Server & database status |

The frontend (Vercel) calls the backend (Render) using `VITE_API_URL`. Images are stored in **Cloudinary** when configured; otherwise they are saved on Render disk (temporary — lost on redeploy).

> **Note:** Render free tier may sleep after ~15 minutes idle. First request can take 30–60 seconds.

### 1.4 Architecture

```
┌─────────────────────┐         HTTPS + CORS          ┌──────────────────────┐
│  Vercel (Frontend)  │ ────────────────────────────► │  Render (Backend)    │
│  React SPA          │         JWT in header         │  Express API         │
└─────────────────────┘                               └──────────┬───────────┘
                                                                   │
                                          ┌────────────────────────┼─────────────┐
                                          ▼                        ▼             ▼
                                   PostgreSQL              Cloudinary      Local disk
                                   (all app data)          (images)        (dev only)
```

### 1.5 Main features by role

| Feature | Student | Admin |
|---------|:-------:|:-----:|
| Browse public courses | ✅ | ✅ |
| Register & login | ✅ | ✅ |
| Enroll / purchase courses | ✅ | — |
| Watch lessons & save progress | ✅ | — |
| Earn certificates | ✅ | — |
| Cart & checkout (Razorpay/simulator) | ✅ | — |
| Create & edit courses | — | ✅ |
| Manage lessons, modules, quizzes | — | ✅ |
| View orders & process refunds | — | ✅ |
| Manage coupons | — | ✅ |
| Upload landing banner | — | ✅ |
| Upload wall of success photos | — | ✅ |
| Manage students & admins | — | ✅ |
| Approve course reviews | — | ✅ |
| Certificate template builder | — | ✅ |
| Mail & payment settings | — | ✅ |

### 1.6 Test accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@skillfort.com` | `admin123` |
| Student | `student@skillfort.com` | `student123` |

> Change these passwords in production after first login.

### 1.7 Key URLs

| Page | URL |
|------|-----|
| Home | https://lmf-final.vercel.app/ |
| Login | https://lmf-final.vercel.app/login |
| Admin dashboard | https://lmf-final.vercel.app/admin/dashboard |
| Student dashboard | https://lmf-final.vercel.app/student/dashboard |
| Certificate verify | https://lmf-final.vercel.app/verify/{certificate-number} |

### 1.8 Project folder structure (summary)

```
src/                  → React frontend (components, pages, API client)
server.ts             → Express server & all API routes
server/               → Auth, database, payments, uploads, mail
db.json               → Seed data (imported into Postgres on first run)
docs/                 → Documentation
```

---

## Part 2: Testing Guide

### 2.1 How to run tests (developers / QA with code access)

#### Prerequisites

```bash
npm install
cp .env.example .env    # optional for local API tests
```

#### Commands

| Command | What it does |
|---------|--------------|
| `npm test` | Run all automated Jest tests |
| `npm run lint` | TypeScript type check (no tests, catches code errors) |
| `npm run dev` | Start local app at http://localhost:3000 |
| `npm run smoke:prod` | Test live deployed API (see below) |

#### Run automated tests

```bash
npm test
```

Expected: all test suites pass.

#### Run smoke tests against live server

```bash
SMOKE_BASE_URL=https://lmf-final.onrender.com \
SMOKE_ADMIN_EMAIL=admin@skillfort.com \
SMOKE_ADMIN_PASSWORD=admin123 \
npm run smoke:prod
```

Smoke tests verify: health endpoint, courses API, settings, admin login, and unauthorized access blocking.

---

### 2.2 Automated test coverage

| Test file | What is tested |
|-----------|----------------|
| `server/__tests__/wallOfSuccess.test.ts` | Add & remove wall of success entries |
| `server/__tests__/landingBanner.test.ts` | Landing banner save & load |
| `server/__tests__/courseBanner.test.ts` | Course banner image upload |
| `server/__tests__/courseReviews.test.ts` | Student reviews & admin moderation |
| `server/__tests__/passwordReset.test.ts` | Forgot / reset password |
| `server/__tests__/refund.test.ts` | Payment refunds |
| `server/__tests__/sessions.test.ts` | Single student session enforcement |
| `server/__tests__/platformKvAccess.test.ts` | Platform data access rules |
| `server/__tests__/startupValidation.test.ts` | Production environment validation |
| `server/__tests__/emailLookup.test.ts` | Email lookup helpers |
| `src/__tests__/criticalPaths.test.tsx` | Student portal UI flows |
| `src/__tests__/courseValidity.test.ts` | Course access expiry logic |

---

### 2.3 Manual QA test plan

Use this checklist before each release. Test on **live**: https://lmf-final.vercel.app

**Tester:** _______________  
**Date:** _______________  
**Build / deploy:** _______________

Mark each item: **Pass / Fail / N/A**

---

#### A. Authentication

| ID | Test steps | Expected result | Pass/Fail |
|----|------------|-----------------|-----------|
| A1 | Go to `/login`, enter admin email & password, submit | Redirect to admin dashboard | |
| A2 | Logout, login as student | Redirect to student dashboard | |
| A3 | Login with wrong password | Error shown, stay on login page | |
| A4 | Click logout | Returned to login, cannot access portal without re-login | |
| A5 | Student: use Forgot password | Reset flow starts (email or dev link) | |

---

#### B. Public website

| ID | Test steps | Expected result | Pass/Fail |
|----|------------|-----------------|-----------|
| B1 | Open home page `/` | Page loads; banner & courses visible | |
| B2 | Browse course catalog | Published courses listed with images & prices | |
| B3 | Open a course detail page | Title, description, price, enroll/cart buttons show | |
| B4 | Submit contact form with valid data | Success message or confirmation | |
| B5 | Open `/verify/{valid-cert-number}` | Certificate details shown | |
| B6 | Open `/verify/invalid-id` | "Not found" or error message | |

---

#### C. Student portal

| ID | Test steps | Expected result | Pass/Fail |
|----|------------|-----------------|-----------|
| C1 | Login as student → My courses | Enrolled courses listed | |
| C2 | Open a course → play a video lesson | Vimeo player loads | |
| C3 | Complete or partially watch a lesson | Progress saved (refresh page — progress retained) | |
| C4 | Enroll in a free course | Enrollment succeeds | |
| C5 | Add paid course to cart → checkout | Checkout modal opens; payment completes (simulator or Razorpay) | |
| C6 | Apply valid coupon at checkout | Discount applied to total | |
| C7 | Apply invalid coupon | Error message shown | |
| C8 | Complete course requirements | Certificate available | |
| C9 | Update profile (name/details) | Changes saved | |
| C10 | Change password | New password works on next login | |

---

#### D. Admin panel

| ID | Test steps | Expected result | Pass/Fail |
|----|------------|-----------------|-----------|
| D1 | Login as admin → Dashboard | Stats & charts load without errors | |
| D2 | Courses → view all courses | Course list with student counts | |
| D3 | Create new course (title, price, banner) | Course saved and appears in list | |
| D4 | Edit course → publish | Course visible on public site | |
| D5 | Add module & lesson to course | Structure saved | |
| D6 | Add quiz questions to a lesson | Questions saved | |
| D7 | Set coupon on course (wizard) | Coupon linked to course | |
| D8 | Orders → view payments | Payment list loads | |
| D9 | Refund a captured payment | Refund succeeds; status updated | |
| D10 | Website → Landing banner → upload image | Preview shows uploaded image | |
| D11 | Save banner link target (e.g. courses) | Settings saved | |
| D12 | Website → Wall of success → upload images | Images appear in admin grid | |
| D13 | Delete a wall of success image (Yes, remove) | Image removed from grid | |
| D14 | Home page shows new banner & wall of success | Public site reflects uploads | |
| D15 | Students → view student list | Students listed | |
| D16 | Course reviews → approve a review | Review published on course page | |
| D17 | Certificate builder → save template | Template saved | |
| D18 | Settings → update site name / payment mode | Settings saved | |

---

#### E. Live deployment checks (Vercel + Render)

| ID | Test steps | Expected result | Pass/Fail |
|----|------------|-----------------|-----------|
| E1 | Open browser DevTools → Network → login | API calls go to `lmf-final.onrender.com` | |
| E2 | Open an uploaded image URL | Image loads (not HTML error page) | |
| E3 | No CORS errors in browser console during normal use | Console clean | |
| E4 | Open `/api/health` on Render URL | `{"ok":true,"database":"postgres",...}` | |

---

### 2.4 Bug report template

When reporting a failed test, include:

```
Test ID: (e.g. D10)
Environment: Live / Local
Browser: Chrome / Safari / Firefox
Steps to reproduce:
1.
2.
3.
Expected:
Actual:
Screenshot or console error (if any):
```

---

### 2.5 Release sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA tested | | | |
| Dev reviewed | | | |
| Approved for release | | | |

---

*Document version: 2026-06-27*
