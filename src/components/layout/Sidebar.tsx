'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Home',
    items: [
      { href: '/platform/dashboard', icon: '⊞', label: 'Command Centre' },
    ],
  },
  {
    label: 'Professional',
    items: [
      { href: '/platform/executive',        icon: '⚡', label: 'Executive OS',    badge: 'EOSA™',  colour: '#22d3ee' },
      { href: '/platform/consulting',       icon: '◎',  label: 'Consulting',      badge: 'CSA™',   colour: '#a78bfa' },
      { href: '/platform/projects',         icon: '◈',  label: 'Projects',                         colour: '#f59e0b' },
      { href: '/platform/tasks',            icon: '✓',  label: 'Tasks',                            colour: '#a78bfa' },
      { href: '/platform/contracts',        icon: '📑', label: 'Contracts',                        colour: '#3b82f6' },
      { href: '/platform/financials',       icon: '📈', label: 'Group P&L',                        colour: '#22c55e' },
      { href: '/platform/expenses',         icon: '₤',  label: 'Expenses',                         colour: '#e05a7a' },
      { href: '/platform/payroll',          icon: '💳', label: 'Payroll',                          colour: '#a78bfa' },
      { href: '/platform/ip-vault',         icon: '🔐', label: 'IP Vault',                         colour: '#a78bfa' },
      { href: '/platform/intelligence',     icon: '📡', label: 'Intelligence',                     colour: '#22d3ee' },
      { href: '/platform/time-sovereignty', icon: '⏱',  label: 'Time Sovereignty', badge: 'TSA™', colour: '#22d3ee' },
    ],
  },
  {
    label: 'Academic',
    items: [
      { href: '/platform/academic',  icon: '🎓', label: 'Academic Hub',  colour: '#5b8def' },
      { href: '/platform/research',  icon: '🔬', label: 'Research',      colour: '#5b8def' },
      { href: '/platform/learning',  icon: '🗺️', label: 'Learning Hub',  colour: '#8B5CF6' },
      { href: '/platform/policy-coach', icon: '🛡️', label: 'Policy Coach', badge: 'NEW', colour: '#f59e0b' },
      { href: '/platform/study',     icon: '⏱',  label: 'Study Timer',  colour: '#8b5cf6' },
      { href: '/platform/knowledge', icon: '🧠', label: 'SE-MIL',        colour: '#0d9488' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/platform/comms',     icon: '📡', label: 'Comms Hub',   badge: 'BICA™', colour: '#3b82f6' },
      { href: '/platform/email',     icon: '✉',  label: 'Inbox',                       colour: '#2dd4a0' },
      { href: '/platform/calendar',  icon: '📅', label: 'Calendar',                    colour: '#22d3ee' },
      { href: '/platform/meetings',  icon: '🗒️', label: 'Meetings',                    colour: '#a78bfa' },
      { href: '/platform/documents', icon: '📄', label: 'Documents',                   colour: '#8B5CF6' },
      { href: '/platform/files',     icon: '🗂️', label: 'File Intel',                  colour: '#f59e0b' },
      { href: '/platform/command',   icon: '⬡',  label: 'Live Data',                   colour: '#22c55e' },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/platform/ai', icon: '◉', label: 'AI Companion', colour: '#a78bfa' },
    ],
  },
  {
    label: 'Wellness',
    items: [
      { href: '/platform/wellness', icon: '◉', label: 'Wellness Intelligence', colour: '#26c99a' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/platform/notifications', icon: '🔔', label: 'Notifications', colour: '#f59e0b' },
      { href: '/platform/billing',       icon: '💳', label: 'Billing',       colour: '#22c55e' },
      { href: '/platform/operator',      icon: '🏷',  label: 'Operator',      colour: '#8b5cf6' },
      { href: '/platform/admin',         icon: '⚙',  label: 'Admin',         colour: '#ef4444' },
      { href: '/platform/setup',         icon: '⚡', label: 'Setup Guide',   colour: '#f59e0b' },
      { href: '/platform/changelog',     icon: '📋', label: "What's New",    colour: '#22c55e' },
      { href: '/platform/help',          icon: '❓', label: 'Help',          colour: '#a78bfa' },
    ],
  },
]

interface SidebarProps {
  userProfile?: { full_name?: string; avatar_url?: string } | null
  tenant?: { plan?: string } | null
}

export function Sidebar({ userProfile, tenant }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [unread, setUnread]       = useState(0)

  useEffect(() => {
    const load = () =>
      fetch('/api/notifications')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setUnread(d.unread ?? 0) })
        .catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials  = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DM'
  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Individual'

  return (
    <aside style={{
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--pios-surface)',
      borderRight: '1px solid var(--pios-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '18px 0' : '16px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--pios-border)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg, #9b87f5 0%, #5b8def 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, color: '#fff',
          flexShrink: 0, letterSpacing: '-0.02em',
          boxShadow: '0 2px 12px rgba(155,135,245,0.3)',
        }}>P</div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pios-text)', letterSpacing: '-0.02em' }}>PIOS</div>
            <div style={{ fontSize: 10, color: 'var(--pios-dim)', letterSpacing: '0.04em', marginTop: 1 }}>
              v2.9 · {planLabel}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase' as const, color: 'var(--pios-dim)',
                padding: gi === 0 ? '6px 14px 4px' : '14px 14px 4px',
              }}>{group.label}</div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: 'var(--pios-border)', margin: '6px 10px' }} />
            )}

            {group.items.map(item => {
              const active = pathname === item.href ||
                (item.href !== '/platform/dashboard' && pathname?.startsWith(item.href + '/'))
              const isNotif = item.href === '/platform/notifications'
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: collapsed ? '9px 0' : '7px 14px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'rgba(155,135,245,0.10)' : 'transparent',
                      borderLeft: active ? '2px solid var(--ai)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'background 0.12s',
                      color: active ? 'var(--pios-text)' : 'var(--pios-muted)',
                      position: 'relative' as const,
                    }}>
                    <span style={{
                      fontSize: 15, lineHeight: '1', flexShrink: 0,
                      color: active ? ((item as Record<string,string>).colour || 'var(--ai)') : 'inherit',
                    }}>{item.icon}</span>
                    {!collapsed && (
                      <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, flex: 1, lineHeight: '1.2' }}>
                        {item.label}
                        {isNotif && unread > 0 && (
                          <span style={{
                            marginLeft: 6, padding: '1px 5px', borderRadius: 10,
                            fontSize: 9, fontWeight: 700, background: '#ef4444', color: '#fff', verticalAlign: 'middle',
                          }}>{unread > 9 ? '9+' : unread}</span>
                        )}
                      </span>
                    )}
                    {!collapsed && (item as Record<string,string>).badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(155,135,245,0.12)', color: 'var(--ai)',
                        letterSpacing: '0.04em', flexShrink: 0,
                      }}>{(item as Record<string,string>).badge}</span>
                    )}
                    {collapsed && isNotif && unread > 0 && (
                      <span style={{
                        position: 'absolute' as const, top: 6, right: 10,
                        width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--pios-border)', flexShrink: 0 }}>
        <Link href="/platform/settings" style={{ textDecoration: 'none', display: 'block' }}>
          <div
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: collapsed ? '10px 0' : '9px 14px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'var(--pios-muted)', cursor: 'pointer', transition: 'background 0.12s',
            }}>
            <span style={{ fontSize: 15 }}>⚙</span>
            {!collapsed && <span style={{ fontSize: 12.5 }}>Settings</span>}
          </div>
        </Link>
        <div
          onClick={signOut}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: collapsed ? '10px 0' : '10px 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', borderTop: '1px solid var(--pios-border)',
            transition: 'background 0.12s',
          }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--pios-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{userProfile?.full_name || 'Douglas'}</div>
              <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>Sign out</div>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand' : 'Collapse'}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface3)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface2)' }}
        style={{
          position: 'absolute', top: '50%', right: '-11px',
          transform: 'translateY(-50%)',
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 9, color: 'var(--pios-muted)',
          zIndex: 10, transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>{collapsed ? '›' : '‹'}</button>
    </aside>
  )
}
