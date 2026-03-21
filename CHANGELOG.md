# Changelog — PIOS

## v1.0.0 — 2026 Q1

### Added
- Daily AI brief generation (3-4 paragraph morning intelligence)
- Cross-domain AI chat with full live data context
- Task management across domains (academic / FM / SaaS / personal)
- Project tracker with domain tagging
- Academic module and thesis chapter tracker (DBA)
- Gmail sync with AI triage (domain classification, priority scoring, draft replies)
- Calendar, expenses, notifications
- Stripe subscription billing (Student / Individual / Professional)
- Magic-link auth (Supabase OTP)
- 14 Supabase tables with full RLS

### Security (v1.0 hardening — 2026 Q1)
- Security headers: CSP, HSTS, X-Frame-Options, nosniff on all responses
- Rate limiting: 100 req/15min per IP at edge middleware
- Next.js 14.2.5 → 14.2.35 (CVE-2024-46982 cache poisoning patch)
- Full try/catch on all API routes
- 404 and global error boundary pages
- LICENSE, README, ADRs added
- /api/health endpoint added

*PIOS v1.0 · VeritasIQ Technologies Ltd*
