## [v2.4.2] — 2026-03-24 · Sprint 56 — Security hardening (T10/T11/T12)

### T10 — MFA enforcement (admin routes)
- `src/lib/mfa.ts` — new Supabase AAL2 session check helper with graceful
  degradation. `requireMFA(supabase)` returns 403 if user has TOTP enrolled
  but session is only AAL1; `getMFAStatus()` for settings UI.
- `/api/admin/run-migration` — `requireMFA()` applied after owner email check.
  If MFA enrolled but not verified: 403 with redirect to /platform/settings?tab=security.
- `/api/admin/migrate` — `requireMFA` import added.

### T11 — Rate limiting (API routes)
- `/api/ai/chat` — rate limit: 20 req/min per IP (`LIMITS.ai`)
- `/api/brief` — rate limit: 10 req/hr per IP (brief generation is expensive)
- `/api/admin/run-migration` — rate limit: 30 req/min per IP (`LIMITS.admin`)
- All use existing `checkRateLimit` + `LIMITS` from `src/lib/redis-rate-limit.ts`
  (Upstash Redis when configured, in-memory fallback when not)

### T12 — GitHub Actions security scanning + Dependabot
- `.github/workflows/security.yml` — daily 07:00 UTC:
  - npm audit (fail on high/critical)
  - CodeQL JavaScript analysis (security-and-quality queries)
  - TruffleHog secret detection (verified secrets only)
- `.github/dependabot.yml` — daily npm updates (major/minor) + weekly Actions updates

### SRAF remediation refs
- SRAF B-01 (MFA/IAM) — T10 closes PIOS gap
- SRAF B-03 (API rate limiting) — T11 closes PIOS gap  
- SRAF B-04 (vulnerability management) — T12 closes PIOS gap

package.json: 2.4.1 -> 2.4.2

---

## [v2.4.1] — 2026-03-24 · Sprint 55 — M013 migration collision fix

### Bug fix: M012 filename collision resolved
- **Root cause:** Two migration files shared the number `012`:
  `012_learning_hub_v2.sql` (CPD bodies + journal tracking) and
  `012_trial_and_plan_status.sql` (tenants plan_status + seats_limit).
  The `run-migration` route mapped `'012'` → trial SQL, so the
  learning hub migration was never reachable from the admin UI.

### Changes
- **`013_learning_hub_v2.sql`** — New canonical migration file. Renamed
  from `012_learning_hub_v2.sql`. Creates:
  - `cpd_bodies` reference table (12 UK CPD bodies seeded: CIMA, ICAEW,
    ICE, RICS, CIPD, NMC, SRA, ACCA, BCS, CIOB, RIBA, CMI)
  - `learning_journal_entries` table (RLS, user isolation)
  - Patches `learning_journeys` with `journal_entries`, `supervisor_approved`,
    `supervisor_approved_at`, `target_completion_date` columns
- **`/api/admin/run-migration`** — M013 entry added to MIGRATIONS object
  with full idempotent SQL (all `IF NOT EXISTS` guarded)
- **`/platform/admin`** — `MIGRATION_DETAILS` updated:
  - `'012'` now correctly references `012_trial_and_plan_status.sql`
  - `'013'` added referencing `013_learning_hub_v2.sql`
- **`runMigration()` routing fix** — Admin page now correctly routes:
  - IDs `001`–`007` → `/api/admin/migrate` (file-based runner)
  - IDs `008`–`013` → `/api/admin/run-migration` (inline SQL via pg)
  Previously **all** IDs were sent to `/api/admin/migrate` which only
  knew 001–007 — meaning 008–012 silently failed or hit wrong SQL.
- **`runAll()` fix** — Now calls both endpoints in sequence (legacy then
  extended), returning combined results.
- `/api/learning-journey` journal writes (`_pending: 'M012'`) will
  resolve once M013 is run from `/platform/admin`.

### Action required
Run **M013** from `/platform/admin` → click Run next to migration 013.
This creates `cpd_bodies` and `learning_journal_entries` and patches
`learning_journeys` with the v2 fields.

---

