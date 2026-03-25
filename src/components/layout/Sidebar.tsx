'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/platform/dashboard', icon: '⊞', label: 'Command Centre' },
  { href: '/platform/academic',  icon: '🎓', label: 'Academic',       colour: '#6c8eff' as string },
  { href: '/platform/learning',  icon: '🗺️', label: 'Learning Hub',   colour: '#8B5CF6' as string },
  { href: '/platform/research',  icon: '🔬', label: 'Research Hub',   colour: '#6c8eff' as string },
  { href: '/platform/tasks',     icon: '✓',  label: 'Tasks',          colour: '#a78bfa' as string },
  { href: '/platform/calendar',  icon: '📅', label: 'Calendar',       colour: '#22d3ee' as string },
  { href: '/platform/meetings',  icon: '🗒️', label: 'Meetings',       colour: '#a78bfa' as string },
  { href: '/platform/email',     icon: '✉',  label: 'Inbox',          colour: '#2dd4a0' as string },
  { href: '/platform/files',     icon: '🗂️', label: 'File Intel',     colour: '#f59e0b' as string },
  { href: '/platform/documents',  icon: '📄', label: 'Documents',       colour: '#8B5CF6' as string },
  { href: '/platform/executive',        icon: '⚡', label: 'Executive OS',     colour: '#22d3ee' as string, badge: 'EOSA™' },
  { href: '/platform/consulting',       icon: '◎', label: 'Consulting',        colour: '#a78bfa' as string, badge: 'CSA™' },
  { href: '/platform/comms',            icon: '📡', label: 'Comms Hub',          colour: '#3b82f6' as string, badge: 'BICA™' },
  { href: '/platform/time-sovereignty', icon: '⏱', label: 'Time Sovereignty',  colour: '#22d3ee' as string, badge: 'TSA™' },
  { href: '/platform/ip-vault',          icon: '🔐', label: 'IP Vault',           colour: '#a78bfa' as string },
  { href: '/platform/knowledge',         icon: '🧠', label: 'SE-MIL',             colour: '#0d9488' as string },
  { href: '/platform/notifications',     icon: '🔔', label: 'Notifications',      colour: '#f59e0b' as string },
  { href: '/platform/contracts',         icon: '📑', label: 'Contracts',          colour: '#3b82f6' as string },
  { href: '/platform/financials',        icon: '📈', label: 'Group P&L',          colour: '#22c55e' as string },
  { href: '/platform/intelligence',icon: '📡',label: 'Intelligence',     colour: '#22d3ee' as string },
  { href: '/platform/payroll',   icon: '💳', label: 'Payroll',        colour: '#a78bfa' as string },
  { href: '/platform/projects',  icon: '◈',  label: 'Projects',       colour: '#f59e0b' as string },
  { href: '/platform/command',   icon: '⬡',  label: 'Live Data',      colour: '#22c55e' as string },
  { href: '/platform/expenses',  icon: '£',  label: 'Expenses',       colour: '#e05a7a' as string },
  { href: '/platform/ai',        icon: '◉',  label: 'AI Companion',   colour: '#a78bfa' as string },
  { href: '/platform/help',       icon: '❓', label: 'Help',           colour: '#a78bfa' as string },
  { href: '/platform/billing',     icon: '💳', label: 'Billing',        colour: '#22c55e' as string },
  { href: '/platform/changelog',   icon: '📋', label: "What's New",     colour: '#22c55e' as string },
  { href: '/platform/setup',       icon: '⚡', label: 'Setup Guide',    colour: '#f59e0b' as string },
  { href: '/platform/smoke',     icon: '✓',  label: 'Smoke Test',     colour: '#22c55e' as string },
  { href: '/platform/operator',       icon: '🏷',  label: 'Operator Config',  colour: '#8b5cf6' as string },
  { href: '/platform/admin',          icon: '⚙',  label: 'Admin',            colour: '#ef4444' as string },
  { href: '/platform/study',     icon: '⏱', label: 'Study Timer',    colour: '#8b5cf6' as string },
  { href: '/platform/nps',       icon: '📊', label: 'Feedback',       colour: '#0ECFB0' as string },
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
  const [searchOpen, setSearchOpen]     = useState(false)
  const [searchQ, setSearchQ]           = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching]       = useState(false)
  const searchRef                        = useRef<HTMLInputElement>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQ(''); setSearchResults([]) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    // Poll notifications every 60s
    const load = () =>
      fetch('/api/notifications')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setUnread(d.unread ?? 0) })
        .catch(() => {})
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const doSearch = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const r = await fetch('/api/search?q=' + encodeURIComponent(q))
      const d = await r.json()
      setSearchResults(d.results ?? [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

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
              v2.2 · {planLabel}
            </div>
          </div>
        )}
      </div>


      {/* ── Search ── */}
      {!collapsed && (
        <div style={{ padding: '0 8px 8px' }}>
          <button onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50) }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
              borderRadius:8, background:'var(--pios-surface2)', border:'1px solid var(--pios-border)',
              color:'var(--pios-dim)', cursor:'pointer', fontSize:12, textAlign:'left' as const }}>
            <span style={{ fontSize:14 }}>🔍</span>
            <span style={{ flex:1 }}>Search…</span>
            <span style={{ fontSize:10, opacity:0.5 }}>⌘K</span>
          </button>
        </div>
      )}

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div style={{ position:'fixed' as const, inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
          onClick={e => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQ(''); setSearchResults([]) } }}>
          <div style={{ width:'100%', maxWidth:560, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--pios-border)' }}>
              <span style={{ fontSize:16, color:'var(--pios-dim)' }}>🔍</span>
              <input ref={searchRef} value={searchQ}
                onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value) }}
                placeholder="Search tasks, projects, meetings, files, knowledge…"
                style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:'var(--pios-text)', fontFamily:'inherit' }} />
              {searching && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>⟳</span>}
              <button onClick={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]) }}
                style={{ background:'none', border:'1px solid var(--pios-border)', borderRadius:4, padding:'2px 6px', fontSize:10, color:'var(--pios-dim)', cursor:'pointer' }}>ESC</button>
            </div>
            {searchResults.length > 0 ? (
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {searchResults.map((r: any, i: number) => {
                  const typeColors: Record<string,string> = {
                    task:'#a78bfa', project:'#22d3ee', meeting:'#2dd4a0', file:'#f59e0b',
                    knowledge:'#0d9488', expense:'#f59e0b', contract:'#3b82f6', ip_asset:'#e05a7a',
                  }
                  const color = typeColors[r.type] ?? '#64748b'
                  return (
                    <a key={i} href={r.href} onClick={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]) }}
                      style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 16px',
                        borderBottom:'1px solid var(--pios-border)', textDecoration:'none',
                        cursor:'pointer', transition:'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background='var(--pios-surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, background:color+'20', color, flexShrink:0, marginTop:3, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>
                        {r.type.replace('_',' ')}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--pios-text)', marginBottom:2 }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize:11, color:'var(--pios-dim)' }}>{r.subtitle}</div>}
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : searchQ.length >= 2 && !searching ? (
              <div style={{ padding:'32px 16px', textAlign:'center' as const, color:'var(--pios-muted)', fontSize:13 }}>
                No results for "{searchQ}"
              </div>
            ) : searchQ.length < 2 ? (
              <div style={{ padding:'20px 16px', color:'var(--pios-dim)', fontSize:12 }}>
                Type at least 2 characters to search across tasks, projects, meetings, files, knowledge, expenses, contracts, and IP assets.
              </div>
            ) : null}
          </div>
        </div>
      )}

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
                  color: active ? (String((item as any).colour || '') || 'var(--ai)') : 'inherit',
                }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, flex: 1 }}>
                    {item.label}
                    {item.href === '/platform/notifications' && unread > 0 && (
                      <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: '#ef4444', color: '#fff' }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                )}
                {!collapsed && (item as any).badge && (
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', letterSpacing: '0.04em', flexShrink: 0 }}>
                    {(item as any).badge}
                  </span>
                )}
              </div>
            </Link>
        
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid var(--pios-border)', padding: '8px 0' }}>
        <Link href="/platform/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '10px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--pios-muted)', cursor: 'pointer',
            position: 'relative' as const,
          }}>
            <span style={{ fontSize: '16px', position: 'relative' as const }}>
              🔔
              {unread > 0 && (
                <span style={{
                  position: 'absolute' as const, top: -4, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            {!collapsed && (
              <span style={{ fontSize: '13px' }}>
                Notifications{unread > 0 ? ` (${unread})` : ''}
              </span>
            )}
          </div>
        </Link>
        <Link href="/platform/notifications" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '10px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--pios-muted)', cursor: 'pointer', position: 'relative' as const,
          }}>
            <span style={{ fontSize: '16px', position: 'relative' as const }}>
              🔔
              {unread > 0 && (
                <span style={{
                  position: 'absolute' as const, top: -4, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unread > 9 ? '9+' : unread}</span>
              )}
            </span>
            {!collapsed && (
              <span style={{ fontSize: '13px' }}>
                Notifications{unread > 0 ? ` (${unread})` : ''}
              </span>
            )}
          </div>
        </Link>
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
