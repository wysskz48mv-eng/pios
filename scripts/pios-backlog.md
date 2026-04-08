# PIOS - Complete Prioritised Backlog
# Updated: 2026-04-08 | VeritasIQ Technologies Ltd

---

## P0 - Critical

| # | Task | VS Code Task | File |
|---|------|-------------|------|
| 1 | Copy ONYX UX files into repo | P0-1 | pios-impl/IMPLEMENTATION_GUIDE.md |
| 2 | Patch onboarding complete route to save command_centre_theme | P0-2 | src/app/api/onboarding/complete/route.ts |
| 3 | Audit and clear personal seed data | P0-3 | scripts/seed-data-audit.sql |
| 4 | TypeScript confirm 0 errors | P0-4 | - |
| 5 | Deploy to Vercel production | P0-5 | - |

## UAT Manual Checklist

- [ ] Magic link email received within 60 seconds
- [ ] Onboarding Step 1 persona cards load and select
- [ ] Onboarding Step 2 theme picker shows 3 previews
- [ ] Onboarding complete redirects to dashboard
- [ ] Theme switcher works and persists
- [ ] NemoClaw chat responds
- [ ] Stripe checkout succeeds