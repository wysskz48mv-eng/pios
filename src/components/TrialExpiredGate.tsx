'use client'
/**
 * TrialExpiredGate — full-screen block shown when trial has expired.
 * Rendered by PlatformShell when plan_status === 'canceled' and no active sub.
 * PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
 */
import Link from 'next/link'

const PLANS = [
  {
    key: 'student',
    name: 'Student',
    price: '$9',
    colour: '#6c8eff',
    features: ['Academic Lifecycle', 'AI Calendar', 'Personal Tasks', '2,000 AI credits/mo'],
  },
  {
    key: 'individual',
    name: 'Individual',
    price: '$19',
    colour: '#a78bfa',
    popular: true,
    features: ['Everything in Student', 'Gmail Triage', 'Projects + Expenses', 'PIOS AI Companion', '5,000 AI credits/mo'],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '$39',
    colour: '#22d3ee',
    features: ['Everything in Individual', 'FM Consulting Engine', '15,000 AI credits/mo', 'Priority support'],
  },
]

interface TrialExpiredGateProps {
  userName?: string
}

export function TrialExpiredGate({ userName }: TrialExpiredGateProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#060709',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Logo */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800, color: '#fff',
        marginBottom: 24,
      }}>P</div>

      <h1 style={{
        fontSize: 24, fontWeight: 700, color: '#fff',
        textAlign: 'center', marginBottom: 8,
      }}>
        Your free trial has ended
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.5)', fontSize: 15,
        textAlign: 'center', maxWidth: 420, lineHeight: 1.6, marginBottom: 40,
      }}>
        {userName ? `Thanks for trying PIOS, ${userName.split(' ')[0]}. ` : ''}
        Choose a plan to keep your data and continue where you left off.
      </p>

      {/* Plan cards */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 800, marginBottom: 32,
      }}>
        {PLANS.map(plan => (
          <div key={plan.key} style={{
            background: plan.popular ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${plan.popular ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 16, padding: '24px 20px',
            width: 220, flexShrink: 0,
            position: 'relative',
          }}>
            {plan.popular && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                background: '#a78bfa', color: '#fff', fontSize: 10, fontWeight: 700,
                padding: '3px 12px', borderRadius: 20, letterSpacing: 1, whiteSpace: 'nowrap',
              }}>MOST POPULAR</div>
            )}
            <div style={{ color: plan.colour, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              {plan.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.features.map(f => (
                <li key={f} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: plan.colour, marginTop: 1, flexShrink: 0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/api/stripe/checkout?plan=${plan.key}`}
              style={{
                display: 'block', textAlign: 'center',
                padding: '10px 0', borderRadius: 8,
                background: plan.popular ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontWeight: 600, fontSize: 13,
                textDecoration: 'none',
                border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Get started →
            </Link>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
        Your data is preserved for 30 days after trial expiry.
        Questions? <a href="mailto:info@sustain-intl.com" style={{ color: '#a78bfa' }}>Contact support</a>
      </p>
    </div>
  )
}
