---

## 🏢 ENTERPRISE & WHITE-LABEL BUILDS — Sprint 3
Owner: Richard | Target: 3–4 weeks | DB: M031 applied ✅

### What M031 Added to the DB

| Table / Column | Purpose |
|---|---|
| `tenant_members` | Who belongs to which org, with role (owner/admin/member/viewer) |
| `tenant_invites` | Email-based seat invitation tokens with expiry |
| `white_label_configs` | Full branding: logo, colors, custom domain, app name, footer control |
| `dpa_agreements` | DPA document + signer + version tracking (not just a timestamp) |
| `enterprise_proposals` | Sales pipeline from enquiry → provisioned |
| `tenant_seat_usage` | View: live seats_used vs seats_limit per tenant |
| `tenant_configs.white_label_enabled` | Flag to activate white-label mode |
| `tenant_configs.custom_domain` | Custom domain setting per tenant |
| `tenant_configs.sso_enabled` | SSO flag for future enterprise SSO |
| `user_profiles.tenant_role` | Owner/admin/member/viewer per user |
| `user_profiles.is_tenant_admin` | Quick admin check |
| `audit_log` enhancements | tenant_id, action, resource, ip_address, outcome |
| `operator_configs.tenant_id` | Links NemoClaw configs to enterprise tenants |

---

### Build Tasks

| # | Priority | Task | VS Code Task |
|---|----------|------|-------------|
| 1 | 🟠 HIGH | Enterprise proposal form — public `/enterprise` page | 🏢 ENT-1 |
| 2 | 🟠 HIGH | Enterprise onboarding flow — tenant creation + DPA + members | 🏢 ENT-2 |
| 3 | 🟠 HIGH | `/api/enterprise/provision` — server-side tenant setup | 🏢 ENT-3 |
| 4 | 🟠 HIGH | Seat invitation flow — invite email + token acceptance | 🏢 ENT-5 |
| 5 | 🟡 MEDIUM | Admin dashboard `/admin` — seat usage, members, modules | 🏢 ENT-4 |
| 6 | 🟡 MEDIUM | White-label config editor + logo upload | 🏢 ENT-6 |
| 7 | 🟡 MEDIUM | DPA signing page in admin | 🏢 ENT-8 |
| 8 | 🟡 MEDIUM | `getWhiteLabelConfig()` utility + middleware hook | 🏢 ENT-10 |
| 9 | 🟢 LOW | Custom domain resolution in Next.js middleware | 🏢 ENT-7 |
| 10 | 🟢 LOW | Audit log viewer for compliance reporting | 🏢 ENT-9 |

---

### Enterprise User Journey (what this enables)

```
1. Org discovers PIOS
       ↓
2. Fills "Request a proposal" form (/enterprise)
   → enterprise_proposals row created (status: enquiry)
       ↓
3. Dimitry qualifies → sends proposal
   → status: proposal_sent
       ↓
4. Org accepts → DPA signed
   → dpa_agreements row created
   → status: dpa_signed
       ↓
5. Dimitry provisions the tenant
   → /api/enterprise/provision creates:
     • tenants row (with seats_limit, Stripe sub)
     • tenant_configs (enabled_modules, data_region, popia_mode)
     • white_label_configs (app_name, logo, colors, custom_domain)
     • tenant_members row for owner
     • user_profiles.tenant_id set
   → status: provisioned
       ↓
6. Org admin logs in to /admin
   → Configures branding, uploads logo
   → Invites team members (tenant_invites)
   → Each invite = email with magic link → new user created
     → tenant_members row created
     → seats_used incremented (enforced by tenant_seat_usage view)
       ↓
7. Members log in → see white-labelled PIOS
   → If custom domain set: app.orgname.com serves PIOS
   → Logo, colors, app name all from white_label_configs
   → Modules limited to tenant_configs.enabled_modules
   → All data isolated: user_id + tenant_id RLS
       ↓
8. Enterprise renewal
   → Stripe subscription handles billing
   → DPA renewal tracked in dpa_agreements
   → Audit log available for compliance
```

---

### White-Label Configuration Options

Once built, a tenant admin can configure:

| Setting | Field | Example |
|---|---|---|
| App name | `white_label_configs.app_name` | "AcmePIOS" |
| Logo (light) | `logo_url` | acme-logo.png |
| Logo (dark) | `logo_dark_url` | acme-logo-dark.png |
| Primary colour | `primary_color` | #004B87 |
| Accent colour | `accent_color` | #C8A96E |
| Custom domain | `custom_domain` | app.acme.com |
| Support email | `support_email` | help@acme.com |
| Hide PIOS branding | `hide_pios_branding` | true |
| Hide VeritasIQ footer | `hide_veritasiq_footer` | true |
| Partner badge | `partner_badge_text` | "Powered by VeritasIQ" |
| Forced modules | `forced_modules` | ['email','decisions'] |
| Locked modules | `locked_modules` | ['wellness'] — users can't turn off |
| SSO | `sso_enabled` | true (future) |

---

### Compliance Checklist (per enterprise client)

- [ ] DPA signed and recorded in `dpa_agreements`
- [ ] `data_region` set correctly (EU/UK/US etc.)
- [ ] `popia_mode` enabled if South African client
- [ ] IT policy disclosure acknowledged (`email_it_policy_log`)
- [ ] `audit_log` capturing all user actions for tenant
- [ ] Seats at or below `seats_limit`
- [ ] `tenant_configs.enabled_modules` scoped to contracted modules only
- [ ] Custom domain verified (`white_label_configs.custom_domain_verified`)

---

VeritasIQ Technologies Ltd · info@veritasiq.io