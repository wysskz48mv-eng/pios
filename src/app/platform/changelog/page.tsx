/**
 * /platform/changelog — PIOS Platform Changelog
 * Sprint history and feature releases
 * PIOS Sprint 51 | VeritasIQ Technologies Ltd
 */
export default function ChangelogPage() {
  const entries = [
    {
      version: 'v2.9.0',
      date: 'March 2026',
      badge: 'Latest',
      badgeColor: '#22c55e',
      changes: [
        { type: 'fix', text: 'Middleware Edge Runtime crash resolved — platform now fully accessible' },
        { type: 'fix', text: 'Pricing and onboarding pages unblocked for unauthenticated visitors' },
        { type: 'new', text: 'ErrorBoundary — page crashes show retry instead of blank screen' },
        { type: 'new', text: 'Mobile navigation — bottom nav bar on phones, hamburger menu' },
        { type: 'new', text: 'File upload API — PDF, Word, Excel, images up to 25 MB' },
        { type: 'new', text: 'Help page — module reference, keyboard shortcuts, FAQ' },
        { type: 'new', text: 'Loading pages — smooth transitions between routes' },
        { type: 'improve', text: 'Daily Brief now includes OKRs, open decisions, section headers' },
        { type: 'improve', text: 'NemoClaw AI training context injected into every chat response' },
        { type: 'improve', text: 'Weekly digest email now includes OKR health summary' },
        { type: 'improve', text: 'Command Centre shows OKR progress bar cards' },
        { type: 'improve', text: 'Smoke test extended to 18 checks (M019/M020/storage)' },
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
    new:     { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e', label: 'New' },
    fix:     { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', label: 'Fix' },
    improve: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', label: 'Improved' },
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
              {entry.changes.map((change, i) => {
                const ts = typeStyle[change.type]
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
