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
    price: '£9',
    annual: '£7',
    period: '/mo',
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
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=starter',
  },
  {
    name: 'Pro',
    price: '£19',
    annual: '£15',
    period: '/mo',
    colour: '#a78bfa',
    highlight: false,
    headline: 'For postgraduates and independent professionals who need more AI.',
    description: 'Everything in Starter plus email triage, projects, expenses, and PIOS AI Companion.',
    features: [
      'Everything in Starter',
      'Gmail Triage + Email AI',
      'Projects + Expenses tracking',
      'PIOS AI Companion',
      'Coaching Engine (5 modes)',
      '5,000 AI interactions per month',
      '10 GB storage',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=pro',
  },
  {
    name: 'Executive',
    price: '£24',
    annual: '£19',
    period: '/mo',
    colour: '#9b87f5',
    highlight: true,
    badge: 'Most popular',
    headline: 'The back office for founders who\'d rather be building.',
    description: 'Everything you need to run the business — payroll, contracts, strategy, knowledge — without the chaos.',
    features: [
      '7am AI briefing so you start every day knowing what needs your attention',
      'Payroll that closes — auto-reconcile and remit, no more Sunday tie-outs',
      'Contract renewal alerts before they catch you out',
      'Institutional memory — every decision and framework stays when people leave',
      'Group P&L across all entities, no spreadsheets duct-taped together',
      'Email triage and meeting intelligence so you don\'t live in your inbox',
      'Calendar protection — block the time that matters before others fill it',
      '10,000 AI interactions per month',
    ],
    cta: 'Start free trial',
    ctaHref: '/auth/signup?plan=executive',
  },
  {
    name: 'Team',
    price: 'Custom',
    annual: 'Custom',
    period: '',
    colour: '#26c99a',
    highlight: false,
    badge: 'Enterprise',
    headline: 'One intelligence layer across your whole leadership team.',
    description: 'Shared knowledge, department admin, SSO, and a dedicated onboarding partner.',
    features: [
      'Shared knowledge base and research libraries across your team',
      'Department-level admin — see activity and usage across the org',
      'Single sign-on with Microsoft or Google',
      'White-label with your brand and custom domain',
      'Dedicated onboarding, SLA, and data processing agreement',
      'Unlimited AI interactions',
    ],
    cta: 'Contact us',
    ctaHref: 'mailto:info@veritasiq.io?subject=PIOS Team Plan',
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
          Everything you need to run the business — payroll, contracts, strategy, knowledge — without the chaos. One OS. From £9/month.
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

      {/* ── Bottom line ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 72px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(99,73,255,0.07)', border: '1px solid rgba(99,73,255,0.2)', borderRadius: 16, padding: '36px 32px' }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 12 }}>
            The bottom line
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 24 }}>
            £24/month is less than you'd spend on the coffee it takes to manually reconcile your payroll.
          </p>
          <Link href="/auth/signup" style={{ display: 'inline-block', padding: '13px 32px', borderRadius: 10, background: '#6349FF', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
            Start free trial →
          </Link>
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
        </div>
      </div>
    </div>
  )
}
