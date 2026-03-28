/**
 * /platform/changelog — PIOS Platform Changelog
 * Sprint history and feature releases
 * PIOS Sprint 85 | VeritasIQ Technologies Ltd
 */
export default function ChangelogPage() {
  const entries = [
    {
      version: 'v3.0.4',
      date: 'March 2026',
      badge: 'Latest',
      badgeColor: 'var(--ai)',
      changes: [
        { type: 'fix', text: 'Sprint 87: CSP middleware — style-src nonce was stripping unsafe-inline, blocking all Next.js inline styles. Every page rendered unstyled. Fixed: nonce applies to script-src only.' },
        { type: 'fix', text: 'Sprint 87: Onboarding TypeScript error — useState declarations after useEffect references caused build bundle failure (grey favicon icon on all pages). Fixed: state hoisted above effects.' },
        { type: 'fix', text: 'Sprint 87: PlatformShell scroll — main had overflowY:auto but content div did not, causing double-scroll. Fixed: main overflow:hidden, content div overflowY:auto.' },
        { type: 'fix', text: 'Sprint 87: Tailwind config — pios-* color tokens had hardcoded hex values differing from CSS variables. All tokens now map to var(--pios-*) for consistency.' },
        { type: 'new', text: 'Sprint 86: Investor Demo page (/platform/demo) — 6-section live showcase: Platform Overview, NemoClaw™ AI (live chat), Executive OS, Academic Module, Live Platforms, Commercial.' },
        { type: 'new', text: 'Sprint 86: Seed-demo extended — OKR key results, today\'s wellness session (mood 7/10, 🔥 7-day streak), March financial snapshot.' },
        { type: 'fix', text: 'Sprint 86: Dashboard API — tasks returned as { overdue, due_today, upcoming } object not array. Demo page crash fixed.' },
        { type: 'fix', text: 'Sprint 86: Profile save (onboarding step 2) — RLS missing UPDATE policy blocked all profile writes. Fixed: service client for DB writes.' },
        { type: 'fix', text: 'Sprint 86: CV upload — pdf-parse/mammoth replaced Claude document API (DOCX unsupported). Extension-based detection. XML w:t fallback for DOCX.' },
        { type: 'fix', text: 'Sprint 87: Login page — Google OAuth + magic link. Google OAuth now live (smpt-sustain project, Client ID configured in Supabase). Gmail/Calendar/Drive scopes enabled.' },
        { type: 'new', text: 'Sprint 85: POST /api/admin/migrate-pending — applies M019–M023 + pios-cv bucket in one authenticated call.' },
        { type: 'new', text: 'Sprint 85: POST /api/admin/seed-nemoclaw — NemoClaw™ first-run seed: exec_intelligence_config, 15 IP frameworks, calibration placeholder.' },
      ],
    },
    {
      version: 'v3.0.3',
      date: 'March 2026',
      badge: null,
      badgeColor: 'var(--ai)',
      changes: [
        { type: 'new', text: 'Sprint 85: Smoke test extended 20 → 26 checks — db_wellness (M021), db_nemoclaw_cal (M022), db_exec_intel (M023), storage_cv_bucket, nemoclaw_seed, nemoclaw_config.' },
        { type: 'new', text: 'Sprint 85: Smoke test extended 20 → 26 checks — db_wellness (M021), db_nemoclaw_cal (M022), db_exec_intel (M023), storage_cv_bucket, nemoclaw_seed, nemoclaw_config.' },
        { type: 'new', text: 'Sprint 85: Smoke UI — ⚡ Seed NemoClaw™ quick-action button appears when nemoclaw checks fail. One click seeds and re-runs.' },
        { type: 'fix', text: 'Sprint 85: Smoke test summary computed after all checks — previously mid-loop, so 6 new checks were excluded from pass/warn/fail totals. total_checks added to response.' },
        { type: 'new', text: 'Sprint 84: NemoClaw™ Training page (/platform/ai/train) — AI persona context, company context, goals, custom instructions, tone, response style. Auto-generate + live test.' },
        { type: 'new', text: 'Sprint 84: NemoClaw™ calibration status card in AI sidebar — summary, seniority, industry, recommended frameworks; prompts CV upload if uncalibrated.' },
        { type: 'new', text: 'Sprint 84: Migration M022 — nemoclaw_calibration table + pios-cv bucket with owner RLS.' },
        { type: 'new', text: 'Sprint 84: Migration M023 — exec_intelligence_config (NemoClaw training config), ai_credits_resets audit table.' },
        { type: 'fix', text: 'Sprint 84: M017 sentinel corrected to sia_signal_briefs — health check no longer falsely marks M017 unapplied.' },
        { type: 'new', text: 'Sprint 83: Financials — Add Snapshot form wired to /api/financials save_snapshot.' },
        { type: 'new', text: 'Sprint 82: Smart notification engine — IP/contract renewals, wellness streak break, overdue tasks, trial expiry — deduplicated by day.' },
        { type: 'new', text: 'Sprint 82: Notifications page v2 — Scan for alerts, category/domain filters, per-item delete, action links.' },
        { type: 'new', text: 'Sprint 81: Billing page v3 — trial countdown, AI credits bar, Stripe portal, plan cards.' },
        { type: 'new', text: 'Sprint 80: GDPR Art.15/17/20 coverage — IP vault, contracts, wellness, knowledge. Settings Privacy: Export JSON, Delete Wellness Data, Erase All Data.' },
        { type: 'new', text: 'Sprint 79: Cron brief wellness state + renewal alerts in every exec morning brief email. Command Centre wellness + renewals tiles.' },
        { type: 'new', text: 'Sprint 78: Morning brief — wellness state + IP/contract renewals in exec brief section.' },
        { type: 'new', text: 'Sprint 77: NemoClaw AI enriched with wellness, IP vault, contracts, knowledge context. 4 new AI shortcuts.' },
        { type: 'new', text: "Sprint 76: Dashboard wellness tile (mood/energy/stress, streak badge) + renewal alerts tile. Exec strip 5+2 layout." },
        { type: 'new', text: 'Sprint 75: M021 registered in migration runner. NemoClaw™ seed button in admin. Intelligence Hub rebuilt — 5 domain briefings + NemoClaw synthesis.' },
        { type: 'fix', text: 'Sprint 75: Admin page inlines all migration SQL — fixes Vercel filesystem read failure. TypeScript 0 errors.' },
      ],
    },
    {
      version: 'v3.0.2',
      date: 'March 2026',
      badge: null,
      badgeColor: 'var(--ai)',
      changes: [
        { type: 'new', text: 'DBA Chapter AI Writer (/platform/academic/writer) — NemoClaw™ section-by-section drafting, chapter section picker, word target selector.' },
        { type: 'new', text: 'Stakeholder CRM (/platform/stakeholders) — NemoClaw™ pre-meeting briefing, overdue follow-up alerts, relationship health scoring.' },
        { type: 'new', text: 'TSA™ Time Sovereignty v2 — visual time map grid, sovereignty score, protection zones.' },
        { type: 'new', text: 'Board Pack generator — financials, OKRs, IP vault, contracts, tasks with NemoClaw™ narrative + risk register.' },
        { type: 'new', text: 'Obsidian Command design system — true black #080808, Instrument Serif + DM Sans + DM Mono, 36 SVG sidebar icons.' },
        { type: 'fix', text: 'Design system: 341 token replacements — 100% pios-* coverage. Tasks API dedup fix.' },
      ],
    },
    {
      version: 'v2.9.0',
      date: 'March 2026',
      badge: null,
      badgeColor: 'var(--fm)',
      changes: [
        { type: 'new', text: 'Billing page — Stripe checkout, usage limits display, plan cards.' },
        { type: 'new', text: 'Executive OS: Contracts + Financial tabs live.' },
        { type: 'improve', text: 'Onboarding wizard — CEO/Founder PRIMARY persona with NemoClaw™ seed.' },
        { type: 'fix', text: 'Middleware Edge Runtime crash resolved. 14-day trial (was 3 days). Tasks sort controls fixed.' },
        { type: 'new', text: 'Global search ⌘K — cross-domain search across 8 data types. Mobile nav. Help page.' },
        { type: 'improve', text: 'Build: 0 TypeScript errors, 110 static pages.' },
      ],
    },
    {
      version: 'v2.8.0',
      date: 'February 2026',
      badge: null,
      badgeColor: '',
      changes: [
        { type: 'new', text: 'IP Vault — frameworks, trademarks, patents, 90-day renewal alerts.' },
        { type: 'new', text: 'Contract Register — full CRUD, expiry alerts, AI portfolio review.' },
        { type: 'new', text: 'Group P&L, SE-MIL Knowledge Base, Operator Config UI, Demo data seeder.' },
        { type: 'new', text: 'Consulting Frameworks expanded to 15 (UMS™, VFO™, CFE™, ADF™, GSM™, SPA™, RTE™, IML™).' },
        { type: 'fix', text: '1,569 TypeScript errors cleared. Next.js build clean.' },
      ],
    },
    {
      version: 'v2.7.0',
      date: 'January 2026',
      badge: null,
      badgeColor: '',
      changes: [
        { type: 'new', text: 'Professional persona wizard — Founder/CEO/Consultant paths.' },
        { type: 'new', text: 'Payroll Engine, Executive OS (OKRs, decisions, stakeholder CRM, EOSA™ brief), Time Sovereignty TSA™, Comms Hub BICA™.' },
        { type: 'improve', text: 'NemoClaw AI injects live platform context (tasks, OKRs, decisions, thesis).' },
      ],
    },
  ]

  const typeStyle: Record<string, { bg: string; color: string; label: string }> = {
    new:     { bg: 'rgba(34,197,94,0.1)',  color: 'var(--fm)',  label: 'New' },
    fix:     { bg: 'rgba(239,68,68,0.1)',  color: 'var(--dng)', label: 'Fix' },
    improve: { bg: 'var(--ai-subtle)',     color: 'var(--ai)',  label: 'Improved' },
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Platform Changelog</h1>
        <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>PIOS v3.0.3 · Sprint 85 · VeritasIQ Technologies Ltd</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 24 }}>
        {entries.map(entry => (
          <div key={entry.version} style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--pios-text)' }}>{entry.version}</span>
              {entry.badge && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: entry.badgeColor + '20', color: entry.badgeColor, border: `1px solid ${entry.badgeColor}40` }}>
                  {entry.badge}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--pios-dim)', marginLeft: 'auto' }}>{entry.date}</span>
            </div>
            <div style={{ padding: '12px 20px' }}>
              {entry.changes.map((change, i) => {
                const ts = typeStyle[change.type] ?? typeStyle.new
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '5px 0', borderBottom: i < entry.changes.length - 1 ? '1px solid var(--pios-border)' : 'none' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: ts.bg, color: ts.color, flexShrink: 0, marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                      {ts.label}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.5 }}>{change.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
