'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [brief, setBrief] = useState<string | null>(null)
  const [notifCount, setNotifCount] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)

    const [t, p, m, b, n] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'done').neq('status', 'cancelled').order('due_date', { ascending: true }).limit(8),
      supabase.from('projects').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(4),
      supabase.from('academic_modules').select('*').eq('user_id', user.id).in('status', ['in_progress', 'upcoming']).order('deadline', { ascending: true }).limit(5),
      supabase.from('daily_briefs').select('content').eq('user_id', user.id).eq('brief_date', today).maybeSingle(),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', user.id).eq('read', false),
    ])
    setTasks(t.data ?? [])
    setProjects(p.data ?? [])
    setModules(m.data ?? [])
    setBrief(b.data?.content ?? null)
    setNotifCount(n.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function generateBrief() {
    setGenerating(true)
    try {
      const res = await fetch('/api/brief', { method: 'POST' })
      const data = await res.json()
      if (data.content) setBrief(data.content)
    } catch {}
    setGenerating(false)
  }

  const domainCounts = tasks.reduce((acc: Record<string, number>, t) => {
    acc[t.domain] = (acc[t.domain] || 0) + 1; return acc
  }, {})

  const criticalCount = tasks.filter(t => t.priority === 'critical').length
  const deadlineCount = modules.filter(m => m.deadline && new Date(m.deadline) < new Date(Date.now() + 7 * 86400000)).length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Command Centre</h1>
        <p style={{ color: 'var(--pios-muted)', fontSize: '13px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Domain health strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { key: 'academic', label: 'Academic', icon: '🎓', extra: `${modules.length} active` },
          { key: 'fm_consulting', label: 'FM Consulting', icon: '🏗', extra: 'Qiddiya active' },
          { key: 'saas', label: 'SaaS', icon: '⚡', extra: 'SE · IS · PIOS' },
          { key: 'business', label: 'Business', icon: '🏢', extra: 'Group ops' },
          { key: 'personal', label: 'Personal', icon: '✦', extra: `${projects.length} projects` },
        ].map(d => (
          <div key={d.key} className="pios-card-sm" style={{ borderLeft: `3px solid ${domainColour(d.key)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px' }}>{d.icon}</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: domainColour(d.key) }}>{domainCounts[d.key] || 0}</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>{d.label}</div>
            <div style={{ fontSize: '10px', color: 'var(--pios-dim)', marginTop: '2px' }}>{d.extra}</div>
          </div>
        ))}
      </div>

      {/* AI Brief */}
      <div className="pios-card" style={{ borderColor: 'rgba(167,139,250,0.2)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ai)' }} className="ai-pulse" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>AI Morning Brief</span>
            <span style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>claude-sonnet-4</span>
          </div>
          <button
            onClick={generateBrief}
            disabled={generating}
            style={{
              fontSize: '11px', color: 'var(--ai)', background: 'rgba(167,139,250,0.1)',
              border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.6 : 1,
            }}>
            {generating ? 'Generating…' : brief ? 'Regenerate →' : 'Generate today\'s brief →'}
          </button>
        </div>
        {brief ? (
          <p style={{ fontSize: '13px', lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--pios-text)' }}>{brief}</p>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--pios-muted)', fontSize: '13px', marginBottom: '16px' }}>
              {loading ? 'Loading…' : 'No brief generated yet. Click above for your cross-domain morning briefing.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
              {[
                { v: criticalCount, l: 'critical tasks' },
                { v: deadlineCount, l: 'deadlines this week' },
                { v: notifCount, l: 'unread notifications' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ai)' }}>{s.v}</div>
                  <div style={{ fontSize: '11px', color: 'var(--pios-dim)' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tasks + Academic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="pios-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Priority Tasks</span>
            <Link href="/platform/tasks" style={{ fontSize: '11px', color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loading ? (
            <p style={{ color: 'var(--pios-dim)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--pios-dim)', fontSize: '12px', marginBottom: '10px' }}>No open tasks</p>
              <Link href="/platform/tasks" style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(167,139,250,0.1)', color: 'var(--ai)', textDecoration: 'none' }}>Add your first task</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tasks.slice(0, 6).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px', borderRadius: '6px', background: 'var(--pios-surface2)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColour(t.priority), flexShrink: 0, marginTop: '4px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: `${domainColour(t.domain)}20`, color: domainColour(t.domain) }}>{domainLabel(t.domain)}</span>
                      {t.due_date && <span style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>{formatRelative(t.due_date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pios-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Academic</span>
            <Link href="/platform/academic" style={{ fontSize: '11px', color: 'var(--pios-dim)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loading ? (
            <p style={{ color: 'var(--pios-dim)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          ) : modules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--pios-dim)', fontSize: '12px', marginBottom: '10px' }}>No modules set up</p>
              <Link href="/platform/academic" style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(108,142,255,0.1)', color: '#6c8eff', textDecoration: 'none' }}>Set up academic tracker</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {modules.map(m => (
                <div key={m.id} style={{ padding: '8px', borderRadius: '6px', background: 'var(--pios-surface2)', borderLeft: '3px solid #6c8eff' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{m.title}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(108,142,255,0.1)', color: '#6c8eff' }}>
                      {m.status.replace('_', ' ')}
                    </span>
                    {m.deadline && <span style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>{formatRelative(m.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projects strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        {projects.map(p => (
          <div key={p.id} className="pios-card-sm" style={{ borderTop: `3px solid ${p.colour || domainColour(p.domain)}` }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
            <div style={{ height: '4px', background: 'var(--pios-surface2)', borderRadius: '2px', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${p.progress}%`, background: p.colour || domainColour(p.domain), borderRadius: '2px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>{domainLabel(p.domain)}</span>
              <span style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>{p.progress}%</span>
            </div>
          </div>
        ))}
        {projects.length < 4 && (
          <Link href="/platform/projects" style={{ textDecoration: 'none' }}>
            <div className="pios-card-sm" style={{ border: '1px dashed var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pios-dim)', fontSize: '12px', cursor: 'pointer', minHeight: '80px' }}>
              + Add project
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
