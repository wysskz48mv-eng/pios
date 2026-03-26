/**
 * /platform/notifications — PIOS Notification Centre
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
"use client"
import { useState, useEffect } from "react"
import { Bell, CheckCheck, Loader2, AlertCircle, CheckCircle2, Info, Zap } from "lucide-react"

type Notification = {
  id: string; type: string; title: string; message?: string
  read: boolean; action_url?: string; created_at: string; domain?: string
}

const TYPE_ICON: Record<string, React.ComponentType<{className?:string}>> = {
  alert: AlertCircle, success: CheckCircle2, info: Info, ai: Zap,
}
const TYPE_COLOR: Record<string, string> = {
  alert: "text-red-500", success: "text-green-500", info: "text-blue-500", ai: "text-violet-500",
}
const TYPE_BG: Record<string, string> = {
  alert: "bg-red-500/8 border-red-500/20",
  success: "bg-green-500/8 border-green-500/20",
  info: "bg-blue-500/8 border-blue-500/20",
  ai: "bg-violet-500/8 border-violet-500/20",
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/notifications?limit=50")
      const d = await r.json()
      setNotifs(d.notifications ?? [])
    } catch { setNotifs([]) }
    setLoading(false)
  }

  const markAll = async () => {
    setMarking(true)
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {})
    setNotifs(p => p.map(n => ({ ...n, read: true })))
    setMarking(false)
  }

  const markOne = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))
  }

  useEffect(() => { load() }, [])

  const unread = notifs.filter(n => !n.read).length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Notifications</h1>
            {unread > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                {unread} unread
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Task alerts, AI updates, weekly digests</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} disabled={marking}
            className="flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-card disabled:opacity-50">
            {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No notifications yet</p>
          <p className="text-xs mt-1">Task alerts and AI updates will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Info
            const color = TYPE_COLOR[n.type] ?? "text-muted-foreground"
            const bg = !n.read ? (TYPE_BG[n.type] ?? "bg-primary/5 border-primary/20") : "bg-card border-border"
            const inner = (
              <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${bg} ${!n.read ? "cursor-pointer" : "opacity-70"}`}
                onClick={() => !n.read && markOne(n.id)}>
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  )}
                  {n.domain && (
                    <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {n.domain}
                    </span>
                  )}
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
              </div>
            )
            return n.action_url ? (
              <a key={n.id} href={n.action_url} className="block">{inner}</a>
            ) : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
