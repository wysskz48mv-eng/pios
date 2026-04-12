# PIOS v1.0 — Personal Intelligence Operating System

**VeritasIQ Technologies Ltd** · `pios.veritasiq.io`

A personal AI operating system for multi-domain executives: surfaces cross-domain conflicts
(academic deadlines vs. business commitments), generates daily intelligence briefs, and
integrates tasks, projects, academic tracking, and email triage in one place.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14.2.35 / TypeScript / Tailwind CSS |
| Auth | Supabase Auth (magic link / OTP) |
| Database | Supabase PostgreSQL (EU West) — RLS enabled |
| AI | Anthropic Claude primary, with OpenAI and Gemini failover |
| Billing | Stripe (subscriptions: Student / Individual / Professional) |
| Email | Resend |
| Deployment | Vercel |

---

## Product features

- **Daily Brief** — AI-generated morning intelligence brief from live data
- **AI Chat** — Contextual assistant with full live data access
- **Tasks** — Cross-domain task management (academic / FM / SaaS / personal)
- **Projects** — Active project tracker across all domains
- **Academic** — DBA module tracker, thesis chapter progress
- **Email Sync** — Gmail OAuth triage with AI domain classification
- **Calendar** — Schedule view
- **Expenses** — Spend tracking

---

## Architecture Decision Records

See [`/docs/adr/`](docs/adr/README.md) for key decisions.

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY= # Optional fallback for newer Supabase publishable keys
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=           # Optional AI failover provider
GOOGLE_GEMINI_API_KEY=    # Optional AI failover provider
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STUDENT=
STRIPE_PRICE_PRO=
STRIPE_PRICE_PROFESSIONAL=
STRIPE_PRICE_TEAM=
NEXT_PUBLIC_APP_URL=https://pios.veritasiq.io
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
GOOGLE_CLIENT_ID=         # For Gmail OAuth
GOOGLE_CLIENT_SECRET=
AZURE_CLIENT_ID=          # For Microsoft / Outlook OAuth
AZURE_CLIENT_SECRET=
OAUTH_STATE_SECRET=       # Recommended when enabling Microsoft OAuth callbacks
SENTRY_DSN=               # Optional — error tracking
```

---

## Security

- **Headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options on all responses (middleware)
- **Rate limiting:** 100 req/15min per IP at edge middleware
- **Auth:** Supabase JWT session, refreshed at middleware on every request
- **RLS:** All Supabase tables have Row Level Security enforced at database layer
- **CVEs:** Next.js 14.2.35 (patches CVE-2024-46982 cache poisoning, CVE-2024-56332 DoS)
- **MFA:** Available via Supabase Auth TOTP — enable in Supabase Dashboard → Authentication
- **Backups:** Supabase automated daily backups, 7-day PITR

### Privileged route controls

- Admin migration and seed routes are disabled by default in production.
- Enable them only when explicitly needed by setting one of:
	- `ENABLE_ADMIN_ROUTES=true`
	- `ENABLE_ADMIN_MIGRATION_ROUTES=true`
	- `ENABLE_ADMIN_SEED_ROUTES=true`
	- `ENABLE_ADMIN_BILLING_ROUTES=true`
	- `ENABLE_ADMIN_COMMUNICATION_ROUTES=true`
	- `ENABLE_LIVE_DIAGNOSTIC_ROUTES=true`
- Protected routes also require the relevant secret header; the production flags do not replace authentication.
- Internal operational endpoints such as setup status and live cross-product metrics are owner-scoped and should not be relied on as general user-facing APIs.

### Microsoft OAuth caveat

- Microsoft inbox connection is enabled, but some work, university, or government Microsoft 365 tenants block third-party OAuth consent by policy.
- If a user hits that restriction, direct them to ask their host organisation IT team to approve the Azure app registration.
- If approval is not available, guide them to use a personal Outlook or Gmail inbox for email triage, or use IMAP with an app password where their tenant permits it.

### AI resilience

- The shared AI client now uses Anthropic as the primary provider, with OpenAI and Gemini as automatic fallbacks when configured.
- Add `OPENAI_API_KEY` and `GOOGLE_GEMINI_API_KEY` in Vercel if you want failover beyond Anthropic.
- CSP now allows `api.openai.com` and `generativelanguage.googleapis.com` for server-side AI failover requests.
- If the `ai_provider_config` and `ai_provider_health_log` tables exist, provider ordering and health events are recorded there. If they do not exist, the app falls back to the built-in provider order and continues operating.

---

## Backup and restore

Supabase handles automated daily backups. To restore:
1. Supabase Dashboard → Project → Settings → Database → Backups
2. Select restore point → Restore to new project
3. Update `NEXT_PUBLIC_SUPABASE_URL` and keys in Vercel env vars

---

## Database

Supabase project: `vfvfulbcaurqkygjrrhh` (EU West)  
14 tables, full RLS. Migrations in `supabase/migrations/`.

---

## Deployment

1. Push to GitHub → Vercel auto-deploys
2. Set all env vars in Vercel Dashboard
3. Run Supabase migrations: `supabase db push`
4. Configure Stripe webhook: endpoint `https://<domain>/api/stripe/webhook`

---

## Workbench API smoke tests

Run local unauthenticated route checks (expects 401 on protected endpoints):

```bash
npm run dev
npm run api:test
```

Run authenticated checks with a raw cookie string:

```bash
WORKBENCH_AUTH_COOKIE="sb-access-token=...; sb-refresh-token=..." npm run api:test
```

Run authenticated checks with a cookie file (recommended):

```bash
WORKBENCH_AUTH_COOKIE_FILE=.secrets/workbench-cookie.txt npm run api:test
```

Run authenticated checks with a bearer token:

```bash
WORKBENCH_AUTH_BEARER="<supabase-access-token>" npm run api:test
```

Run authenticated checks with email/password token exchange:

```bash
WORKBENCH_AUTH_EMAIL="user@example.com" WORKBENCH_AUTH_PASSWORD="..." npm run api:test
```

Notes:
- Set `BASE_URL` to target non-local environments, for example `BASE_URL=https://pios.veritasiq.io npm run api:test`.
- The script first verifies the app is reachable, then runs unauthenticated checks, then authenticated create/read/step/archive checks if auth cookie input is provided.
- Authenticated mode accepts cookie, bearer token, or email/password exchange (requires Supabase public URL and anon key envs).
- In restricted networks/CI where reachability checks are blocked, set `WORKBENCH_SKIP_PREFLIGHT=1`.

---

*PIOS v1.0 · VeritasIQ Technologies Ltd · VeritasIQ Technologies Ltd*
