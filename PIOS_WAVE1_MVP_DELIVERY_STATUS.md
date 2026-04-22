### PIOS Wave 1 MVP Delivery Status

**Document purpose:** Production-ready delivery status for stakeholder review and engineering handoff.  
**Project:** PIOS (Wave 1 MVP)  
**Cutoff state:** `master @ 8ec53ec` (Phase 4 FM Consultant Alpha complete)  
**Prepared:** 2026-04-22

### 1) Implementation Progress Summary

#### 1.1 Completed phases and commit hashes

| Phase | Scope | Migration(s) | Primary commit(s) | Status |
|---|---|---|---|---|
| Phase 2 | Persona/module foundation (activation substrate + profile rollups) | `M083` | `b146617` | ✅ Complete |
| Phase 3 | Consulting Workbench (7-step flow + 15 frameworks + engagement progression) | `M084` | `8ea794f` | ✅ Complete |
| Phase 4 | FM Consultant Alpha (risk library, options, precedents, email correlation, reports) | `M108` (superseding deleted `M085`) | `079c654` (feature baseline), `8ec53ec` (alpha-complete hardening/release) | ✅ Complete |

**Current production-ready Wave 1 alpha commit:** `8ec53ec`

#### 1.2 Features delivered by phase

##### Phase 2 (M083)
- Multi-persona model with canonical persona codes.
- Persona/module activation substrate:
  - `user_personas` modernization for multi-persona support.
  - `user_modules` activation table.
  - `user_profiles.active_personas` + `active_module_codes` cache arrays.
- Default persona→module seeding and rollup sync.
- RLS policy set for persona/module ownership.
- Platform and AI context enrichment using active persona/module state.

##### Phase 3 (M084)
- Consulting Engagement Manager foundation.
- 7-step engagement progression model:
  - `engagement_steps`
  - `engagement_frameworks`
  - `engagement_deliverables`
- Framework library seeded with **15 consulting frameworks** across steps 1–7.
- Engagement schema enhancements (`project_id`, `current_step`, `linked_email_ids`, correlation metadata, archival status support).
- Email correlation scaffold functions:
  - `suggest_linked_emails(...)`
  - `correlate_engagement_emails(...)`
- Calibration gate function scaffold:
  - `evaluate_calibration_gates(...)`

##### Phase 4 (M108)
- FM Consultant Alpha module completed end-to-end:
  - FM engagement taxonomy (Wave 1 seed: Types 1, 2, 3, 9).
  - FM risk library with **50 seeded risks (FM-001..FM-050)**.
  - Engagement-level risk register with score generation and mitigation lifecycle.
  - FM strategic options model (1–4 options per engagement).
  - FM precedents library with anonymization/search.
  - Engagement email correlation support + linked evidence retrieval.
  - Report pipeline + persisted deliverables + file download endpoint.
  - FM dashboard widget metrics and route.

#### 1.3 Database migrations applied (Wave 1 MVP path)

> Note: These migrations are implemented and versioned in code. Apply to each target Supabase environment during deployment.

Recommended execution sequence for Wave 1 MVP handoff:
1. `20260421120000_M076_schema_drift_and_email_intelligence.sql`
2. `20260422183000_M083_foundational_persona_module_system.sql`
3. `20260422193000_M084_engagement_manager_foundation.sql`
4. `20260422235500_M108_fm_consultant_module.sql`

#### 1.4 Tables created (Wave 1 scope)

##### M076
- `project_source_documents`
- `document_extracts`
- `project_risks`
- `project_compliance`
- `project_intelligence`
- `email_drafts`

##### M083
- `user_modules` (new)
- `user_personas` (modernized/expanded to multi-persona)
- `user_profiles` additions: `active_personas`, `active_module_codes`, `workload_tracking_enabled`

##### M084
- `framework_library`
- `engagement_steps`
- `engagement_frameworks`
- `engagement_deliverables`
- `consulting_engagements` extended for step lifecycle + email correlation metadata

##### M108
- `fm_engagement_types`
- `fm_risk_library`
- `engagement_risks`
- `fm_options`
- `fm_precedents`
- `consulting_engagements` extended with FM email auto-correlation fields

### 2) FM Consultant Alpha Status

#### 2.1 Feature checklist

- ✅ FM engagement type model and APIs (`fm_type_1`, `fm_type_2`, `fm_type_3`, `fm_type_9` seeded)
- ✅ FM risk library schema + seed data
- ✅ 50 canonical FM risks seeded (`FM-001` through `FM-050`)
- ✅ Engagement risk CRUD (including linked evidence email IDs)
- ✅ AI-assisted strategic option generation (3–4 options, MECE framing)
- ✅ Options CRUD and recommendation flagging
- ✅ FM precedents creation and search with anonymization
- ✅ Engagement↔email correlation endpoint and retrieval endpoint
- ✅ Project context endpoint for engagement evidence framing
- ✅ Report generation + storage + download pipeline
- ✅ FM dashboard/widgets API
- ✅ FM route surfaced in consulting navigation UI

#### 2.2 FM risk set coverage (FM-001 to FM-050)
- **Operational:** FM-001..FM-015
- **Financial:** FM-016..FM-025
- **Compliance:** FM-026..FM-035
- **Health & Safety:** FM-036..FM-045
- **Strategic:** FM-046..FM-050

#### 2.3 Report generation capabilities

