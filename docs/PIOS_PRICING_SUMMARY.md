# PIOS PRICING STRATEGY - ADOPTED SUMMARY
**Date:** 12 April 2026
**Decision:** Stop legacy pricing progression and adopt the updated pricing strategy as the active baseline.
**Status:** Approved for implementation planning and execution sequencing.

---

## Adopted Pricing Baseline

| Tier | Adopted Price | Customer Segment | Notes |
|------|---------------|------------------|-------|
| Spark | GBP 16 / month | Students, researchers, early-career professionals | Entry tier, conversion funnel |
| Pro | GBP 35 / month | Consultants, solo practitioners | Full framework-led professional tier |
| Executive | GBP 65 / month | Founders, directors, C-suite | Premium decision-support tier |
| Enterprise | GBP 55-75 / seat / month | Teams and organisations | Volume-based seat pricing |
| White-Label | Partner program pricing (finalize in rollout) | Agencies, integrators, enterprise partners | Requires partner model and contract framework |

## Adoption Rules

1. New signups move to the adopted pricing baseline once Stripe IDs and checkout routing are complete.
2. Existing customers remain price-protected for 12 months per migration lock-in policy.
3. Enterprise and White-Label pricing is only sellable when minimum feature gates are live.

---

## Why This Strategy Is Being Adopted

1. Current public pricing is materially under market for a framework-led professional intelligence OS.
2. Competitor benchmarking supports a premium for specialized vertical capability.
3. The updated model improves unit economics while preserving a low-friction entry path.
4. It creates a credible path to enterprise and partner ARR, not only individual subscriptions.

---

## Minimum Feature Gates Before Full Rollout

### Enterprise Gates (must-have)
1. Admin dashboard with RBAC.
2. Team controls with SSO/MFA pathway.
3. Audit logs and compliance reporting.
4. DPA + data residency options.
5. Published SLA/support policy.

### White-Label Gates (must-have)
1. Domain and branding override.
2. Partner provisioning and tenant isolation controls.
3. Contracted partner terms and revenue model.
4. Support and escalation runbook.

---

## Implementation Sequence

### Phase 1 (Immediate)
1. Finalize Stripe product and price objects for Spark, Pro, Executive, and Enterprise seat bands.
2. Map all price IDs into database pricing tables.
3. Wire checkout and billing portal flows to tier resolver.

### Phase 2 (Parallel Build)
1. Deliver enterprise admin and compliance foundations.
2. Deliver White-Label MVP (branding, domain, provisioning).

### Phase 3 (Go-Live)
1. Launch updated pricing page and in-app plan selector.
2. Send migration communication to existing customers.
3. Launch enterprise and partner outreach with finalized commercial terms.

---

## Owner Checklist (Execution This Week)

### Product/Leadership
1. Confirm final public packaging copy per tier.
2. Approve enterprise seat discount thresholds.

### Engineering
1. Complete Stripe-to-tier wiring and webhook verification.
2. Ship enterprise gate features in sequence.
3. Ship White-Label MVP capability set.

### Finance/Ops
1. Validate price object accuracy and invoicing behavior.
2. Lock reporting views for ARR, conversion, and seat expansion.

### CX/Comms
1. Publish FAQ and migration messaging.
2. Enable support scripts for plan-change scenarios.

---

## Decision Note

This document supersedes prior draft pricing variants. Implementation should proceed against this adopted baseline unless explicitly amended in a subsequent strategy revision.
