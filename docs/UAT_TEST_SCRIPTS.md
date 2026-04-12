# PIOS v3.0 — UAT Test Scripts

**VeritasIQ Technologies Ltd**
**Date:** 2026-03-30
**Prepared for:** User Acceptance Testing (pre-production)

---

## Prerequisites

- PIOS running at `https://pios.veritasiq.io` (or `localhost:3000`)
- Test user account with valid Supabase credentials
- Stripe test mode enabled
- Gmail OAuth connected (for email tests)
- NemoClaw™ calibration completed (CV uploaded)

---

## 1. Authentication

### 1.1 Email/Password Login
- [ ] Navigate to `/auth/login`
- [ ] Enter valid email + password
- [ ] Verify redirect to `/platform/dashboard`
- [ ] Verify session persists on page refresh

### 1.2 Magic Link Login
- [ ] Navigate to `/auth/login`
- [ ] Enter email, click "Send magic link"
- [ ] Check inbox for magic link email
- [ ] Click link → verify redirect to dashboard

### 1.3 Google OAuth Login
- [ ] Click "Sign in with Google" on login page
- [ ] Complete Google OAuth flow
- [ ] Verify redirect to dashboard with correct profile

### 1.4 Logout
- [ ] Click user avatar → "Sign out"
- [ ] Verify redirect to login page
- [ ] Verify `/platform/dashboard` redirects to login

### 1.5 Unauthenticated Access
- [ ] In incognito, navigate to `/platform/dashboard`
- [ ] Verify redirect to `/auth/login?next=%2Fplatform%2Fdashboard`
- [ ] After login, verify redirect back to dashboard

---

## 2. Onboarding

### 2.1 New User Flow
- [ ] Sign up with new email
- [ ] Verify redirect to `/onboarding`
- [ ] Complete all 7 onboarding steps
- [ ] Upload CV (PDF, DOCX, or TXT)
- [ ] Verify NemoClaw™ calibration summary appears
- [ ] Verify autofill of profile fields (name, org, job title)
- [ ] Complete onboarding → verify redirect to dashboard

### 2.2 Onboarding Gate
- [ ] User with `onboarded = false` visiting `/platform/*`
- [ ] Verify redirect to `/onboarding`
- [ ] `/platform/demo` should NOT redirect (exempt)

---

## 3. Dashboard

### 3.1 Dashboard Load
- [ ] Navigate to `/platform/dashboard`
- [ ] Verify all widgets load without errors
- [ ] Verify task count, OKR progress, and notification count displayed

### 3.2 Morning Brief
- [ ] Click "Generate brief" button
- [ ] Verify AI brief generates (3 paragraphs, ~220 words)
- [ ] Refresh page → verify cached brief loads instantly
- [ ] Verify AI credit counter incremented

### 3.3 Global Search (Cmd+K)
- [ ] Press Cmd+K (or Ctrl+K)
- [ ] Search for a known task title → verify result appears
- [ ] Click result → verify navigation to correct page

---

## 4. Tasks

### 4.1 Task CRUD
- [ ] Navigate to `/platform/tasks`
- [ ] Create new task: title, priority (high), domain (business), due date
- [ ] Verify task appears in list
- [ ] Edit task: change priority to medium
- [ ] Mark task as done → verify it moves to completed section
- [ ] Delete task → verify removal

### 4.2 AI Prioritisation
- [ ] With 5+ open tasks, click "AI Prioritise"
- [ ] Verify tasks reorder by AI-suggested priority
- [ ] Verify AI credit deducted

---

## 5. AI Chat

### 5.1 AI Companion
- [ ] Open AI chat panel (sidebar or `/platform/ai`)
- [ ] Send: "What are my priorities today?"
- [ ] Verify response references actual PIOS data (tasks, OKRs)
- [ ] Verify response is concise and action-oriented
- [ ] Send follow-up → verify conversational context maintained

### 5.2 Session Management
- [ ] Create new chat session
- [ ] Send multiple messages
- [ ] Navigate away and return → verify session persists
- [ ] Verify session auto-titled

