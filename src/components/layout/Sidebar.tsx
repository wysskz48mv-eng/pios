'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Obsidian Command — Sidebar v4.0 ──────────────────────────────────────────
// True black (#080808) · Instrument Serif · DM Mono · SVG icons
// Single violet accent #6349FF · Matches login page exactly
// VeritasIQ Technologies Ltd

const C = {
  bg:          '#080808',
  surface:     '#0f0f0f',
  surfaceHov:  'rgba(255,255,255,0.04)',
  border:      'rgba(255,255,255,0.07)',
  border2:     'rgba(255,255,255,0.12)',
  text:        '#f4f4f5',
  sub:         '#a1a1aa',
  muted:       '#71717a',
  dim:         '#3f3f46',
  violet:      '#6349FF',
  violetSubtle:'rgba(99,73,255,0.09)',
  violetGlow:  'rgba(99,73,255,0.22)',
  academic:    '#4f8ef7',
  pro:         '#38d9f5',
  fm:          '#10b981',
  amber:       '#f59e0b',
  rose:        '#f43f5e',
}

// ── SVG icon set — consistent 14×14 stroked icons ───────────────────────────
const Icon = ({ name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string }) => {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 } as React.CSSProperties
  const icons: Record<string, React.ReactNode> = {
    dashboard: <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.1"/><rect x="7.5" y="1" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.1"/><rect x="1" y="7.5" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.1"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.2" stroke={color} strokeWidth="1.1"/></svg>,
    executive:  <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L12.5 4.5V9.5L7 12.5L1.5 9.5V4.5L7 1.5Z" stroke={color} strokeWidth="1.1"/></svg>,
    consulting: <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><circle cx="7" cy="7" r="2" stroke={color} strokeWidth="1.1"/></svg>,
    projects:   <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="9" rx="1.5" stroke={color} strokeWidth="1.1"/><path d="M4 3V2.5C4 1.67 4.67 1 5.5 1H8.5C9.33 1 10 1.67 10 2.5V3" stroke={color} strokeWidth="1.1"/></svg>,
    tasks:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 7L5 10L12 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    contracts:  <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="2.5" y="1.5" width="9" height="11" rx="1.5" stroke={color} strokeWidth="1.1"/><line x1="5" y1="5" x2="9" y2="5" stroke={color} strokeWidth="1"/><line x1="5" y1="7.5" x2="9" y2="7.5" stroke={color} strokeWidth="1"/><line x1="5" y1="10" x2="7.5" y2="10" stroke={color} strokeWidth="1"/></svg>,
    financials: <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 10L5 6.5L7.5 8.5L12 3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    expenses:   <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M7 4V10M5 5.5H8C8.55 5.5 9 5.95 9 6.5C9 7.05 8.55 7.5 8 7.5H6C5.45 7.5 5 7.95 5 8.5C5 9.05 5.45 9.5 6 9.5H9" stroke={color} strokeWidth="1" strokeLinecap="round"/></svg>,
    payroll:    <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke={color} strokeWidth="1.1"/><circle cx="7" cy="7" r="1.5" stroke={color} strokeWidth="1"/><line x1="3" y1="7" x2="4.5" y2="7" stroke={color} strokeWidth="1"/><line x1="9.5" y1="7" x2="11" y2="7" stroke={color} strokeWidth="1"/></svg>,
    ipvault:    <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L12 3.5V7.5C12 10 9.5 12 7 12.5C4.5 12 2 10 2 7.5V3.5L7 1.5Z" stroke={color} strokeWidth="1.1"/></svg>,
    intelligence:<svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M4.5 7C4.5 5.62 5.62 4.5 7 4.5C8.38 4.5 9.5 5.62 9.5 7" stroke={color} strokeWidth="1"/><circle cx="7" cy="7" r="1" fill={color}/></svg>,
    time:       <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M7 4V7L9 9" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg>,
    academic:   <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 2L13 5L7 8L1 5L7 2Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/><path d="M4 6.5V10C4 10 5 12 7 12C9 12 10 10 10 10V6.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg>,
    research:   <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke={color} strokeWidth="1.1"/><path d="M9 9L12.5 12.5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>,
    learning:   <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke={color} strokeWidth="1.1"/><path d="M5 5H9M5 7H9M5 9H7" stroke={color} strokeWidth="1" strokeLinecap="round"/></svg>,
    policy:     <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L12 4V9C12 11 9.5 12.5 7 13C4.5 12.5 2 11 2 9V4L7 1.5Z" stroke={color} strokeWidth="1.1"/><path d="M5 7L6.5 8.5L9 6" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    study:      <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M7 4V7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="9.5" r="0.6" fill={color}/></svg>,
    knowledge:  <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke={color} strokeWidth="1.1"/><path d="M5 4.5H9M5 7H9M5 9.5H7.5" stroke={color} strokeWidth="1" strokeLinecap="round"/></svg>,
    comms:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M1.5 2.5H12.5V9.5H8L5 12V9.5H1.5V2.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
    email:      <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke={color} strokeWidth="1.1"/><path d="M1.5 5L7 8.5L12.5 5" stroke={color} strokeWidth="1"/></svg>,
    calendar:   <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke={color} strokeWidth="1.1"/><line x1="1.5" y1="6" x2="12.5" y2="6" stroke={color} strokeWidth="1"/><line x1="4.5" y1="1.5" x2="4.5" y2="3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/><line x1="9.5" y1="1.5" x2="9.5" y2="3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>,
    meetings:   <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="2.5" stroke={color} strokeWidth="1.1"/><circle cx="10" cy="4.5" r="2" stroke={color} strokeWidth="1.1"/><path d="M1 12C1 10.07 2.79 8.5 5 8.5C7.21 8.5 9 10.07 9 12" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><path d="M10 7.5C11.5 7.5 13 8.7 13 10.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg>,
    documents:  <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M3 1.5H9L12 4.5V12.5H3V1.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/><path d="M9 1.5V4.5H12" stroke={color} strokeWidth="1"/><line x1="5" y1="7" x2="10" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round"/><line x1="5" y1="9.5" x2="8.5" y2="9.5" stroke={color} strokeWidth="1" strokeLinecap="round"/></svg>,
    files:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 2.5H7L9 4.5H12V11.5H2V2.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
    livedata:   <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 10L5 6.5L7.5 8.5L12 3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="3.5" r="1.2" fill={color}/></svg>,
    ai:         <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1.1"/><circle cx="7" cy="7" r="1" fill={color}/><line x1="7" y1="1.5" x2="7" y2="3.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="10.5" x2="7" y2="12.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><line x1="1.5" y1="7" x2="3.5" y2="7" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><line x1="10.5" y1="7" x2="12.5" y2="7" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg>,
    wellness:   <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 11.5C7 11.5 2 8.5 2 5.5C2 3.57 3.57 2 5.5 2C6.5 2 7 3 7 3C7 3 7.5 2 8.5 2C10.43 2 12 3.57 12 5.5C12 8.5 7 11.5 7 11.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
    notif:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5C4.5 1.5 3 3.5 3 5.5V9L1.5 10.5H12.5L11 9V5.5C11 3.5 9.5 1.5 7 1.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/><path d="M5.5 11.5C5.5 12.05 6.17 12.5 7 12.5C7.83 12.5 8.5 12.05 8.5 11.5" stroke={color} strokeWidth="1"/></svg>,
    billing:    <svg style={s} viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke={color} strokeWidth="1.1"/><line x1="1.5" y1="6.5" x2="12.5" y2="6.5" stroke={color} strokeWidth="1"/><line x1="4" y1="9" x2="6" y2="9" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>,
    operator:   <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke={color} strokeWidth="1.1"/><path d="M7 1.5V4M7 10V12.5M1.5 7H4M10 7H12.5M3.5 3.5L5.5 5.5M8.5 8.5L10.5 10.5M10.5 3.5L8.5 5.5M5.5 8.5L3.5 10.5" stroke={color} strokeWidth="1" strokeLinecap="round"/></svg>,
    admin:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5L8.5 2.5H11.5V5.5L12.5 7L11.5 8.5V11.5H8.5L7 12.5L5.5 11.5H2.5V8.5L1.5 7L2.5 5.5V2.5H5.5L7 1.5Z" stroke={color} strokeWidth="1"/><circle cx="7" cy="7" r="2" stroke={color} strokeWidth="1"/></svg>,
    setup:      <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 10L5.5 6.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><path d="M7 2.5L11.5 7L9.5 9L5 4.5L7 2.5Z" stroke={color} strokeWidth="1.1" strokeLinejoin="round"/></svg>,
    changelog:  <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M7 4V7L9 8.5" stroke={color} strokeWidth="1.1" strokeLinecap="round"/></svg>,
    help:       <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.1"/><path d="M5.5 5.5C5.5 4.67 6.17 4 7 4C7.83 4 8.5 4.67 8.5 5.5C8.5 6.33 7.83 7 7 7V8" stroke={color} strokeWidth="1.1" strokeLinecap="round"/><circle cx="7" cy="10" r="0.6" fill={color}/></svg>,
  }
  return <>{icons[name] ?? icons['dashboard']}</>
}

