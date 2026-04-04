# PIOS / InvestiScript - Critical Architecture Review

**Date:** 4 April 2026
**Reviewer:** Claude (Architecture Audit)
**Scope:** Architecture, Security, IP Protection, Rebuild Strategy

---

## EXECUTIVE SUMMARY

PIOS is a multi-tenant SaaS personal intelligence OS built with **Next.js 14, TypeScript, Supabase (PostgreSQL), and Claude AI**. It targets executives, academics, and consultants with proprietary AI-powered features including HDCA, NemoClaw, VE-CAFX, and InvestiScript.

**Overall Assessment: 5.0/10** - Solid MVP with strong security foundations but significant architectural debt that will break at scale. The IP protection posture is excellent; the engineering scalability is not.

---

## 1. ARCHITECTURE ANALYSIS

### 1.1 Current Stack
| Layer | Technology | Assessment |
|-------|-----------|------------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS | Good choice |
| Backend | Next.js API Routes (serverless) | Limiting at scale |
| Database | Supabase PostgreSQL + RLS | Good, but missing indexes |
| AI | Anthropic Claude SDK (server-side) | Well-integrated |
| Auth | Supabase Auth (JWT) | Solid |
| Payments | Stripe | Standard |
| Deployment | Vercel (serverless) | Good for MVP |
| Email | Resend | Adequate |

### 1.2 Project Structure
```
/src
  /app
    /api         → 153 route handlers (REST endpoints)
    /platform    → Feature pages (dashboard, research, study, payroll, etc.)
    /(auth)      → Login, signup flows
  /components    → React UI components
  /lib
    /ai          → Claude AI client, prompts
    /email       → Email templates
    security-middleware.ts → IP protection, sanitisation
  /middleware.ts → Auth, CSP, rate limiting, CSRF
/supabase
  /migrations    → 24 SQL migrations (~3,400 lines)
```

### 1.3 Strengths
- **Multi-tenant from day 1**: `tenant_id` in all tables, RLS enforced
- **Clean domain separation**: exec, academic, wellness, IP vault, contracts
- **Server-side AI**: All Claude calls server-side only, system prompts never exposed
- **Comprehensive middleware**: Auth, CSRF, CSP nonce, rate limiting, security headers

### 1.4 Critical Weaknesses

#### A. No Service Layer
API routes directly access Supabase with repeated boilerplate. The same auth check + profile fetch pattern appears ~50 times:
```typescript
// Repeated across ~50 route handlers
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

#### B. Monolithic Page Components
- `research/page.tsx` = **1,136 lines**
- `payroll/page.tsx` = **747 lines**
- `dashboard/page.tsx` = **733 lines**
- `WellnessCheckIn.tsx` = **598 lines**
- `Sidebar.tsx` = **427 lines**

These are unmaintainable and block hydration on slow networks.

#### C. N+1 Query Pattern
The AI chat endpoint fires **7 parallel queries per request**:
```typescript
const [tasksR, modulesR, projectsR, chaptersR, notifsR, briefR, calendarR] = 
  await Promise.all([
    supabase.from('tasks').select(...).limit(15),
    supabase.from('academic_modules').select(...).limit(6),
    // ... 5 more queries
  ])
