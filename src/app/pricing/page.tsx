/**
 * /pricing — PIOS Pricing Page
 * Human-friendly positioning v4.0 | VeritasIQ Technologies Ltd
 */
'use client'
import Link from 'next/link'
import { useState } from 'react'

const PLANS = [
  {
    name: 'Starter',
    price: '£15',
    annual: '£12',
    period: '/mo',
    savings: 'Save £36/year',
    colour: '#26aee8',
    highlight: false,
    headline: 'For doctoral and postgraduate researchers.',
    description: 'Stay on top of your thesis, CPD deadlines, and supervisor sessions — without a spreadsheet.',
    features: [
      'Thesis tracker with word counts, chapters, and milestone alerts',
      'Never miss a CPD deadline — supports 12 professional bodies',
      'Log every supervisor session, keep every action item',
      'AI that searches your uploaded papers, prevents repetition',
      'Viva prep with concept mapping and argument structure',
      '100 GB storage',
      'Email support',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=starter',
  },
  {
    name: 'Pro',
    price: '£35',
    annual: '£28',
    period: '/mo',
    savings: 'Save £84/year',
    colour: '#a78bfa',
    highlight: false,
    headline: 'For postgraduates and independent professionals who need more AI.',
    description: 'Everything in Starter plus email triage, projects, expenses, and PIOS AI Companion.',
    features: [
      'Everything in Starter',
      'Gmail Triage + Email AI (unlimited)',
      'Projects + Expenses tracking',
      'PIOS AI Companion (5 coaching modes)',
      '5,000 AI interactions per month',
      '500 GB storage',
      'Priority email support',
      'Research library with 10K+ papers',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=pro',
  },
  {
    name: 'Executive',
    price: '£45',
    annual: '£36',
    period: '/mo',
    savings: 'Save £108/year',
    colour: '#9b87f5',
    highlight: true,
    badge: 'Most popular',
    headline: 'The back office for founders who\'d rather be building.',
    description: 'Everything you need to run the business — payroll, contracts, strategy, knowledge — without the chaos. Built for founders, leaders, and decision-makers.',
    features: [
      '7am Daily Command Centre — AI briefing of priorities, risks, decisions',
      'Payroll that closes — auto-reconcile and remit payroll',
      'Contract renewal alerts before anything auto-renews',
      'Institutional memory — every decision and framework in searchable vault',
      'Group P&L across all entities and companies',
      'Email triage, meeting intelligence, and inbox management',
      'Calendar protection and time sovereignty tools',
      '10,000+ AI interactions per month',
      '1 TB storage',
      'Phone + email support (24/7)',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=executive',
  },
  {
    name: 'Team',
    price: '£12–15',
    annual: 'Custom',
    period: '/person/mo',
    colour: '#26c99a',
    highlight: false,
    badge: 'Organization',
    headline: 'One intelligence layer across your entire team or department.',
    description: 'Shared knowledge, team admin, SSO, compliance, and a dedicated onboarding partner. Starting at £12/person for 5–25 people, scaling to £15/person for 100–500 people.',
    features: [
      'Everything in Executive (all features unlocked)',
      'Shared knowledge base and research libraries',
      'Team-level admin dashboard with usage analytics',
      'Single sign-on (SSO) with Microsoft or Google',
      'White-label options available',
      'Team member provisioning and role management',
      'Email and Slack integrations',
      'Dedicated support team',
      'Data processing agreement (DPA) included',
      'Unlimited AI interactions',
    ],
    cta: 'Request Demo',
    ctaHref: 'mailto:sales@veritasiq.io?subject=PIOS Team Plan — [Company Name]',
  },
  {
    name: 'Enterprise',
    price: '£15–20',
    annual: 'Custom',
    period: '/person/mo',
    colour: '#ec4899',
    highlight: false,
    badge: 'Custom',
    headline: 'Custom deployment for large organizations, government, and universities.',
    description: 'White-label with your branding, custom domain, dedicated infrastructure, 24/7 support, and enterprise SLA guarantees.',
    features: [
      'Everything in Team plan',
      'White-label with custom domain and branding',
      'Dedicated infrastructure (private deployment)',
      '99.99% uptime SLA with dedicated incident commander',
      '24/7 phone + email support team',
      'Quarterly business reviews and optimization sessions',
      'Custom integrations with your systems',
      'Advanced security: IP allowlist, role-based access (RBAC)',
      'ISO 27001 & SOC 2 Type II attestation',
      'Data residency: UK, EU, or US (your choice)',
    ],
    cta: 'Contact Enterprise Sales',
    ctaHref: 'mailto:enterprise@veritasiq.io?subject=PIOS Enterprise Plan',
  },
]

const PAINS = [
  { icon: '⏰', text: 'You\'re the only one who knows how payroll works' },
  { icon: '📄', text: 'Contract renewals sneak up on you the day they bill' },
  { icon: '🧠', text: 'Key context walks out the door when someone leaves' },
  { icon: '📊', text: 'Financials live across three spreadsheets and a folder' },
  { icon: '📥', text: 'Your inbox is running you, not the other way around' },
  { icon: '📅', text: 'You feel like you\'re operating the business, not building it' },
]

const MODULES = [
  { emoji: '📡', name: 'Daily Command Centre', plain: 'A 7am AI briefing — your priorities, risks, and decisions, every morning before the noise starts.' },
  { emoji: '💷', name: 'Payroll Engine', plain: 'Auto-detect, reconcile, and remit. Payroll that closes without the Sunday spreadsheet panic.' },
  { emoji: '📄', name: 'Contract Register', plain: 'Every contract, every renewal date, with 60-day alerts before anything auto-renews or expires.' },
  { emoji: '🧠', name: 'Institutional Memory', plain: 'Every framework, decision, and trade secret in one searchable vault. Knowledge stays when people leave.' },
  { emoji: '📊', name: 'Group P&L', plain: 'One consolidated view across all your entities. Expenses, payroll, and contracts — aggregated automatically.' },
  { emoji: '📥', name: 'Inbox & Meeting Intelligence', plain: 'AI triage so you see what matters. Meeting summaries that capture decisions, not just who said what.' },
  { emoji: '📅', name: 'Time Sovereignty', plain: 'Protect your deep-work time before others fill it. A visual map of where your hours actually go.' },
]

const FAQS = [
  {
    q: 'Who is this for?',
    a: 'Solo founders and CEOs of companies with 1–50 people who are still the default operator for too many things. If payroll, contracts, strategy, and institutional knowledge all live in your head — this is your back office in a box.',
  },
  {
    q: 'What does the free trial include?',
    a: 'Full access to your chosen plan for 14 days. No credit card. No cancellation flow. Just stop using it if it\'s not for you.',
  },
  {
    q: 'What does the AI actually do differently?',
    a: 'It reads your CV, learns your industry and working style, and uses that context every time. It\'s not a generic assistant. It knows whether you\'re a GCC property founder or a London VC — and it responds accordingly. Every morning it briefs you on your actual situation, not a template.',
  },
  {
    q: 'What about the strategic frameworks?',
    a: 'We don\'t give you 15 frameworks with trademarked names just to sound smart. We give you the output: fewer surprises, cleaner books, more focused time, and a business that doesn\'t break when you stop micromanaging it.',
  },
  {
    q: 'Where is my data?',
    a: 'EU West (AWS). Encrypted in transit and at rest. We do not train on your data. Export or delete everything from Settings at any time.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes. Settings → Billing, effective immediately.',
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ background: '#080808', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f4f4f5' }}>

      {/* ── Nav ── */}
      <nav style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,73,255,0.15)', border: '1px solid rgba(99,73,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 900, color: 'rgba(130,108,255,0.9)' }}>P</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>PIOS</span>
        </Link>
        <Link href="/auth/signup" style={{ padding: '9px 20px', borderRadius: 9, background: '#6349FF', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
          Start free trial →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', padding: '72px 24px 52px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9b87f5', background: 'rgba(99,73,255,0.1)', border: '1px solid rgba(99,73,255,0.2)', padding: '4px 14px', borderRadius: 20, marginBottom: 24 }}>
          Simple pricing
        </div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 'clamp(36px,5vw,54px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 18 }}>
          The back office for founders<br />
          <em style={{ fontStyle: 'italic', color: 'rgba(155,135,245,0.9)' }}>who'd rather be building.</em>
        </h1>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 14 }}>
          Everything you need to run the business — payroll, contracts, strategy, knowledge — without the chaos. One OS. From £15/month.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>
          14-day free trial · No credit card · Cancel anytime
        </p>

        {/* Annual toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28 }}>
          <span style={{ fontSize: 13, color: annual ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)', fontWeight: annual ? 400 : 600 }}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
              background: annual ? '#6349FF' : 'rgba(255,255,255,0.12)', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: annual ? 23 : 3, width: 18, height: 18,
              borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: 13, color: annual ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)', fontWeight: annual ? 600 : 400 }}>
            Annual <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Save 20%</span>
          </span>
        </div>
      </div>

      {/* ── Plan cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 1040, margin: '0 auto', padding: '0 24px 64px' }}>
        {PLANS.map(plan => (
          <div key={plan.name} style={{
            background: plan.highlight ? 'linear-gradient(135deg, rgba(99,73,255,0.08), rgba(79,142,247,0.05))' : 'rgba(255,255,255,0.025)',
            border: `1px solid ${plan.highlight ? 'rgba(99,73,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 16, padding: '28px 24px', position: 'relative', display: 'flex', flexDirection: 'column',
          }}>
            {plan.badge && (
              <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: plan.colour, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                {plan.badge}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: plan.colour, marginBottom: 10 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 38, fontWeight: 400, color: '#fff', letterSpacing: '-0.03em' }}>
                  {plan.price === 'Custom' ? 'Custom' : (annual ? plan.annual : plan.price)}
                </span>
                {plan.period && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>{plan.period}</span>}
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{plan.headline}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>{plan.description}</p>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ color: plan.colour, fontSize: 12, marginTop: 2, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>

            <Link href={plan.ctaHref} style={{
              display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 10,
              background: plan.highlight ? '#6349FF' : 'rgba(255,255,255,0.06)',
              border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.12)',
              color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600,
              transition: 'opacity 0.15s',
            }}>
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* ── Pain points ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 10 }}>
            If any of these sound familiar…
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>…you're exactly who this is built for.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {PAINS.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── What it is in plain language ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 72px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 10 }}>
            What it actually does
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 520, margin: '0 auto' }}>Most founder tools are point solutions. This is the opposite — seven things that keep you out of flow state, handled.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {MODULES.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 0', borderBottom: i < MODULES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontSize: 22, flexShrink: 0, width: 32 }}>{m.emoji}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{m.plain}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Comparison vs Competitors ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            How PIOS compares
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Why founders choose PIOS over task managers and spreadsheets</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '12px 0', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 12 }}>Feature</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#6349FF', fontWeight: 700 }}>PIOS</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.4)' }}>Notion</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.4)' }}>Asana</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.4)' }}>Monday</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'AI Decision Support', pios: '✓', notion: '△', asana: '△', monday: '△' },
                { feature: 'Email Triage', pios: '✓', notion: '✗', asana: '✗', monday: '✗' },
                { feature: 'Coaching Engine', pios: '✓', notion: '✗', asana: '✗', monday: '✗' },
                { feature: 'Payroll Management', pios: '✓', notion: '✗', asana: '✗', monday: '✗' },
                { feature: 'Contract Alerts', pios: '✓', notion: '✗', asana: '✗', monday: '✗' },
                { feature: 'Meeting Intelligence', pios: '✓', notion: '△', asana: '△', monday: '△' },
                { feature: 'Research Library', pios: '✓', notion: '△', asana: '✗', monday: '✗' },
                { feature: 'Task Management', pios: '✓', notion: '✓', asana: '✓', monday: '✓' },
                { feature: 'Database/Wiki', pios: '✓', notion: '✓', asana: '△', monday: '△' },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 0', color: 'rgba(255,255,255,0.7)' }}>{row.feature}</td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', color: row.pios === '✓' ? '#10d9a0' : 'rgba(255,255,255,0.4)' }}>{row.pios}</td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.3)' }}>{row.notion}</td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.3)' }}>{row.asana}</td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', color: 'rgba(255,255,255,0.3)' }}>{row.monday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 24, textAlign: 'center' }}>
          ✓ = Full support  |  △ = Limited/via integration  |  ✗ = Not available
        </p>
      </div>

      {/* ── Operating Costs & Transparency ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            Transparent pricing
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>All-inclusive costs. No surprise bills. Real-time usage tracking.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {[
            { title: 'What\'s Included', items: ['All platform features', 'Hosting & infrastructure', 'AI interactions (5K–10K+/mo)', 'Email integrations', 'Data backups', '24/7 monitoring'] },
            { title: 'What\'s Optional', items: ['Overage AI tokens: £0.02/1K', 'White-label domain: +£100/mo', 'Advanced SLA (99.99%): +£500/mo', 'Custom integrations: Quote separately', 'Enterprise support: Included at scale'] },
            { title: 'Cost Visibility', items: ['Real-time AI usage dashboard', 'Monthly cost forecasting', 'Usage alerts at 80% limit', 'No surprise invoices', 'Export cost reports anytime'] },
          ].map((section, i) => (
            <div key={i} style={{ background: 'rgba(99,73,255,0.05)', border: '1px solid rgba(99,73,255,0.15)', borderRadius: 12, padding: '24px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{section.title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {section.items.map((item, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#10d9a0', flexShrink: 0 }}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Enterprise & Organization ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            Organization & Enterprise
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Flexible pricing scaled for departments, institutions, and large organizations</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { name: 'Department', size: '5–25 people', price: '£10/person', annual: '£8.50/person (annual)', features: ['Team admin', 'Shared knowledge', 'Basic SSO', 'Email support'] },
            { name: 'Team', size: '25–100 people', price: '£12/person', annual: '£10/person (annual)', features: ['Everything in Department', 'Advanced analytics', 'Priority support', 'Integrations'] },
            { name: 'Organization', size: '100–500 people', price: '£15/person', annual: '£12/person (annual)', features: ['Everything in Team', 'White-label options', 'DPA included', 'Compliance features'] },
            { name: 'Enterprise', size: '500+ people', price: '£15–20/person', annual: 'Custom (3-year)', features: ['Custom deployment', '99.99% SLA', '24/7 support', 'Dedicated team'] },
          ].map((tier, i) => (
            <div key={i} style={{ background: 'rgba(99,73,255,0.05)', border: '1px solid rgba(99,73,255,0.15)', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{tier.name}</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>{tier.size}</p>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#6349FF', margin: '4px 0' }}>{tier.price}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '4px 0' }}>{tier.annual}</p>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {tier.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#10d9a0' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
            For organizations, <strong>volume discounts and multi-year commitments available</strong>. Contact sales for custom pricing.
          </p>
          <a href="mailto:sales@veritasiq.io?subject=Organization Pricing Inquiry" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 10, background: 'rgba(99,73,255,0.2)', border: '1px solid rgba(99,73,255,0.5)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }}>
            Request Organization Quote →
          </a>
        </div>
      </div>

      {/* ── Security & Compliance ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            Enterprise-ready security
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ISO 27001, SOC 2, GDPR, and compliance audit logs included</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { icon: '🔐', title: 'Certifications', desc: 'ISO 27001, SOC 2 Type II, GDPR compliant, UK Data Residency' },
            { icon: '📋', title: 'Audit Logs', desc: '2-year retention, 24/7 monitoring, tamper-proof trail, exportable' },
            { icon: '📊', title: 'Uptime SLA', desc: '99.5% (Standard), 99.9% (Team), 99.99% (Enterprise)' },
            { icon: '🤝', title: 'Data Agreements', desc: 'Standard DPA included, can sign your template, <5 day turnaround' },
            { icon: '🔄', title: 'Disaster Recovery', desc: 'Hourly backups, RTO <1 hour, RPO <15 minutes' },
            { icon: '🛡️', title: 'Encryption', desc: 'TLS 1.3 in transit, AES-256 at rest, FIPS-140-2 ready' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(99,73,255,0.05)', border: '1px solid rgba(99,73,255,0.15)', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom line ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px 72px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(99,73,255,0.07)', border: '1px solid rgba(99,73,255,0.2)', borderRadius: 16, padding: '36px 32px' }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            The bottom line
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 12 }}>
            Individual plans start at £15/month. Organization pricing from £8/person. Enterprise custom.
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            Every plan includes AI interactions, hosting, backups, and monitoring. No hidden costs.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <Link href="/auth/signup" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 10, background: '#6349FF', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Start free trial →
            </Link>
            <a href="mailto:sales@veritasiq.io?subject=Pricing Question" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 10, background: 'rgba(99,73,255,0.15)', border: '1px solid rgba(99,73,255,0.3)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Contact sales
            </a>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 12, letterSpacing: '0.02em' }}>
            14 days free · No credit card · Cancel anytime
          </p>
        </div>
      </div>

      {/* ── FAQs ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 96px' }}>
        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 24, textAlign: 'center' }}>Questions</h2>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{ width: '100%', textAlign: 'left', padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{faq.q}</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', flexShrink: 0, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
            </button>
            {openFaq === i && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, paddingBottom: 18, margin: 0 }}>{faq.a}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© 2026 VeritasIQ Technologies Ltd · info@veritasiq.io</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/privacy" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/cookies" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>Cookies</Link>
        </div>
      </div>
    </div>
  )
}