## [v2.3.0] — 2026-03-24 · Study Timer / Pomodoro

### Study Timer
- `/platform/study` (305L): Full Pomodoro timer
  - Focus (25min), Short Break (5min), Long Break (15min)
  - SVG circular progress with colour per mode
  - Browser Notification API alerts on session complete
  - Session history stored in localStorage (50 sessions)
  - Completed focus sessions auto-logged to CPD via /api/learning-journey
  - Configurable durations (1–90 min) with settings panel
  - Today's count, total focus minutes, streak stats
- Sidebar: Study Timer link added

---

## [v2.2.4] — 2026-03-24 · Notifications Page + Sidebar

### New
- `/platform/notifications`: notification centre (143 lines)
  Unread badge, mark-all-read, type icons, time-ago, action links
- Sidebar: notifications link with live unread count badge

---

## [v2.2.3] — 2026-03-24 · TypeScript Cleanup

### TypeScript — PI param-any: 15→11
- microsoft callback: tokenData, profileData typed
- literature/gap-analysis: paper typed
- stripe webhook: event typed

---

## [v2.2.2] — 2026-03-24 · Learning Journal + Documents + Intelligence

### New Pages
- `/platform/learning/journal`: AI-assisted reflective journal with mood, tags, AI reflection
- `/platform/documents`: Document Intelligence Hub — AI analysis, tag extraction
- `/platform/intelligence`: FM & Research Intelligence Feed

### Learning Hub
- `/api/learning-journey`: view=journal, action=journal_entry, action=ai_reflect
- M012 updated: `learning_journal_entries` table
- Learning page: journal tab + quick-link

### TypeScript — PI now at ZERO
- All 26 suppressions removed across 30+ files

---

## [v2.2.1] — 2026-03-23 · Documents + Intelligence + TypeScript

### New Pages
- /platform/documents: Document Intelligence Hub — AI analysis, tag extraction, summaries
- /platform/intelligence: FM & Research Intelligence Feed — categorised, filterable

### Navigation
- Sidebar: Documents (📄) and Intelligence (📡) added

### TypeScript
- 13+ as any removed, catch blocks typed
- Domain: pios.sustain-intl.com, info@sustain-intl.com throughout

---

# PIOS Changelog

## v2.0.0 — 2026-Q1 (Expenses inline edit + Admin env checklist)

### New Features
- **Expenses inline edit** (`src/app/platform/expenses/page.tsx` +40L) [commit 8f3bebf] — Click any expense description to edit in-place. Enter saves; Escape cancels. PATCH to Supabase with optimistic local update. Edit mode shows ✓ save + ✕ cancel; view mode shows ✎ edit + ✕ delete. Previously expenses could only be deleted and re-added to fix errors.

- **Admin env checklist — two new vars** (`src/app/platform/admin/page.tsx`) [commit 8f3bebf] — `SUPABASE_IS_SERVICE_KEY` (optional, IS live data in Command Centre) and `CRON_SECRET` (required, Bearer auth for `/api/cron/brief`) added to the Vercel env vars checklist. Without `CRON_SECRET` the morning brief cron fires but returns 401 and generates nothing.

---

## v1.9.0 — 2026-Q1 (Morning Brief Cron + vercel.json)

### New Features
- **Morning Brief Cron** (`src/app/api/cron/brief/route.ts` — 116L) [commit 674b577] — `GET /api/cron/brief` runs daily at 06:00 UTC (08:00 Dubai / 07:00 London). Fetches all `user_profiles` (cap 50), skips users who already have today's brief, generates brief via Claude for remaining users using the same prompt as `POST /api/brief`, upserts to `daily_briefs` with `generated_by='cron'`. Requires `CRON_SECRET` env var (Bearer auth). Returns `{ok, date, skipped, generated, errors, results}`. Users who forget to trigger their brief manually now receive it automatically before their workday starts.

- **`vercel.json`** [commit 674b577] — Vercel cron schedule `0 6 * * *` wired to `/api/cron/brief`. Function timeouts: `brief` 60s, `cron/brief` 300s (multi-user batch), `ai/**` 60s, `research/**` 60s, `live/**` 30s.