```
At 10k concurrent users this produces ~70k QPS - exceeding Supabase capacity.

#### D. Missing Database Indexes
No compound indexes on frequently queried patterns:
- `tasks(user_id, due_date)` - queried on every dashboard load
- `academic_modules(user_id, status)` - queried on study pages
- `user_profiles(id)` - queried on every authenticated request

#### E. No Caching Layer
- Every API call hits the database directly
- User profiles fetched on every request (no Redis/memory cache)
- Zustand is in `package.json` but not used
- Upstash Redis partially set up but not leveraged

#### F. Embedded Migrations
`/api/admin/migrate/route.ts` = **2,032 lines** of embedded SQL. No rollback support, no CI/CD integration, risk of accidental execution.

---

## 2. SECURITY ANALYSIS

### 2.1 Strengths (Score: 7/10)

| Control | Implementation | Status |
|---------|---------------|--------|
| Authentication | Supabase JWT + session cookies | STRONG |
| Authorization | Row-Level Security (PostgreSQL RLS) | STRONG |
| CSRF Protection | Origin/Referer validation in middleware | GOOD |
| CSP Headers | Strict CSP with per-request nonce | STRONG |
| Rate Limiting | 500 req/15min per IP (middleware) | GOOD |
| Security Headers | HSTS, X-Frame-Options DENY, nosniff, XSS protection | STRONG |
| Session Management | 4-hour idle timeout | GOOD |
| API Sanitisation | Blocked fields stripped from all responses | EXCELLENT |
| Prompt Injection | 11 regex patterns for jailbreak detection | MODERATE |
| Audit Logging | All security events logged to `audit_log` table | GOOD |

### 2.2 Vulnerabilities

#### CRITICAL: Prompt Injection Detection is Regex-Based (Bypassable)
```typescript
// /lib/security-middleware.ts - trivially bypassed
/ignore\s+(all\s+)?previous\s+instructions/i,
/you\s+are\s+now\s+in\s+developer\s+mode/i,
/jailbreak/i,
```
- **Risk**: Attackers can use synonyms, unicode substitution, or encoding tricks
- **Fix**: Use LLM-based classification or input allow-listing instead of regex blocklists

#### HIGH: `unsafe-eval` in CSP
```typescript
script-src 'self' 'unsafe-eval' 'nonce-{random}'
```
- `unsafe-eval` allows `eval()`, `Function()`, `setTimeout(string)` - XSS vector
- **Fix**: Remove `unsafe-eval`; refactor any code relying on dynamic evaluation

#### HIGH: System Prompt Redaction Leaves Evidence
```typescript
// /lib/ai/client.ts:35-41
if (p.test(text)) { return text.replace(p, '[filtered]') }
```
- The `[filtered]` marker confirms a system prompt exists and reveals its approximate structure
- **Fix**: Strip entirely rather than replacing with markers

#### MEDIUM: In-Memory Rate Limiter Not Distributed
- Middleware uses an in-memory `Map` for rate limiting
- In Vercel serverless, each function instance has its own Map
- **Result**: Rate limits are per-instance, not per-user globally
- **Fix**: Use Upstash Redis (already partially configured)

#### MEDIUM: No Error Tracking / Alerting
- All errors logged to `console.error` only
- No Sentry, Datadog, or alerting integration
- Production errors are invisible unless someone checks Vercel logs
- **Fix**: Add Sentry or equivalent APM

#### LOW: Hardcoded Preview URL in Email Templates
```typescript
// /lib/email/index.ts:325
href="https://pios-wysskz48mv-engs-projects.vercel.app/platform/dashboard"
```
- Personal Vercel preview URL in production code
- **Fix**: Use environment variable for base URL

---

## 3. IP PROTECTION ANALYSIS

### 3.1 Overall Assessment: EXCELLENT (9/10)

The IP protection posture is the strongest aspect of this codebase.

### 3.2 Legal Framework
| Asset | Protection | Status |
|-------|-----------|--------|
| PIOS | Trademark (TM pending) | Filed |
| VeritasIQ | Trademark (TM pending) | Filed |
| NemoClawAI | Trademark (TM pending) | Filed |
| InvestiScript | Trademark (TM pending) | Filed |
| VeritasEdge | Trademark (TM pending) | **Deadline: 14 Apr 2026** |
| HDCA Algorithm | Patent pending + Trade secret | 6 patent claims documented |
| VE-CAFX | Trade secret (TS-20260323-E2C618) | Registered internally |
| VE-BENCH | Trade secret (TS-20260323-BENCH-01) | Database-only, never exposed |
| NemoClaw Spec | Trade secret (TS-20260323-NEMO-01) | Server-side only |

**Action Required**: VeritasEdge and VeritasIQ TM filings due **14 April 2026** (10 days).

### 3.3 Technical IP Protection

#### API Response Sanitisation (EXCELLENT)
```typescript
// /lib/security-middleware.ts
const BLOCKED_FIELDS = new Set([
  'cafx_factor', 'cafx_value', 'climate_factor',
  'bench_rate', 'bench_rate_per_sqm', 'hdca_weight',
  'system_prompt', '_internal', 'raw_coefficient',
])
```
All API responses pass through `sanitiseApiResponse()` which recursively strips proprietary fields.

#### Server-Side Isolation (EXEMPLARY)
- **Zero proprietary logic on client**: All HDCA, VE-CAFX, NemoClaw, VE-BENCH calculations are server-side only
- Client components are purely presentational display layers
- Claude API calls exclusively server-side via `/src/lib/ai/client.ts`
- System prompts classified INTERNAL (IS-POL-004), never transmitted to client

#### IP Response Headers
```
X-IP-Notice: (c) 2026 VeritasIQ Technologies Ltd. Proprietary and confidential.
X-Content-Owner: VeritasIQ Technologies Ltd
Cache-Control: no-store, no-cache, must-revalidate
X-Robots-Tag: noindex
```

#### Source Map Protection
- TypeScript `noEmit: true` - no source maps generated
- Next.js production builds minified by default
- `.gitignore` excludes `.next/`, `*.tsbuildinfo`
- No webpack config enabling source maps

### 3.4 IP Risks

1. **No automated tests verifying sanitisation**: If `sanitiseApiResponse()` is accidentally bypassed on a new endpoint, proprietary fields leak silently
2. **No DLP (Data Loss Prevention)**: No checks to prevent bulk export of HDCA weights or VE-BENCH rates
3. **Trade secret register is in git**: `IP_NOTICE.md` documents internal trade secret reference codes - consider moving to encrypted vault

---

## 4. SCALABILITY SCORECARD

| Category | Score | Key Issue |
|----------|-------|-----------|
| Code Organization | 6/10 | Monolithic pages, no service layer |
| Database Layer | 5/10 | N+1 queries, missing indexes, no pagination |
| State Management | 5/10 | No caching, redundant fetches |
| Error Handling | 5/10 | Generic catches, no alerting, inconsistent HTTP codes |
| API Design | 7/10 | Mostly RESTful, some action-based endpoints |
| Type Safety | 5/10 | ~798 `any` casts despite strict mode |
| Performance | 4/10 | 7-query baseline per AI request, no code splitting |
| Testing | 2/10 | 5 E2E tests only, 0 unit tests, 0 integration tests |
| Code Duplication | 5/10 | Auth/profile/error patterns repeated 50+ times |
| Scalability | 3/10 | Breaks at 10k concurrent users |

### Scale Breaking Points

**At 10x (10,000 users)**:
- Database: 70k QPS from AI chat alone (exceeds Supabase capacity)
- Rate limiter: In-memory Map grows unbounded in serverless
- No pagination on list endpoints causes response bloat

**At 100x (100,000 users)**:
- Connection pool exhaustion
- Middleware auth latency becomes bottleneck
- No horizontal scaling for stateful operations
- Need read replicas, event streaming, database sharding

---

## 5. HOW I WOULD REBUILD IT

### 5.1 Architecture: Domain-Driven Modular Monolith

Instead of the current flat structure, organize around bounded contexts:

```
/src
  /modules
    /auth          → Authentication, sessions, user profiles
    /exec          → Executive tools (OKRs, stakeholders, decisions)
    /academic      → Study, modules, thesis, research
    /wellness      → Check-ins, BICA personality
    /ai            → NemoClaw, Claude integration, chat
    /finance       → Payroll, HDCA, Stripe billing
    /ip-vault      → IP documents, contracts, citation guard
  /shared
    /lib           → Database client, auth guard, error handler, cache
    /types         → Generated Supabase types, shared interfaces
    /middleware     → Security, CSP, rate limiting
  /app
    /api           → Thin route handlers that delegate to modules
    /platform      → Thin page components that compose module UIs
