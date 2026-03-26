/**
 * /platform/billing — Plan, usage, Stripe management
 * PIOS v3.0 | Sprint 81 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type TenantData = {
  plan?: string
  plan_status?: string
  subscription_status?: string
  ai_credits_used?: number
  ai_credits_limit?: number
  trial_ends_at?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
}

type ProfileData = {
  billing_email?: string
  google_email?: string
  full_name?: string
}

// ─── Plan config ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'student',
    name: 'Student',
    price: 9,
    currency: '£',
    color: '#6b7280',
    description: 'Academic lifecycle, thesis & CPD',
    credits: 2000,
    features: [
      'Academic Hub — thesis, chapters, milestones',
      'CPD Tracker — 12 bodies supported',
      'Supervisor session log + AI summaries',
      'Research Hub + literature AI',
      '2,000 AI credits/month',
      '5 GB storage',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 24,
    currency: '£',
    color: '#7c3aed',
    highlight: true,
    description: 'Full CEO/Founder OS — all modules, 15 NemoClaw™ frameworks',
    credits: 10000,
    features: [
      'Everything in Student',
      'Command Centre + Daily AI Brief (7am)',
      'Payroll Engine (detect → remit → chase)',
      'Executive OS — OKRs, decisions, stakeholders',
      'IP Vault + Contract Register + Group P&L',
      'SE-MIL Knowledge Base + NemoClaw™ AI',
      'Wellness Intelligence + purpose anchors',
      'File Intelligence + Email AI',
      '10,000 AI credits/month · 20 GB storage',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: null,
    currency: '£',
    color: '#0e5ca4',
    description: 'Institution / team — shared workspaces, SSO',
    credits: -1,
    features: [
      'Everything in Professional',
      'Shared research workspaces (up to 10 members)',
      'Department-level admin + cohort dashboard',
      'SSO / institutional login',
      'Team citation libraries',
      'Unlimited AI credits · Dedicated support',
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({ used, limit, label, color = '#7c3aed' }: {
  used: number; limit: number; label: string; color?: string
}) {
  const pct = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0
  const isHigh = pct >= 80
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: isHigh ? '#ef4444' : 'var(--pios-text)' }}>
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
          {limit > 0 && <span style={{ color: 'var(--pios-dim)', fontWeight: 400 }}> ({pct}%)</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--pios-surface3)', borderRadius: 3 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: isHigh ? '#ef4444' : color,
          borderRadius: 3, transition: 'width 0.4s',
        }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: 'Active',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    trialing:  { label: 'Trial',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    past_due:  { label: 'Past due',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    canceled:  { label: 'Canceled',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    inactive:  { label: 'Inactive',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  }
  const s = map[status ?? 'inactive'] ?? map.inactive
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>{s.label}</span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [tenant, setTenant]   = useState<TenantData | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/auth/profile').then(r => r.ok ? r.json() : null),
      fetch('/api/dashboard').then(r => r.ok ? r.json() : null),
    ]).then(([profileR, dashR]) => {
      if (profileR.status === 'fulfilled' && profileR.value) {
        setProfile(profileR.value)
        setTenant(profileR.value.tenant ?? null)
      }
      if (dashR.status === 'fulfilled' && dashR.value?.tenant) {
        setTenant(dashR.value.tenant)
      }
    }).finally(() => setLoading(false))
  }, [])

  const currentPlan     = tenant?.plan ?? 'professional'
  const planStatus      = tenant?.plan_status ?? tenant?.subscription_status ?? 'trialing'
  const creditsUsed     = tenant?.ai_credits_used ?? 0
  const creditsLimit    = tenant?.ai_credits_limit ?? 10000
  const trialEnds       = tenant?.trial_ends_at
  const hasStripe       = !!tenant?.stripe_customer_id
  const trialDaysLeft   = trialEnds
    ? Math.max(0, Math.ceil((new Date(trialEnds).getTime() - Date.now()) / 86400000))
    : null

  async function handleUpgrade(planId: string) {
    setRedirecting(planId)
    window.location.href = `/api/stripe/checkout?plan=${planId}`
  }

  async function handlePortal() {
    setRedirecting('portal')
    window.location.href = '/api/stripe/portal'
  }

  if (loading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--pios-muted)' }}>
        <span className="spin" style={{ fontSize: 18 }}>⟳</span>
        Loading billing information…
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
          Plan & Billing
        </h1>
        <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
          Manage your PIOS subscription, AI usage, and payment details
        </p>
      </div>

      {/* ── Current plan card ── */}
      <div style={{
        padding: '20px 24px', borderRadius: 14,
        background: 'var(--pios-surface)',
        border: '1px solid var(--pios-border)',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Current plan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--pios-text)', textTransform: 'capitalize' }}>
                {currentPlan}
              </span>
              <StatusBadge status={planStatus} />
            </div>
            {profile?.billing_email || profile?.google_email ? (
              <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 4 }}>
                {profile.billing_email ?? profile.google_email}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasStripe && (
              <button
                onClick={handlePortal}
                disabled={!!redirecting}
                style={{
                  padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--pios-border2)', background: 'var(--pios-surface2)',
                  color: 'var(--pios-muted)', cursor: 'pointer',
                }}
              >
                {redirecting === 'portal' ? '⟳ Opening…' : '⚙ Manage billing'}
              </button>
            )}
            <a
              href="mailto:info@veritasiq.io?subject=PIOS billing enquiry"
              style={{
                padding: '8px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--pios-border2)', background: 'transparent',
                color: 'var(--pios-muted)', textDecoration: 'none',
              }}
            >
              ✉ Contact us
            </a>
          </div>
        </div>

        {/* Trial countdown */}
        {trialDaysLeft !== null && planStatus === 'trialing' && (
          <div style={{
            padding: '10px 14px', borderRadius: 9, marginBottom: 16,
            background: trialDaysLeft <= 3 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${trialDaysLeft <= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>{trialDaysLeft <= 3 ? '⚠' : '⏱'}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: trialDaysLeft <= 3 ? '#ef4444' : '#f59e0b' }}>
                {trialDaysLeft === 0 ? 'Trial expires today' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in trial`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                Trial ends {new Date(trialEnds!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })} — subscribe to keep all features
              </div>
            </div>
          </div>
        )}

        {/* AI credits usage */}
        <UsageBar
          used={creditsUsed}
          limit={creditsLimit}
          label="AI credits this month"
          color="#7c3aed"
        />
      </div>

      {/* ── Plan cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan
          return (
            <div key={plan.id} style={{
              borderRadius: 14, padding: '20px 18px',
              background: 'var(--pios-surface)',
              border: `1px solid ${isCurrent ? plan.color + '50' : 'var(--pios-border)'}`,
              boxShadow: isCurrent ? `0 0 0 2px ${plan.color}20` : 'none',
              display: 'flex', flexDirection: 'column', gap: 12,
              position: 'relative',
            }}>
              {plan.highlight && !isCurrent && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                  color: '#fff', background: plan.color, padding: '3px 10px', borderRadius: 20,
                  textTransform: 'uppercase',
                }}>Most popular</div>
              )}
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                  color: '#fff', background: plan.color, padding: '3px 10px', borderRadius: 20,
                  textTransform: 'uppercase',
                }}>Current plan</div>
              )}

              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: plan.color, marginBottom: 2 }}>{plan.name}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.5 }}>{plan.description}</div>
              </div>

              <div>
                {plan.price !== null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--pios-text)', letterSpacing: '-0.03em' }}>
                      {plan.currency}{plan.price}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>/month</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pios-muted)' }}>Custom pricing</div>
                )}
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 7, fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.5 }}>
                    <span style={{ color: plan.color, flexShrink: 0, fontWeight: 700 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (isCurrent) return
                  if (plan.price === null) {
                    window.open('mailto:info@veritasiq.io?subject=PIOS Team plan enquiry', '_blank')
                  } else {
                    handleUpgrade(plan.id)
                  }
                }}
                disabled={isCurrent || !!redirecting}
                style={{
                  padding: '10px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'var(--pios-surface2)' : plan.color,
                  color: isCurrent ? 'var(--pios-muted)' : '#fff',
                  opacity: redirecting && redirecting !== plan.id ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {redirecting === plan.id ? '⟳ Redirecting…'
                  : isCurrent ? 'Current plan'
                  : plan.price === null ? 'Contact us'
                  : `Upgrade to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Usage limits ── */}
      <div style={{
        padding: '18px 22px', borderRadius: 14,
        background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14 }}>Plan limits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'AI credits/month', value: currentPlan === 'student' ? '2,000' : currentPlan === 'professional' ? '10,000' : '∞' },
            { label: 'Projects', value: currentPlan === 'student' ? '5' : currentPlan === 'professional' ? '20' : '∞' },
            { label: 'Storage', value: currentPlan === 'student' ? '5 GB' : currentPlan === 'professional' ? '20 GB' : 'Unlimited' },
            { label: 'Collaborators', value: currentPlan === 'professional' ? '3 guests' : currentPlan === 'team' ? 'Up to 10' : '—' },
          ].map(item => (
            <div key={item.label} style={{
              textAlign: 'center', padding: '12px 8px',
              border: '1px solid var(--pios-border)', borderRadius: 9,
              background: 'var(--pios-surface2)',
            }}>
              <div style={{ fontSize: 9, color: 'var(--pios-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pios-text)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer notes ── */}
      <div style={{ fontSize: 11, color: 'var(--pios-dim)', lineHeight: 1.8 }}>
        <div>• 14-day free trial on all plans. Cancel anytime — no lock-in.</div>
        <div>• All prices exclude VAT where applicable.</div>
        <div>• For invoice, PO, or enterprise billing: <a href="mailto:info@veritasiq.io" style={{ color: 'var(--ai)', textDecoration: 'none' }}>info@veritasiq.io</a></div>
        {hasStripe && (
          <div>• <button onClick={handlePortal} style={{ background: 'none', border: 'none', color: 'var(--ai)', cursor: 'pointer', fontSize: 11, padding: 0 }}>Manage payment method, invoices, or cancel →</button></div>
        )}
        <div style={{ marginTop: 8 }}>
          <Link href="/platform/settings" style={{ color: 'var(--pios-dim)', textDecoration: 'none', fontSize: 11 }}>
            ← Back to settings
          </Link>
        </div>
      </div>
    </div>
  )
}
