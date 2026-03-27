/**
 * /platform/time-sovereignty — TSA™ Time Sovereignty Agent v2
 * Visual time map · Calendar protection zones · Weekly sovereignty score
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Clock, Shield, Plus, Zap, Loader2, Trash2, TrendingUp, Lock, AlertTriangle } from 'lucide-react'

type Block = {
  id: string; label: string; block_type: string
  day_of_week: number[]; start_time: string; end_time: string
  protected: boolean; notes?: string
}
type Audit = {
  week_start: string
  strategic_hours: number; operational_hours: number; admin_hours: number
  stakeholder_hours: number; recovery_hours: number; total_hours: number
  strategic_pct: number
}
type Summary = { total_blocks: number; protected_blocks: number; type_breakdown: Record<string,number> }

const DAYS      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WORK_DAYS = ['Mon','Tue','Wed','Thu','Fri']

const TYPE_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  strategic:   { color: 'var(--pro)',      bg: 'rgba(56,217,245,0.08)',   border: 'rgba(56,217,245,0.2)',   label: 'Strategic'   },
  deep_work:   { color: 'var(--ai3)',      bg: 'var(--ai-subtle)',        border: 'rgba(99,73,255,0.25)',   label: 'Deep Work'   },
  stakeholder: { color: 'var(--academic)', bg: 'rgba(79,142,247,0.08)',   border: 'rgba(79,142,247,0.2)',   label: 'Stakeholder' },
  admin:       { color: 'var(--saas)',     bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)',   label: 'Admin'       },
  recovery:    { color: 'var(--fm)',       bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.2)',   label: 'Recovery'    },
  other:       { color: 'var(--pios-muted)', bg: 'var(--pios-surface2)', border: 'var(--pios-border)',     label: 'Other'       },
}

const BLOCK_TYPES = Object.keys(TYPE_META)

// ── Time helpers ──────────────────────────────────────────────────────────
function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function sovereignty_score(audits: Audit[]): number {
  if (!audits.length) return 0
  const latest = audits[0]
  if (!latest.total_hours) return 0
  const strategic_pct = (latest.strategic_hours + (latest.operational_hours * 0.4)) / latest.total_hours * 100
  return Math.min(100, Math.round(strategic_pct))
}
function score_label(s: number) {
  if (s >= 70) return { text: 'Sovereign', color: 'var(--fm)' }
  if (s >= 50) return { text: 'Contested', color: 'var(--saas)' }
  return { text: 'Fragmented', color: 'var(--dng)' }
}

const inp: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px',
  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
  borderRadius: 8, color: 'var(--pios-text)', fontSize: 13,
  fontFamily: 'var(--font-sans)', outline: 'none',
}
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10 }

export default function TimeSovereigntyPage() {
  const [blocks,  setBlocks]  = useState<Block[]>([])
  const [audits,  setAudits]  = useState<Audit[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'map'|'blocks'|'log'>('map')

  // AI audit
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [auditing,  setAuditing]  = useState(false)

  // Block form
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [blockForm, setBlockForm] = useState({
    label: '', block_type: 'strategic',
    day_of_week: [1,2,3,4,5],
    start_time: '08:00', end_time: '10:00',
    protected: true, notes: '',
  })

  // Weekly log
  const [weekLog, setWeekLog] = useState({
    week_start: new Date(Date.now() - ((new Date().getDay() || 7) - 1) * 86400000).toISOString().split('T')[0],
    strategic_hours: 0, operational_hours: 0, admin_hours: 0,
    stakeholder_hours: 0, recovery_hours: 0,
  })
  const [logging,  setLogging]  = useState(false)
  const [logSaved, setLogSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/exec/time')
      const d = await r.json()
      setBlocks(d.blocks ?? [])
      setAudits(d.audits ?? [])
      setSummary(d.summary ?? null)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBlock() {
    setSaving(true)
    await fetch('/api/exec/time', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_block', payload: blockForm }),
    })
    setShowForm(false)
    setBlockForm({ label:'', block_type:'strategic', day_of_week:[1,2,3,4,5], start_time:'08:00', end_time:'10:00', protected:true, notes:'' })
    setSaving(false)
    load()
  }

  async function deleteBlock(id: string) {
    await fetch('/api/exec/time', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_block', id }),
    })
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  async function saveLog() {
    setLogging(true)
    const total = Object.entries(weekLog)
      .filter(([k]) => k !== 'week_start')
      .reduce((s, [,v]) => s + Number(v), 0)
    await fetch('/api/exec/time', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_audit', payload: { ...weekLog, total_hours: total } }),
    })
    setLogging(false); setLogSaved(true)
    setTimeout(() => setLogSaved(false), 3000)
    load()
  }

  async function runAudit() {
    setAuditing(true); setAiInsight(null)
    try {
      const r = await fetch('/api/exec/time', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_audit', blocks, audits }),
      })
      const d = await r.json()
      setAiInsight(d.insight ?? d.analysis ?? 'No insight returned.')
    } catch { setAiInsight('Audit failed — try again.') }
    setAuditing(false)
  }

  const score = sovereignty_score(audits)
  const { text: scoreLabel, color: scoreColor } = score_label(score)
  const latest = audits[0]

  // Build time map — grid of work hours (7am–8pm) × weekdays
  const HOUR_START = 7
  const HOUR_END   = 20
  const hours      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

  function blockAt(dayIdx: number, hour: number): Block | null {
    const mins = hour * 60
    return blocks.find(b =>
      b.day_of_week.includes(dayIdx) &&
      timeToMins(b.start_time) <= mins &&
      timeToMins(b.end_time) > mins
    ) ?? null
  }

  const tabs = [
    { id: 'map' as const, label: 'Time Map' },
    { id: 'blocks' as const, label: `Protection Zones (${blocks.length})` },
    { id: 'log' as const, label: 'Weekly Log' },
  ]

  return (
    <div className="fade-up">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap' as const, gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
            <Clock size={18} color="var(--pro)" />
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:400, letterSpacing:'-0.03em' }}>
              Time Sovereignty
            </h1>
            <span style={{ ...mono, padding:'2px 8px', borderRadius:4, background:'rgba(56,217,245,0.08)', color:'var(--pro)', border:'1px solid rgba(56,217,245,0.2)' }}>TSA™</span>
          </div>
          <p style={{ fontSize:12, color:'var(--pios-muted)' }}>
            Audit where your hours go · Protect deep work · Score your sovereignty
          </p>
        </div>
        <button onClick={runAudit} disabled={auditing} style={{
          display:'flex', alignItems:'center', gap:7,
          padding:'8px 16px', borderRadius:8, border:'1px solid rgba(99,73,255,0.3)',
          background:'var(--ai-subtle)', color:'var(--ai3)',
          fontSize:12, fontWeight:500, fontFamily:'var(--font-sans)', cursor:'pointer',
        }}>
          {auditing ? <Loader2 size={13} style={{ animation:'spin 0.8s linear infinite' }} /> : <Zap size={13} />}
          {auditing ? 'Analysing…' : 'NemoClaw™ Audit'}
        </button>
      </div>

      {/* Sovereignty score strip */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
        gap:10, marginBottom:18,
      }}>
        {/* Score */}
        <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'16px 18px', gridColumn:'span 1' }}>
          <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:6 }}>Sovereignty score</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:36, fontWeight:400, color:scoreColor, lineHeight:1 }}>{score}</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:18, color:scoreColor }}>%</span>
          </div>
          <div style={{ ...mono, color:scoreColor, marginTop:4 }}>{scoreLabel}</div>
          <div style={{ height:3, background:'var(--pios-surface3)', borderRadius:2, overflow:'hidden', marginTop:8 }}>
            <div style={{ width:`${score}%`, height:'100%', background:scoreColor, borderRadius:2, transition:'width 0.8s' }} />
          </div>
        </div>

        {/* Protected blocks */}
        <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'16px 18px' }}>
          <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:6 }}>Protected blocks</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:400, color:'var(--ai3)', lineHeight:1 }}>{summary?.protected_blocks ?? 0}</span>
            <span style={{ fontSize:12, color:'var(--pios-muted)' }}>of {summary?.total_blocks ?? 0}</span>
          </div>
          <div style={{ ...mono, color:'var(--pios-muted)', marginTop:4 }}>calendar locks active</div>
        </div>

        {/* Latest week strategic hours */}
        <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'16px 18px' }}>
          <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:6 }}>Strategic this week</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:400, color:'var(--fm)', lineHeight:1 }}>{latest?.strategic_hours ?? '—'}</span>
            <span style={{ fontSize:12, color:'var(--pios-muted)' }}>hrs</span>
          </div>
          <div style={{ ...mono, color:'var(--pios-muted)', marginTop:4 }}>
            {latest ? `${latest.strategic_pct ?? Math.round((latest.strategic_hours / latest.total_hours) * 100)}% of ${latest.total_hours}h` : 'no log yet'}
          </div>
        </div>

        {/* Admin hours warning */}
        <div style={{
          background:'var(--pios-surface)', borderRadius:12, padding:'16px 18px',
          border:`1px solid ${latest && latest.admin_hours > (latest.total_hours * 0.3) ? 'rgba(244,63,94,0.3)' : 'var(--pios-border)'}`,
        }}>
          <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:6 }}>Admin drag</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:32, fontWeight:400, color: latest && latest.admin_hours > (latest.total_hours * 0.3) ? 'var(--dng)' : 'var(--pios-text)', lineHeight:1 }}>
              {latest?.admin_hours ?? '—'}
            </span>
            <span style={{ fontSize:12, color:'var(--pios-muted)' }}>hrs</span>
          </div>
          <div style={{ ...mono, color:'var(--pios-muted)', marginTop:4 }}>
            {latest && latest.admin_hours > (latest.total_hours * 0.3)
              ? 'Above 30% — reclaim time'
              : 'within target'}
          </div>
        </div>
      </div>

      {/* AI insight */}
      {aiInsight && (
        <div style={{
          marginBottom:18, padding:'14px 16px', borderRadius:10,
          background:'var(--ai-subtle)', border:'1px solid rgba(99,73,255,0.25)',
          borderLeft:'3px solid var(--ai)',
        }}>
          <div style={{ ...mono, color:'var(--ai3)', marginBottom:5 }}>NemoClaw™ insight</div>
          <p style={{ fontSize:13, color:'var(--pios-text)', lineHeight:1.7 }}>{aiInsight}</p>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:3, padding:3, borderRadius:9, background:'var(--pios-surface2)', marginBottom:18, width:'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:'5px 14px', borderRadius:7, fontSize:12, border:'none', cursor:'pointer',
            background: activeTab===t.id ? 'var(--pios-surface)' : 'transparent',
            color: activeTab===t.id ? 'var(--pios-text)' : 'var(--pios-muted)',
            fontWeight: activeTab===t.id ? 600 : 400, fontFamily:'var(--font-sans)',
            boxShadow: activeTab===t.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'40px 0', color:'var(--pios-muted)', fontSize:13 }}>
          <Loader2 size={15} style={{ animation:'spin 0.8s linear infinite' }} /> Loading…
        </div>
      )}

      {/* ── TIME MAP TAB ─────────────────────────────────────────────────── */}
      {!loading && activeTab === 'map' && (
        <div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', minWidth:560 }}>
              <thead>
                <tr>
                  <th style={{ ...mono, padding:'4px 10px 8px', color:'var(--pios-dim)', fontWeight:500, textAlign:'left', width:46 }}>Hour</th>
                  {WORK_DAYS.map(d => (
                    <th key={d} style={{ ...mono, padding:'4px 6px 8px', color:'var(--pios-text)', fontWeight:600, textAlign:'center', minWidth:80 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map(h => (
                  <tr key={h}>
                    <td style={{ ...mono, padding:'2px 10px', color:'var(--pios-dim)', verticalAlign:'middle', whiteSpace:'nowrap', fontSize:9.5 }}>
                      {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`}
                    </td>
                    {[1,2,3,4,5].map(dayIdx => {
                      const b = blockAt(dayIdx, h)
                      const m = b ? (TYPE_META[b.block_type] ?? TYPE_META.other) : null
                      return (
                        <td key={dayIdx} title={b ? `${b.label} (${b.start_time}–${b.end_time})` : undefined}
                          style={{
                            padding:'2px 4px', height:22,
                            background: b ? m!.bg : 'transparent',
                            borderLeft: b ? `2px solid ${m!.color}` : '2px solid transparent',
                            borderBottom:'1px solid var(--pios-border)',
                            transition:'background 0.1s',
                          }}>
                          {b && timeToMins(b.start_time) === h * 60 && (
                            <div style={{ fontSize:9, color:m!.color, fontWeight:600, paddingLeft:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {b.protected && '🔒 '}{b.label}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' as const, marginTop:14 }}>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:m.bg, border:`1.5px solid ${m.color}` }} />
                <span style={{ fontSize:11, color:'var(--pios-muted)' }}>{m.label}</span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ fontSize:11 }}>🔒</span>
              <span style={{ fontSize:11, color:'var(--pios-muted)' }}>Protected</span>
            </div>
          </div>

          {blocks.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--pios-dim)', fontSize:12, marginTop:12 }}>
              No protection zones defined yet. Add time blocks in the Protection Zones tab.
            </div>
          )}
        </div>
      )}

      {/* ── PROTECTION ZONES TAB ─────────────────────────────────────────── */}
      {!loading && activeTab === 'blocks' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button onClick={() => setShowForm(!showForm)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px', borderRadius:8, border:'none',
              background:'var(--ai)', color:'#fff',
              fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)',
            }}>
              <Plus size={13} /> Add protection zone
            </button>
          </div>

          {showForm && (
            <div style={{ background:'var(--pios-surface)', border:'1px solid rgba(99,73,255,0.25)', borderRadius:12, padding:18, marginBottom:16 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:9.5, color:'var(--ai3)', marginBottom:14, letterSpacing:'0.08em', textTransform:'uppercase' as const }}>New protection zone</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:4 }}>Label</div>
                  <input style={inp} placeholder="e.g. Deep Work Block"
                    value={blockForm.label} onChange={e => setBlockForm(p=>({...p,label:e.target.value}))} autoFocus />
                </div>
                <div>
                  <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:4 }}>Type</div>
                  <select style={inp} value={blockForm.block_type} onChange={e => setBlockForm(p=>({...p,block_type:e.target.value}))}>
                    {BLOCK_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:4 }}>Start time</div>
                  <input type="time" style={inp} value={blockForm.start_time} onChange={e => setBlockForm(p=>({...p,start_time:e.target.value}))} />
                </div>
                <div>
                  <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:4 }}>End time</div>
                  <input type="time" style={inp} value={blockForm.end_time} onChange={e => setBlockForm(p=>({...p,end_time:e.target.value}))} />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:6 }}>Days</div>
                <div style={{ display:'flex', gap:6 }}>
                  {DAYS.map((d, i) => {
                    const on = blockForm.day_of_week.includes(i)
                    return (
                      <button key={d} onClick={() => setBlockForm(p => ({
                        ...p, day_of_week: on ? p.day_of_week.filter(x => x!==i) : [...p.day_of_week, i]
                      }))} style={{
                        width:36, height:32, borderRadius:7, fontSize:11, border:'1px solid',
                        cursor:'pointer', fontWeight:on?600:400,
                        background: on ? 'var(--ai-subtle)' : 'var(--pios-surface2)',
                        borderColor: on ? 'rgba(99,73,255,0.4)' : 'var(--pios-border2)',
                        color: on ? 'var(--ai3)' : 'var(--pios-muted)',
                      }}>{d}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <input type="checkbox" checked={blockForm.protected} onChange={e => setBlockForm(p=>({...p,protected:e.target.checked}))} id="prot" />
                <label htmlFor="prot" style={{ fontSize:12, color:'var(--pios-text)', cursor:'pointer' }}>Protected — block meeting requests during this time</label>
                <Lock size={12} color="var(--ai3)" />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={saveBlock} disabled={!blockForm.label||saving} style={{
                  padding:'8px 18px', borderRadius:8, border:'none',
                  background: blockForm.label ? 'var(--ai)' : 'rgba(99,73,255,0.3)',
                  color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)',
                }}>{saving?'Saving…':'Save zone'}</button>
                <button onClick={() => setShowForm(false)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--pios-border2)', background:'transparent', color:'var(--pios-muted)', fontSize:13, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Cancel</button>
              </div>
            </div>
          )}

          {blocks.length === 0 ? (
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'40px 24px', textAlign:'center' }}>
              <Shield size={32} color="var(--pios-dim)" style={{ margin:'0 auto 12px' }} />
              <p style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:400, marginBottom:6 }}>No protection zones</p>
              <p style={{ fontSize:12, color:'var(--pios-muted)' }}>Add your first calendar protection zone to start defending your time.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {blocks.map(b => {
                const m = TYPE_META[b.block_type] ?? TYPE_META.other
                return (
                  <div key={b.id} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', borderRadius:10,
                    background:'var(--pios-surface)', border:`1px solid ${m.border}`,
                    borderLeft:`3px solid ${m.color}`,
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        {b.protected && <Lock size={11} color={m.color} />}
                        <span style={{ fontSize:13, fontWeight:500 }}>{b.label}</span>
                        <span style={{ ...mono, fontSize:9, padding:'1px 6px', borderRadius:4, background:m.bg, color:m.color }}>{TYPE_META[b.block_type]?.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--pios-muted)' }}>
                        <span style={mono}>{b.start_time}–{b.end_time}</span>
                        <span>{b.day_of_week.map(d => DAYS[d]).join(', ')}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteBlock(b.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pios-dim)', padding:4 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color='var(--dng)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color='var(--pios-dim)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── WEEKLY LOG TAB ───────────────────────────────────────────────── */}
      {!loading && activeTab === 'log' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Log form */}
          <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:18 }}>
            <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:14 }}>Log hours for week of</div>
            <input type="date" style={{ ...inp, marginBottom:14 }} value={weekLog.week_start}
              onChange={e => setWeekLog(p => ({...p, week_start:e.target.value}))} />

            {[
              ['strategic_hours',   'Strategic (CEO decisions, IP, fundraising)'],
              ['operational_hours', 'Operational (product, FM consulting)'],
              ['stakeholder_hours', 'Stakeholder (meetings, investors, partners)'],
              ['admin_hours',       'Admin (email, finance, admin tasks)'],
              ['recovery_hours',    'Recovery (exercise, rest, learning)'],
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11.5, color:'var(--pios-muted)', marginBottom:4 }}>{label}</div>
                <input type="number" min="0" max="60" step="0.5" style={{ ...inp }}
                  value={(weekLog as any)[key]}
                  onChange={e => setWeekLog(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}

            <div style={{ fontSize:12, color:'var(--pios-muted)', margin:'4px 0 14px' }}>
              Total: <span style={{ fontWeight:600, color:'var(--pios-text)' }}>
                {Object.entries(weekLog).filter(([k]) => k!=='week_start').reduce((s,[,v])=>s+Number(v),0).toFixed(1)}h
              </span>
            </div>

            <button onClick={saveLog} disabled={logging} style={{
              width:'100%', padding:'9px', borderRadius:8, border:'none',
              background:'var(--ai)', color:'#fff', fontSize:13, fontWeight:500,
              cursor:'pointer', fontFamily:'var(--font-sans)',
            }}>
              {logging ? 'Saving…' : logSaved ? '✓ Saved' : 'Save weekly log'}
            </button>
          </div>

          {/* Audit history */}
          <div>
            <div style={{ ...mono, color:'var(--pios-dim)', marginBottom:12 }}>Audit history (last 8 weeks)</div>
            {audits.length === 0 ? (
              <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:24, textAlign:'center', color:'var(--pios-dim)', fontSize:12 }}>
                No logs yet. Log your first week.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {audits.map((a, i) => {
                  const stratPct = a.total_hours ? Math.round(a.strategic_hours / a.total_hours * 100) : 0
                  const adminPct = a.total_hours ? Math.round(a.admin_hours / a.total_hours * 100) : 0
                  const s = sovereignty_score([a])
                  const { color: sc } = score_label(s)
                  return (
                    <div key={i} style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:10, padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ ...mono, fontSize:10 }}>{a.week_start}</span>
                        <span style={{ fontFamily:'var(--font-display)', fontSize:14, color:sc }}>{s}%</span>
                      </div>
                      <div style={{ height:4, background:'var(--pios-surface2)', borderRadius:2, overflow:'hidden', display:'flex' }}>
                        <div style={{ width:`${stratPct}%`, height:'100%', background:'var(--fm)' }} title={`Strategic ${stratPct}%`} />
                        <div style={{ width:`${a.total_hours?Math.round(a.operational_hours/a.total_hours*100):0}%`, height:'100%', background:'var(--academic)' }} />
                        <div style={{ width:`${a.total_hours?Math.round(a.stakeholder_hours/a.total_hours*100):0}%`, height:'100%', background:'var(--pro)' }} />
                        <div style={{ width:`${adminPct}%`, height:'100%', background:'var(--saas)' }} />
                        <div style={{ width:`${a.total_hours?Math.round(a.recovery_hours/a.total_hours*100):0}%`, height:'100%', background:'var(--ai3)' }} />
                      </div>
                      <div style={{ display:'flex', gap:12, marginTop:6, fontSize:10.5, color:'var(--pios-muted)' }}>
                        <span style={{ color:'var(--fm)' }}>S:{a.strategic_hours}h</span>
                        <span style={{ color:'var(--academic)' }}>O:{a.operational_hours}h</span>
                        <span style={{ color:'var(--saas)', ...(adminPct>30?{fontWeight:700}:{}) }}>
                          {adminPct>30 && '⚠ '}A:{a.admin_hours}h
                        </span>
                        <span style={{ color:'var(--pios-dim)' }}>Total:{a.total_hours}h</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
