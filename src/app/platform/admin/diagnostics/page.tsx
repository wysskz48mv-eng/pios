'use client'
import { useState, useEffect, useCallback } from 'react'

/**
 * /platform/admin/diagnostics — PIOS Self-Learning Diagnostics Dashboard
 * Shows: latest run results, open findings, recurring patterns, resolution history
 * Owner: info@veritasiq.io
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */

interface Finding {
  id: string
  check_type: string
  check_name: string
  severity: string
  status: string
  title: string
  detail: string
  affected_route?: string
  affected_table?: string
  fix_applied?: string
  recurrence_count: number
  first_seen_at: string
  last_seen_at: string
  resolved_at?: string
}

interface DiagRun {
  id: string
  trigger: string
  started_at: string
  completed_at?: string
  duration_ms?: number
  total_checks: number
  findings: number
  critical: number
  high: number
  auto_fixed: number
  status: string
}

interface Pattern {
  id: string
  pattern_name: string
  description: string
  times_detected: number
  times_fixed: number
  auto_fix_safe: boolean
  last_detected?: string
}

const SEV_COLOURS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
  info:     '#6b7280',
}

const STATUS_COLOURS: Record<string, string> = {
  open:           '#ef4444',
  recurring:      '#f97316',
  acknowledged:   '#eab308',
  auto_fixed:     '#22c55e',
  manually_fixed: '#22c55e',
  wont_fix:       '#6b7280',
}

export default function DiagnosticsPage() {
  const [findings, setFindings]   = useState<Finding[]>([])
  const [runs, setRuns]           = useState<DiagRun[]>([])
  const [patterns, setPatterns]   = useState<Pattern[]>([])
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState(false)
  const [tab, setTab]             = useState<'findings' | 'runs' | 'patterns'>('findings')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, rRes, pRes] = await Promise.all([
        fetch('/api/admin/diagnostics?type=findings'),
        fetch('/api/admin/diagnostics?type=runs'),
        fetch('/api/admin/diagnostics?type=patterns'),
      ])
      if (fRes.ok) { const d = await fRes.json(); setFindings(d.findings ?? []) }
      if (rRes.ok) { const d = await rRes.json(); setRuns(d.runs ?? []) }
      if (pRes.ok) { const d = await pRes.json(); setPatterns(d.patterns ?? []) }
    } catch (err) { console.error('[PIOS diagnostics]', err) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const triggerRun = async () => {
    setRunning(true)
    try {
      await fetch('/api/cron/diagnostics', {
        headers: { 'x-cron-secret': '', 'x-trigger': 'manual' },
      })
      await load()
    } catch (err) { console.error('[PIOS diagnostics run]', err) }
    setRunning(false)
  }

  const openFindings = findings.filter(f => f.status === 'open' || f.status === 'recurring')
  const resolvedFindings = findings.filter(f => f.status === 'auto_fixed' || f.status === 'manually_fixed')

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 4px' }}>Diagnostics</h1>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            Self-learning system health · {openFindings.length} open · {resolvedFindings.length} resolved · {patterns.length} patterns learned
          </div>
        </div>
        <button onClick={triggerRun} disabled={running}
          style={{ padding: '8px 16px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 500, cursor: running ? 'wait' : 'pointer', opacity: running ? 0.7 : 1 }}>
          {running ? 'Running...' : 'Run diagnostics'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Critical', value: openFindings.filter(f => f.severity === 'critical').length, colour: SEV_COLOURS.critical },
          { label: 'High', value: openFindings.filter(f => f.severity === 'high').length, colour: SEV_COLOURS.high },
          { label: 'Medium', value: openFindings.filter(f => f.severity === 'medium').length, colour: SEV_COLOURS.medium },
          { label: 'Auto-fixed', value: findings.filter(f => f.status === 'auto_fixed').length, colour: '#22c55e' },
          { label: 'Patterns', value: patterns.filter(p => p.times_detected > 0).length, colour: 'var(--ai)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--pios-surface2)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.value > 0 ? s.colour : 'var(--pios-muted)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['findings', 'runs', 'patterns'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '6px 16px', background: tab === t ? 'var(--pios-surface3)' : 'transparent', border: '1px solid var(--pios-border)', borderRadius: 6, color: tab === t ? 'var(--pios-text)' : 'var(--pios-muted)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--pios-muted)', fontSize: 13 }}>Loading...</div>}

      {/* Findings tab */}
      {!loading && tab === 'findings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {findings.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--pios-muted)', fontSize: 13 }}>
              No diagnostics have run yet. Click "Run diagnostics" to start.
            </div>
          )}
          {findings.map(f => (
            <div key={f.id} style={{ background: 'var(--pios-surface)', border: `1px solid ${f.status === 'open' || f.status === 'recurring' ? SEV_COLOURS[f.severity] + '40' : 'var(--pios-border)'}`, borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: SEV_COLOURS[f.severity] + '20', color: SEV_COLOURS[f.severity], fontWeight: 700, textTransform: 'uppercase' }}>{f.severity}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: STATUS_COLOURS[f.status] + '20', color: STATUS_COLOURS[f.status], fontWeight: 600 }}>{f.status.replace('_', ' ')}</span>
                {f.recurrence_count > 1 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontWeight: 600 }}>
                    seen {f.recurrence_count}x
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--pios-muted)', fontFamily: 'monospace' }}>{f.check_type}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{f.detail}</div>
              {f.affected_table && <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4, fontFamily: 'monospace' }}>Table: {f.affected_table}</div>}
              {f.affected_route && <div style={{ fontSize: 11, color: 'var(--pios-muted)', fontFamily: 'monospace' }}>Route: {f.affected_route}</div>}
              {f.fix_applied && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>Fix: {f.fix_applied}</div>}
              <div style={{ fontSize: 10, color: 'var(--pios-muted)', marginTop: 6 }}>
                First seen: {new Date(f.first_seen_at).toLocaleString()} · Last: {new Date(f.last_seen_at).toLocaleString()}
                {f.resolved_at && ` · Resolved: ${new Date(f.resolved_at).toLocaleString()}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Runs tab */}
      {!loading && tab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {runs.map(r => (
            <div key={r.id} style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>
                  {r.trigger} run · {r.total_checks} checks · {r.findings} findings
                </div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>
                  {new Date(r.started_at).toLocaleString()} · {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : 'running...'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {r.critical > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#ef444420', color: '#ef4444' }}>{r.critical} critical</span>}
                {r.high > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f9731620', color: '#f97316' }}>{r.high} high</span>}
                {r.auto_fixed > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#22c55e20', color: '#22c55e' }}>{r.auto_fixed} auto-fixed</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patterns tab */}
      {!loading && tab === 'patterns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patterns.map(p => (
            <div key={p.id} style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', fontFamily: 'monospace' }}>{p.pattern_name}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: p.times_detected > 0 ? '#f97316' : 'var(--pios-muted)' }}>
                    {p.times_detected} detected
                  </span>
                  <span style={{ fontSize: 11, color: p.times_fixed > 0 ? '#22c55e' : 'var(--pios-muted)' }}>
                    {p.times_fixed} fixed
                  </span>
                  {p.auto_fix_safe && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#22c55e20', color: '#22c55e' }}>auto-fix</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--pios-sub)', lineHeight: 1.5 }}>{p.description}</div>
              {p.last_detected && <div style={{ fontSize: 10, color: 'var(--pios-muted)', marginTop: 4 }}>Last detected: {new Date(p.last_detected).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
