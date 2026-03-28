'use client'
/**
 * /platform/trial-expired — shown when trial has ended
 * VeritasIQ Technologies Ltd · PIOS
 */
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    name:     'Starter',
    price:    '£29',
    period:   '/month',
    color:    '#22d3ee',
    features: [
      '100 AI credits per month',
      'All core platform modules',
      'NemoClaw™ AI calibration',
      'Morning brief email',
      'Tasks, OKRs, decisions',
    ],
  },
  {
    name:     'Pro',
    price:    '£79',
    period:   '/month',
    color:    '#8b7cf8',
    popular:  true,
    features: [
      '500 AI credits per month',
      'All 13 NemoClaw™ frameworks',
      'Content Studio pipeline',
      'Cross-platform sync',
      'Market intelligence feed',
      'Priority support',
    ],
  },
  {
    name:     'Enterprise',
    price:    '£199',
    period:   '/month',
    color:    '#10d9a0',
    features: [
      'Unlimited AI credits',
      'White-label options',
      'Dedicated onboarding',
      'SLA guarantee',
      'Custom integrations',
    ],
  },
]

export default function TrialExpiredPage() {
  const router = useRouter()

  return (
    <div style={{
      maxWidth: 860,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: 'var(--pios-text)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, paddingTop: 20 }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 16px', borderRadius: 20,
          background: 'rgba(240,160,48,0.1)',
          border: '1px solid rgba(240,160,48,0.3)',
          fontSize: 12, fontWeight: 700, color: '#f0a030',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          Trial ended
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 800, margin: '0 0 12px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          letterSpacing: '-0.02em', color: 'var(--pios-text)',
        }}>
          Your 3-day trial has ended.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--pios-muted)', maxWidth: 480, margin: '0 auto' }}>
          Upgrade to keep your OKRs, decisions, NemoClaw™ calibration, and morning brief running. Everything you built is waiting.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {PLANS.map(plan => (
          <div
            key={plan.name}
            style={{
              padding: '24px 20px',
              borderRadius: 12,
              border: `1px solid ${plan.popular ? plan.color + '50' : 'var(--pios-border)'}`,
              background: plan.popular ? `${plan.color}08` : 'rgba(255,255,255,0.02)',
              position: 'relative',
            }}
          >
            {plan.popular && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                padding: '3px 12px', borderRadius: 10,
                background: plan.color, color: '#fff',
                fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                Most popular
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: plan.color, marginBottom: 6 }}>
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 28, fontWeight: 800, color: 'var(--pios-text)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em',
                }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{plan.period}</span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: plan.color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push(`/platform/billing?plan=${plan.name.toLowerCase()}`)}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: plan.popular ? plan.color : 'transparent',
                color: plan.popular ? '#fff' : plan.color,
                border: `1px solid ${plan.color}`,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: 'all 0.15s',
              }}
            >
              Choose {plan.name}
            </button>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--pios-dim)', marginBottom: 12 }}>
          Questions? Email us at{' '}
          <a href="mailto:info@veritasiq.io" style={{ color: 'var(--ai)', textDecoration: 'none' }}>
            info@veritasiq.io
          </a>
        </p>
        <button
          onClick={() => router.push('/auth/signin')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--pios-dim)', textDecoration: 'underline',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