Current implemented output formats via `/api/engagements/[id]/report/generate`:
- ✅ **HTML**
- ✅ **PDF** (via Puppeteer renderer)
- ✅ **PPTX** (via PptxGenJS)
- ✅ **JSON** (structured report payload)

Markdown status:
- 🟡 **Schema-ready** (`engagement_deliverables` supports `markdown` type from M084), but direct `format=markdown` route support is not yet exposed in the Phase 4 generator endpoint.

#### 2.4 Email correlation details (FM Alpha)

- Engagement-level auto-correlation function: `correlate_emails_to_engagement(p_engagement_id)`.
- Matching basis: engagement `client_name` vs email sender/subject signals.
- Correlation window: recent emails relative to engagement creation date (30-day lookback in function logic).
- Result persistence:
  - `consulting_engagements.linked_email_ids`
  - Risk-level evidence links via `engagement_risks.linked_email_ids`
- API support:
  - Correlate now endpoint
  - Linked email retrieval endpoint
  - Project-context endpoint including risk evidence links

#### 2.5 API endpoints created/available for FM Alpha

##### FM module APIs
- `GET /api/fm/engagement-types`
- `GET /api/fm/engagement-types/[typeCode]`
- `GET /api/fm/risks/library`
- `GET /api/fm/risks/library/[riskCode]`
- `POST /api/fm/precedents`
- `GET /api/fm/precedents/[id]`
- `GET /api/fm/precedents/search`
- `GET /api/fm/dashboard/widgets`

##### Engagement FM workflows
- `GET|POST|PATCH|DELETE /api/engagements/[id]/risks`
- `PATCH|DELETE /api/engagements/[id]/risks/[riskId]`
- `GET|POST|PATCH|DELETE /api/engagements/[id]/options`
- `POST /api/engagements/[id]/options/generate`
- `POST /api/engagements/[id]/emails/correlate`
- `GET /api/engagements/[id]/emails`
- `GET /api/engagements/[id]/project-context`
- `POST /api/engagements/[id]/report/generate`
- `POST /api/engagements/[id]/reports/generate` (compat alias)
- `GET /api/engagements/[id]/report/download`

### 3) Alpha Testing Checklist

#### 3.1 Completed test checklist (Wave 1 through Phase 4)
- [x] Persona/module activation and profile rollup persistence validated.
- [x] Consulting 7-step progression schema and framework library seeded.
- [x] FM engagement type retrieval and filtering validated.
- [x] FM risk library retrieval + category/type filtering validated.
- [x] Engagement risk CRUD and computed risk score behavior validated.
- [x] Option CRUD + AI option generation path validated.
- [x] Email correlation function invocation + linked email retrieval validated.
- [x] Report generation and download for HTML/PDF/PPTX validated.
- [x] FM dashboard widget aggregation path validated.
- [x] FM consulting route available in UI navigation.

#### 3.2 Remaining Wave 1 items
- [ ] Apply migrations to all target Supabase environments and complete production smoke test pass.
- [ ] Add direct Markdown export format parity in report generator endpoint.
- [ ] Complete Citation Graph integration cycle (`M062` workstream alignment).
- [ ] Deliver Academic module minimum production slice.
- [ ] Deliver CPD Setup module minimum production slice.

### 4) Technical Details

#### 4.1 Dependencies added in delivered phases

##### Phase 3 (M084 enablement)
- `zod`
- `react-hook-form`
- `@hookform/resolvers`

##### Phase 4 (FM report generation)
- `pptxgenjs` (PPTX generation)
- `puppeteer` (PDF rendering)

#### 4.2 Migration sequence and replacement note
- `M085` was superseded and removed.
- Canonical FM migration for this release is `M108`.
- Recommended Wave 1 run order for delivery handoff:
  - `M076` → `M083` → `M084` → `M108`

#### 4.3 Deployment instructions (handoff)

1. **Install dependencies**
   - `npm install`
2. **Configure environment**
   - Populate `.env.local` / deployment environment variables (Supabase, Anthropic, app URL, cron secret, etc.).
3. **Apply database migrations**
   - `npm run db:push`
4. **Type-check and build**
   - `npm run type-check`
   - `npm run build`
5. **Smoke test key FM Alpha flows**
   - Engagement create/open
   - Risks CRUD
   - Options generate + edit
   - Email correlate + linked email view
   - Report generate/download (HTML/PDF/PPTX)
6. **Deploy**
   - `npm run deploy:production` (or CI/CD equivalent)
7. **Post-deploy verification**
   - Validate FM dashboard widgets, RLS behavior, and report download headers/content types.

### 5) Next Development Cycle (Post-Alpha)

#### 5.1 Citation Graph M062
- Complete integration with Wave 1 engagement and consulting data surfaces.
- Finalize ingestion, citation linking UX, and retrieval endpoints for production usage.

#### 5.2 Academic Module (minimum)
- Minimum end-to-end slice for onboarding → research context → export-ready outputs.
- Align module activation with persona/module framework already delivered in M083.

#### 5.3 CPD Setup module
- Deliver CPD setup baseline UX + persistence + progression checkpoints.
- Ensure consistency with consultant persona and module toggles.

---

**Release readiness summary:** Wave 1 MVP through Phase 4 (FM Consultant Alpha) is code-complete and handoff-ready at commit `8ec53ec`, with deployment actions focused on migration application, smoke validation, and remaining Wave 1 closure items (Citation Graph, Academic minimum, CPD setup, Markdown report parity).
