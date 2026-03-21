# ADR-005: Stripe for subscription billing
**Status:** Accepted
Three tiers: Student (2,000 AI credits), Individual (5,000), Professional (15,000).
Webhook handles checkout.session.completed, subscription.updated, subscription.deleted.
Stripe signature verification on webhook route — bypass auth middleware (verified by sig).
