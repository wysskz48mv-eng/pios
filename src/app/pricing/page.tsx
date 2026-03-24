/**
 * /pricing — PIOS Pricing Page
 * Public-facing pricing and feature comparison
 * PIOS Sprint 43 | VeritasIQ Technologies Ltd
 */
import Link from 'next/link'

const PLANS = [
  {
    name: 'Student',
    price: '£9',
    period: '/mo',
    colour: '#0891b2',
    badge: null,
    description: 'Academic lifecycle, CPD tracking, and AI research tools',
    features: [
      'Academic Hub — thesis chapters, milestones, word targets',
      'CPD Tracker — 12 professional bodies supported',
      'Supervisor session log with AI summaries',
      'DBA / PhD milestone engine (14 milestones)',
      'Research Hub + literature AI + citation guard',
      'Viva preparation and concept mapping',
      'Study timer with Pomodoro mode',
      '2,000 AI credits / month',
      '5 GB file storage',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=student',
  },
  {
    name: 'Professional',
    price: '£24',
    period: '/mo',
    colour: '#7c3aed',
    badge: '★ Most popular',
    description: 'Full CEO / Founder OS — all 41 modules, 15 proprietary frameworks',
    features: [
      'Everything in Student',
      'Command Centre — live cockpit with 7am Daily AI Brief',
      'Payroll detect engine — auto-reconcile and remit',
      '15 NemoClaw™ consulting frameworks (POM™, OAE™, SDL™…)',
      'Executive OS — OKR tracking, Decision Architecture, EOSA™',
      'IP Vault — register frameworks, trademarks, trade secrets',
      'Contract Register — full CRUD with 60-day renewal alerts',
      'Group P&L — aggregates expenses, payroll, contracts',
      'SE-MIL Knowledge Base — institutional memory + RAG search',
      'Email AI triage + meeting intelligence (6 action templates)',
      'Time Sovereignty Agent (TSA™)',
      'Board Report Pack — one-click AI board brief',
      '10,000 AI credits / month',
      '20 GB storage + 3 guest collaborators',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=professional',
  },
  {
    name: 'Team',
    price: 'Custom',
    period: '',
    colour: '#0d9488',
    badge: 'Enterprise',
    description: 'Institution / team — shared workspaces, SSO, department admin',
    features: [
      'Everything in Professional',
      'Shared research workspaces',
      'Department-level admin panel',
      'SSO / institutional login (SAML, Azure AD)',
      'Team citation libraries and shared knowledge base',
      'Cohort dashboard for supervisors',
      'White-label branding and custom domain',
      'Unlimited AI credits',
      'Dedicated onboarding and support',
      'SLA and data processing agreement',
    ],
    cta: 'Contact sales',
    ctaHref: 'mailto:info@veritasiq.io?subject=PIOS Team Plan',
  },
]

const FAQS = [
  {
    q: 'What is the free trial?',
    a: 'All plans include a 14-day free trial. No credit card required to start. You get full access to your chosen plan during the trial.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes — upgrade or downgrade at any time from Settings → Plan & AI Credits. Changes take effect immediately.',
  },
  {
    q: 'What are AI credits?',
    a: 'AI credits are consumed whenever PIOS uses Claude AI — for briefs, framework analyses, summaries, and NemoClaw responses. Credits reset monthly. Unused credits do not roll over.',
  },
  {
    q: 'Are the consulting frameworks proprietary?',
    a: 'Yes. All 15 NemoClaw™ frameworks (POM™, OAE™, SDL™, CVDM™, CPA™, UMS™, VFO™, CFE™, ADF™, GSM™, SPA™, RTE™, IML™, SCE™, AAM™) are original IP owned by VeritasIQ Technologies Ltd. They replace named third-party frameworks (BCG Matrix, McKinsey 7S, PESTLE, etc.) with zero IP risk.',
  },
  {
    q: 'Is my data secure?',
    a: 'PIOS uses Supabase (hosted on AWS EU) for data storage with row-level security. All data is encrypted in transit and at rest. We never train AI models on your data.',
  },
]

export default function PricingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#070C12',
      color: '#F1F5F9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>PIOS</span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>by VeritasIQ</span>
        </Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/auth/login" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/signup" style={{ fontSize: 13, padding: '7px 16px', background: '#7c3aed', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
            Start free trial →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '72px 20px 48px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7c3aed', fontWeight: 700, marginBottom: 16 }}>
          PIOS — Personal Intelligent Operating System
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          Simple, honest pricing.
        </h1>
        <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 520, margin: '0 auto 12px', lineHeight: 1.6 }}>
          From doctoral researcher to Fortune-500 founder — PIOS adapts to how you work.
        </p>
        <p style={{ fontSize: 13, color: '#475569' }}>14-day free trial · No credit card required · Cancel anytime</p>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1080, margin: '0 auto', padding: '0 24px 80px' }}>
        {PLANS.map(plan => (
          <div key={plan.name} style={{
            background: '#0F1A26',
            border: `1px solid ${plan.badge === '★ Most popular' ? plan.colour + '60' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 16,
            padding: '28px 28px 32px',
            display: 'flex',
            flexDirection: 'column' as const,
            position: 'relative' as const,
            boxShadow: plan.badge === '★ Most popular' ? `0 0 40px ${plan.colour}20` : 'none',
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                background: plan.colour, color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' as const,
              }}>
                {plan.badge}
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: plan.colour, marginBottom: 6 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px' }}>{plan.price}</span>
                {plan.period && <span style={{ fontSize: 14, color: '#64748b' }}>{plan.period}</span>}
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{plan.description}</p>
            </div>

            <Link href={plan.ctaHref} style={{
              display: 'block', textAlign: 'center', padding: '11px 0',
              background: plan.badge === '★ Most popular' ? plan.colour : 'rgba(255,255,255,0.06)',
              color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontSize: 14, fontWeight: 700, marginBottom: 24,
              border: `1px solid ${plan.badge === '★ Most popular' ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {plan.cta}
            </Link>

            <div style={{ flex: 1 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: plan.colour, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40, letterSpacing: '-0.5px' }}>
          Frequently asked questions
        </h2>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{faq.q}</div>
            <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      {/* CTA footer */}
      <div style={{ textAlign: 'center', padding: '48px 20px 72px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
          Ready to build your Operating System?
        </h2>
        <p style={{ fontSize: 16, color: '#64748b', marginBottom: 28 }}>Join founders, consultants, and researchers who run smarter with PIOS.</p>
        <Link href="/auth/signup" style={{
          display: 'inline-block', padding: '14px 36px', background: '#7c3aed',
          color: '#fff', borderRadius: 10, textDecoration: 'none',
          fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px',
        }}>
          Start your 14-day free trial →
        </Link>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 12 }}>
          Questions? <a href="mailto:info@veritasiq.io" style={{ color: '#7c3aed', textDecoration: 'none' }}>info@veritasiq.io</a>
        </p>
      </div>
    </div>
  )
}
