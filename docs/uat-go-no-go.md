# Pre-UAT Go/No-Go Checklist

Use this after the latest branch is pushed and the production deployment completes.

## Go Conditions

- `git push origin main` completed for the current local head.
- Production deployment was triggered from the latest pushed commit.
- Public [api/health](../src/app/api/health/route.ts) returns summary fields only and does not expose `checks` without a secret header.
- `node scripts/uat-smoke-test.js` returns `Automated: 10 passed, 0 failed` against production.
- Landing page shows the ONYX redesign.
- Signup page shows the magic-link-first flow.
- Unauthenticated access to `/platform/dashboard` redirects to login.
- `/api/cron/brief` returns `401` without a bearer token.

## No-Go Conditions

- Public health response still exposes detailed internal diagnostics.
- Production behavior does not match the local build validated in this repo.
- Automated smoke suite has any failures.
- Latest local commits are not pushed to [origin](../README.md).
- Required environment configuration is missing for the active scope.

## Manual UAT Checks

- Magic link email is received within 60 seconds.
- Persona cards load and can be selected.
- Theme picker shows the expected previews.
- Onboarding completes and redirects to dashboard.
- Theme selection persists after refresh.
- NemoClaw responds within 5 seconds.
- Stripe test checkout completes if billing is in scope.
- Reporting and self-heal checks are only required if the HEAL routes are in scope.

## Recommended Run Order

1. Push latest local `main`.
2. Wait for production deployment to complete.
3. Run `powershell -ExecutionPolicy Bypass -File scripts/post-deploy-verify.ps1`.
4. If that passes, run manual UAT.
5. Record any failures before signoff.