### Platform Scale
- **21 pages · 35 routes** (+1: /api/cron/brief)

---

## v1.8.0 — 2026-Q1 (Zero Blocking Dialogs)

### Fixes
- **confirm() → inline two-step guards** [commit 5c58c69] — Eliminates all synchronous blocking browser dialogs. `command/page.tsx`: `handleDeleteFeed` now requires two clicks using `deleteFeedConfirm` state (arm → execute pattern, no modal needed). `files/page.tsx`: `deleteRule` gated by same two-step pattern with `deleteRuleConfirm` state. `research/page.tsx`: watchlist/library remove actions use explicit `window.confirm()` where inline state restructuring would be disproportionate. PIOS now has zero unintentional native `alert()` / `confirm()` blocking calls.

---

## v1.7.0 — 2026-Q1 (Stripe Billing Portal)

### New Features
- **Stripe Customer Portal** (`src/app/api/stripe/portal/route.ts` — 52L) [commit 9792e7a] — `GET /api/stripe/portal` creates a Stripe Customer Portal session and redirects the authenticated user to Stripe's hosted billing management page. Handles: no Stripe customer (redirect with `billing=not_subscribed`), Stripe API errors (redirect with `billing=error`). Return URL: `/platform/settings?billing=returned`.

- **Settings page billing management** (`src/app/platform/settings/page.tsx`) [commit 9792e7a] — Added 'Manage subscription →' button, shown only when `tenant.stripe_customer_id` exists (active subscriber). Subtitle: "Update payment method · Cancel · View invoices". Added `billing` URL param handler in `useEffect`: `?billing=returned` → green banner; `?billing=error` → red banner; `?billing=not_subscribed` → red banner. URL param cleaned after reading via `window.history.replaceState`. Previously: no mechanism for paid subscribers to cancel, update payment, or view invoices.

### Platform Scale
- **21 pages** (+1: implicitly through settings enhancement) · **33 routes** (+1: /api/stripe/portal)

---

## v1.6.0 — 2026-Q1 (Google Auth + UX Fixes)

### Fixes
- **Google reconnect always shown** (`src/app/platform/settings/page.tsx`) [commit b08d054] — Previously the 'Connect Google Account' button only appeared when `profile.google_email` was null (not connected). Problem: users who had connected Google before `gmail.modify` scope was added to the OAuth flow could not grant the new scope without reconnecting — the button was hidden. Now: button is always visible, label changes based on state: Connected → `'↻ Reconnect Google (refresh scopes)'` / Not connected → `'Connect Google Account'`. Both use `prompt: 'consent' + access_type: 'offline'` to force full scope re-grant and new refresh token issuance. Required for Gmail API send + Calendar sync to work for existing users.

- **alert() → inline banner notifications** [commit e81456b] — Replaced all `alert()` dialogs with non-blocking inline banner notifications. `alert()` is synchronous, browser-blocking, and fails for users with popup blockers. All PIOS notifications now use the inline banner pattern already established in the dashboard.

---

## v1.5.0 — 2026-Q1 (Citation Guard Sprint)

### New Features
- **Citation Guard Library** (`src/lib/citation-guard.ts` — 260L) [commit f010c09] — Shared verification library for all PIOS AI academic outputs. 6-step pipeline:
  - **Step 1:** CrossRef DOI existence check (REST API, 6s timeout)
  - **Step 2:** Wayback Machine snapshot availability check
  - **Step 3:** Fuzzy title/author metadata matching vs CrossRef record
  - **Step 4:** Confidence scoring 0–100: +40 DOI exists, +30 title exact/+15 close/-20 mismatch, +15 author confirmed/+5 partial/-15 mismatch, +10 year match, +10 Wayback available, capped at 20 if no DOI/URL
  - **Step 5:** HITL gate — flags when confidence <40 or metadata mismatch
  - **Step 6:** `ProvenanceLabel`: `AI_VERIFIED` | `AI_UNVERIFIED` | `FABRICATED_RISK`
  - `verifyCitations(citations[])` → `GuardReport` with summary counts
  - `provenanceBadge(label)` → text/colour/bg for UI rendering

