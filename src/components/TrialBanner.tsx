'use client'
/**
 * TrialBanner — sticky top bar shown to trialing users.
 * Shows days remaining, upgrade CTA, and dismisses on upgrade.
 * Rendered inside PlatformShell when tenant.plan_status === 'trialing'.
 * PIOS v2.2 | Sprint 28 | VeritasIQ Technologies Ltd
 */
import { useState } from 'react'
import Link from 'next/link'

interface TrialBannerProps {
  trialEndsAt: string | null
  planStatus: string
}

function daysRemaining(endsAt: string | null): number {
  if (!endsAt) return 3
  const diff = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function TrialBanner({ trialEndsAt, planStatus }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (planStatus !== 'trialing') return null

  const days = daysRemaining(trialEndsAt)
  const urgent = days <= 1

  const bg     = urgent ? 'rgba(239,68,68,0.12)'  : 'rgba(167,139,250,0.10)'
  const border = urgent ? 'rgba(239,68,68,0.35)'  : 'rgba(167,139,250,0.30)'
  const accent = urgent ? '#ef4444'                : '#a78bfa'
  const label  = days === 0
    ? 'Your trial expires today'
    : days === 1
    ? '1 day left on your free trial'
    : `${days} days left on your free trial`

  return (
    <div style={{
      background: bg,
      borderBottom: `1px solid ${border}`,
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: accent, flexShrink: 0,
          boxShadow: `0 0 6px ${accent}`,
        }} />
        <span style={{ color: '#c8cedd' }}>
          <strong style={{ color: accent }}>{label}</strong>
          {' — unlock full access with a paid plan.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Link href="/platform/settings?tab=billing" style={{
          padding: '5px 14px',
          borderRadius: 20,
          background: accent,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          Upgrade now →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '2px 4px',
          }}
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  )
}
