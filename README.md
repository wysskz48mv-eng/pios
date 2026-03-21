# PIOS v1.0 — Personal Intelligence Operating System

**VeritasIQ Technologies Ltd** · `pios-wysskz48mv-engs-projects.vercel.app`

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
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
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
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STUDENT=
STRIPE_PRICE_INDIVIDUAL=
STRIPE_PRICE_PROFESSIONAL=
NEXT_PUBLIC_APP_URL=https://pios-wysskz48mv-engs-projects.vercel.app
RESEND_API_KEY=
GOOGLE_CLIENT_ID=         # For Gmail OAuth
GOOGLE_CLIENT_SECRET=
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

*PIOS v1.0 · VeritasIQ Technologies Ltd · Sustain International FZE Ltd*
