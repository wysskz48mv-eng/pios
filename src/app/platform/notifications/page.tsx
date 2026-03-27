/**
 * /platform/notifications — PIOS Notification Centre
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Bell, CheckCheck, Loader2, AlertCircle, CheckCircle2,
         Info, Zap, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Notification = {
  id: string; type: string; title: string; body?: string; message?: string
  read: boolean; action_url?: string; created_at: string; domain?: string
}

const TYPE_META: Record<string, {
  icon: React.ElementType
  color: string; bg: string; border: string; label: string
}> = {
  alert:   { icon: AlertCircle,   color: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)',  label: 'Alert' },
  warning: { icon: AlertTriangle, color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)',   label: 'Warning' },
  success: { icon: CheckCircle2,  color: '#34d399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)',   label: 'Success' },
  info:    { icon: Info,          color: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.2)',   label: 'Info' },
  ai:      { icon: Zap,           color: 'var(--ai3)', bg: 'var(--ai-subtle)', border: 'rgba(99,73,255,0.25)', label: 'AI' },
}

const DOMAIN_LABELS: Record<string, string> = {
  tasks: 'Tasks', business: 'Business', wellness: 'Wellness',
  billing: 'Billing', ai: 'AI', academic: 'Academic',
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsPage() {
  const [notifs, setNotifs]         = useState<Notification[]>([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter]         = useState<string>('all')
  const [marking, setMarking]       = useState(false)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [hovered, setHovered]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notifications?limit=60')
      const d = await r.json()
      setNotifs(d.notifications ?? [])
    } catch { setNotifs([]) }
    setLoading(false)
  }, [])

  const generate = async () => {
    setGenerating(true)
    try { await fetch('/api/notifications/generate', { method: 'POST' }); await load() }
    catch { /* silent */ }
    setGenerating(false)
  }

  const markAll = async () => {
    setMarking(true)
    await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read' }),
    }).catch(() => {})
    setNotifs(p => p.map(n => ({ ...n, read: true })))
    setMarking(false)
  }

  const markOne = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const deleteOne = async (id: string) => {
    setDeleting(id)
    await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => {})
    setNotifs(p => p.filter(n => n.id !== id))
    setDeleting(null)
  }

  useEffect(() => { load() }, [load])

  const types   = Array.from(new Set(notifs.map(n => n.type).filter(Boolean))) as string[]
  const domains = Array.from(new Set(notifs.map(n => n.domain).filter(Boolean))) as string[]

  const filtered = filter === 'all'    ? notifs
    : filter === 'unread'              ? notifs.filter(n => !n.read)
    : notifs.filter(n => n.domain === filter || n.type === filter)

  const unread = notifs.filter(n => !n.read).length
  const filters = ['all', 'unread', ...types, ...domains].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <Bell size={18} color="var(--ai3)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.03em' }}>
              Notifications
            </h1>
            {unread > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                padding: '2px 7px', borderRadius: 20,
                background: 'rgba(248,113,113,0.1)', color: '#f87171',
                border: '1px solid rgba(248,113,113,0.25)', letterSpacing: '0.04em',
              }}>{unread} unread</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
            Renewal alerts, wellness signals, task overdue, trial warnings
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={generate} disabled={generating} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--pios-border2)',
            color: 'var(--pios-muted)', fontSize: 12, fontFamily: 'var(--font-sans)',
            opacity: generating ? 0.5 : 1, transition: 'all 0.15s',
          }}>
            <RefreshCw size={13} style={{ animation: generating ? 'spin 0.8s linear infinite' : 'none' }} />
            {generating ? 'Scanning…' : 'Scan for alerts'}
          </button>
          {unread > 0 && (
            <button onClick={markAll} disabled={marking} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--pios-border2)',
              color: 'var(--pios-muted)', fontSize: 12, fontFamily: 'var(--font-sans)',
              opacity: marking ? 0.5 : 1,
            }}>
              {marking ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCheck size={13} />}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 20 }}>
        {filters.map(f => {
          const active = filter === f
          const label = f === 'all' ? `All (${notifs.length})`
            : f === 'unread' ? `Unread (${unread})`
            : DOMAIN_LABELS[f] ?? TYPE_META[f]?.label ?? f
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400,
              background: active ? 'var(--ai-subtle)' : 'transparent',
              border: `1px solid ${active ? 'rgba(99,73,255,0.35)' : 'var(--pios-border)'}`,
              color: active ? 'var(--ai3)' : 'var(--pios-muted)',
              transition: 'all 0.12s',
            }}>{label}</button>
          )
        })}
      </div>

      {/* Notification list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '52px 0', color: 'var(--pios-muted)', fontSize: 13 }}>
          <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading…
        </div>

      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--pios-muted)' }}>
          <Bell size={36} style={{ margin: '0 auto 14px', opacity: 0.15 }} />
          <p style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: 6 }}>
            {filter === 'unread' ? 'All caught up.' : 'No notifications'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--pios-dim)', marginBottom: 16 }}>
            {filter === 'all' && 'Click "Scan for alerts" to check for renewal, wellness and task alerts'}
          </p>
          {filter === 'all' && (
            <button onClick={generate} disabled={generating} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--ai-subtle)', border: '1px solid rgba(99,73,255,0.25)',
              color: 'var(--ai3)', fontSize: 12, fontFamily: 'var(--font-sans)',
            }}>
              <RefreshCw size={12} style={{ animation: generating ? 'spin 0.8s linear infinite' : 'none' }} />
              {generating ? 'Scanning…' : 'Scan now →'}
            </button>
          )}
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(n => {
            const meta = TYPE_META[n.type] ?? TYPE_META.info
            const Icon = meta.icon
            const body = n.body ?? n.message
            const isHovered = hovered === n.id

            const card = (
              <div
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => !n.read && markOne(n.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '13px 14px', borderRadius: 11,
                  background: n.read ? 'var(--pios-surface)' : meta.bg,
                  border: `1px solid ${n.read ? 'var(--pios-border)' : meta.border}`,
                  cursor: !n.read ? 'pointer' : 'default',
                  opacity: n.read ? 0.65 : 1,
                  transition: 'border-color 0.15s, opacity 0.15s',
                }}
              >
                <Icon size={15} color={meta.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{n.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pios-dim)' }}>
                        {timeAgo(n.created_at)}
                      </span>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id) }}
                        disabled={deleting === n.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          color: 'var(--pios-dim)', opacity: isHovered ? 1 : 0,
                          transition: 'opacity 0.15s, color 0.15s',
                          display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#f87171'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--pios-dim)'}
                      >
                        {deleting === n.id
                          ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                          : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                  {body && (
                    <p style={{ fontSize: 11.5, color: 'var(--pios-muted)', marginTop: 3, lineHeight: 1.6 }}>{body}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    {n.domain && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 6px',
                        borderRadius: 4, background: 'var(--pios-surface2)',
                        color: 'var(--pios-dim)', letterSpacing: '0.06em',
                      }}>{DOMAIN_LABELS[n.domain] ?? n.domain}</span>
                    )}
                    {n.action_url && (
                      <Link href={n.action_url} onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: 'var(--ai3)', textDecoration: 'none' }}>
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ai)', flexShrink: 0, marginTop: 3 }} />
                )}
              </div>
            )

            return n.action_url && n.read ? (
              <Link key={n.id} href={n.action_url} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
            ) : <div key={n.id}>{card}</div>
          })}
        </div>
      )}
    </div>
  )
}
