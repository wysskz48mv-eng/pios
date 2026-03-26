'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { AiChat } from './AiChat'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialExpiredGate } from '@/components/TrialExpiredGate'
import { GlobalSearch } from '@/components/GlobalSearch'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface PlatformShellProps {
  children: React.ReactNode
  userProfile?: Record<string,unknown>
  tenant?: Record<string,unknown>
}

const MOBILE_NAV = [
  { href: '/platform/dashboard', icon: '⊞', label: 'Home'    },
  { href: '/platform/tasks',     icon: '✓',  label: 'Tasks'   },
  { href: '/platform/command',   icon: '⬡',  label: 'Live'    },
  { href: '/platform/email',     icon: '✉',  label: 'Inbox'   },
  { href: '/platform/ai',        icon: '◉',  label: 'AI'      },
]

// Derive a readable page title from the pathname
function pageTitle(pathname: string | null): string {
  if (!pathname) return 'PIOS'
  const seg = pathname.split('/').filter(Boolean).pop() ?? ''
  const map: Record<string,string> = {
    dashboard: 'Command Centre', academic: 'Academic Hub', learning: 'Learning Hub',
    research: 'Research Hub', tasks: 'Tasks', calendar: 'Calendar', meetings: 'Meetings',
    email: 'Inbox', files: 'File Intel', documents: 'Documents', executive: 'Executive OS',
    consulting: 'Consulting', comms: 'Comms Hub', 'time-sovereignty': 'Time Sovereignty',
    'ip-vault': 'IP Vault', knowledge: 'SE-MIL', notifications: 'Notifications',
    contracts: 'Contracts', financials: 'Group P&L', intelligence: 'Intelligence',
    payroll: 'Payroll', projects: 'Projects', command: 'Live Data', expenses: 'Expenses',
    ai: 'AI Companion', help: 'Help', billing: 'Billing', changelog: "What's New",
    setup: 'Setup Guide', smoke: 'Smoke Test', operator: 'Operator Config',
    admin: 'Admin',
    'policy-coach': 'Policy Coach', study: 'Study Timer', nps: 'Feedback', settings: 'Settings',
  }
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function PlatformShell({ children, userProfile, tenant }: PlatformShellProps) {
  const [chatOpen,    setChatOpen]   = useState(false)
  const [mobileMenuOpen, setMenuOpen] = useState(false)
  const [isMobile,   setIsMobile]    = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const planStatus  = ((tenant as Record<string,unknown>)?.plan as string) ?? (tenant as Record<string,unknown>)?.subscription_status ?? 'active'
  const trialEndsAt = String((tenant as Record<string,unknown>)?.trial_ends_at ?? '') || null
  const isTrialing  = planStatus === 'trialing'
  const isExpired   = planStatus === 'canceled' && !(tenant as Record<string,unknown>)?.stripe_subscription_id
  const creditsUsed = Number((tenant as Record<string,unknown>)?.ai_credits_used ?? 0)
  const creditsLimit = Number((tenant as Record<string,unknown>)?.ai_credits_limit ?? 10000)
  const creditPct   = Math.min(100, (creditsUsed / creditsLimit) * 100)
  const title       = pageTitle(pathname)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar userProfile={userProfile as Record<string,string> | undefined} tenant={tenant as Record<string,string> | undefined} />}

      {/* Mobile full-screen menu */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--pios-bg)', overflowY: 'auto',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--pios-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: '#fff',
              }}>P</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--pios-text)', letterSpacing: '-0.01em' }}>PIOS</span>
            </div>
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'none', border: '1px solid var(--pios-border2)',
              borderRadius: 7, padding: '5px 10px',
              color: 'var(--pios-muted)', fontSize: 12, cursor: 'pointer',
            }}>Close</button>
          </div>
          <div style={{ height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
            <Sidebar userProfile={userProfile as Record<string,string> | undefined} tenant={tenant as Record<string,string> | undefined} />
          </div>
        </div>
      )}

      {/* Main area */}
      <main style={{
        flex: 1, overflowY: 'auto', background: 'var(--pios-bg)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: isMobile ? 64 : 0,
      }}>

        {isTrialing && (
          <TrialBanner trialEndsAt={trialEndsAt} planStatus={String(planStatus ?? 'active')} />
        )}

        {/* ── Top bar ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(7,8,16,0.9)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--pios-border)',
          padding: '0 24px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexShrink: 0,
        }}>

          {/* Left: mobile hamburger OR desktop page title */}
          {isMobile ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setMenuOpen(true)} style={{
                background: 'none', border: '1px solid var(--pios-border2)',
                borderRadius: 7, padding: '5px 9px',
                color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span>☰</span>
              </button>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#fff',
              }}>P</div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15, fontWeight: 700, color: 'var(--pios-text)',
                letterSpacing: '-0.02em',
              }}>{title}</span>
            </div>
          )}

          {/* Centre: ⌘K search (desktop) */}
          {!isMobile && (
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                color: 'var(--pios-dim)', fontSize: 12, transition: 'all 0.15s',
                minWidth: 200,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pios-border3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pios-muted)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pios-border2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pios-dim)' }}
            >
              <span style={{ fontSize: 13 }}>🔍</span>
              <span style={{ flex: 1, textAlign: 'left' as const }}>Search anything…</span>
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 5,
                background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
                color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)',
              }}>⌘K</span>
            </button>
          )}

          {/* Right: credits + trial badge + AI button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Credit meter — desktop only */}
            {tenant && !isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 56, height: 4, borderRadius: 2, background: 'var(--pios-surface3)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${creditPct}%`,
                    background: creditPct > 80 ? '#ef4444' : creditPct > 50 ? '#f59e0b' : 'var(--ai)',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
                  {creditsUsed.toLocaleString()}/{creditsLimit.toLocaleString()}
                </span>
              </div>
            )}

            {/* Trial badge */}
            {isTrialing && (
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#9b87f5',
                background: 'rgba(155,135,245,0.08)', border: '1px solid rgba(155,135,245,0.18)',
                padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em',
              }}>Trial</div>
            )}

            {/* AI chat toggle */}
            <button onClick={() => setChatOpen(!chatOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: chatOpen ? 'rgba(139,124,248,0.14)' : 'var(--pios-surface2)',
              border: `1px solid ${chatOpen ? 'rgba(139,124,248,0.3)' : 'var(--pios-border2)'}`,
              color: chatOpen ? 'var(--ai)' : 'var(--pios-muted)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              letterSpacing: '-0.01em', fontFamily: 'var(--font-sans)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--ai)', display: 'inline-block',
              }} className="ai-pulse" />
              {isMobile ? 'AI' : 'NemoClaw™'}
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <div style={{
          padding: isMobile ? '16px 16px 28px' : '24px 28px 60px',
          flex: 1,
        }}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          height: 60, background: 'rgba(8,9,12,0.96)', backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--pios-border)',
          display: 'flex', alignItems: 'center',
        }}>
          {MOBILE_NAV.map(item => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                textDecoration: 'none', padding: '6px 0',
                color: active ? 'var(--ai)' : 'var(--pios-dim)',
                transition: 'color 0.15s',
              }}>
                <span style={{ fontSize: 19, lineHeight: '1' }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          <button onClick={() => setMenuOpen(true)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
            color: mobileMenuOpen ? 'var(--ai)' : 'var(--pios-dim)',
          }}>
            <span style={{ fontSize: 19, lineHeight: '1' }}>⋯</span>
            <span style={{ fontSize: 9, letterSpacing: '0.04em' }}>More</span>
          </button>
        </nav>
      )}

      {/* Overlays */}
      {isExpired && <TrialExpiredGate userName={userProfile?.full_name as string | undefined} />}
      <GlobalSearch />
      {chatOpen && <AiChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