- **Research Verify Route** (`/api/research/verify` — new) [commit f010c09] — `POST /api/research/verify` — batch citation verification endpoint. Max 30 citations per request. Returns full `GuardReport`.

- **Research Search Prompt Upgrade** (`/api/research/search`) [commit f010c09] — System prompt upgraded: Claude now instructed NOT to fabricate DOIs, NOT to invent page/volume/issue numbers, use null when uncertain, set confidence 0–100 per result, flag `ai_generated: true` on all. After parsing: runs citation guard on DOI-bearing results, stamps `provenance_label`, `doi_verified`, `requires_hitl` onto each result. `guardSummary` returned alongside results.

- **Literature APA Citation Guard** (`/api/literature`) [commit f010c09] — After generating APA citation: runs guard on the item's own DOI/URL. If CrossRef title mismatch: appends warning to `citation_apa` string. If `requires_hitl`: appends `[NEEDS MANUAL VERIFICATION]` to citation.

- **Citation Guard UI** (`/platform/research` — +60L) [commit bc4cef0] — Provenance badges visible in Research Search and Literature Library:
  - Search results: Guard banner above results showing verified/needs_review/fabricated_risk counts. Per-result badge (top-right): ✓ Verified (green) | ⚠ Unverified (amber) | ✗ Check manually (red)
  - Literature Library: Guard badge shown above APA citation box after generation. CrossRef mismatch warning + HITL reason shown inline if flagged.

### Platform Scale
- 20 pages · **33 routes** (+1: /api/research/verify)

---

## v1.4.0 — 2026-Q1

### New Features
- **Real Gmail Send** (`/api/email/send`) [commit e9a9f3c] — POST endpoint (152L) sends emails via Gmail API using the authenticated user's OAuth token. Retrieves and auto-refreshes Google access token from `user_profiles`. Builds RFC 2822 message (base64url encoded per Gmail API spec). Calls Gmail API `messages/send`. Handles `threadId` for replies within existing threads. Marks source `email_item` as 'actioned' after send. Returns specific error codes: `GOOGLE_NOT_CONNECTED`, `INSUFFICIENT_SCOPE`. Works with existing `gmail.modify` scope already requested in OAuth flow.
- **Privacy Policy page** (`/privacy`) [commit a298d35] — Standalone Privacy Policy page accessible without authentication.
- **Terms of Service page** (`/terms`) [commit a298d35] — Standalone Terms of Service page accessible without authentication.
- **Middleware public paths expanded** [commit a298d35, c7b7e75] — `/privacy`, `/terms`, `/auth/login`, `/auth/signup`, `/auth/verify` added to public bypass list. `next.config` build settings corrected for production compatibility.

### Platform Scale
- 20 pages (+2: /privacy, /terms) · 31 routes (+1: /api/email/send)

---

## v1.3.0 — 2026-Q1

### New Features
- **Admin Migration Runner** (`/platform/admin`) — owner-only admin panel for running all 7 PIOS database migrations:
  - Status check: polls `/api/admin/migrate` to show which sentinel tables exist (applied/not-applied per migration)
  - Per-migration controls: ▶ Run · ⎘ Copy SQL · Open SQL Editor buttons
  - Expandable detail per migration: tables created, file name, result feedback
  - Run all: executes all pending migrations in sequence
  - Supabase dashboard quick links: SQL Editor, Table Editor, Auth, Storage, RLS, API
  - Vercel environment variables checklist (required vs optional)
  - Access restricted to owner `info@sustain-intl.com`
- **Admin Migrate API** (`/api/admin/migrate` — GET + POST, 213L) — GET checks sentinel tables; POST runs specified migration SQL, returns SQL text if manual execution needed
- **Admin Migrate SQL API** (`/api/admin/migrate/sql` — 37L) — serves raw migration SQL for copy/paste into Supabase SQL Editor
- **Signup/Onboarding flow** (`/auth/signup`, 195L) — new user registration with email/password, organisation name, role selection; email verification redirect
- **Email verify page** (`/auth/verify`, 30L) — post-signup verification confirmation page
- **Sidebar update** — Admin link added (⚙, red, position after AI Companion)

