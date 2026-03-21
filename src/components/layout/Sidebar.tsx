'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/platform/dashboard', icon: '⊞', label: 'Command Centre' },
  { href: '/platform/academic',  icon: '🎓', label: 'Academic',       colour: '#6c8eff' },
  { href: '/platform/tasks',     icon: '✓',  label: 'Tasks',          colour: '#a78bfa' },
  { href: '/platform/calendar',  icon: '📅', label: 'Calendar',       colour: '#22d3ee' },
  { href: '/platform/email',     icon: '✉',  label: 'Inbox',          colour: '#2dd4a0' },
  { href: '/platform/projects',  icon: '◈',  label: 'Projects',       colour: '#f59e0b' },
  { href: '/platform/command',   icon: '⬡',  label: 'Live Data',      colour: '#22c55e' },
  { href: '/platform/expenses',  icon: '£',  label: 'Expenses',       colour: '#e05a7a' },
  { href: '/platform/ai',        icon: '◉',  label: 'AI Companion',   colour: '#a78bfa' },
]

interface SidebarProps {
  userProfile?: { full_name?: string; avatar_url?: string } | null
  tenant?: { plan?: string } | null
}

export function Sidebar({ userProfile, tenant }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DM'

  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Individual'

  return (
    <aside style={{
      width: collapsed ? '64px' : '220px',
      minHeight: '100vh',
      background: 'var(--pios-surface)',
      borderRight: '1px solid var(--pios-border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
        borderBottom: '1px solid var(--pios-border)',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '14px', color: '#fff', flexShrink: 0,
        }}>P</div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--pios-text)' }}>PIOS</div>
            <div style={{ fontSize: '10px', color: 'var(--pios-dim)', letterSpacing: '0.05em' }}>
              v1.0 · {planLabel}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/platform/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: collapsed ? '10px 0' : '9px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'rgba(167,139,250,0.1)' : 'transparent',
                borderLeft: active ? '2px solid var(--ai)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                color: active ? 'var(--pios-text)' : 'var(--pios-muted)',
              }}>
                <span style={{
                  fontSize: '16px', lineHeight: 1, flexShrink: 0,
                  color: active ? ((item as any).colour || 'var(--ai)') : 'inherit',
                }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400 }}>
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid var(--pios-border)', padding: '8px 0' }}>
        <Link href="/platform/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '10px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--pios-muted)', cursor: 'pointer',
          }}>
            <span style={{ fontSize: '16px' }}>⚙</span>
            {!collapsed && <span style={{ fontSize: '13px' }}>Settings</span>}
          </div>
        </Link>

        {/* User */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: collapsed ? '10px 0' : '10px 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          cursor: 'pointer', borderTop: '1px solid var(--pios-border)', marginTop: '4px',
        }} onClick={signOut} title="Sign out">
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--pios-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {userProfile?.full_name || 'Douglas'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>Sign out</div>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)} style={{
        position: 'absolute', top: '50%', right: '-12px', transform: 'translateY(-50%)',
        width: '24px', height: '24px', borderRadius: '50%',
        background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: '10px', color: 'var(--pios-muted)', zIndex: 10,
      }}>{collapsed ? '›' : '‹'}</button>
    </aside>
  )
}