```

Each module owns its:
- **Service layer** (business logic)
- **Repository layer** (database queries)
- **Types** (interfaces, validation schemas)
- **Components** (UI specific to the domain)

### 5.2 Key Technical Decisions

#### A. Shared API Utilities (Eliminate 50x Duplication)
```typescript
// /shared/lib/api.ts
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    
    try {
      return await handler(req, { user, supabase })
    } catch (err) {
      logError(err, { userId: user.id, path: req.nextUrl.pathname })
      return json({ error: 'Internal error' }, 500)
    }
  }
}

// Usage in route handler - clean, 3 lines:
export const GET = withAuth(async (req, { user, supabase }) => {
  const tasks = await taskService.getByUser(user.id)
  return json({ data: tasks })
})
```

#### B. Redis Caching Layer (Critical for Scale)
```typescript
// /shared/lib/cache.ts
import { Redis } from '@upstash/redis'

export async function cached<T>(
  key: string, 
  ttlSeconds: number, 
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await redis.get<T>(key)
  if (hit) return hit
  const data = await fetcher()
  await redis.set(key, data, { ex: ttlSeconds })
  return data
}

// Usage:
const profile = await cached(
  `profile:${userId}`, 300, // 5 min cache
  () => supabase.from('user_profiles').select('*').eq('id', userId).single()
)
```

#### C. Generated Database Types (Eliminate 798 `any` Casts)
```bash
npx supabase gen types typescript --project-id=vfvfulbcaurqkygjrrhh > src/shared/types/database.ts
```

Then:
```typescript
import { Database } from '@/shared/types/database'
type Task = Database['public']['Tables']['tasks']['Row']
type InsertTask = Database['public']['Tables']['tasks']['Insert']
```

#### D. Proper Database Indexes
```sql
-- Add to migration 025
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_academic_modules_user ON academic_modules(user_id, status);
CREATE INDEX idx_ai_sessions_user ON ai_sessions(user_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_user_profiles_id ON user_profiles(id);
```

#### E. Optimized AI Chat Query (7 queries -> 2)
```sql
-- Single materialized view for AI context
CREATE MATERIALIZED VIEW user_ai_context AS
SELECT 
  u.id as user_id,
  jsonb_build_object(
    'tasks', (SELECT jsonb_agg(t.*) FROM tasks t WHERE t.user_id = u.id AND t.status != 'done' LIMIT 15),
    'modules', (SELECT jsonb_agg(m.*) FROM academic_modules m WHERE m.user_id = u.id LIMIT 6),
    'projects', (SELECT jsonb_agg(p.*) FROM research_projects p WHERE p.user_id = u.id LIMIT 5)
  ) as context
FROM user_profiles u;

-- Refresh periodically or on write
REFRESH MATERIALIZED VIEW CONCURRENTLY user_ai_context;
```

#### F. Input Validation with Zod
```typescript
// /modules/exec/schemas.ts
import { z } from 'zod'

export const CreateOKRSchema = z.object({
  objective: z.string().min(1).max(500),
  key_results: z.array(z.object({
    description: z.string().min(1).max(300),
    target: z.number().positive(),
    unit: z.enum(['percentage', 'count', 'currency']),
  })).min(1).max(10),
})

// In route handler:
const body = CreateOKRSchema.parse(await req.json()) // throws 400 on invalid
```

#### G. Component Decomposition
```
// Before: dashboard/page.tsx (733 lines)
// After:
/modules/exec/components/
  DashboardPage.tsx        → Layout container (50 lines)
  OKRSection.tsx           → OKR cards (80 lines)
  StakeholderSection.tsx   → Stakeholder grid (60 lines)
  TaskSection.tsx          → Task list (70 lines)
  WellnessWidget.tsx       → Wellness summary (40 lines)
  RecentActivity.tsx       → Activity feed (50 lines)
```

#### H. Testing Strategy
```
Priority 1 (Week 1):
  - Unit tests for security-middleware.ts (sanitisation, prompt injection)
  - Unit tests for HDCA calculation logic
  - Integration tests for auth flow

Priority 2 (Month 1):
  - API integration tests for all 153 endpoints
  - Component tests for critical UI flows
  - Load tests with k6 targeting 10k concurrent users

Priority 3 (Quarter 1):
  - E2E coverage for billing, onboarding, AI chat
  - Visual regression tests
  - Chaos engineering (Supabase unavailable, Claude API timeout)
```

#### I. Observability Stack
```
Sentry       → Error tracking + performance monitoring
Pino         → Structured JSON logging (replace console.log)
Upstash Redis → Distributed rate limiting + caching
Vercel Analytics → Core Web Vitals, bundle size tracking
```

### 5.3 Rebuild Priority Roadmap

#### IMMEDIATE (Week 1) - Stop the Bleeding
1. Add database indexes for hot query paths
2. Move migrations out of route handler into `/supabase/migrations/`
3. Implement Redis caching for user profiles
4. Fix `unsafe-eval` in CSP
5. Add Sentry error tracking

#### SHORT-TERM (Month 1) - Foundation
6. Create `withAuth()` wrapper - eliminate 50x duplication
7. Generate Supabase types - eliminate `any` casts
8. Add Zod validation to all API inputs
9. Break down pages > 500 LOC into sub-components
10. Implement cursor-based pagination on all list endpoints
11. Add unit tests for security middleware and IP sanitisation

#### MEDIUM-TERM (Quarter 1) - Scale
12. Refactor into domain modules (exec, academic, wellness, ai, finance)
13. Create service layer (separate business logic from route handlers)
14. Implement materialized view for AI chat context
15. Add distributed rate limiting via Upstash Redis
16. Comprehensive load testing with k6
17. CI/CD pipeline: type-check, lint, test, build on every PR

#### LONG-TERM (Quarter 2) - Production Grade
18. Read replicas for analytics/reporting queries
19. Event-driven architecture for async operations (email, notifications)
20. LLM-based prompt injection detection (replace regex)
21. Secret rotation automation
22. Database connection pooling via PgBouncer
23. Horizontal scaling architecture documentation

---

## 6. SUMMARY

### What's Done Well
- **IP protection is exemplary** - proprietary algorithms server-side only, API responses sanitised, comprehensive legal framework
- **Security middleware is thoughtful** - CSP nonce, CSRF, rate limiting, audit logging, prompt injection detection
- **Multi-tenant design from day 1** - RLS policies, tenant isolation
- **AI integration is clean** - server-side only, system prompts protected, output filtering

### What Needs Immediate Attention
- **Testing (2/10)**: Near-zero test coverage is the single biggest risk
- **Scalability (3/10)**: N+1 queries and no caching will break at 10k users
- **Performance (4/10)**: 7 queries per AI chat request, no code splitting, no pagination
- **Type safety (5/10)**: 798 `any` casts undermine TypeScript's value

### Bottom Line
PIOS has **excellent security DNA and IP protection** but is architecturally a **well-secured MVP that won't scale**. The rebuild strategy above preserves the strong security/IP foundations while addressing the structural issues. The modular monolith approach allows incremental migration without a full rewrite.

**Suitable for**: < 1,000 daily active users
**Requires hardening for**: 10,000+ concurrent users
**Timeline to production-grade**: ~3 months with focused engineering effort
