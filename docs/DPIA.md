# Data Protection Impact Assessment (DPIA)
**PIOS v1.0 | VeritasIQ Technologies Ltd**  
Prepared: 2026 Q1 | Review: Annually  
Required under: GDPR Article 35 | DIFC PDPL Article 20

---

## 1. Description of processing

VeritasEdge™ processes personal data of:
- **Platform user (single user):** name, contact details, annual tasks, emails, academic records, financial data
- **Platform users:** email, name, role (Finance Manager, Board Member, FM Consultant)
- **AI usage:** prompt content sent to Anthropic API for budget/lifecycle analysis

High-risk indicator: AI-based automated processing that produces financially significant
outputs (service charge levies) affecting individual property owners.

---

## 2. Legal basis

| Data subject | Legal basis | Detail |
|---|---|---|
| Plot owners | GDPR Art. 6(1)(b) — Contract | Service charge obligation under REGA/MOMRA |
| Platform users | GDPR Art. 6(1)(b) — Contract | SaaS subscription agreement |
| AI processing | GDPR Art. 6(1)(f) — Legitimate interest | Operational efficiency of service charge management |

---

## 3. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI generates incorrect levy amount | Medium | High — financial harm | HITL mandatory; amounts not communicated without Board approval |
| Unauthorised access to levy data | Low | High | RLS tenant isolation; JWT auth; rate limiting |
| Third-party AI provider breach | Low | High | Minimal PII sent to Anthropic; no full names in AI prompts |
| Data subject requests erasure | Medium | Medium | DSAR export/delete (Report R13) implemented |
| Regulatory non-compliance (REGA) | Low | High | Compliance tracker page; MOMRA references in code |

---

## 4. Safeguards implemented

- PostgreSQL Row Level Security — all queries tenant-scoped at DB layer
- HITL mandatory for all AI financial decisions (EU AI Act Art. 14)
- AI disclaimers on all OBE/allocation outputs
- DSAR export (R13) — data portability and erasure
- ISO 27001 security headers on all responses
- PII-stripping in error tracking (Sentry beforeSend removes email)
- Data minimisation — only necessary fields sent to Anthropic API

---

## 5. Conclusion

Processing is necessary for the stated purposes. Risks are mitigated to acceptable levels
through HITL governance, RLS isolation, and GDPR mechanisms. This DPIA should be reviewed
annually or when significant changes to processing are made.

**DPO / Owner:** Douglas Masuku, CEO, VeritasIQ Technologies Ltd  
d.masuku@veritasiq.co.uk
