'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar v3.0 — Investment-Grade UIX
// Syne display font · Domain-coloured icon tiles · Smooth collapse
// PIOS v2.9 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/platform/dashboard', icon: '⊞', label: 'Command Centre', tileColor: 'rgba(139,124,248,0.12)', iconColor: 'var(--ai)' },
    ],
  },
  {
    label: 'Professional',
    items: [
      { href: '/platform/executive',        icon: '⚡', label: 'Executive OS',     badge: 'EOSA™',  tileColor: 'rgba(34,211,238,0.1)',   iconColor: 'var(--pro)' },
      { href: '/platform/consulting',       icon: '◎',  label: 'Consulting',       badge: 'CSA™',   tileColor: 'rgba(139,124,248,0.1)',  iconColor: 'var(--ai)' },
      { href: '/platform/projects',         icon: '◈',  label: 'Projects',                          tileColor: 'rgba(240,160,48,0.1)',   iconColor: 'var(--saas)' },
      { href: '/platform/tasks',            icon: '✓',  label: 'Tasks',                             tileColor: 'rgba(139,124,248,0.1)',  iconColor: 'var(--ai)' },
      { href: '/platform/contracts',        icon: '§',  label: 'Contracts',                         tileColor: 'rgba(79,142,247,0.1)',   iconColor: 'var(--academic)' },
      { href: '/platform/financials',       icon: '↗',  label: 'Group P&L',                         tileColor: 'rgba(16,217,160,0.08)',  iconColor: 'var(--fm)' },
      { href: '/platform/expenses',         icon: '£',  label: 'Expenses',                          tileColor: 'rgba(224,82,114,0.1)',   iconColor: 'var(--dng)' },
      { href: '/platform/payroll',          icon: '◎',  label: 'Payroll',                           tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
      { href: '/platform/ip-vault',         icon: '⊛',  label: 'IP Vault',                          tileColor: 'rgba(139,124,248,0.1)',  iconColor: 'var(--ai)' },
      { href: '/platform/intelligence',     icon: '◉',  label: 'Intelligence',                      tileColor: 'rgba(34,211,238,0.08)',  iconColor: 'var(--pro)' },
      { href: '/platform/time-sovereignty', icon: '⏱',  label: 'Time Sovereignty', badge: 'TSA™',  tileColor: 'rgba(34,211,238,0.08)',  iconColor: 'var(--pro)' },
    ],
  },
  {
    label: 'Academic',
    items: [
      { href: '/platform/academic',     icon: '◈',  label: 'Academic Hub',   tileColor: 'rgba(79,142,247,0.1)',  iconColor: 'var(--academic)' },
      { href: '/platform/research',     icon: '⊕',  label: 'Research',       tileColor: 'rgba(79,142,247,0.1)',  iconColor: 'var(--academic)' },
      { href: '/platform/learning',     icon: '⬡',  label: 'Learning Hub',   tileColor: 'rgba(139,124,248,0.1)', iconColor: 'var(--ai)' },
      { href: '/platform/policy-coach', icon: '⊞',  label: 'Policy Coach',   badge: 'NEW', tileColor: 'rgba(240,160,48,0.1)', iconColor: 'var(--saas)' },
      { href: '/platform/study',        icon: '◷',  label: 'Study Timer',    tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
      { href: '/platform/knowledge',    icon: '⊡',  label: 'SE-MIL',         tileColor: 'rgba(16,217,160,0.08)', iconColor: 'var(--fm)' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/platform/comms',     icon: '◈', label: 'Comms Hub',  badge: 'BICA™', tileColor: 'rgba(34,211,238,0.08)',  iconColor: 'var(--pro)' },
      { href: '/platform/email',     icon: '✉', label: 'Inbox',                      tileColor: 'rgba(16,217,160,0.08)',  iconColor: 'var(--fm)', notifKey: 'email' },
      { href: '/platform/calendar',  icon: '▦', label: 'Calendar',                   tileColor: 'rgba(34,211,238,0.08)',  iconColor: 'var(--pro)' },
      { href: '/platform/meetings',  icon: '◉', label: 'Meetings',                   tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
      { href: '/platform/documents', icon: '▤', label: 'Documents',                  tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
      { href: '/platform/files',     icon: '⊟', label: 'File Intel',                 tileColor: 'rgba(240,160,48,0.08)',  iconColor: 'var(--saas)' },
      { href: '/platform/command',   icon: '⬡', label: 'Live Data',                  tileColor: 'rgba(16,217,160,0.08)',  iconColor: 'var(--fm)' },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/platform/ai', icon: '◉', label: 'NemoClaw™ AI', tileColor: 'rgba(139,124,248,0.12)', iconColor: 'var(--ai)', isAI: true },
    ],
  },
  {
    label: 'Wellness',
    items: [
      { href: '/platform/wellness', icon: '◎', label: 'Wellness Intelligence', tileColor: 'rgba(16,217,160,0.08)', iconColor: 'var(--fm)' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/platform/notifications', icon: '◉', label: 'Notifications', tileColor: 'rgba(240,160,48,0.08)',   iconColor: 'var(--saas)', notifKey: 'notif' },
      { href: '/platform/billing',       icon: '▧', label: 'Billing',       tileColor: 'rgba(16,217,160,0.06)',  iconColor: 'var(--fm)' },
      { href: '/platform/operator',      icon: '⊛', label: 'Operator',      tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
      { href: '/platform/admin',         icon: '⚙', label: 'Admin',         tileColor: 'rgba(224,82,114,0.1)',   iconColor: 'var(--dng)' },
      { href: '/platform/setup',         icon: '⚡', label: 'Setup Guide',   tileColor: 'rgba(240,160,48,0.08)',  iconColor: 'var(--saas)' },
      { href: '/platform/changelog',     icon: '◈', label: "What's New",    tileColor: 'rgba(16,217,160,0.06)',  iconColor: 'var(--fm)' },
      { href: '/platform/help',          icon: '?', label: 'Help',           tileColor: 'rgba(139,124,248,0.08)', iconColor: 'var(--ai)' },
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
    : 'DO'
  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Professional'

  return (
    <aside style={{
      width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--pios-surface)',
      borderRight: '1px solid var(--pios-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Wordmark ── */}
      <div style={{
        height: 56,
        display: 'flex', alignItems: 'center', gap: 11,
        padding: collapsed ? '0' : '0 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--pios-border)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--ai) 0%, var(--academic) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: '#fff',
          boxShadow: '0 0 20px rgba(139,124,248,0.35)', letterSpacing: '-0.02em',
        }}>P</div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
              color: 'var(--pios-text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap',
            }}>PIOS</div>
            <div style={{ fontSize: 10, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              v2.9 · {planLabel}
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0 10px' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Group label */}
            {!collapsed && (
              <div style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase' as const, color: 'var(--pios-dim)',
                padding: gi === 0 ? '6px 14px 3px' : '12px 14px 3px',
                whiteSpace: 'nowrap',
              }}>{group.label}</div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: 'var(--pios-border)', margin: '5px 10px' }} />
            )}

            {group.items.map((item: Record<string, unknown>) => {
              const href = item.href as string
              const icon = item.icon as string
              const label = item.label as string
              const badge = item.badge as string | undefined
              const tileColor = item.tileColor as string
              const iconColor = item.iconColor as string
              const isAI = item.isAI as boolean | undefined
              const isNotif = (item.notifKey as string | undefined) === 'notif'

              const active = pathname === href ||
                (href !== '/platform/dashboard' && pathname?.startsWith(href + '/'))

              return (
                <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: collapsed ? '8px 0' : '6px 14px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? 'rgba(139,124,248,0.08)' : 'transparent',
                      borderLeft: active ? '2px solid var(--ai)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'background 0.12s',
                      color: active ? 'var(--pios-text)' : 'var(--pios-muted)',
                      position: 'relative' as const,
                    }}>

                    {/* Icon tile */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: active ? tileColor : collapsed ? tileColor : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: active ? iconColor : 'inherit',
                      transition: 'all 0.15s',
                    }}>
                      {isAI ? (
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: 'var(--ai)',
                          display: 'block',
                          animation: 'ai-pulse 2.5s ease-in-out infinite',
                        }} />
                      ) : icon}
                    </div>

                    {!collapsed && (
                      <span style={{
                        fontSize: 12.5, fontWeight: active ? 600 : 400,
                        flex: 1, lineHeight: '1.2', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {label}
                        {isNotif && unread > 0 && (
                          <span style={{
                            marginLeft: 6, padding: '1px 5px', borderRadius: 10,
                            fontSize: 9, fontWeight: 700, background: '#e05272', color: '#fff',
                            verticalAlign: 'middle',
                          }}>{unread > 9 ? '9+' : unread}</span>
                        )}
                      </span>
                    )}

                    {/* Badge */}
                    {!collapsed && badge && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: 'var(--ai-subtle)', color: 'var(--ai)',
                        letterSpacing: '0.04em', flexShrink: 0,
                      }}>{badge}</span>
                    )}

                    {/* Unread dot (collapsed) */}
                    {collapsed && isNotif && unread > 0 && (
                      <span style={{
                        position: 'absolute' as const, top: 6, right: 10,
                        width: 6, height: 6, borderRadius: '50%', background: '#e05272',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer / profile ── */}
      <div style={{ borderTop: '1px solid var(--pios-border)', flexShrink: 0 }}>
        <div
          onClick={signOut}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--pios-surface2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: collapsed ? '12px 0' : '10px 14px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', transition: 'background 0.12s',
          }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--ai), var(--academic))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)',
          }}>{initials}</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 12, fontWeight: 700, color: 'var(--pios-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>{userProfile?.full_name || 'Douglas'}</div>
              <div style={{ fontSize: 9.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
                Group CEO · Sign out
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface4)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface3)' }}
        style={{
          position: 'absolute', top: '50%', right: '-12px',
          transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--pios-surface3)', border: '1px solid var(--pios-border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 9, color: 'var(--pios-muted)',
          zIndex: 10, transition: 'all 0.15s', boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        }}>{collapsed ? '›' : '‹'}</button>
    </aside>
  )
}
