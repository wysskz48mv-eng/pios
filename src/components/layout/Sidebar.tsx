'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// PIOS Sidebar — Investment-Grade v3.0
// Design language: VeritasEdge v5.2 glass system
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  surface:     '#0f1225',
  surfaceHov:  'rgba(255,255,255,0.04)',
  border:      'rgba(255,255,255,0.07)',
  borderBright:'rgba(255,255,255,0.14)',
  text:        '#f0f2ff',
  sub:         '#9ba3c8',
  muted:       '#5c6490',
  ai:          '#6c5ce7',
  aiGlow:      'rgba(108,92,231,0.22)',
  aiSubtle:    'rgba(108,92,231,0.08)',
  academic:    '#4f8ef7',
  fm:          '#00c896',
  saas:        '#f4b942',
  pro:         '#38d9f5',
  dng:         '#ff6b9d',
}

const NAV_GROUPS = [
  {
    label: null, color: null,
    items: [
      { href: '/platform/dashboard', icon: '⊞', label: 'Command Centre', accent: '#6c5ce7' },
    ],
  },
  {
    label: 'PROFESSIONAL', color: '#38d9f5',
    items: [
      { href: '/platform/executive',        icon: '⚡', label: 'Executive OS',     badge: 'EOSA™', accent: '#38d9f5' },
      { href: '/platform/consulting',       icon: '◎',  label: 'Consulting',       badge: 'CSA™',  accent: '#6c5ce7' },
      { href: '/platform/projects',         icon: '◈',  label: 'Projects',                         accent: '#f4b942' },
      { href: '/platform/tasks',            icon: '✓',  label: 'Tasks',                            accent: '#6c5ce7' },
      { href: '/platform/contracts',        icon: '§',  label: 'Contracts',                        accent: '#4f8ef7' },
      { href: '/platform/financials',       icon: '↗',  label: 'Group P&L',                        accent: '#00c896' },
      { href: '/platform/expenses',         icon: '£',  label: 'Expenses',                         accent: '#ff6b9d' },
      { href: '/platform/payroll',          icon: '◎',  label: 'Payroll',                          accent: '#6c5ce7' },
      { href: '/platform/ip-vault',         icon: '⊛',  label: 'IP Vault',                         accent: '#6c5ce7' },
      { href: '/platform/intelligence',     icon: '◉',  label: 'Intelligence',                     accent: '#38d9f5' },
      { href: '/platform/time-sovereignty', icon: '⏱',  label: 'Time Sovereignty', badge: 'TSA™', accent: '#38d9f5' },
    ],
  },
  {
    label: 'ACADEMIC', color: '#4f8ef7',
    items: [
      { href: '/platform/academic',     icon: '◈',  label: 'Academic Hub',              accent: '#4f8ef7' },
      { href: '/platform/research',     icon: '⊕',  label: 'Research',                  accent: '#4f8ef7' },
      { href: '/platform/learning',     icon: '⬡',  label: 'Learning Hub',              accent: '#6c5ce7' },
      { href: '/platform/policy-coach', icon: '⊞',  label: 'Policy Coach', badge: 'NEW',accent: '#f4b942' },
      { href: '/platform/study',        icon: '◷',  label: 'Study Timer',               accent: '#6c5ce7' },
      { href: '/platform/knowledge',    icon: '⊡',  label: 'SE-MIL',                    accent: '#00c896' },
    ],
  },
  {
    label: 'WORKSPACE', color: '#00c896',
    items: [
      { href: '/platform/comms',     icon: '◈', label: 'Comms Hub',  badge: 'BICA™', accent: '#38d9f5' },
      { href: '/platform/email',     icon: '✉', label: 'Inbox',                      accent: '#00c896', notifKey: 'email' },
      { href: '/platform/calendar',  icon: '▦', label: 'Calendar',                   accent: '#38d9f5' },
      { href: '/platform/meetings',  icon: '◉', label: 'Meetings',                   accent: '#6c5ce7' },
      { href: '/platform/documents', icon: '▤', label: 'Documents',                  accent: '#6c5ce7' },
      { href: '/platform/files',     icon: '⊟', label: 'File Intel',                 accent: '#f4b942' },
      { href: '/platform/command',   icon: '⬡', label: 'Live Data',                  accent: '#00c896' },
    ],
  },
  {
    label: 'AI', color: '#6c5ce7',
    items: [
      { href: '/platform/ai', icon: '◉', label: 'NemoClaw™ AI', accent: '#6c5ce7', isAI: true },
    ],
  },
  {
    label: 'WELLNESS', color: '#00c896',
    items: [
      { href: '/platform/wellness', icon: '◎', label: 'Wellness Intelligence', accent: '#00c896' },
    ],
  },
  {
    label: 'SYSTEM', color: '#5c6490',
    items: [
      { href: '/platform/notifications', icon: '◉', label: 'Notifications', accent: '#f4b942', notifKey: 'notif' },
      { href: '/platform/billing',       icon: '▧', label: 'Billing',       accent: '#00c896' },
      { href: '/platform/operator',      icon: '⊛', label: 'Operator',      accent: '#6c5ce7' },
      { href: '/platform/admin',         icon: '⚙', label: 'Admin',         accent: '#ff6b9d' },
      { href: '/platform/setup',         icon: '⚡', label: 'Setup Guide',   accent: '#f4b942' },
      { href: '/platform/changelog',     icon: '◈', label: "What's New",    accent: '#00c896' },
      { href: '/platform/help',          icon: '?', label: 'Help',           accent: '#6c5ce7' },
    ],
  },
]

