/**
 * /platform/time-sovereignty — TSA™ Time Sovereignty Agent
 * Calendar audit, protected blocks, weekly time tracking
 * PIOS Sprint 23 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Clock, Shield, Plus, Zap, Loader2, Trash2 } from 'lucide-react'

type Block = { id: string; label: string; block_type: string; day_of_week: number[]; start_time: string; end_time: string; protected: boolean; notes?: string }
type Audit = { week_start: string; strategic_hours: number; operational_hours: number; admin_hours: number; stakeholder_hours: number; recovery_hours: number; total_hours: number; strategic_pct: number }
type Summary = { total_blocks: number; protected_blocks: number; type_breakdown: Record<string,number> }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const BLOCK_TYPES = ['strategic','deep_work','stakeholder','admin','recovery','other']
const TYPE_COLOR: Record<string,string> = {
  strategic:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  deep_work:   'bg-[var(--ai)]/10 text-[var(--ai3)] border-[rgba(99,73,255,0.2)]',
  stakeholder: 'bg-[var(--academic)]/10 text-[var(--academic)] border-blue-500/20',
  admin:       'bg-[var(--saas)]/10 text-[var(--saas)] border-amber-500/20',
  recovery:    'bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border-green-500/20',
  other:       'bg-slate-500/10 text-[var(--pios-muted)] border-[var(--pios-border2)]/20',
}

function HoursInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-[var(--pios-muted)] block mb-1">{label}</label>
      <input type="number" min="0" max="60" step="0.5" value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
    </div>
  )
}

export default function TimeSovereigntyPage() {
  const [blocks, setBlocks]   = useState<Block[]>([])
  const [audits, setAudits]   = useState<Audit[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'blocks'|'audit'|'log'>('blocks')

  // AI audit
  const [aiAudit, setAiAudit]       = useState<string | null>(null)
  const [auditing, setAuditing]     = useState(false)

  // New block modal
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockForm, setBlockForm] = useState({
    label: '', block_type: 'strategic', day_of_week: [1,2,3,4,5],
    start_time: '08:00', end_time: '10:00', protected: true, notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Weekly log form
  const [weekLog, setWeekLog] = useState({
    week_start: new Date(Date.now() - ((new Date().getDay() || 7) - 1) * 86400000).toISOString().split('T')[0],
    strategic_hours: 0, operational_hours: 0, admin_hours: 0,
    stakeholder_hours: 0, recovery_hours: 0,
  })
  const [logging, setLogging] = useState(false)
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_block', payload: blockForm }),
    })
    setShowBlockModal(false)
    setBlockForm({ label:'', block_type:'strategic', day_of_week:[1,2,3,4,5], start_time:'08:00', end_time:'10:00', protected:true, notes:'' })
    setSaving(false)
    load()
  }

  async function deleteBlock(id: string) {
    await fetch('/api/exec/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_block', block_id: id }),
    })
    load()
  }

  async function logWeek() {
    setLogging(true)
    await fetch('/api/exec/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_week', ...weekLog }),
    })
    setLogSaved(true)
    setLogging(false)
    setTimeout(() => setLogSaved(false), 3000)
    load()
  }

  async function runAudit() {
    setAuditing(true)
    setAiAudit(null)
    try {
      const r = await fetch('/api/exec/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_audit', blocks, recent_audits: audits }),
      })
      const d = await r.json()
      setAiAudit(d.audit ?? 'No output returned.')
    } catch { setAiAudit('Error running audit.') }
    setAuditing(false)
  }

  const totalLogHours = weekLog.strategic_hours + weekLog.operational_hours + weekLog.admin_hours + weekLog.stakeholder_hours + weekLog.recovery_hours
  const strategicPct = totalLogHours > 0 ? Math.round((weekLog.strategic_hours / totalLogHours) * 100) : 0

  const inp = "w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] placeholder:text-[var(--pios-muted)] focus:outline-none focus:border-violet-500/50 mb-3"

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-[var(--pios-muted)] text-sm animate-pulse">Loading Time Sovereignty Agent…</div>
    </div>
  )

  return (
    <div className="p-6 min-h-screen max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold">Time Sovereignty</h1>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium">TSA™</span>
          </div>
          <p className="text-sm text-[var(--pios-muted)]">Protect strategic time · audit calendar · ensure busyness never replaces strategy</p>
        </div>
        <button onClick={runAudit} disabled={auditing}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 disabled:opacity-50">
          {auditing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditing…</> : <><Zap className="w-3.5 h-3.5" /> Run AI Audit</>}
        </button>
      </div>

      {/* Stats strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
            <div className="text-xs text-[var(--pios-muted)] mb-1">Protected blocks</div>
            <div className="text-2xl font-semibold">{summary.protected_blocks}</div>
            <div className="text-xs text-[var(--pios-muted)]">of {summary.total_blocks} total</div>
          </div>
          {(['strategic','deep_work','admin'] as const).map(t => (
            <div key={t} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] mb-1 capitalize">{t.replace('_',' ')}</div>
              <div className="text-2xl font-semibold">{summary.type_breakdown[t] ?? 0}</div>
              <div className="text-xs text-[var(--pios-muted)]">blocks</div>
            </div>
          ))}
        </div>
      )}

      {/* AI audit output */}
      {aiAudit && (
        <div className="mb-6 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">TSA™ Time Sovereignty Audit</span>
          </div>
          <div className="text-sm text-[var(--pios-text)]/90 whitespace-pre-wrap leading-relaxed">{aiAudit}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[var(--pios-surface2)] rounded-lg p-1 w-fit">
        {(['blocks','log','audit'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-[var(--pios-surface3)] text-[var(--pios-text)]' : 'text-[var(--pios-muted)] hover:text-[var(--pios-text)]'}`}>
            {t === 'log' ? 'Weekly Log' : t === 'audit' ? 'History' : 'Time Blocks'}
          </button>
        ))}
      </div>

      {/* ── BLOCKS TAB ───────────────────────────────────────── */}
      {activeTab === 'blocks' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowBlockModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--ai)]/10 border border-[rgba(99,73,255,0.2)] text-[var(--ai3)] rounded-lg text-sm font-medium hover:bg-[var(--ai)]/20">
              <Plus className="w-4 h-4" /> Add Block
            </button>
          </div>
          <div className="space-y-3">
            {blocks.map(b => (
              <div key={b.id} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--pios-text)]">{b.label}</span>
                    {b.protected && <Shield className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[b.block_type]}`}>{b.block_type.replace('_',' ')}</span>
                    <span className="text-xs text-[var(--pios-muted)]">{b.start_time} – {b.end_time}</span>
                    <span className="text-xs text-[var(--pios-muted)]">{(b.day_of_week ?? []).map((d: number) => DAYS[d]).join(', ')}</span>
                  </div>
                  {b.notes && <p className="text-xs text-[var(--pios-muted)] mt-1">{b.notes}</p>}
                </div>
                <button onClick={() => deleteBlock(b.id)} className="text-[var(--pios-muted)] hover:text-[var(--dng)] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {blocks.length === 0 && (
              <div className="text-center py-16 text-[var(--pios-muted)]">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No time blocks configured.</p>
                <p className="text-xs mt-1">Add your first protected block to start building your time architecture.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WEEKLY LOG TAB ───────────────────────────────────── */}
      {activeTab === 'log' && (
        <div className="max-w-md">
          <p className="text-sm text-[var(--pios-muted)] mb-5">Log how you actually spent your time this week. This feeds your TSA™ audit history.</p>
          <label className="text-xs text-[var(--pios-muted)] block mb-1">Week starting</label>
          <input type="date" value={weekLog.week_start}
            onChange={e => setWeekLog(w => ({...w, week_start: e.target.value}))}
            className={inp} />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <HoursInput label="Strategic / deep work (hrs)" value={weekLog.strategic_hours} onChange={v => setWeekLog(w=>({...w,strategic_hours:v}))} />
            <HoursInput label="Operational (hrs)" value={weekLog.operational_hours} onChange={v => setWeekLog(w=>({...w,operational_hours:v}))} />
            <HoursInput label="Admin / meetings (hrs)" value={weekLog.admin_hours} onChange={v => setWeekLog(w=>({...w,admin_hours:v}))} />
            <HoursInput label="Stakeholder (hrs)" value={weekLog.stakeholder_hours} onChange={v => setWeekLog(w=>({...w,stakeholder_hours:v}))} />
            <HoursInput label="Recovery / personal (hrs)" value={weekLog.recovery_hours} onChange={v => setWeekLog(w=>({...w,recovery_hours:v}))} />
            <div className="flex flex-col justify-end">
              <div className="text-xs text-[var(--pios-muted)] mb-1">Strategic ratio</div>
              <div className={`text-2xl font-semibold ${strategicPct >= 30 ? 'text-[var(--fm)]' : strategicPct >= 20 ? 'text-[var(--saas)]' : 'text-[var(--dng)]'}`}>{strategicPct}%</div>
              <div className="text-xs text-[var(--pios-muted)]">target: 30–40%</div>
            </div>
          </div>
          <button onClick={logWeek} disabled={logging || totalLogHours === 0}
            className="w-full py-2.5 rounded-xl bg-[var(--ai)] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[var(--ai)] flex items-center justify-center gap-2">
            {logging ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : logSaved ? '✓ Saved' : 'Log This Week'}
          </button>
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div>
          {audits.length > 0 ? (
            <div className="space-y-3">
              {audits.map(a => (
                <div key={a.week_start} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">w/c {new Date(a.week_start).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</span>
                    <span className={`text-sm font-bold ${a.strategic_pct >= 30 ? 'text-[var(--fm)]' : a.strategic_pct >= 20 ? 'text-[var(--saas)]' : 'text-[var(--dng)]'}`}>{a.strategic_pct}% strategic</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      ['Strategic', a.strategic_hours],
                      ['Ops', a.operational_hours],
                      ['Admin', a.admin_hours],
                      ['Stakeholder', a.stakeholder_hours],
                      ['Recovery', a.recovery_hours],
                    ].map(([label, hrs]) => (
                      <div key={String(label)} className="text-center">
                        <div className="text-xs text-[var(--pios-muted)] mb-0.5">{label}</div>
                        <div className="text-sm font-medium">{hrs}h</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-[var(--pios-muted)]">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No weekly logs yet. Use the Weekly Log tab to start tracking.</p>
            </div>
          )}
        </div>
      )}

      {/* ── BLOCK MODAL ──────────────────────────────────────── */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-[var(--pios-border)] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">Add Time Block</h3>
            <input className={inp} placeholder="Block label (e.g. Deep work — strategy)" value={blockForm.label} onChange={e => setBlockForm(f=>({...f,label:e.target.value}))} />
            <label className="text-xs text-[var(--pios-muted)] block mb-1">Block type</label>
            <select className={inp+" appearance-none"} value={blockForm.block_type} onChange={e => setBlockForm(f=>({...f,block_type:e.target.value}))}>
              {BLOCK_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Start time</label>
                <input type="time" value={blockForm.start_time} onChange={e => setBlockForm(f=>({...f,start_time:e.target.value}))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">End time</label>
                <input type="time" value={blockForm.end_time} onChange={e => setBlockForm(f=>({...f,end_time:e.target.value}))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none" />
              </div>
            </div>
            <label className="text-xs text-[var(--pios-muted)] block mb-1.5">Days</label>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {DAYS.map((d,i) => (
                <button key={d} type="button"
                  onClick={() => setBlockForm(f => ({ ...f, day_of_week: f.day_of_week.includes(i) ? f.day_of_week.filter(x=>x!==i) : [...f.day_of_week, i] }))}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${blockForm.day_of_week.includes(i) ? 'bg-[var(--ai)] text-white' : 'bg-[var(--pios-surface2)] text-[var(--pios-muted)] hover:bg-[var(--pios-surface3)]'}`}>
                  {d}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--pios-text)] cursor-pointer mb-4">
              <input type="checkbox" checked={blockForm.protected} onChange={e => setBlockForm(f=>({...f,protected:e.target.checked}))} className="rounded" />
              Protected block (TSA™ will flag if this time gets eroded)
            </label>
            <div className="flex gap-2">
              <button onClick={()=>setShowBlockModal(false)} className="flex-1 py-2 rounded-lg border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:bg-[var(--pios-surface2)]">Cancel</button>
              <button onClick={saveBlock} disabled={!blockForm.label||saving} className="flex-1 py-2 rounded-lg bg-[var(--ai)] text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
