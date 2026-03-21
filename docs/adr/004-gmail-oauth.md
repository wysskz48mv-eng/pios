# ADR-004: Gmail OAuth for email triage
**Status:** Accepted
Gmail access token stored in user_profiles.google_access_token.
Used only for reading unread messages for AI triage — no write access.
Token must be renewed on Google OAuth credential refresh.
Privacy: email content is sent to Anthropic API for triage — documented in Privacy Policy.
