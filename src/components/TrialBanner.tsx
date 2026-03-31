'use client'
/**
 * TrialBanner — shows on dashboard when user is on trial plan
 * Displays days remaining, credit usage, and upgrade CTA.
 * Dismisses for current session once seen.
 * VeritasIQ Technologies Ltd · PIOS
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TrialStatus {
  on_trial:  boolean
  expired:   boolean
  days_left: number
  trial_end: string | null
  plan:      string
}

export default function TrialBanner() {
  const [status, setStatus]   = useState<TrialStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/trial/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.on_trial) setStatus(d) })
      .catch(() => {})
  }, [])

  if (!status?.on_trial || dismissed) return null

  const urgent = status.days_left <= 1
  const color  = urgent ? '#e05272' : status.days_left <= 2 ? '#f0a030' : '#8b7cf8'
  const bg     = urgent ? 'rgba(224,82,114,0.08)' : status.days_left <= 2 ? 'rgba(240,160,48,0.08)' : 'rgba(139,124,248,0.08)'
  const border = urgent ? 'rgba(224,82,114,0.25)' : status.days_left <= 2 ? 'rgba(240,160,48,0.25)' : 'rgba(139,124,248,0.25)'

  return (
    <div style={{
      padding: '12px 18px',
      borderRadius: 10,
      marginBottom: 20,
      background: bg,
      border: `1px solid ${border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, color, fontWeight: 700 }}>
          {status.expired
            ? '⚠ Trial expired'
            : status.days_left === 0
              ? '⚠ Trial ends today'
              : `◉ ${status.days_left} day${status.days_left !== 1 ? 's' : ''} left in trial`}
        </span>
        <span style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
          {status.expired
            ? 'Upgrade to continue using PIOS'
            : 'Full access · 20 AI credits'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => router.push('/platform/billing')}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: color,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          Upgrade — from £9/mo
        </button>
        {!status.expired && (
          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11,
              background: 'transparent',
              color: 'var(--pios-muted)',
              border: '1px solid var(--pios-border)',
              cursor: 'pointer',
            }}
          >
            Remind later
          </button>
        )}
      </div>
    </div>
  )
}
