/**
 * /pricing — PIOS Pricing Page
 * Redesigned v3.0 | VeritasIQ Technologies Ltd
 */
import Link from 'next/link'

const PLANS = [
  {
    name: 'Student',
    price: '£9',
    period: '/mo',
    colour: '#26aee8',
    highlight: false,
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
    colour: '#9b87f5',
    highlight: true,
    badge: '★ Most popular',
    description: 'Full CEO / Founder OS — all 41 modules, 15 proprietary frameworks',
    features: [
      'Everything in Student',
      'Command Centre with 7am Daily AI Brief',
      'Payroll detect engine — auto-reconcile and remit',
      '15 NemoClaw™ frameworks (POM™, OAE™, SDL™…)',
      'Executive OS — OKRs, Decision Architecture, EOSA™',
      'IP Vault — register frameworks, trademarks, trade secrets',
      'Contract Register with 60-day renewal alerts',
      'Group P&L — aggregates expenses, payroll, contracts',
      'SE-MIL institutional knowledge base + RAG search',
      'Email AI triage + meeting intelligence',
      'Time Sovereignty Agent (TSA™)',
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
    colour: '#26c99a',
    highlight: false,
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
      'Dedicated onboarding and SLA',
      'Data processing agreement',
    ],
    cta: 'Contact sales',
    ctaHref: 'mailto:info@veritasiq.io?subject=PIOS Team Plan',
  },
]

const FAQS = [
  {
    q: 'What is the free trial?',
    a: 'All plans include a 14-day free trial. No credit card required. You get full access to your chosen plan during the trial period.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes — upgrade or downgrade at any time from Settings → Plan & AI Credits. Changes take effect immediately.',
  },
  {
    q: 'What are AI credits?',
    a: 'AI credits are consumed whenever PIOS uses Claude AI — for briefs, framework analyses, summaries, and NemoClaw responses. Credits reset monthly; unused credits do not roll over.',
  },
  {
    q: 'Are the consulting frameworks proprietary?',
    a: 'Yes. All 15 NemoClaw™ frameworks are original IP owned by VeritasIQ Technologies Ltd — they replace named third-party frameworks (BCG Matrix, McKinsey 7S, etc.) with zero IP exposure.',
  },
  {
    q: 'Is my data secure?',
    a: 'PIOS uses Supabase (AWS EU West) with row-level security. All data is encrypted in transit and at rest. We never use your data to train AI models.',
  },
]

const LOGOS = ['Academic', 'Consulting', 'Executive', 'Research', 'Operations']