const NAV_GROUPS = [
  {
    label: null, color: null,
    items: [
      { href: '/platform/dashboard', icon: 'dashboard', label: 'Command Centre', accent: C.violet },
    ],
  },
  {
    label: 'Professional', color: C.pro,
    items: [
      { href: '/platform/executive',        icon: 'executive',    label: 'Executive OS',      badge: 'EOSA™', accent: C.pro },
      { href: '/platform/consulting',       icon: 'consulting',   label: 'Consulting',        badge: 'CSA™',  accent: C.violet },
      { href: '/platform/projects',         icon: 'projects',     label: 'Projects',                          accent: C.amber },
      { href: '/platform/tasks',            icon: 'tasks',        label: 'Tasks',                             accent: C.violet },
      { href: '/platform/contracts',        icon: 'contracts',    label: 'Contracts',                         accent: C.academic },
      { href: '/platform/financials',       icon: 'financials',   label: 'Group P&L',                         accent: C.fm },
      { href: '/platform/expenses',         icon: 'expenses',     label: 'Expenses',                          accent: C.rose },
      { href: '/platform/payroll',          icon: 'payroll',      label: 'Payroll',                           accent: C.violet },
      { href: '/platform/ip-vault',         icon: 'ipvault',      label: 'IP Vault',                          accent: C.violet },
      { href: '/platform/intelligence',     icon: 'intelligence', label: 'Intelligence',                      accent: C.pro },
      { href: '/platform/time-sovereignty', icon: 'time',         label: 'Time Sovereignty',  badge: 'TSA™',  accent: C.pro },
    ],
  },
  {
    label: 'Academic', color: C.academic,
    items: [
      { href: '/platform/academic',     icon: 'academic',   label: 'Academic Hub',            accent: C.academic },
      { href: '/platform/research',     icon: 'research',   label: 'Research',                accent: C.academic },
      { href: '/platform/learning',     icon: 'learning',   label: 'Learning Hub',            accent: C.violet },
      { href: '/platform/policy-coach', icon: 'policy',     label: 'Policy Coach', badge:'NEW',accent: C.amber },
      { href: '/platform/study',        icon: 'study',      label: 'Study Timer',             accent: C.violet },
      { href: '/platform/knowledge',    icon: 'knowledge',  label: 'SE-MIL',                  accent: C.fm },
    ],
  },
  {
    label: 'Workspace', color: C.fm,
    items: [
      { href: '/platform/comms',     icon: 'comms',     label: 'Comms Hub',  badge: 'BICA™', accent: C.pro },
      { href: '/platform/email',     icon: 'email',     label: 'Inbox',                      accent: C.fm, notifKey: 'email' },
      { href: '/platform/calendar',  icon: 'calendar',  label: 'Calendar',                   accent: C.pro },
      { href: '/platform/meetings',  icon: 'meetings',  label: 'Meetings',                   accent: C.violet },
      { href: '/platform/documents', icon: 'documents', label: 'Documents',                  accent: C.violet },
      { href: '/platform/files',     icon: 'files',     label: 'File Intel',                 accent: C.amber },
      { href: '/platform/command',   icon: 'livedata',  label: 'Live Data',                  accent: C.fm },
    ],
  },
  {
    label: 'AI', color: C.violet,
    items: [
      { href: '/platform/ai',      icon: 'ai',      label: 'NemoClaw™ AI',          accent: C.violet, isAI: true },
      { href: '/platform/wellness',icon: 'wellness', label: 'Wellness Intelligence', accent: C.fm },
    ],
  },
  {
    label: 'System', color: C.dim,
    items: [
      { href: '/platform/notifications', icon: 'notif',     label: 'Notifications',  accent: C.amber, notifKey: 'notif' },
      { href: '/platform/billing',       icon: 'billing',   label: 'Billing',        accent: C.fm },
      { href: '/platform/operator',      icon: 'operator',  label: 'Operator',       accent: C.violet },
      { href: '/platform/admin',         icon: 'admin',     label: 'Admin',          accent: C.rose },
      { href: '/platform/setup',         icon: 'setup',     label: 'Setup Guide',    accent: C.amber },
      { href: '/platform/changelog',     icon: 'changelog', label: "What's New",     accent: C.fm },
      { href: '/platform/help',          icon: 'help',      label: 'Help',           accent: C.violet },
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

  const initials  = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DM'
  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)
    : 'Professional'
  const fullName  = userProfile?.full_name || 'Douglas Masuku'
  const jobTitle  = userProfile?.job_title || 'Group CEO'
  const W = collapsed ? 52 : 220

  // Hex logomark SVG
  const HexMark = () => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ flexShrink: 0 }}>
      <polygon points="13,1.5 23.5,7.5 23.5,18.5 13,24.5 2.5,18.5 2.5,7.5"
        fill="rgba(99,73,255,0.1)" stroke="rgba(99,73,255,0.42)" strokeWidth="1"/>
      <polygon points="13,6 19.5,9.75 19.5,16.25 13,20 6.5,16.25 6.5,9.75"
        fill="none" stroke="rgba(99,73,255,0.16)" strokeWidth="0.6"/>
      <text x="13" y="17" textAnchor="middle"
        style={{ fontFamily:'Georgia,serif', fontWeight:900, fontSize:9, fill:'rgba(130,108,255,0.88)' }}>P</text>
    </svg>
  )

  return (
    <aside style={{
      width: W, minWidth: W, height: '100vh',
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1), min-width 0.2s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Wordmark ── */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <HexMark />
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic', fontSize: 15, fontWeight: 400,
              color: C.text, letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>PIOS</div>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 8.5, color: C.dim, letterSpacing: '0.07em', marginTop: 2,
            }}>v3.0 · {planLabel}</div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0 10px' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Group label */}
            {!collapsed && group.label && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 16px 4px',
              }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 8.5, fontWeight: 500, letterSpacing: '0.12em',
                  color: C.dim, textTransform: 'uppercase' as const, whiteSpace: 'nowrap',
                }}>{group.label}</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: C.border, margin: '5px 10px' }} />
            )}

            {group.items.map((item: Record<string, unknown>) => {
              const href     = item.href as string
              const iconName = item.icon as string
              const label    = item.label as string
              const badge    = item.badge as string | undefined
              const accent   = item.accent as string
              const isAI     = item.isAI as boolean | undefined
              const isNotif  = (item.notifKey as string | undefined) === 'notif'

              const active = pathname === href ||
                (href !== '/platform/dashboard' && pathname?.startsWith(href + '/'))

              return (
                <Link key={href} href={href} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    onMouseEnter={e => { if (!active)(e.currentTarget as HTMLDivElement).style.background = C.surfaceHov }}
                    onMouseLeave={e => { if (!active)(e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: collapsed ? 0 : 9,
                      padding: collapsed ? '8px 0' : '6px 16px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: active ? `${accent}0d` : 'transparent',
                      borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
                      cursor: 'pointer', transition: 'background 0.1s',
                      position: 'relative' as const,
                    }}>

                    {/* SVG Icon */}
                    <div style={{
                      width: 20, height: 20, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      color: active ? accent : C.muted,
                      transition: 'color 0.12s',
                    }}>
                      {isAI ? (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: C.violet,
                          boxShadow: `0 0 8px ${C.violetGlow}`,
                        }} className="ai-pulse" />
                      ) : (
                        <Icon name={iconName} size={13} color={active ? accent : C.muted} />
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <span style={{
                          fontSize: 12.5, fontWeight: active ? 500 : 400,
                          color: active ? C.text : C.sub,
                          flex: 1, whiteSpace: 'nowrap' as const,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          letterSpacing: '-0.005em',
                          transition: 'color 0.1s',
                        }}>
                          {label}
                          {isNotif && unread > 0 && (
                            <span style={{
                              marginLeft: 6, padding: '1px 5px', borderRadius: 10,
                              fontSize: 8.5, fontWeight: 700, background: C.rose,
                              color: '#fff', verticalAlign: 'middle',
                              fontFamily: "'DM Mono', monospace",
                            }}>{unread > 9 ? '9+' : unread}</span>
                          )}
                        </span>
                        {badge && (
                          <span style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 8, fontWeight: 500, padding: '1.5px 5px',
                            borderRadius: 3, flexShrink: 0,
                            background: badge === 'NEW' ? `${C.amber}14` : `${accent}10`,
                            color: badge === 'NEW' ? C.amber : accent,
                            letterSpacing: '0.06em',
                            border: `1px solid ${badge === 'NEW' ? `${C.amber}30` : `${accent}25`}`,
                          }}>{badge}</span>
                        )}
                      </>
                    )}

                    {/* Collapsed notification dot */}
                    {collapsed && isNotif && unread > 0 && (
                      <span style={{
                        position: 'absolute' as const, top: 7, right: 9,
                        width: 5, height: 5, borderRadius: '50%',
                        background: C.rose,
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
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.violetSubtle; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,73,255,0.4)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surface; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border2 }}
        style={{
          position: 'absolute', top: '50%', right: -10,
          transform: 'translateY(-50%)',
          width: 20, height: 20, borderRadius: '50%',
          background: C.surface, border: `1px solid ${C.border2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 9, color: C.muted,
          zIndex: 20, transition: 'all 0.15s',
          boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
        }}>
        {collapsed ? '›' : '‹'}
      </button>

      {/* ── User footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div
          onClick={signOut}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.surfaceHov }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: collapsed ? '12px 0' : '11px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer', transition: 'background 0.12s',
          }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(99,73,255,0.15)',
            border: '1px solid rgba(99,73,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace",
            fontSize: 9, fontWeight: 700, color: 'rgba(169,157,255,0.9)',
            letterSpacing: '0.04em',
          }}>{initials}</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 500, color: C.text,
                whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', letterSpacing: '-0.01em',
              }}>{fullName}</div>
              <div style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9, color: C.muted, letterSpacing: '0.02em',
              }}>{jobTitle} · sign out</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
