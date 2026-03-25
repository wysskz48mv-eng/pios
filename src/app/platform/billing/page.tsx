/**
 * PIOS Billing & Upgrade page
 * Sprint 64 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect } from 'react'
import { PlatformShell } from '@/components/layout/PlatformShell'

const PLANS = [
  {
    id: 'student',
    name: 'Student',
    price: 9,
    features: ['DBA / PhD modules', 'Thesis manager', 'CPD tracker', 'AI companion (50 msg/day)', '5 projects'],
    colour: '#6b7280',
  },
  {
    id: 'individual',
    name: 'Individual',
    price: 24,
    features: ['All Student features', 'Executive OS (OKRs, Decisions)', 'IP Vault (NemoClaw™)', 'Contract register', 'Group P&L', 'Payroll engine', 'Unlimited AI', '20 projects'],
    colour: '#7c3aed',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: null,
    features: ['All Individual features', 'Multi-user (up to 10)', 'Shared projects', 'Admin portal', 'Custom NemoClaw™ training', 'Priority support'],
    colour: '#0e5ca4',
  },
]

export default function BillingPage() {
  const [profile, setProfile] = useState<Record<string,any> | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/profile').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfile(d) })
      .finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async (planId: string) => {
    setUpgrading(true)
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      if (r.ok) { const d = await r.json(); if (d.url) window.location.href = d.url }
    } catch { /* silent */ } finally { setUpgrading(false) }
  }

  const handlePortal = async () => {
    const r = await fetch('/api/billing/portal', { method: 'POST' })
    if (r.ok) { const d = await r.json(); if (d.url) window.location.href = d.url }
  }

  const currentPlan = profile?.plan ?? 'individual'

  return (
    <PlatformShell>
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-xl font-semibold mb-1">Billing & Plan</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and usage</p>
        </div>

        {/* Current plan */}
        {!loading && profile && (
          <div className="rounded-xl border p-5 flex items-center justify-between bg-violet-50 dark:bg-violet-950/20 border-violet-200">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current plan</p>
              <p className="text-lg font-bold capitalize">{currentPlan}</p>
              {profile.trial_ends_at && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Trial ends {new Date(profile.trial_ends_at).toLocaleDateString('en-GB', { day:'numeric', month:'long' })}
                </p>
              )}
            </div>
            <button onClick={handlePortal} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-accent">
              Manage billing →
            </button>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            return (
              <div key={plan.id} className={`rounded-xl border p-5 flex flex-col space-y-4 ${plan.highlight ? 'border-violet-500 ring-1 ring-violet-500/20' : ''}`}>
                {plan.highlight && (
                  <div className="text-[10px] font-bold tracking-wider text-violet-600 uppercase">Most popular</div>
                )}
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.price !== null
                    ? <p className="mt-1"><span className="text-2xl font-bold">£{plan.price}</span><span className="text-xs text-muted-foreground">/month</span></p>
                    : <p className="text-sm text-muted-foreground mt-1">Contact us</p>
                  }
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-green-500 shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => plan.price !== null ? handleUpgrade(plan.id) : window.open('mailto:info@veritasiq.io?subject=PIOS Team plan', '_blank')}
                  disabled={isCurrent || upgrading}
                  style={{ background: isCurrent ? undefined : plan.colour }}
                  className={`w-full py-2 rounded-lg text-sm font-medium ${isCurrent ? 'bg-muted text-muted-foreground cursor-default' : 'text-white hover:opacity-90'}`}
                >
                  {isCurrent ? 'Current plan' : plan.price !== null ? `Upgrade to ${plan.name}` : 'Contact us'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Usage */}
        <div className="rounded-xl border p-5">
          <h2 className="text-sm font-semibold mb-3">Plan limits</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'AI messages', limit: currentPlan === 'student' ? '50/day' : '∞' },
              { label: 'Projects', limit: currentPlan === 'student' ? '5' : currentPlan === 'individual' ? '20' : '∞' },
              { label: 'File uploads', limit: '25 MB each' },
              { label: 'Storage', limit: '1 GB' },
            ].map(item => (
              <div key={item.label} className="text-center border rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-bold">{item.limit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 14-day free trial on all plans. Cancel anytime.</p>
          <p>• Questions: <a href="mailto:info@veritasiq.io" className="text-violet-500 hover:underline">info@veritasiq.io</a></p>
        </div>
      </div>
    </PlatformShell>
  )
}