export default function PricingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#08090c',
      color: '#eceef4',
      fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 40px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,9,12,0.85)', backdropFilter: 'blur(12px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, color: '#fff',
            boxShadow: '0 2px 10px rgba(155,135,245,0.3)',
          }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: '#eceef4' }}>PIOS</span>
          <span style={{ fontSize: 10, color: '#4a5068', letterSpacing: '0.04em' }}>by VeritasIQ</span>
        </Link>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Link href="/auth/login" style={{ fontSize: 13, color: '#7a8098', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
          <Link href="/auth/signup" style={{
            fontSize: 13, padding: '7px 16px',
            background: 'var(--ai, #9b87f5)',
            color: '#08090c', borderRadius: 8, textDecoration: 'none', fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            Start free trial →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', padding: '80px 20px 52px', position: 'relative', overflow: 'hidden' }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 500, height: 260, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(155,135,245,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 14px', borderRadius: 20, marginBottom: 24,
          background: 'rgba(155,135,245,0.08)', border: '1px solid rgba(155,135,245,0.15)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#9b87f5',
        }}>
          ◉ PIOS — Personal Intelligent Operating System
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, margin: '0 0 16px',
          letterSpacing: '-0.04em', lineHeight: 1.1, color: '#eceef4',
        }}>
          Simple, honest pricing.
        </h1>
        <p style={{
          fontSize: 17, color: '#7a8098', maxWidth: 480, margin: '0 auto 14px', lineHeight: 1.65,
        }}>
          From doctoral researcher to Fortune-500 founder — PIOS adapts to how you work.
        </p>
        <p style={{ fontSize: 12, color: '#4a5068', letterSpacing: '0.02em' }}>
          14-day free trial · No credit card · Cancel anytime
        </p>
      </div>

      {/* ── Plan cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20, maxWidth: 1080, margin: '0 auto', padding: '0 24px 72px',
      }}>
        {PLANS.map(plan => (
          <div key={plan.name} style={{
            background: plan.highlight ? 'linear-gradient(160deg, #161230 0%, #0e1117 100%)' : '#0e1117',
            border: `1px solid ${plan.highlight ? 'rgba(155,135,245,0.30)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 18,
            padding: '28px 26px 30px',
            display: 'flex', flexDirection: 'column',
            position: 'relative',
            boxShadow: plan.highlight ? '0 0 50px rgba(155,135,245,0.12), 0 4px 24px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                background: plan.colour, color: plan.highlight ? '#08090c' : '#fff',
                fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 20,
                whiteSpace: 'nowrap', letterSpacing: '0.04em',
              }}>{plan.badge}</div>
            )}

            {/* Plan header */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 6, marginBottom: 14,
                background: plan.colour + '18', border: `1px solid ${plan.colour}30`,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase' as const, color: plan.colour,
              }}>{plan.name}</div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{
                  fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em',
                  color: '#eceef4', lineHeight: 1,
                }}>{plan.price}</span>
                {plan.period && (
                  <span style={{ fontSize: 14, color: '#4a5068', fontWeight: 500 }}>{plan.period}</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#7a8098', margin: 0, lineHeight: 1.55 }}>
                {plan.description}
              </p>
            </div>

            {/* CTA */}
            <Link href={plan.ctaHref} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 0', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 700, marginBottom: 22, letterSpacing: '-0.01em',
              background: plan.highlight ? plan.colour : 'rgba(255,255,255,0.06)',
              color: plan.highlight ? '#08090c' : '#eceef4',
              border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.10)',
              transition: 'opacity 0.15s',
            }}>
              {plan.cta} {plan.highlight ? '→' : ''}
            </Link>

            {/* Features */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{
                    flexShrink: 0, width: 16, height: 16, borderRadius: '50%', marginTop: 1,
                    background: plan.colour + '18', border: `1px solid ${plan.colour}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: plan.colour, fontWeight: 800,
                  }}>✓</span>
                  <span style={{ fontSize: 13, color: '#b0b6c8', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Social proof strip ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '28px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        flexWrap: 'wrap',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <span style={{ fontSize: 11, color: '#4a5068', letterSpacing: '0.06em', marginRight: 8 }}>
          TRUSTED ACROSS
        </span>
        {LOGOS.map(l => (
          <span key={l} style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: '#7a8098', letterSpacing: '0.03em',
          }}>{l}</span>
        ))}
      </div>

      {/* ── FAQ ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '72px 24px 64px' }}>
        <h2 style={{
          fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 44,
          letterSpacing: '-0.04em', color: '#eceef4',
        }}>
          Frequently asked questions
        </h2>
        {FAQS.map((faq, i) => (
          <div key={i} style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '22px 0',
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, marginBottom: 8,
              letterSpacing: '-0.02em', color: '#eceef4',
            }}>{faq.q}</div>
            <div style={{ fontSize: 13, color: '#7a8098', lineHeight: 1.75 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      {/* ── CTA footer ── */}
      <div style={{
        textAlign: 'center', padding: '56px 20px 80px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
          width: 500, height: 200,
          background: 'radial-gradient(ellipse, rgba(155,135,245,0.09) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#9b87f5', marginBottom: 16, textTransform: 'uppercase' }}>
          Get started today
        </div>
        <h2 style={{
          fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, margin: '0 0 14px',
          letterSpacing: '-0.04em', color: '#eceef4',
        }}>
          Build your Operating System.
        </h2>
        <p style={{ fontSize: 15, color: '#7a8098', marginBottom: 32, lineHeight: 1.6 }}>
          Join founders, consultants, and researchers who run smarter with PIOS.
        </p>
        <Link href="/auth/signup" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '13px 32px', background: '#9b87f5',
          color: '#08090c', borderRadius: 12, textDecoration: 'none',
          fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em',
          boxShadow: '0 4px 24px rgba(155,135,245,0.3)',
        }}>
          Start your 14-day free trial →
        </Link>
        <p style={{ fontSize: 12, color: '#4a5068', marginTop: 16 }}>
          Questions?{' '}
          <a href="mailto:info@veritasiq.io" style={{ color: '#9b87f5', textDecoration: 'none', fontWeight: 600 }}>
            info@veritasiq.io
          </a>
        </p>
      </div>
    </div>
  )
}