interface SidebarProps {
  userProfile?: Record<string,string> | null
  tenant?: Record<string,string> | null
}

export function Sidebar({ userProfile, tenant }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [unread,    setUnread]    = useState(0)

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

  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DM'
  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Professional'
  const fullName  = userProfile?.full_name || 'Douglas Masuku'
  const jobTitle  = userProfile?.job_title || 'Group CEO'

  const W = collapsed ? 56 : 224

  return (
    <aside style={{
      width: W, minWidth: W, height: '100vh',
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Wordmark ── */}
      <div style={{
        height: 60,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: collapsed ? '0' : '0 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #6c5ce7 0%, #4f8ef7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff',
          boxShadow: `0 0 24px ${C.aiGlow}, 0 2px 8px rgba(0,0,0,0.4)`,
          letterSpacing: '-0.02em',
        }}>P</div>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
              color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1,
            }}>PIOS</div>
            <div style={{
              fontSize: 9, color: C.muted, letterSpacing: '0.05em',
              fontFamily: "'JetBrains Mono', monospace", marginTop: 2,
            }}>v3.0 · {planLabel}</div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0 12px' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {!collapsed && group.label && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '14px 18px 5px',
              }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: group.color ?? C.muted, flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  color: C.muted, fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: 'nowrap',
                }}>{group.label}</span>
              </div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: C.border, margin: '6px 12px' }} />
            )}

            {group.items.map((item: Record<string,unknown>) => {
              const href    = item.href as string
              const icon    = item.icon as string
              const label   = item.label as string
              const badge   = item.badge as string | undefined
              const accent  = item.accent as string
              const isAI    = item.isAI as boolean | undefined
              const isNotif = (item.notifKey as string | undefined) === 'notif'

              const active = pathname === href ||
                (href !== '/platform/dashboard' && pathname?.startsWith(href + '/'))

              return (
                <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = C.surfaceHov }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
                      padding: collapsed ? '9px 0' : '7px 18px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? `linear-gradient(90deg, ${accent}14 0%, transparent 100%)` : 'transparent',
                      borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'background 0.1s',
                      position: 'relative' as const,
                    }}>

                    {/* Icon */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isAI ? 0 : 12,
                      color: active ? accent : C.muted,
                      background: active ? `${accent}18` : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                      {isAI ? (
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: C.ai, display: 'block',
                          boxShadow: `0 0 8px ${C.aiGlow}`,
                          animation: 'ai-pulse 2.5s ease-in-out infinite',
                        }} />
                      ) : icon}
                    </div>

                    {!collapsed && (
                      <>
                        <span style={{
                          fontSize: 12.5, fontWeight: active ? 600 : 400,
                          color: active ? C.text : C.sub,
                          flex: 1, whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          letterSpacing: active ? '-0.01em' : '0',
                          transition: 'color 0.1s',
                        }}>
                          {label}
                          {isNotif && unread > 0 && (
                            <span style={{
                              marginLeft: 6, padding: '1px 5px', borderRadius: 10,
                              fontSize: 9, fontWeight: 700, background: '#e05272', color: '#fff',
                              verticalAlign: 'middle', fontFamily: "'JetBrains Mono', monospace",
                            }}>{unread > 9 ? '9+' : unread}</span>
                          )}
                        </span>
                        {badge && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4, flexShrink: 0,
                            background: badge === 'NEW' ? 'rgba(244,185,66,0.15)' : `${accent}14`,
                            color: badge === 'NEW' ? C.saas : accent,
                            letterSpacing: '0.06em',
                            border: `1px solid ${badge === 'NEW' ? 'rgba(244,185,66,0.3)' : `${accent}30`}`,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{badge}</span>
                        )}
                      </>
                    )}

                    {collapsed && isNotif && unread > 0 && (
                      <span style={{
                        position: 'absolute' as const, top: 7, right: 10,
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#e05272', boxShadow: '0 0 6px rgba(224,82,114,0.6)',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand' : 'Collapse'}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.aiSubtle; (e.currentTarget as HTMLButtonElement).style.borderColor = C.ai }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surface; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderBright }}
        style={{
          position: 'absolute', top: '50%', right: -11, transform: 'translateY(-50%)',
          width: 22, height: 22, borderRadius: '50%',
          background: C.surface, border: `1px solid ${C.borderBright}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 8, color: C.muted,
          zIndex: 20, transition: 'all 0.15s',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>{collapsed ? '›' : '‹'}</button>

      {/* ── User footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div
          onClick={signOut}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.surfaceHov }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '14px 0' : '12px 18px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', transition: 'background 0.12s',
          }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6c5ce7, #4f8ef7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: `0 0 14px ${C.aiGlow}`,
          }}>{initials}</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 700, color: C.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>{fullName}</div>
              <div style={{
                fontSize: 9.5, color: C.muted,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{jobTitle} · Sign out</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
