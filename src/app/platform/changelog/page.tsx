/**
 * /platform/changelog — PIOS Platform Changelog
 * Sprint history and feature releases
 * PIOS Sprint 51 | VeritasIQ Technologies Ltd
 */
export default function ChangelogPage() {
  const entries = [
    {
      version: 'v3.0.2',
      date: 'March 2026',
      badge: 'Latest',
      badgeColor: 'var(--ai)',
      items: [
        { type: 'fix', text: "UIX consistency pass: 6 pages migrated from Tailwind opacity utilities to pios design tokens — comms, executive, financials, intelligence, operator, time-sovereignty" },
        { type: 'fix', text: "246 class replacements: bg-[var(--pios-surface2)]→var(--pios-surface2), border-[var(--pios-border2)]→var(--pios-border2), text-foreground→var(--pios-text) etc." },
      ],
    },
    {
      version: 'v3.0.0',
      date: 'March 2026',
      badge: '',
      badgeColor: 'var(--ai)',
      changes: [
        { type: 'new', text: "Sprint 84: NemoClaw™ calibration status card in AI sidebar — shows calibration summary, seniority, industry, recommended frameworks; prompts CV upload if uncalibrated" },
        { type: 'new', text: "Sprint 84: AI welcome message is calibration-aware — hints CV upload when NemoClaw is not yet calibrated" },
        { type: 'new', text: "Sprint 84: Migration M023 — nemoclaw_calibration index + ai_sessions index + ai_credits_resets audit table" },
        { type: 'fix', text: "Sprint 84: Migration runner updated with M023 entry" },
        { type: 'new', text: "Sprint 83: Financials — Add Snapshot form (period, revenue, expenses, payroll, cash, receivables, payables) wired to /api/financials save_snapshot" },
        { type: 'new', text: 'Sprint 82: Smart notification engine — IP/contract renewals, wellness streak break, overdue tasks, trial expiry — all deduplicated by day' },
        { type: 'new', text: 'Sprint 82: Notifications page v2 — Scan for alerts button, category/domain filters, per-item delete, body text, action links' },
        { type: 'new', text: 'Sprint 82: Notifications PATCH handler — mark individual notifications read without full POST' },
        { type: 'new', text: 'Sprint 81: Billing page v3 — trial countdown, AI credits bar, Stripe portal, plan cards (Student/Professional/Team), fixed double PlatformShell' },
        { type: 'new', text: 'Sprint 80: GDPR M019/M020/M021 coverage — IP vault, contracts, wellness, knowledge all covered under Art.15/17/20' },
        { type: 'new', text: "Sprint 80: Settings Privacy section — Export JSON, Delete Wellness Data, Erase All Data (each with confirm dialogs)" },
        { type: 'new', text: 'Sprint 80: Weekly digest wellness — avg mood/energy/stress for the week + 30-day renewal alerts in AI insight' },
        { type: 'new', text: 'Sprint 79: Cron brief wellness state + renewal alerts injected into every exec morning brief email' },
        { type: 'new', text: 'Sprint 79: Command Centre wellness tile + renewal alerts tile below OKR pulse' },
        { type: 'new', text: 'Sprint 78: Morning brief /api/brief — wellness state + IP/contract renewals in exec brief section' },
        { type: 'new', text: 'Sprint 77: NemoClaw AI enriched with wellness, IP vault, contracts and knowledge context — AI companion now sees your full operational state' },
        { type: 'new', text: 'Sprint 77: 4 new AI shortcuts — Wellness + performance link, IP portfolio review, Contract risk scan, Knowledge base insight' },
        { type: 'new', text: "Sprint 76: Dashboard wellness tile — today's mood/energy/stress scores, check-in CTA, 🔥 streak badge" },
        { type: 'new', text: 'Sprint 76: Dashboard renewal alerts tile — IP assets + contracts expiring in 90 days, colour-coded with expiry dates' },
        { type: 'new', text: 'Sprint 76: Dashboard exec strip expanded to 5+2 tile layout (row 1: OKRs/Decisions/Stakeholders/IP/Contracts; row 2: Wellness + Renewals)' },
        { type: 'new', text: 'Sprint 75: M021 (wellness tables) registered in migration runner — runnable via /platform/admin' },
        { type: 'new', text: 'Sprint 75: NemoClaw™ seed button in /platform/admin — one-click seeds all 15 frameworks into IP Vault' },
        { type: 'new', text: 'Sprint 75: Intelligence Hub rebuilt — 5 AI domain briefings (FM, Academic, SaaS, Regulatory, GCC), NemoClaw synthesis, SO WHAT callouts' },
        { type: 'new', text: 'Sprint 75: /api/intelligence/briefing — domain-tuned AI briefing engine for UK/GCC FM + SaaS context' },
        { type: 'fix',  text: 'Admin page: inline all migration SQL — fixes Vercel filesystem read failure on /api/admin/migrate' },
        { type: 'fix',  text: 'TypeScript: 0 errors across all source files (was 2 in admin page)' },
      ],
    },
    {
      version: 'v2.9.0',
      date: 'March 2026',
      badge: null,
      badgeColor: 'var(--fm)',
      changes: [
        { type: 'new', text: 'Billing page — plan cards (Student/Individual/Team), Stripe checkout, usage limits display' },
        { type: 'new', text: 'Executive OS: Contracts tab (live data, status badges) + Financial tab (Group P&L summary)' },
        { type: 'new', text: 'Payroll: Edit and remove staff members inline (✎ / ✕ per card)' },
        { type: 'improve', text: 'Onboarding wizard — CEO/Founder PRIMARY persona with NemoClaw™ seed on completion' },
        { type: 'fix', text: 'Middleware Edge Runtime crash — platform now fully accessible (MIDDLEWARE_INVOCATION_FAILED)' },
        { type: 'fix', text: 'Pricing and onboarding pages unblocked for unauthenticated visitors' },
        { type: 'fix', text: '14-day trial (was 3 days) — new signups get individual plan with full access' },
        { type: 'fix', text: 'Tasks sort controls — sortBy state was undeclared, buttons now work' },
        { type: 'fix', text: 'Email page — showed "Gmail connected" even with 0 accounts wired up' },
        { type: 'new', text: 'M019/M020 fully runnable from Admin panel — IP Vault, Contracts, P&L, SE-MIL' },
        { type: 'new', text: 'ErrorBoundary — any page crash shows retry UI instead of blank screen' },
        { type: 'new', text: 'Mobile navigation — bottom nav bar on phones, hamburger full-menu overlay' },
        { type: 'new', text: 'File upload API — PDF, Word, Excel, images up to 25 MB with signed URLs' },
        { type: 'new', text: 'Help page — 22-module reference, keyboard shortcuts, 5-item FAQ' },
        { type: 'new', text: 'Changelog page — full sprint history with New/Fix/Improved labels' },
        { type: 'new', text: 'Gmail OAuth connect route — one-click Gmail connection from email page' },
        { type: 'new', text: 'First-time welcome banner on dashboard with 5 quick-start actions' },
        { type: 'improve', text: 'Daily Brief: OKRs + open decisions included, ## section card renderer' },
        { type: 'improve', text: 'NemoClaw AI: training config context injected into every chat response' },
        { type: 'improve', text: 'Sidebar: EOSA™/CSA™/BICA™/TSA™ badge labels now visible, notification count pill' },
        { type: 'improve', text: 'Weekly digest email includes OKR health summary and at-risk flag' },
        { type: 'improve', text: 'Command Centre: OKR progress bar cards with health status' },
        { type: 'improve', text: 'Smoke test extended to 19 checks (M019/M020/storage/DIRECT_URL)' },
        { type: 'new', text: 'Global search ⌘K — real-time cross-domain search across 8 data types' },
        { type: 'improve', text: 'AI chat and morning brief now include today\'s calendar schedule' },
        { type: 'improve', text: 'Vercel timeouts configured for 18 routes (AI operations no longer cut off)' },
        { type: 'improve', text: 'Build: 0 TypeScript errors, 0 ESLint warnings, 110 static pages' },
      ],
    },
    {
      version: 'v2.8.0',
      date: 'February 2026',
      badge: null,
      badgeColor: '',
      changes: [
        { type: 'new', text: 'IP Vault — register frameworks, trademarks, patents. 90-day renewal alerts' },
        { type: 'new', text: 'Contract Register — full CRUD, expiry alerts, AI portfolio review' },
        { type: 'new', text: 'Group P&L — aggregated expenses, payroll, and contract pipeline' },
        { type: 'new', text: 'SE-MIL Knowledge Base — semantic search, AI summarisation, add entries' },
        { type: 'new', text: 'Executive Report Pack — one-click board brief from OKRs and decisions' },
        { type: 'new', text: 'IP Vault Seed — one-click seeds all 15 NemoClaw™ frameworks' },
        { type: 'new', text: 'Consulting Frameworks expanded to 15 (UMS™, VFO™, CFE™, ADF™, GSM™, SPA™, RTE™, IML™)' },
        { type: 'new', text: 'Operator Config UI — white-label branding, feature flags, custom domain' },
        { type: 'new', text: 'NemoClaw Training Agent — configure AI context, tone, response style' },
        { type: 'new', text: 'Demo data seeder — realistic CEO data for demos and onboarding' },
        { type: 'new', text: 'Public pricing page — Student $9 / Professional $24 / Team custom' },
        { type: 'new', text: 'Dashboard CEO grid — all 32 modules accessible from dashboard' },
        { type: 'fix', text: '1,569 TypeScript errors cleared (1569 → 0)' },
        { type: 'fix', text: 'Next.js build clean — 0 errors, 0 warnings, 107 pages' },
      ],
    },
    {
      version: 'v2.7.0',
      date: 'January 2026',
      badge: null,
      badgeColor: '',
      changes: [
        { type: 'new', text: 'Professional persona wizard — Founder/CEO/Consultant paths added' },
        { type: 'new', text: 'Onboarding wizard Business step for company name, sector, currency' },
        { type: 'new', text: 'Onboarding redirects Professional users to dashboard (not Learning)' },
        { type: 'new', text: 'Payroll Engine — detect, approve, remit, chase contractor payments' },
        { type: 'new', text: 'Executive OS — OKRs, open decisions, stakeholder CRM, EOSA™ brief' },
        { type: 'new', text: 'Time Sovereignty — TSA™ time audit engine' },
        { type: 'new', text: 'Comms Hub — BICA™ board and stakeholder communications' },
        { type: 'improve', text: 'NemoClaw AI injects live platform context (tasks, OKRs, decisions, thesis)' },
      ],
    },
  ]

  const typeStyle: Record<string, { bg: string; color: string; label: string }> = {
    new:     { bg: 'rgba(34,197,94,0.1)',   color: 'var(--fm)', label: 'New' },
    fix:     { bg: 'rgba(239,68,68,0.1)',   color: 'var(--dng)', label: 'Fix' },
    improve: { bg: 'var(--ai-subtle)', color: 'var(--ai)', label: 'Improved' },
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Platform Changelog</h1>
        <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>PIOS — what&apos;s new in each release</p>
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
              {(entry.changes ?? []).map((change, i) => {
                const ts = typeStyle[change.type]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '5px 0', borderBottom: i < (entry.changes ?? []).length - 1 ? '1px solid var(--pios-border)' : 'none' }}>
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