### 5.3 AI Training
- [ ] Navigate to `/platform/ai/train`
- [ ] Configure tone preference
- [ ] Test persona → verify response matches configured style

---

## 6. NemoClaw™ PA

### 6.1 Floating PA
- [ ] Click NemoClaw™ FAB (bottom-right)
- [ ] Ask: "What's overdue?"
- [ ] Verify response lists actual overdue tasks
- [ ] Ask: "Draft an email to [stakeholder name]"
- [ ] Verify action proposal with confirmation

### 6.2 Day Plan
- [ ] Ask PA to generate a day plan
- [ ] Verify time blocks, deferred tasks, capacity gap returned

---

## 7. Email

### 7.1 Gmail Sync
- [ ] Navigate to `/platform/email`
- [ ] Click "Sync" → verify emails load from connected Gmail
- [ ] Verify sender, subject, preview displayed correctly

### 7.2 Email Triage
- [ ] Select untriaged emails
- [ ] Click "Triage" → verify classification (urgent/opportunity/fyi/junk)
- [ ] Verify urgent emails create tasks automatically
- [ ] Verify opportunity emails create decisions

### 7.3 AI Draft
- [ ] For a triaged email, verify AI draft appears
- [ ] Verify draft is from correct inbox address (multi-inbox)
- [ ] Edit draft → send → verify sent via Gmail API

### 7.4 Compose
- [ ] Click "Compose" in email view
- [ ] Enter recipient, subject, body
- [ ] Send → verify appears in Gmail sent folder

---

## 8. Calendar

### 8.1 Calendar View
- [ ] Navigate to `/platform/calendar`
- [ ] Verify month view renders with events
- [ ] Click event → verify detail panel

---

## 9. Academic

### 9.1 Module Tracking
- [ ] Navigate to `/platform/academic`
- [ ] Add new module (title, credits, status)
- [ ] Add thesis chapter (number, title, word count, target)
- [ ] Update word count → verify progress bar updates

### 9.2 Academic Writer
- [ ] Navigate to `/platform/academic/writer`
- [ ] Select chapter → enter section heading + key points
- [ ] Click "Draft" → verify AI generates academic prose
- [ ] Verify word count and citation references

### 9.3 Thesis Export
- [ ] Click "Export" → verify Markdown download

---

## 10. Executive Module

### 10.1 OKRs
- [ ] Navigate to `/platform/executive`
- [ ] Create OKR: objective + 3 key results
- [ ] Update progress on key results
- [ ] Verify overall objective progress recalculates

### 10.2 Decisions
- [ ] Create a new decision (title, context)
- [ ] Verify it appears in open decisions
- [ ] Resolve decision → verify status change

### 10.3 Board Pack
- [ ] Navigate to `/platform/board-pack`
- [ ] Generate board pack → verify comprehensive output

### 10.4 Chief of Staff Review
- [ ] Navigate to `/platform/chief-of-staff`
- [ ] Generate weekly review → verify structured output (summary, risks, priorities)

---

## 11. Coaching

### 11.1 Coaching Session
- [ ] Navigate to `/platform/coaching`
- [ ] Start "Daily Reflection" session
- [ ] Answer 3 coaching questions
- [ ] Verify session ends with synthesis
- [ ] Verify insights and themes extracted

### 11.2 Session History
- [ ] Verify past sessions listed with titles and themes
- [ ] Click past session → verify conversation history

---

## 12. Knowledge & Stakeholders

### 12.1 Knowledge Base
- [ ] Navigate to `/platform/knowledge`
- [ ] Add entry: title, source, content
- [ ] Search entries → verify results
- [ ] Delete entry → verify removal

### 12.2 Stakeholder Map
- [ ] Navigate to `/platform/stakeholders`
- [ ] Add stakeholder: name, org, role, influence level
- [ ] Verify stakeholder appears in list
- [ ] Set contact cadence → verify overdue contact alerts

---

## 13. Content (Blood Oath Chronicles)

### 13.1 Episodes
- [ ] Navigate to `/platform/content` (via dashboard Content section)
- [ ] Create new episode: title, manuscript text
- [ ] Save → verify persistence

