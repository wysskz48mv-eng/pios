'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import TrialBanner from '@/components/TrialBanner'
import { TrialExpiredGate } from '@/components/TrialExpiredGate'
import { GlobalSearch } from '@/components/GlobalSearch'
import { NemoclawPanel } from './NemoclawPanel'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useNemoclawStore } from '@/stores/useNemoclawStore'

interface PlatformShellProps {
  children: React.ReactNode
  userProfile?: Record<string, unknown>
  tenant?: Record<string, unknown>
}

const MOBILE_NAV = [
  { href: '/platform/dashboard', icon: '⊞', label: 'Home' },
  { href: '/platform/tasks', icon: '✓', label: 'Tasks' },
  { href: '/platform/inbox', icon: '✉', label: 'Inbox' },
  { href: '/platform/files', icon: '📁', label: 'Files' },
  { href: '/platform/ai', icon: '✦', label: 'Nemo' },
]

function pageTitle(pathname: string | null): string {
  if (!pathname) return 'PIOS'
  const seg = pathname.split('/').filter(Boolean).pop() ?? ''
  const map: Record<string, string> = {
    dashboard: 'Command Centre',
    inbox: 'Inbox',
    tasks: 'Tasks',
    files: 'File Intelligence',
    documents: 'Documents',
    stakeholders: 'Stakeholders',
    decisions: 'Decision Queue',
    settings: 'Settings',
    ai: 'NemoClaw Workspace',
  }
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function PlatformShell({ children, userProfile, tenant }: PlatformShellProps) {
  const [mobileMenuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const { open } = useNemoclawStore()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const planStatus = ((tenant as Record<string, unknown>)?.plan as string) ?? (tenant as Record<string, unknown>)?.subscription_status ?? 'active'
  const isTrialing = planStatus === 'trialing'
  const isExpired = planStatus === 'canceled' && !(tenant as Record<string, unknown>)?.stripe_subscription_id
  const title = pageTitle(pathname)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: '#07080D' }}>
      {!isMobile && <Sidebar userProfile={userProfile as Record<string, string> | undefined} tenant={tenant as Record<string, string> | undefined} />}

      {isMobile && mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--pios-bg)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--pios-border)' }}>
            <strong style={{ color: 'var(--pios-text)', fontSize: 13 }}>Navigation</strong>
            <button onClick={() => setMenuOpen(false)} className="pios-btn pios-btn-ghost pios-btn-sm">Close</button>
          </div>
          <div style={{ height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
            <Sidebar userProfile={userProfile as Record<string, string> | undefined} tenant={tenant as Record<string, string> | undefined} />
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: isMobile ? 64 : 0 }}>
        {isTrialing && <TrialBanner />}

        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            background: 'rgba(7,8,13,0.92)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 24px',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {isMobile ? (
            <button onClick={() => setMenuOpen(true)} className="pios-btn pios-btn-ghost pios-btn-sm">☰ Menu</button>
          ) : (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1, color: 'rgba(250,250,249,0.95)' }}>{title}</span>
          )}

          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
            }}
            style={{
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.42)',
              fontSize: 12,
              minWidth: 220,
            }}
          >
            <span>Search anything…</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘K</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="pios-btn pios-btn-primary pios-btn-sm" onClick={open}>✦ NemoClaw</button>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div id="main-content" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '18px 14px 24px' : '24px 28px 36px' }}>
            {children}
          </div>
          {!isMobile && <NemoclawPanel />}
        </div>
      </main>

      {isMobile && <NemoclawPanel />}

      {isMobile && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, height: 60, background: 'rgba(7,8,13,0.97)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center' }}>
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', padding: '6px 0', color: active ? 'var(--ai)' : 'var(--pios-dim)' }}>
                <span style={{ fontSize: 16, lineHeight: '1' }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {isExpired && <TrialExpiredGate userName={userProfile?.full_name as string | undefined} />}
      <GlobalSearch />
    </div>
  )
}
