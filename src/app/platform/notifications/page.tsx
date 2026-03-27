/**
 * /platform/notifications — PIOS Notification Centre
 * Smart renewal alerts, wellness signals, task overdue, trial warnings
 * PIOS v3.0 | Sprint 82 | VeritasIQ Technologies Ltd
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
  icon: React.ComponentType<{className?: string}>
  color: string; bg: string; label: string
}> = {
  alert:   { icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-500/8 border-red-500/20',      label: 'Alert' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/8 border-amber-500/20',  label: 'Warning' },
  success: { icon: CheckCircle2,  color: 'text-green-400',  bg: 'bg-green-500/8 border-green-500/20',  label: 'Success' },
  info:    { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20',    label: 'Info' },
  ai:      { icon: Zap,           color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-500/20', label: 'AI' },
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
  const [notifs, setNotifs]       = useState<Notification[]>([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter]       = useState<string>('all')
  const [marking, setMarking]     = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

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
    try {
      await fetch('/api/notifications/generate', { method: 'POST' })
      await load()
    } catch { /* silent */ }
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
    await supabaseDelete(id)
    setNotifs(p => p.filter(n => n.id !== id))
    setDeleting(null)
  }

  async function supabaseDelete(id: string) {
    await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => {})
  }

  useEffect(() => { load() }, [load])

  const domains = Array.from(new Set(notifs.map(n => n.domain).filter(Boolean))) as string[]
  const types   = Array.from(new Set(notifs.map(n => n.type).filter(Boolean))) as string[]

  const filtered = filter === 'all' ? notifs
    : filter === 'unread' ? notifs.filter(n => !n.read)
    : notifs.filter(n => n.domain === filter || n.type === filter)

  const unread = notifs.filter(n => !n.read).length

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
            {unread > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                {unread} unread
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--pios-muted)]">Renewal alerts, wellness signals, task overdue, trial warnings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-1.5 text-xs border border-[var(--pios-border)] rounded-lg px-3 py-1.5 hover:bg-[var(--pios-surface)] disabled:opacity-50 text-[var(--pios-muted)]">
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Scanning…' : 'Scan for alerts'}
          </button>
          {unread > 0 && (
            <button onClick={markAll} disabled={marking}
              className="flex items-center gap-1.5 text-xs border border-[var(--pios-border)] rounded-lg px-3 py-1.5 hover:bg-[var(--pios-surface)] disabled:opacity-50 text-[var(--pios-muted)]">
              {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        {['all', 'unread', ...types, ...domains].filter((v, i, a) => a.indexOf(v) === i).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? 'border-violet-500/60 bg-violet-500/10 text-violet-400'
                : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-foreground'
            }`}>
            {f === 'all' ? `All (${notifs.length})`
             : f === 'unread' ? `Unread (${unread})`
             : DOMAIN_LABELS[f] ?? TYPE_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-[var(--pios-muted)] text-sm py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--pios-muted)]">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{filter === 'unread' ? 'All caught up!' : 'No notifications'}</p>
          <p className="text-xs mt-1">
            {filter === 'all' && 'Click "Scan for alerts" to check for renewal, wellness and task alerts'}
          </p>
          {filter === 'all' && (
            <button onClick={generate} disabled={generating}
              className="mt-4 text-xs text-violet-400 hover:underline flex items-center gap-1 mx-auto">
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Scanning…' : 'Scan now →'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const meta = TYPE_META[n.type] ?? TYPE_META.info
            const Icon = meta.icon
            const bg   = !n.read ? meta.bg : 'bg-[var(--pios-surface)] border-[var(--pios-border)] opacity-70'
            const body = n.body ?? n.message

            const inner = (
              <div
                className={`group flex items-start gap-3 p-4 rounded-xl border transition-all ${bg} ${!n.read ? 'cursor-pointer' : ''}`}
                onClick={() => !n.read && markOne(n.id)}
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-[var(--pios-muted)]">{timeAgo(n.created_at)}</span>
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id) }}
                        disabled={deleting === n.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--pios-muted)] hover:text-red-400"
                      >
                        {deleting === n.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  {body && <p className="text-xs text-[var(--pios-muted)] mt-0.5 leading-relaxed">{body}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    {n.domain && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-[var(--pios-muted)]">
                        {DOMAIN_LABELS[n.domain] ?? n.domain}
                      </span>
                    )}
                    {n.action_url && (
                      <Link href={n.action_url} onClick={e => e.stopPropagation()}
                        className="text-[10px] text-violet-400 hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
              </div>
            )

            return n.action_url && n.read ? (
              <Link key={n.id} href={n.action_url} className="block">{inner}</Link>
            ) : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
