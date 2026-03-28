'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard v3.0 — Investment-Grade UIX
// Syne display · Domain-coloured KPIs · Brief block · Live platform tiles
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

type DashTask = {
  id: string; title?: string; status?: string; deadline?: string
  domain?: string; priority?: string; project_id?: string
  updated_at?: string; created_at?: string; due_date?: string
}
type DashProject = {
  id: string; name?: string; title?: string; status?: string; deadline?: string
  domain?: string; progress?: number; module_count?: number; colour?: string
}
type DashModule = {
  id: string; title?: string; status?: string; deadline?: string
  module_type?: string; credits?: number
}
type DashNotif = {
  id: string; title?: string; message?: string; type?: string
  created_at?: string; read?: boolean; url?: string
}
type SnapRecord = {
  totalBudgetSAR?: number; districts?: number; costUsd?: number
  thisMonth?: number; total?: number
  tenants?: {total?: number}; projects?: {total?: number; active?: number}
  assets?: {total?: number; active?: number} | number
  organisations?: {total?: number}; obe?: {totalBudgetSAR?: number; lastRun?: string}
  apiUsage?: {total?: number; thisMonth?: number; costUsd?: number}
  investigations?: {total?: number; recentWeek?: number}
  scripts?: {total?: number}; topics?: {total?: number}
  usage?: {thisMonth?: number; [key:string]: unknown}
  users?: {total?: number}; [key: string]: unknown
}
type TenantRecord = {
  id: string; name?: string; plan?: string; subscription_status?: string
  trial_ends_at?: string; company_name?: string
}

// ── Shared micro-components ──────────────────────────────────────────────────

function Card({ children, style = {}, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
      borderRadius: 14, padding: '18px 20px',
      transition: 'border-color 0.15s', ...style,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pios-border2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pios-border)' }}>
      {children}
    </div>
  )
}

function CardSm({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
      borderRadius: 10, padding: '12px 14px', ...style,
    }}>{children}</div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 10,
    }}>{children}</div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, background: 'var(--pios-surface3)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
      background: `${color}14`, color, letterSpacing: '0.02em',
    }}>{children}</span>
  )
}

// ── KPI stat card ────────────────────────────────────────────────────────────

