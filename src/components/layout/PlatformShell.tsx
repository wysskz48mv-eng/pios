'use client'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { AiChat } from './AiChat'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialExpiredGate } from '@/components/TrialExpiredGate'

interface PlatformShellProps {
  children: React.ReactNode
  userProfile?: Record<string,unknown>
  tenant?: Record<string,unknown>
}

export function PlatformShell({ children, userProfile, tenant }: PlatformShellProps) {
  const [chatOpen, setChatOpen] = useState(false)

  const planStatus  = ((tenant as Record<string,unknown> | undefined)?.plan as string | undefined) ?? (tenant as Record<string,unknown> | undefined)?.subscription_status as string ?? 'active'
  const trialEndsAt = tenant?.trial_ends_at ?? null
  const isTrialing  = planStatus === 'trialing'
  const isExpired   = planStatus === 'canceled' && !tenant?.stripe_subscription_id

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar userProfile={userProfile} tenant={tenant} />

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--pios-bg)', display: 'flex', flexDirection: 'column' }}>

        {isTrialing && (
          <TrialBanner trialEndsAt={trialEndsAt} planStatus={String(planStatus ?? "active")} />
        )}

        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(10,11,13,0.85)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--pios-border)',
          padding: '0 24px', height: '52px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px',
          flexShrink: 0,
        }}>
          {tenant && (
            <div style={{ fontSize: '11px', color: 'var(--pios-dim)' }}>
              {(tenant.ai_credits_used || 0).toLocaleString()} / {(tenant.ai_credits_limit || 15000).toLocaleString()} AI credits
            </div>
          )}
          {isTrialing && (
            <div style={{
              fontSize: '11px', color: '#a78bfa',
              background: 'rgba(167,139,250,0.1)',
              border: '1px solid rgba(167,139,250,0.2)',
              padding: '3px 10px', borderRadius: 12,
            }}>
              Trial
            </div>
          )}
          <button onClick={() => setChatOpen(!chatOpen)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '20px',
            background: chatOpen ? 'rgba(167,139,250,0.2)' : 'var(--pios-surface)',
            border: `1px solid ${chatOpen ? 'rgba(167,139,250,0.4)' : 'var(--pios-border)'}`,
            color: chatOpen ? 'var(--ai)' : 'var(--pios-muted)',
            cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--ai)', display: 'inline-block',
            }} className="ai-pulse" />
            PIOS AI
          </button>
        </div>

        <div style={{ padding: '28px 28px 60px', flex: 1 }}>
          {children}
        </div>
      </main>

      {isExpired && (
        <TrialExpiredGate userName={userProfile?.full_name as string | undefined} />
      )}

      {chatOpen && <AiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
