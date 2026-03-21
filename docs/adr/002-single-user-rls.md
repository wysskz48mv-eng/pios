# ADR-002: Single-user RLS (user_id not tenant_id)
**Status:** Accepted
Unlike SustainEdge (multi-tenant, tenant_id RLS) and InvestiScript (organisation_id RLS),
PIOS is a personal platform with one user per account. All RLS policies use user_id = auth.uid().
The tenant_id column is retained for future multi-seat expansion.