function StatCard({ label, value, delta, deltaUp, accent, icon }: {
  label: string; value: string; delta?: string; deltaUp?: boolean
  accent: string; icon?: string
}) {
  return (
    <div style={{
      background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
      borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s', cursor: 'default',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pios-border2)';
        const bar = e.currentTarget.querySelector('.kpi-bar') as HTMLElement;
        if (bar) bar.style.opacity = '1';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pios-border)';
        const bar = e.currentTarget.querySelector('.kpi-bar') as HTMLElement;
        if (bar) bar.style.opacity = '0';
      }}>
      {/* Top accent bar */}
      <div className="kpi-bar" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: accent, opacity: 0, transition: 'opacity 0.2s',
      }} />
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 10 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400,
        color: 'var(--pios-text)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6,
      }}>{value}</div>
      {delta && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
          background: deltaUp ? 'rgba(16,217,160,0.1)' : 'rgba(100,104,128,0.12)',
          color: deltaUp ? 'var(--fm)' : 'var(--pios-muted)',
        }}>{delta}</span>
      )}
      {icon && (
        <div style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 36, opacity: 0.06, lineHeight: 1 }}>{icon}</div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tasks,        setTasks]        = useState<DashTask[]>([])
  const [projects,     setProjects]     = useState<DashProject[]>([])
  const [modules,      setModules]      = useState<DashModule[]>([])
  const [brief,        setBrief]        = useState<string | null>(null)
  const [notifs,       setNotifs]       = useState<DashNotif[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadErr,      setLoadErr]      = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [tenant,       setTenant]       = useState<TenantRecord | null>(null)
  const [todayEvents,  setTodayEvents]  = useState<Record<string,unknown>[]>([])
  const [seSnap,       setSeSnap]       = useState<SnapRecord | null>(null)
  const [isSnap,       setIsSnap]       = useState<SnapRecord | null>(null)
  const [persona,      setPersona]      = useState<string>('')
  const [execSnap,     setExecSnap]     = useState<Record<string,unknown> | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [dueTodayCount,setDueTodayCount]= useState(0)
  const [pendingInvoices,  setPendingInvoices]  = useState(0)
  const [actionEmails,     setActionEmails]     = useState(0)
  const [pendingTransfers, setPendingTransfers] = useState(0)
  const [meetingActions,   setMeetingActions]   = useState(0)
  const [receipts48h,      setReceipts48h]      = useState(0)
  const [activeDomain,     setActiveDomain]     = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [dashRes, notifsRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/notifications'),
    ])
    if (!dashRes.ok) setLoadErr('Failed to load dashboard data')
    const [d, nR]: [any, any] = await Promise.all([
      dashRes.ok ? dashRes.json() : {},
      notifsRes.ok ? notifsRes.json() : { notifications: [] },
    ])
    const overdueList  = d.tasks?.overdue   ?? []
    const dueTodayList = d.tasks?.due_today ?? []
    const upcomingList = d.tasks?.upcoming  ?? []
    setTasks([...overdueList, ...dueTodayList, ...upcomingList])
    setOverdueCount(overdueList.length)
    setDueTodayCount(dueTodayList.length)
    setProjects(d.projects ?? [])
    setModules(d.modules   ?? [])
    setBrief(d.brief ?? null)
    setTenant(d.tenant ?? null)
    setTodayEvents(d.calendar?.today ?? [])
    setPendingInvoices(d.counts?.pending_invoices ?? 0)
    setActionEmails(d.counts?.action_emails ?? 0)
    setPendingTransfers(d.counts?.queued_transfers ?? 0)
    setMeetingActions(d.counts?.pending_meeting_actions ?? 0)
    setReceipts48h(d.counts?.receipts_48h ?? 0)
    setNotifs((nR.notifications ?? []).filter((n: Record<string,unknown>) => !n.read))
    setPersona(d.persona ?? '')
    if (d.exec) setExecSnap(d.exec)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {

      .catch(() => {})

      .catch(() => {})
  }, [])

  async function generateBrief(force = false) {
    setBriefLoading(true)
    try {
      const res  = await fetch(force ? '/api/brief?force=1' : '/api/brief', { method: 'POST' })
      const data = await res.json()
      if (data.content) setBrief(data.content)
    } catch { /* silent */ }
    setBriefLoading(false)
  }

  const isExecPersona  = ['executive', 'founder', 'professional'].includes(persona)
  const criticalCount  = tasks.filter(t => t.priority === 'critical').length
  const weekDeadlines  = modules.filter(m => m.deadline && new Date(m.deadline) < new Date(Date.now() + 7 * 86400000)).length
  const activeProjects = projects.filter(p => p.status === 'active' || !p.status).length

  const filteredTasks = activeDomain === 'all' ? tasks : tasks.filter(t => t.domain === activeDomain)

  const DOMAIN_FILTERS = [
    { key: 'all',          label: 'All', color: 'var(--ai)' },
    { key: 'academic',     label: 'Academic', color: 'var(--academic)' },
    { key: 'fm_consulting',label: 'FM / SE', color: 'var(--fm)' },
    { key: 'saas',         label: 'SaaS', color: 'var(--pro)' },
    { key: 'business',     label: 'Business', color: 'var(--ops)' },
    { key: 'personal',     label: 'Personal', color: 'var(--saas)' },
  ]

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
            color: 'var(--pios-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4,
          }}>Command Centre</h1>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overdueCount > 0 && (
            <Link href="/platform/tasks" style={{ textDecoration: 'none' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: 'rgba(224,82,114,0.1)', border: '1px solid rgba(224,82,114,0.25)', color: 'var(--dng)',
              }}>⚠ {overdueCount} overdue</span>
            </Link>
          )}
          {dueTodayCount > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'var(--ai-subtle)', border: '1px solid rgba(139,124,248,0.2)', color: 'var(--ai)',
            }}>◉ {dueTodayCount} due today</span>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {loadErr && (
        <div style={{
          background: 'rgba(224,82,114,0.06)', border: '1px solid rgba(224,82,114,0.2)',
          borderRadius: 10, padding: '9px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: 'var(--dng)' }}>⚠ {loadErr}</span>
          <button onClick={load} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(224,82,114,0.1)', border: '1px solid rgba(224,82,114,0.25)', color: 'var(--dng)',
          }}>Retry</button>
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard
          label="Active Projects"
          value={loading ? '—' : String(activeProjects)}
          delta={`${projects.length} total`}
          accent="var(--ai)"
          icon="◈"
        />
        <StatCard
          label="Overdue Tasks"
          value={loading ? '—' : String(overdueCount)}
          delta={overdueCount > 0 ? `${dueTodayCount} due today` : 'All clear ✓'}
          deltaUp={overdueCount === 0}
          accent="var(--dng)"
          icon="⚑"
        />
        <StatCard
          label="AI Credits"
          value={loading ? '—' : `${credits?.used ?? 0} / ${credits?.limit ?? 500}`}
          delta={credits && credits.used < credits.limit ? 'Available' : 'Limit reached'}
          accent="var(--ai)"
          icon="✦"
        />
        <StatCard
          label="Academic Modules"
          value={loading ? '—' : String(modules.length)}
          delta={weekDeadlines > 0 ? `${weekDeadlines} due this week` : 'On track'}
          deltaUp={weekDeadlines === 0}
          accent="var(--academic)"
          icon="✍"
        />
      </div>

      {/* ── AI Morning Brief ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,124,248,0.06) 0%, rgba(79,142,247,0.04) 100%)',
        border: '1px solid rgba(139,124,248,0.14)',
        borderRadius: 14, padding: '16px 20px', marginBottom: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top gradient rule */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, var(--ai), var(--academic))',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'var(--ai-subtle)', border: '1px solid rgba(139,124,248,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>◉</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: 'var(--ai)',
                letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              }}>NemoClaw™ Morning Brief</div>
              <span style={{ fontSize: 9, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>claude-sonnet-4</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button onClick={() => generateBrief(false)} disabled={briefLoading} style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 7, cursor: 'pointer',
                  background: 'var(--ai-subtle)', border: '1px solid rgba(139,124,248,0.2)',
                  color: 'var(--ai)', fontFamily: 'var(--font-sans)',
                }}>
                  {briefLoading ? '⏳ Generating…' : brief ? '↻ Refresh' : 'Generate brief →'}
                </button>
                {brief && !briefLoading && (
                  <button onClick={() => generateBrief(true)} title="Force regenerate" style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 7, cursor: 'pointer',
                    background: 'transparent', border: '1px solid var(--pios-border2)',
                    color: 'var(--pios-muted)', fontFamily: 'var(--font-sans)',
                  }}>⟳</button>
                )}
              </div>
            </div>
            {brief ? (
              <div style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.65 }}>
                {brief.includes('##')
                  ? brief.split(/^##\s+/m).filter(Boolean).map((section, i) => {
                      const [title, ...bodyLines] = section.split('\n')
                      const body = bodyLines.join('\n').trim()
                      const isAlert = /overdue|at.risk|critical|urgent/i.test(title)
                      return (
                        <div key={i} style={{
                          marginBottom: 10, padding: '9px 13px', borderRadius: 8,
                          background: isAlert ? 'rgba(224,82,114,0.06)' : 'var(--pios-surface2)',
                          borderLeft: `2px solid ${isAlert ? 'var(--dng)' : 'rgba(139,124,248,0.4)'}`,
                        }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: isAlert ? 'var(--dng)' : 'var(--ai)', marginBottom: 5 }}>{title.trim()}</div>
                          <p style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--pios-text)', margin: 0 }}>{body}</p>
                        </div>
                      )
                    })
                  : <p style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--pios-text)' }}>{brief}</p>
                }
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 32 }}>
                {[
                  { v: criticalCount, l: 'critical tasks' },
                  { v: weekDeadlines, l: 'deadlines this week' },
                  { v: notifs.length, l: 'unread notifications' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' as const }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--ai)' }}>{loading ? '—' : s.v}</div>
                    <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

            {/* ── Executive OS strip ── */}
      {isExecPersona && execSnap && (() => {
        const wellness = (execSnap as any).wellness ?? {}
        const ipRenewals = (execSnap as any).ip_renewals_due ?? []
        const contractRenewals = (execSnap as any).contract_renewals_due ?? []
        const renewalAlerts = ((execSnap as any).ip_renewals_count ?? 0) + ((execSnap as any).contract_renewals_count ?? 0)
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { dot: '#4ade80', label: 'OKR Pulse', value: `${(execSnap.okr_summary as any)?.avg_prog ?? 0}%`, sub: `${(execSnap.okr_summary as any)?.total ?? 0} active`, href: '/platform/executive' },
                { dot: '#fbbf24', label: 'Open Decisions', value: String(execSnap.open_decisions_count ?? 0), sub: 'requiring action', href: '/platform/executive?tab=decisions' },
                { dot: 'var(--academic)', label: 'Stakeholders', value: String(execSnap.stakeholders_due_count ?? 0), sub: 'due this week', href: '/platform/executive?tab=stakeholders' },
                { dot: 'var(--ai)', label: 'IP Assets', value: String(execSnap.ip_assets_count ?? 0), sub: 'in vault', href: '/platform/ip-vault' },
                { dot: 'var(--pro)', label: 'Contracts', value: String(execSnap.active_contracts_count ?? 0), sub: 'active', href: '/platform/contracts' },
              ].map(s => (
                <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
                  <CardSm style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{s.label}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--pios-muted)', marginTop: 3 }}>{s.sub}</div>
                  </CardSm>
                </Link>
              ))}
            </div>

            {/* Wellness + renewals row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Link href="/platform/wellness" style={{ textDecoration: 'none' }}>
                <CardSm style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>
                    {wellness.today_done ? (wellness.mood_score >= 7 ? '😊' : wellness.mood_score >= 4 ? '😐' : '😔') : '🌅'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Wellness</span>
                      {wellness.streak > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '1px 5px', borderRadius: 8 }}>🔥 {wellness.streak}d</span>
                      )}
                    </div>
                    {wellness.today_done ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[{ l: 'M', v: wellness.mood_score, c: 'var(--ai)' }, { l: 'E', v: wellness.energy_score, c: 'var(--pro)' }, { l: 'S', v: wellness.stress_score, c: 'var(--ops)' }].map(({ l, v, c }) => (
                          <span key={l} style={{ fontSize: 11, fontWeight: 700, color: c, background: `${c}18`, padding: '1px 6px', borderRadius: 5 }}>{l}:{v}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--pios-text)' }}>Check in →</div>
                    )}
                  </div>
                </CardSm>
              </Link>
              <CardSm>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: renewalAlerts > 0 ? 'var(--dng)' : 'var(--fm)', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Renewals Due (90d)</span>
                </div>
                {renewalAlerts === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>No renewals due ✓</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                    {[...ipRenewals.slice(0, 2).map((a: any) => ({ label: a.name, date: a.renewal_date, href: '/platform/ip-vault', color: 'var(--ai)' })),
                      ...contractRenewals.slice(0, 2).map((c: any) => ({ label: c.title, date: c.end_date, href: '/platform/contracts', color: 'var(--academic)' }))
                    ].slice(0, 3).map((r, i) => (
                      <Link key={i} href={r.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--pios-text)', flex: 1, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                        <span style={{ fontSize: 9.5, color: 'var(--pios-dim)', flexShrink: 0 }}>{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardSm>
            </div>
          </div>
        )
      })()}

      {/* ── Main two-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 16 }}>

        {/* Left: Tasks */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 400, letterSpacing: '-0.01em' }}>Priority Tasks</span>
            <Link href="/platform/tasks" style={{ fontSize: 11, color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>

          {/* Domain filter chips */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' as const }}>
            {DOMAIN_FILTERS.map(df => (
              <button key={df.key} onClick={() => setActiveDomain(df.key)} style={{
                fontSize: 10.5, padding: '3px 9px', borderRadius: 6,
                border: activeDomain === df.key ? `1px solid ${df.color}` : '1px solid var(--pios-border)',
                background: activeDomain === df.key ? `${df.color}12` : 'transparent',
                color: activeDomain === df.key ? df.color : 'var(--pios-muted)',
                cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'var(--font-sans)',
              }}>{df.label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="pios-skeleton" style={{ height: 44, borderRadius: 8 }} />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
              <p style={{ fontSize: 12, color: 'var(--pios-dim)', marginBottom: 10 }}>
                {activeDomain === 'all' ? 'No open tasks' : `No tasks in ${activeDomain}`}
              </p>
              <Link href="/platform/tasks" style={{
                fontSize: 11.5, padding: '5px 14px', borderRadius: 7,
                background: 'var(--ai-subtle)', color: 'var(--ai)', textDecoration: 'none',
              }}>Add task</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {filteredTasks.slice(0, 7).map(t => {
                const isOverdue = overdueCount > 0 && tasks.indexOf(t) < overdueCount
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    background: isOverdue ? 'rgba(224,82,114,0.05)' : 'var(--pios-surface2)',
                    borderLeft: isOverdue ? '2px solid var(--dng)' : '2px solid transparent',
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: priorityColour(String(t.priority ?? '')), flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: isOverdue ? 600 : 400, color: 'var(--pios-text)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(t.title ?? '')}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                        <Tag color={domainColour(String(t.domain ?? ''))}>{domainLabel(String(t.domain ?? ''))}</Tag>
                        {t.due_date && <span style={{ fontSize: 10, color: isOverdue ? 'var(--dng)' : 'var(--pios-dim)' }}>{formatRelative(String(t.due_date))}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>

          {/* Pending actions */}
          <Card style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 12 }}>Pending Actions</div>
            {[
              { icon: '✉', label: 'Action emails', val: actionEmails, color: 'var(--dng)', href: '/platform/email' },
              { icon: '📄', label: 'Pending invoices', val: pendingInvoices, color: 'var(--saas)', href: '/platform/files' },
              { icon: '🔔', label: 'Unread notifications', val: notifs.length, color: 'var(--ai)', href: '/platform/notifications' },
              { icon: '💳', label: 'Transfers queued', val: pendingTransfers, color: 'var(--academic)', href: '/platform/payroll' },
              { icon: '✓', label: 'Meeting follow-ups', val: meetingActions, color: 'var(--fm)', href: '/platform/meetings' },
              { icon: '🧾', label: 'Receipts (48h)', val: receipts48h, color: 'var(--pro)', href: '/platform/expenses' },
            ].filter(a => a.val > 0 || true).map(a => (
              <Link key={a.label} href={a.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--pios-border)' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--pios-sub)' }}>{a.label}</span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400,
                  color: a.val > 0 ? a.color : 'var(--pios-dim)',
                }}>{a.val}</span>
              </Link>
            ))}
          </Card>

          {/* Today's events */}
          {todayEvents.length > 0 && (
            <Card style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 12 }}>Today's Calendar</div>
              <div style={{ position: 'relative', paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 1, background: 'var(--pios-border)' }} />
                {todayEvents.slice(0, 4).map((e: any, i: number) => (
                  <div key={e.id} style={{ position: 'relative', paddingBottom: 12 }}>
                    <div style={{ position: 'absolute', left: -13, top: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--pro)', border: '2px solid var(--pios-bg)' }} />
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 1 }}>{String(e.title ?? '')}</div>
                    <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>
                      {e.all_day ? 'All day' : new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notifications */}
          {notifs.length > 0 && (
            <Card style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--pios-dim)' }}>Notifications</div>
                <button onClick={async () => {
                  await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) })
                  setNotifs([])
                }} style={{ fontSize: 10, color: 'var(--pios-dim)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Mark all read
                </button>
              </div>
              {notifs.slice(0, 4).map(n => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 0', borderBottom: '1px solid var(--pios-border)',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: n.type === 'critical' ? 'var(--dng)' : n.type === 'warning' ? 'var(--saas)' : 'var(--ai)' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--pios-sub)' }}>{String(n.title ?? '')}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* ── Academic modules ── */}
      {modules.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>Academic Modules</SectionLabel>
            <Link href="/platform/academic" style={{ fontSize: 11, color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {modules.slice(0, 3).map(m => (
              <CardSm key={m.id} style={{ borderLeft: '2px solid var(--academic)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 6, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Tag color={m.status === 'in_progress' ? 'var(--fm)' : 'var(--academic)'}>{String(m.status ?? '').replace('_', ' ')}</Tag>
                  {m.deadline && <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{formatRelative(m.deadline)}</span>}
                </div>
              </CardSm>
            ))}
          </div>
        </div>
      )}

      {/* ── Active projects ── */}
      {projects.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>Active Projects</SectionLabel>
            <Link href="/platform/projects" style={{ fontSize: 11, color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {projects.slice(0, 4).map(p => {
              const color = p.colour || domainColour(String(p.domain ?? ''))
              return (
                <CardSm key={p.id} style={{ borderTop: `2px solid ${color}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 8, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <ProgressBar pct={p.progress ?? 0} color={color} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{domainLabel(String(p.domain ?? ''))}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 400, color }}>{p.progress ?? 0}%</span>
                  </div>
                </CardSm>
              )
            })}
            {projects.length < 4 && (
              <Link href="/platform/projects" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'transparent', border: '1px dashed var(--pios-border)',
                  borderRadius: 10, padding: '12px 14px', minHeight: 80,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'var(--pios-dim)', cursor: 'pointer',
                }}>+ New project</div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Quick access grid ── */}
      <div>
        <SectionLabel>Professional OS — Quick Access</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 8 }}>
          {([
            { href: '/platform/command',      icon: '⬡', label: 'Live Data',       sub: 'Real-time cockpit',   color: 'var(--academic)' },
            { href: '/platform/executive',    icon: '⚡', label: 'Executive OS',    sub: 'OKRs + decisions',    color: 'var(--pro)' },
            { href: '/platform/consulting',   icon: '◎', label: 'Frameworks',      sub: 'NemoClaw™ tools',     color: 'var(--ai)' },
            { href: '/platform/ip-vault',     icon: '⊛', label: 'IP Vault',        sub: 'TMs + frameworks',    color: 'var(--ai)' },
            { href: '/platform/contracts',    icon: '§', label: 'Contracts',       sub: 'Register + renewals', color: 'var(--academic)' },
            { href: '/platform/financials',   icon: '↗', label: 'Group P&L',       sub: 'YTD + pipeline',      color: 'var(--fm)' },
            { href: '/platform/knowledge',    icon: '⊡', label: 'SE-MIL',          sub: 'Institutional memory', color: 'var(--fm)' },
            { href: '/platform/time-sovereignty', icon: '◷', label: 'Time Sovereignty', sub: 'TSA™ engine', color: 'var(--pro)' },
          ] as { href: string; icon: string; label: string; sub: string; color: string }[]).map(m => (
            <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
                borderRadius: 10, padding: '11px 13px', cursor: 'pointer',
                borderLeft: `2px solid ${m.color}30`, transition: 'border-left-color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderLeftColor = m.color }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderLeftColor = `${m.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: m.color }}>{m.icon}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 400, color: 'var(--pios-text)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{m.sub}</div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          {([
            { href: '/platform/calendar', icon: '▦', label: 'Calendar', color: 'var(--pro)' },
            { href: '/platform/research', icon: '⊕', label: 'Research', color: 'var(--academic)' },
            { href: '/platform/comms', icon: '◈', label: 'Comms', color: 'var(--saas)' },
            { href: '/platform/intelligence', icon: '◉', label: 'Intelligence', color: 'var(--fm)' },
            { href: '/platform/notifications', icon: '◉', label: 'Alerts', color: 'var(--dng)' },
            { href: '/platform/ai', icon: '◉', label: 'NemoClaw', color: 'var(--ai)' },
          ] as { href: string; icon: string; label: string; color: string }[]).map(m => (
            <Link key={m.href} href={m.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--pios-surface)', border: '1px solid var(--pios-border)',
                borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center' as const,
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = m.color }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--pios-border)' }}>
                <div style={{ fontSize: 15, color: m.color, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--pios-muted)' }}>{m.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
