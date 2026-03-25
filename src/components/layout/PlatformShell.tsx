'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { AiChat } from './AiChat'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialExpiredGate } from '@/components/TrialExpiredGate'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface PlatformShellProps {
  children: React.ReactNode
  userProfile?: Record<string,unknown>
  tenant?: Record<string,unknown>
}

// Mobile bottom nav — 5 primary items
const MOBILE_NAV = [
  { href: '/platform/dashboard', icon: '⊞', label: 'Home'     },
  { href: '/platform/tasks',     icon: '✓',  label: 'Tasks'    },
  { href: '/platform/command',   icon: '⚡', label: 'Command'  },
  { href: '/platform/email',     icon: '✉',  label: 'Inbox'    },
  { href: '/platform/ai',        icon: '✨', label: 'AI'       },
]

export function PlatformShell({ children, userProfile, tenant }: PlatformShellProps) {
  const [chatOpen, setChatOpen]       = useState(false)
  const [mobileMenuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile]       = useState(false)
  const pathname                      = usePathname()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const planStatus  = ((tenant as any)?.plan as string) ?? (tenant as any)?.subscription_status ?? 'active'
  const trialEndsAt: string | null = String((tenant as any)?.trial_ends_at ?? '') || null
  const isTrialing  = planStatus === 'trialing'
  const isExpired   = planStatus === 'canceled' && !(tenant as any)?.stripe_subscription_id
  const creditsUsed = Number((tenant as any)?.ai_credits_used ?? 0)
  const creditsLimit = Number((tenant as any)?.ai_credits_limit ?? 10000)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      {!isMobile && <Sidebar userProfile={userProfile} tenant={tenant} />}

      {/* ── Mobile full-screen menu overlay ── */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--pios-bg)',
          overflowY: 'auto',
        }}>
          {/* Menu header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--pios-border)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pios-text)' }}>Navigation</span>
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'var(--pios-muted)',
              fontSize: 20, cursor: 'pointer', padding: '4px',
            }}>✕</button>
          </div>

          {/* Sidebar inside overlay */}
          <div style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
            <Sidebar userProfile={userProfile} tenant={tenant} />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--pios-bg)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: isMobile ? '64px' : 0,
      }}>

        {isTrialing && (
          <TrialBanner trialEndsAt={trialEndsAt} planStatus={String(planStatus ?? 'active')} />
        )}

        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(10,11,13,0.9)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--pios-border)',
          padding: '0 16px', height: '52px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          flexShrink: 0,
        }}>
          {/* Mobile: hamburger */}
          {isMobile && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMenuOpen(true)} style={{
                background: 'none', border: '1px solid var(--pios-border)',
                borderRadius: 8, padding: '6px 10px',
                color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 16 }}>☰</span>
                <span style={{ fontSize: 11 }}>Menu</span>
              </button>
              <a href="/platform/dashboard#brief" style={{
                background: 'none', border: '1px solid var(--pios-border)',
                borderRadius: 8, padding: '6px 10px',
                color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              }}>
                <span>✦</span> PIOS
              </a>
            </div>
          )}

          {/* Desktop: spacer */}
          {!isMobile && <div style={{ flex: 1 }} />}

          {/* Right side: credits + AI button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {tenant && !isMobile && (
              <div style={{ fontSize: '11px', color: 'var(--pios-dim)', fontFamily: 'monospace' }}>
                {creditsUsed.toLocaleString()} / {creditsLimit.toLocaleString()} credits
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
              {isMobile ? 'AI' : 'PIOS AI'}
            </button>
          </div>
        </div>

        {/* ── Page content ── */}
        <div style={{ padding: isMobile ? '16px 16px 24px' : '28px 28px 60px', flex: 1 }}>
          {children}
        </div>
      </main>

      {/* ── Mobile bottom navigation bar ── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          height: '60px',
          background: 'rgba(10,11,13,0.95)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--pios-border)',
          display: 'flex', alignItems: 'center',
        }}>
          {MOBILE_NAV.map(item => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                textDecoration: 'none', padding: '6px 0',
                color: active ? 'var(--ai)' : 'var(--pios-dim)',
                transition: 'color 0.15s',
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          {/* More button opens full menu */}
          <button onClick={() => setMenuOpen(true)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
            color: mobileMenuOpen ? 'var(--ai)' : 'var(--pios-dim)',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>⋯</span>
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.04em' }}>More</span>
          </button>
        </nav>
      )}

      {/* ── Trial gate + AI Chat ── */}
      {isExpired && (
        <TrialExpiredGate userName={userProfile?.full_name as string | undefined} />
      )}
      {chatOpen && <AiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />}

    </div>
  )
}
