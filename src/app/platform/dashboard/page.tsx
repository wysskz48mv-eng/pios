'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const [tasks, setTasks]       = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [modules, setModules]   = useState<any[]>([])
  const [brief, setBrief]       = useState<string | null>(null)
  const [notifs, setNotifs]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [briefLoading, setBriefLoading] = useState(false)
  const [tenant, setTenant]     = useState<any>(null)
  const [todayEvents,   setTodayEvents]   = useState<any[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<number>(0)
  const [actionEmails,    setActionEmails]    = useState<number>(0)
  const [pendingTransfers,setPendingTransfers]= useState<number>(0)
  const [seSnap, setSeSnap] = useState<any>(null)
  const [isSnap, setIsSnap] = useState<any>(null)
  const [meetingActions, setMeetingActions] = useState<number>(0)
  const [receipts48h,    setReceipts48h]    = useState<number>(0)
  const [emailAccounts,  setEmailAccounts]  = useState<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    // Single aggregated fetch replaces 9 direct Supabase calls
    const [dashRes, notifsRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/notifications'),
    ])
    const [d, nR]: [any, any] = await Promise.all([
      dashRes.ok ? dashRes.json() : {},
      notifsRes.ok ? notifsRes.json() : { notifications: [] },
    ])
    setTasks([...(d.tasks?.overdue ?? []), ...(d.tasks?.due_today ?? []), ...(d.tasks?.upcoming ?? [])])
    setProjects(d.projects ?? [])
    setModules(d.modules ?? [])
    setBrief(d.brief ?? null)
    setTenant(d.tenant ?? null)
    setTodayEvents(d.calendar?.today ?? [])
    setPendingInvoices(d.counts?.pending_invoices  ?? 0)
    setActionEmails(d.counts?.action_emails        ?? 0)
    setPendingTransfers(d.counts?.queued_transfers ?? 0)
    setMeetingActions(d.counts?.pending_meeting_actions ?? 0)
    setReceipts48h(d.counts?.receipts_48h  ?? 0)
    setEmailAccounts(d.counts?.email_accounts ?? 0)
    setNotifs((nR.notifications ?? []).filter((n: any) => !n.read))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Fetch cross-platform live snapshots (non-blocking, runs once)
  useEffect(() => {
    fetch('/api/live/sustainedge').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected && d?.snapshot) setSeSnap(d.snapshot) })
      .catch(() => {})
    fetch('/api/live/investiscript').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected && d?.snapshot) setIsSnap(d.snapshot) })
      .catch(() => {})
  }, [])

  const domainCounts = tasks.reduce((acc: Record<string,number>, t) => {
    acc[t.domain] = (acc[t.domain] || 0) + 1; return acc
  }, {})

  const criticalCount  = tasks.filter(t => t.priority === 'critical').length
  const weekDeadlines  = modules.filter(m => m.deadline &&
    new Date(m.deadline) < new Date(Date.now() + 7 * 86400000)).length

  async function generateBrief(force = false) {
    setBriefLoading(true)
    try {
      const url = force ? '/api/brief?force=1' : '/api/brief'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (data.content) setBrief(data.content)
    } catch { /* silent */ }
    setBriefLoading(false)
  }

  const DOMAINS = [
    { key: 'academic',      label: 'Academic',      icon: '🎓', extra: `${modules.length} active` },
    { key: 'fm_consulting', label: 'FM Consulting',  icon: '🏗',  extra: 'Qiddiya active' },
    { key: 'saas',          label: 'SaaS',           icon: '⚡',  extra: `${seSnap ? (seSnap.tenants?.total ?? seSnap.organisations?.total ?? 0) + ' tenants' : 'SE · IS · PIOS'}` },
    { key: 'business',      label: 'Business',       icon: '🏢',  extra: 'Group ops' },
    { key: 'personal',      label: 'Personal',       icon: '✦',   extra: `${projects.length} projects` },
  ]

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Command Centre</h1>
        <p style={{ color: 'var(--pios-muted)', fontSize: 13 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {tenant?.plan && <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,0.12)', color: 'var(--ai)', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{tenant.plan}</span>}
        </p>
      </div>

      {/* Domain health strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
        {DOMAINS.map(d => (
          <div key={d.key} className="pios-card-sm" style={{ borderLeft: `3px solid ${domainColour(d.key)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{d.icon}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: domainColour(d.key) }}>{domainCounts[d.key] || 0}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{d.label}</div>
            <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginTop: 2 }}>{d.extra}</div>
          </div>
        ))}
      </div>

      {/* SaaS Platform Live Metrics */}
      {(seSnap || isSnap) && (
        <div style={{ display:'grid', gridTemplateColumns: seSnap && isSnap ? '1fr 1fr' : '1fr', gap:10, marginBottom:16 }}>
          {seSnap && (
            <div className="pios-card-sm" style={{ borderLeft:'3px solid #0ECFB0' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#0ECFB0' }}>VeritasEdge™</span>
                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'rgba(14,207,176,0.1)', color:'#0ECFB0', fontWeight:600 }}>LIVE</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[
                  { l:'Tenants', v: seSnap.tenants?.total ?? seSnap.organisations?.total ?? 0 },
                  { l:'Projects', v: seSnap.projects?.total ?? 0 },
                  { l:'Assets', v: (seSnap.assets?.total ?? 0).toLocaleString() },
                ].map(m => (
                  <div key={m.l}>
                    <div style={{ fontSize:16, fontWeight:800, color:'var(--pios-text)' }}>{m.v}</div>
                    <div style={{ fontSize:10, color:'var(--pios-dim)' }}>{m.l}</div>
                  </div>
                ))}
              </div>
              {seSnap.obe?.totalBudgetSAR && (
                <div style={{ marginTop:6, fontSize:11, color:'var(--pios-muted)' }}>
                  Last OBE: SAR {(seSnap.obe.totalBudgetSAR/1e6).toFixed(1)}M
                </div>
              )}
            </div>
          )}
          {isSnap && (
            <div className="pios-card-sm" style={{ borderLeft:'3px solid #6c8eff' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#6c8eff' }}>InvestiScript</span>
                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'rgba(108,142,255,0.1)', color:'#6c8eff', fontWeight:600 }}>LIVE</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {[
                  { l:'Newsrooms', v: isSnap.organisations?.total ?? 0 },
                  { l:'Investigations', v: isSnap.investigations?.total ?? isSnap.topics?.total ?? 0 },
                  { l:'Scripts', v: isSnap.scripts?.total ?? 0 },
                ].map(m => (
                  <div key={m.l}>
                    <div style={{ fontSize:16, fontWeight:800, color:'var(--pios-text)' }}>{m.v}</div>
                    <div style={{ fontSize:10, color:'var(--pios-dim)' }}>{m.l}</div>
                  </div>
                ))}
              </div>
              {(isSnap.apiUsage?.costUsd != null || isSnap.usage?.thisMonth != null) && (
                <div style={{ marginTop:6, fontSize:11, color:'var(--pios-muted)' }}>
                  {isSnap.apiUsage?.costUsd != null
                    ? `$${isSnap.apiUsage.costUsd.toFixed(2)} API cost (30d)`
                    : `${isSnap.usage.thisMonth} AI calls this month`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Today's Agenda */}
      {todayEvents.length > 0 && (
        <div className="pios-card" style={{ marginBottom:16, borderLeft:'3px solid #22d3ee' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Today's Calendar</span>
            <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{todayEvents.length} event{todayEvents.length!==1?'s':''}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {todayEvents.map((e:any) => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 0', borderBottom:'1px solid var(--pios-border)' }}>
                <div style={{ minWidth:50, fontSize:12, fontWeight:600, color:'#22d3ee' }}>
                  {e.all_day ? 'All day' : new Date(e.start_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                </div>
                <div style={{ flex:1, fontSize:13, fontWeight:500 }}>{e.title}</div>
                {e.location && <div style={{ fontSize:11, color:'var(--pios-dim)' }}>📍 {e.location}</div>}
                {e.google_meet_url && <a href={e.google_meet_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#22c55e' }}>🎥 Join</a>}
                <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:`${domainColour(e.domain||'personal')}20`, color:domainColour(e.domain||'personal') }}>
                  {domainLabel(e.domain||'personal')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert banner — pending actions */}
      {(pendingInvoices > 0 || actionEmails > 0 || pendingTransfers > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {pendingInvoices > 0 && (
            <Link href="/platform/files" style={{ textDecoration:'none' }}>
              <div className="pios-card-sm" style={{ padding:'10px 14px', borderLeft:'3px solid #f59e0b', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#f59e0b', lineHeight:1, marginBottom:3 }}>{pendingInvoices}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>invoice{pendingInvoices!==1?'s':''} pending approval</div>
              </div>
            </Link>
          )}
          {actionEmails > 0 && (
            <Link href="/platform/email" style={{ textDecoration:'none' }}>
              <div className="pios-card-sm" style={{ padding:'10px 14px', borderLeft:'3px solid #6c8eff', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#6c8eff', lineHeight:1, marginBottom:3 }}>{actionEmails}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>email{actionEmails!==1?'s':''} need action</div>
              </div>
            </Link>
          )}
          {pendingTransfers > 0 && (
            <Link href="/platform/payroll" style={{ textDecoration:'none' }}>
              <div className="pios-card-sm" style={{ padding:'10px 14px', borderLeft:'3px solid #a78bfa', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa', lineHeight:1, marginBottom:3 }}>{pendingTransfers}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>transfer{pendingTransfers!==1?'s':''} queued for approval</div>
              </div>
            </Link>
          )}
          {meetingActions > 0 && (
            <Link href="/platform/meetings" style={{ textDecoration:'none' }}>
              <div className="pios-card-sm" style={{ padding:'10px 14px', borderLeft:'3px solid #22c55e', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#22c55e', lineHeight:1, marginBottom:3 }}>{meetingActions}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>meeting action item{meetingActions!==1?'s':''} to promote</div>
              </div>
            </Link>
          )}
          {receipts48h > 0 && (
            <Link href="/platform/expenses" style={{ textDecoration:'none' }}>
              <div className="pios-card-sm" style={{ padding:'10px 14px', borderLeft:'3px solid #0ECFB0', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#0ECFB0', lineHeight:1, marginBottom:3 }}>{receipts48h}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)' }}>receipt{receipts48h!==1?'s':''} auto-captured from email</div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* AI Morning Brief */}
      <div className="pios-card" style={{ borderColor: 'rgba(167,139,250,0.2)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)' }} className="ai-pulse" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>AI Morning Brief</span>
            <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>claude-sonnet-4</span>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => generateBrief(false)} disabled={briefLoading} className="pios-btn pios-btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }}>
              {briefLoading ? '⏳ Generating…' : brief ? '↻ Refresh' : 'Generate today\'s brief →'}
            </button>
            {brief && !briefLoading && (
              <button onClick={() => generateBrief(true)} title="Force regenerate with latest data" className="pios-btn pios-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color:'var(--pios-muted)' }}>
                ⟳
              </button>
            )}
          </div>
        </div>
        {brief ? (
          <p style={{ fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--pios-text)' }}>{brief}</p>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--pios-muted)', fontSize: 13, marginBottom: 16 }}>
              {briefLoading ? 'Generating your cross-domain briefing…' : 'No brief yet today. Generate your cross-domain morning briefing.'}
            </p>
            {!briefLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
                {[
                  { v: criticalCount,  l: 'critical tasks' },
                  { v: weekDeadlines,  l: 'deadlines this week' },
                  { v: notifs.length,  l: 'unread notifications' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ai)' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifications strip — show if any unread */}
      {notifs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notifications ({notifs.length})</span>
            <button onClick={async () => { await fetch('/api/notifications', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'mark_read' }) }); setNotifs([]) }}
              style={{ fontSize: 11, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Mark all read</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {notifs.map(n => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, fontSize: 11,
              background: n.type === 'critical' ? 'rgba(239,68,68,0.1)' : n.type === 'warning' ? 'rgba(245,158,11,0.1)' : n.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(167,139,250,0.1)',
              color: n.type === 'critical' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#22c55e' : 'var(--ai)',
              border: `1px solid currentColor`, opacity: 0.85,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
              {n.title}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Tasks + Academic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Priority tasks */}
        <div className="pios-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Priority Tasks</span>
            <Link href="/platform/tasks" style={{ fontSize: 11, color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loading ? (
            <p style={{ color: 'var(--pios-dim)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--pios-dim)', fontSize: 12, marginBottom: 10 }}>No open tasks</p>
              <Link href="/platform/tasks" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', color: 'var(--ai)', textDecoration: 'none' }}>Add your first task</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.slice(0, 6).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 9, borderRadius: 7, background: 'var(--pios-surface2)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColour(t.priority), flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: `${domainColour(t.domain)}20`, color: domainColour(t.domain) }}>{domainLabel(t.domain)}</span>
                      {t.due_date && <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{formatRelative(t.due_date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Academic */}
        <div className="pios-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Academic</span>
            <Link href="/platform/academic" style={{ fontSize: 11, color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {modules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--pios-dim)', fontSize: 12, marginBottom: 10 }}>No modules set up</p>
              <Link href="/platform/academic" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: 'rgba(108,142,255,0.1)', color: '#6c8eff', textDecoration: 'none' }}>Set up academic tracker</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modules.map(m => (
                <div key={m.id} style={{ padding: 9, borderRadius: 7, background: 'var(--pios-surface2)', borderLeft: '3px solid #6c8eff' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{m.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: m.status === 'in_progress' ? 'rgba(45,212,160,0.1)' : 'rgba(108,142,255,0.1)', color: m.status === 'in_progress' ? '#2dd4a0' : '#6c8eff' }}>{m.status.replace('_', ' ')}</span>
                    {m.deadline && <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{formatRelative(m.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Projects */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {projects.map(p => (
          <div key={p.id} className="pios-card-sm" style={{ borderTop: `3px solid ${p.colour || domainColour(p.domain)}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
            <div style={{ height: 4, background: 'var(--pios-surface2)', borderRadius: 2, marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${p.progress}%`, background: p.colour || domainColour(p.domain), borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>{domainLabel(p.domain)}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: p.colour || domainColour(p.domain) }}>{p.progress}%</span>
            </div>
          </div>
        ))}
        {projects.length < 4 && (
          <Link href="/platform/projects" style={{ textDecoration: 'none' }}>
            <div className="pios-card-sm" style={{ border: '1px dashed var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pios-dim)', fontSize: 12, cursor: 'pointer', minHeight: 80 }}>+ New project</div>
          </Link>
        )}
      </div>
    </div>
  )
}