### Platform Scale
- 18 pages (+3: admin, signup, verify) · 30 routes (+2: admin/migrate, admin/migrate/sql)

---

## v1.2.0 — 2026-Q1

### Bug Fixes
- **Build fix** (`payroll/detect/route.ts`, `brief/route.ts`) — Vercel build failures caused by `try {}` injected inside `Promise.all([...])` arrays from a bad merge. Both files restored to valid TypeScript. [commit 07b8e8c]

### New Features
- **Literature Library** (`/platform/research`) — My Library tab: GET/POST `/api/literature` route (168L). Lists items with filters (read_status, source_type, tag, text search) + stats. Supports update (read_status, relevance, notes, themes), delete, and AI summary generation (3-4 sentence summary + APA citation + DBA relevance framing + theme extraction). Interactive star rating and notes textarea. Tabs: search · journals · cfp · **library** · import.

---

## v1.1.0 — 2026-Q1 (March 2026)

### New Features
- **AI Companion full rebuild** — persistent sessions with sidebar listing last 30 conversations; session titles auto-generated by Claude after first exchange; domain modes (Academic / FM / SaaS / Personal); keyboard shortcuts
- **Dashboard alert panel** — three live alert tiles above the morning brief: pending invoices (links to File Intel), emails needing action (links to Inbox), transfers queued for approval (links to Payroll); tiles only appear when count > 0
- **Calendar API** (`/api/calendar`) — GET/POST handlers with full try/catch coverage; feeds into dashboard today-agenda
- **Payroll & Finance Workflows** — migration 007 (6 tables: staff_members, payroll_runs, payroll_lines, expense_claims, transfer_queue, payroll_chase_log); 4 routes: /api/payroll, /api/payroll/detect, /api/payroll/chase, /api/payroll/remit; full HITL gate — no transfer executes without explicit approval; 645L platform page
- **File Intelligence** — migration 006 (5 tables: file_spaces, file_items, invoices, filing_rules, drive_scans); 3 routes: /api/files, /api/files/scan, /api/files/invoice; Google Drive scan pipeline with AI classification (Claude claude-sonnet-4-6, batches of 20); 22 pre-seeded folder structure; invoice extraction with HITL approval gate; 489L platform page
- **AI sessions persistence** — `/api/ai/sessions` route; chat history stored across sessions
- **Research infrastructure** (migrations 004-005) — journal watchlist, CFP tracker, FM news feeds, academic DB searches, user feed configuration

### Bug Fixes
- **Health endpoint** — changed liveness check from `tenants` to `user_profiles` (correct primary user table for personal productivity platform)
- **Try/catch coverage** — 9 routes wrapped after deep per-function brace-depth audit: brief, ai/chat, files/invoice, payroll/detect, payroll/chase, payroll/remit, research/fm-news, research/search, tasks

### Platform Scale
- 15 pages · 27 API routes · 7 migrations

---

## v1.0.0 — 2026-Q1 (initial release)

### Platform
- 11 pages, 18 API routes
- Supabase Auth (magic link / OTP), RLS enabled
- AI Daily Brief — synthesised from tasks, projects, thesis, FM news, CFPs
- Command Centre (Live Data) — configurable intelligence feeds
- Academic workbench — module tracker, thesis chapters, supervision sessions
- Task & project management — cross-domain (academic, FM, SaaS, personal)
- Google Calendar & Gmail integration (token refresh via migration 003)
- Stripe billing — Student / Individual / Professional tiers

### Security
- Security headers middleware (CSP, HSTS, X-Frame-Options, nosniff)
- Rate limiting: 100 req/15min per IP
- Supabase RLS — all tables row-level secured to auth.uid()
- Next.js 14.2.35 (CVE-2024-46982 patched)

### Migrations
- 001: Initial schema (19 tables)
- 002: Dedup and seed data
- 003: Google token refresh function

---

*PIOS v1.0–1.1 | VeritasIQ Technologies Ltd*
