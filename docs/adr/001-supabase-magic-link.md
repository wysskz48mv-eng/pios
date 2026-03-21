# ADR-001: Supabase magic-link auth
**Status:** Accepted
PIOS is a single-user personal platform. Magic-link (OTP) auth eliminates password
management overhead and is appropriate for personal productivity tools. Supabase handles
token refresh at middleware on every request. MFA available via TOTP if required.
