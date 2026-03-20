'use client'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { AiChat } from './AiChat'

interface PlatformShellProps {
  children: React.ReactNode
  userProfile?: any
  tenant?: any
}

export function PlatformShell({ children, userProfile, tenant }: PlatformShellProps) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar userProfile={userProfile} />

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--pios-bg)' }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(10,11,13,0.8)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--pios-border)',
          padding: '0 24px', height: '52px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px',
        }}>
          {tenant && (
            <div style={{ fontSize: '11px', color: 'var(--pios-dim)' }}>
              {tenant.ai_credits_used?.toLocaleString() ?? 0} / {tenant.ai_credits_limit?.toLocaleString() ?? 5000} AI credits
            </div>
          )}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              background: chatOpen ? 'rgba(167,139,250,0.2)' : 'var(--pios-surface)',
              border: `1px solid ${chatOpen ? 'rgba(167,139,250,0.4)' : 'var(--pios-border)'}`,
              color: chatOpen ? 'var(--ai)' : 'var(--pios-muted)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500,
              transition: 'all 0.15s',
            }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ai)', display: 'inline-block' }} className="ai-pulse" />
            PIOS AI
          </button>
        </div>

        {/* Page content */}
        <div style={{ padding: '28px 28px 60px' }}>
          {children}
        </div>
      </main>

      {chatOpen && <AiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
