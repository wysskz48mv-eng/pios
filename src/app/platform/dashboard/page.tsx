'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const today = new Date().toISOString().slice(0, 10)
    const [tR, pR, mR, bR, nR, tenR] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id)
        .not('status', 'in', '("done","cancelled")').order('due_date', { ascending: true }).limit(8),
      supabase.from('projects').select('*').eq('user_id', user.id)
        .eq('status', 'active').order('created_at', { ascending: false }).limit(4),
      supabase.from('academic_modules').select('*').eq('user_id', user.id)
        .not('status', 'in', '("passed","failed")').order('deadline', { ascending: true }).limit(6),
      supabase.from('daily_briefs').select('content').eq('user_id', user.id)
        .eq('brief_date', today).maybeSingle(),
      supabase.from('notifications').select('*').eq('user_id', user.id)
        .eq('read', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('tenants').select('plan,ai_credits_used,ai_credits_limit,name')
        .single(),
    ])
    setTasks(tR.data ?? [])
    setProjects(pR.data ?? [])
    setModules(mR.data ?? [])
    setBrief(bR.data?.content ?? null)
    setNotifs(nR.data ?? [])
    setTenant(tenR.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const domainCounts = tasks.reduce((acc: Record<string,number>, t) => {
    acc[t.domain] = (acc[t.domain] || 0) + 1; return acc
  }, {})

  const criticalCount  = tasks.filter(t => t.priority === 'critical').length
  const weekDeadlines  = modules.filter(m => m.deadline &&
    new Date(m.deadline) < new Date(Date.now() + 7 * 86400000)).length

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const res = await fetch('/api/brief', { method: 'POST' })
      const data = await res.json()
      if (data.content) setBrief(data.content)
    } catch { /* silent */ }
    setBriefLoading(false)
  }

  const DOMAINS = [
    { key: 'academic',      label: 'Academic',      icon: '🎓', extra: `${modules.length} active` },
    { key: 'fm_consulting', label: 'FM Consulting',  icon: '🏗',  extra: 'Qiddiya active' },
    { key: 'saas',          label: 'SaaS',           icon: '⚡',  extra: 'SE · IS · PIOS' },
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

      {/* AI Morning Brief */}
      <div className="pios-card" style={{ borderColor: 'rgba(167,139,250,0.2)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)' }} className="ai-pulse" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>AI Morning Brief</span>
            <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>claude-sonnet-4</span>
          </div>
          <button onClick={generateBrief} disabled={briefLoading} className="pios-btn pios-btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }}>
            {briefLoading ? '⏳ Generating…' : brief ? '↻ Regenerate' : 'Generate today\'s brief →'}
          </button>
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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