### 13.2 Review Agent
- [ ] Select episodes for review
- [ ] Run "Single Review" → verify quality scoring
- [ ] Run "Consistency Audit" → verify continuity findings

---

## 14. Workbench API smoke validation

### 14.1 Unauthenticated smoke suite
- [ ] Start app (`npm run dev`)
- [ ] Run `npm run api:test`
- [ ] Verify output shows 401 for protected workbench routes

### 14.2 Authenticated smoke suite (cookie string)
- [ ] Export auth cookie string to `WORKBENCH_AUTH_COOKIE`
- [ ] Run `npm run api:test`
- [ ] Verify flow passes: create project → read project → run step 1 → archive project

### 14.3 Authenticated smoke suite (cookie file)
- [ ] Save cookie string to a local file (example: `.secrets/workbench-cookie.txt`)
- [ ] Set `WORKBENCH_AUTH_COOKIE_FILE=.secrets/workbench-cookie.txt`
- [ ] Run `npm run api:test`
- [ ] Verify authenticated suite passes

### 14.4 Hosted target validation
- [ ] Set `BASE_URL=https://pios.veritasiq.io`
- [ ] Run `npm run api:test`
- [ ] Verify expected route protection behavior on hosted environment
- [ ] If network restrictions block preflight, set `WORKBENCH_SKIP_PREFLIGHT=1`

---

## 14. Billing

### 14.1 Plan Display
- [ ] Navigate to `/platform/billing`
- [ ] Verify current plan displayed correctly
- [ ] Verify AI credit usage meter shown

### 14.2 Upgrade Flow
- [ ] Click "Upgrade" → verify redirect to Stripe Checkout
- [ ] Complete payment (test card: `4242 4242 4242 4242`)
- [ ] Verify plan updated in PIOS
- [ ] Verify AI credit limit increased

### 14.3 Stripe Portal
- [ ] Click "Manage subscription" → verify Stripe portal opens
- [ ] Verify invoice history accessible

### 14.4 Trial Expiry
- [ ] User on expired trial → verify `/platform/trial-expired` gate
- [ ] Verify upgrade CTA displayed

---

## 15. Wellness

### 15.1 Daily Check-in
- [ ] Navigate to `/platform/wellness`
- [ ] Complete check-in: mood, energy, stress scores + notes
- [ ] Verify AI insight generated
- [ ] Verify streak counter incremented

### 15.2 Streak Persistence
- [ ] Check in on consecutive days → verify streak counts up
- [ ] Skip a day → verify streak resets to 1

---

## 16. Settings

### 16.1 Profile Settings
- [ ] Navigate to `/platform/settings`
- [ ] Update display name → verify persistence
- [ ] Update intelligence settings → verify feed changes

---

## 17. Security & Edge Cases

### 17.1 CSRF Protection
- [ ] Attempt POST to `/api/tasks` with mismatched Origin header
- [ ] Verify 403 response

### 17.2 Rate Limiting
- [ ] Send 100+ requests in 15 minutes from same IP
- [ ] Verify 429 response after limit

### 17.3 AI Credit Limit
- [ ] Exhaust AI credits → verify 429 on next AI call
- [ ] Verify user-friendly message displayed

### 17.4 GDPR Export
- [ ] Navigate to Settings → request data export
- [ ] Verify JSON export contains user data

### 17.5 404 Page
- [ ] Navigate to `/nonexistent-page`
- [ ] Verify custom 404 page renders

---

## 18. Admin

### 18.1 Health Dashboard
- [ ] Navigate to `/platform/admin` (admin user)
- [ ] Verify system health panel shows DB, env vars, table status
- [ ] Run migration check → verify pending migrations listed

### 18.2 Demo Seed
- [ ] Click "Seed demo data" → verify data populated
- [ ] Verify idempotent (running twice doesn't duplicate)

---

## Sign-off

| Tester | Date | Result | Notes |
|--------|------|--------|-------|
| | | PASS / FAIL | |
| | | PASS / FAIL | |

---

*PIOS v3.0 UAT Scripts · VeritasIQ Technologies Ltd*
