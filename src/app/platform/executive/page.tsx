/**
 * /platform/executive — EOSA™ Executive Operating System Dashboard
 * Agents: EOSA™ · DAA™ · PAA™ · STIA™ · TSA™
 * PIOS Sprint 22 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Zap, Target, Users, Clock, TrendingUp, Plus, ChevronRight, RefreshCw, BookOpen, AlertTriangle, Loader2, Check, Copy } from 'lucide-react'

type OKR = { id: string; title: string; health: string; progress: number; period: string; exec_key_results: KR[] }
type KR  = { id: string; title: string; current: number; target: number; unit: string; status: string; metric_type: string }
type Stakeholder = { id: string; name: string; role: string; organisation: string; importance: string; next_touchpoint: string; open_commitments: string[]; health_score: number }
type Decision = { id: string; title: string; context: string; status: string; framework_used: string; created_at: string }
type Principle = { id: string; title: string; category: string; description: string }
type Summary = { okrs: { total: number; on_track: number; at_risk: number; off_track: number; avg_progress: number }; stakeholders: { critical_count: number; needs_touchpoint: number } }

const HEALTH_COLOR: Record<string, string> = {
  on_track: 'text-green-400', at_risk: 'text-amber-400', off_track: 'text-red-400'
}
const HEALTH_BG: Record<string, string> = {
  on_track: 'bg-green-500/10 border-green-500/20',
  at_risk: 'bg-amber-500/10 border-amber-500/20',
  off_track: 'bg-red-500/10 border-red-500/20',
}
const IMP_COLOR: Record<string, string> = {
  critical: 'text-red-400', high: 'text-amber-400', medium: 'text-blue-400', low: 'text-slate-500'
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-violet-400' }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, color = 'bg-violet-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export default function ExecutivePage() {
  const [okrs, setOkrs]             = useState<OKR[]>([])
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [decisions, setDecisions]   = useState<Decision[]>([])
  const [principles, setPrinciples] = useState<Principle[]>([])
  const [summary, setSummary]       = useState<Summary | null>(null)
  const [brief, setBrief]           = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [contracts, setContracts]       = useState<Record<string,any>[]>([])
  const [financial,  setFinancial]       = useState<Record<string,any>|null>(null)
  const [ctLoading,  setCtLoading]       = useState(false)
  const [finLoading, setFinLoading]      = useState(false)

  const loadContracts = async () => {
    setCtLoading(true)
    try {
      const r = await fetch('/api/contracts')
      if (r.ok) { const d = await r.json(); setContracts(d.contracts ?? []) }
    } catch { /* silent */ } finally { setCtLoading(false) }
  }
  const loadFinancial = async () => {
    setFinLoading(true)
    try {
      const r = await fetch('/api/financials')
      if (r.ok) { const d = await r.json(); setFinancial(d) }
    } catch { /* silent */ } finally { setFinLoading(false) }
  }

  const [activeTab, setActiveTab]   = useState<'overview'|'okrs'|'decisions'|'stakeholders'|'time'|'contracts'|'financial'>('overview')

  useEffect(() => {
    if (activeTab === 'contracts') loadContracts()
    if (activeTab === 'financial') loadFinancial()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  const [reportPack, setReportPack] = useState<string | null>(null)
  const [genReport, setGenReport]   = useState(false)
  const [reportCopied, setRepCopied] = useState(false)

  // Modals
  const [showOKRModal, setShowOKRModal]       = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [showStakeModal, setShowStakeModal]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [daaLoading, setDaaLoading] = useState<string|null>(null)
  const [daaAnalysis, setDaaAnalysis] = useState<Record<string,string>>({})

  // Forms
  const [okrForm, setOkrForm]   = useState({ title: '', period: `Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`, description: '' })
  const [decForm, setDecForm]   = useState({ title: '', context: '', framework_used: 'POM' })
  const [stakeForm, setStakeForm] = useState({ name: '', role: '', organisation: '', importance: 'high', relationship_type: 'professional' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/exec')
      const d = await r.json()
      setOkrs(d.okrs ?? [])
      setStakeholders(d.stakeholders ?? [])
      setDecisions(d.decisions ?? [])
      setPrinciples(d.principles ?? [])
      setSummary(d.summary ?? null)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const r = await fetch('/api/exec/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'brief', context: {} }),
      })
      const d = await r.json()
      setBrief(d.content ?? null)
    } catch { /* silent */ }
    setBriefLoading(false)
  }

  async function saveOKR() {
    setSaving(true)
    await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'exec_okrs', payload: { ...okrForm, status: 'active', health: 'on_track', progress: 0 } }),
    })
    setShowOKRModal(false)
    setOkrForm({ title: '', period: okrForm.period, description: '' })
    setSaving(false)
    load()
  }

  async function saveDecision() {
    setSaving(true)
    await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'exec_decisions', payload: { ...decForm, status: 'open' } }),
    })
    setShowDecisionModal(false)
    setDecForm({ title: '', context: '', framework_used: 'POM' })
    setSaving(false)
    load()
  }

  async function saveStakeholder() {
    setSaving(true)
    await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'exec_stakeholders', payload: { ...stakeForm, health_score: 70 } }),
    })
    setShowStakeModal(false)
    setStakeForm({ name: '', role: '', organisation: '', importance: 'high', relationship_type: 'professional' })
    setSaving(false)
    load()
  }

  async function analyseDecision(d: Decision) {
    setDaaLoading(d.id)
    try {
      const r = await fetch('/api/exec/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'structure', title: d.title, context: d.context ?? '', framework: d.framework_used ?? 'POM' }),
      })
      const res = await r.json()
      if (res.analysis) setDaaAnalysis(prev => ({...prev, [d.id]: res.analysis}))
    } catch { /* silent */ }
    setDaaLoading(null)
  }

  const inp = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 mb-3"
  const sel = inp + " appearance-none"

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground text-sm animate-pulse">Loading Executive OS…</div>
    </div>
  )

  async function generateReportPack() {
    setGenReport(true)
    try {
      const r = await fetch('/api/exec/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'report_pack',
          context: {
            okrSummary: summary,
            openDecisions: decisions.filter((d: any) => d.status === 'open').slice(0, 5),
            stakeholders: stakeholders.filter((s: any) => s.importance === 'critical').slice(0, 6),
          },
        }),
      })
      const d = await r.json()
      setReportPack(d.content ?? null)
    } catch { /* silent */ }
    setGenReport(false)
  }


  return (
    <div className="p-6 min-h-screen max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold">Executive OS</h1>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium">EOSA™</span>
          </div>
          <p className="text-sm text-muted-foreground">Your personal operating system — decisions, performance, intelligence</p>
        </div>
        <button onClick={generateBrief} disabled={briefLoading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/20 disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
          {briefLoading ? 'Generating…' : 'Generate Brief'}
        </button>
      </div>

      {/* AI Brief */}
      {brief && (
        <div className="mb-6 bg-violet-500/5 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">Executive Brief — EOSA™</span>
          </div>
          <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{brief}</div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={Target} label="OKR Progress" value={`${summary?.okrs.avg_progress ?? 0}%`}
          sub={`${summary?.okrs.on_track ?? 0} on track · ${summary?.okrs.at_risk ?? 0} at risk`} color="text-green-400" />
        <StatCard icon={AlertTriangle} label="Open Decisions" value={decisions.filter(d => d.status === 'open').length}
          sub="requiring action" color="text-amber-400" />
        <StatCard icon={Users} label="Stakeholders" value={stakeholders.length}
          sub={`${summary?.stakeholders.needs_touchpoint ?? 0} need contact`} color="text-blue-400" />
        <StatCard icon={BookOpen} label="Principles" value={principles.length}
          sub="active" color="text-violet-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/5 rounded-lg p-1 w-fit">
        {(['overview','okrs','decisions','stakeholders','time'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'okrs' ? 'OKRs' : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-5">
          {/* OKR snapshot */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold">OKR Pulse</span>
              </div>
              <button onClick={() => setActiveTab('okrs')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {okrs.slice(0,3).map(o => (
              <div key={o.id} className="mb-3 last:mb-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-foreground truncate flex-1 mr-2">{o.title}</span>
                  <span className={`text-xs font-medium ${HEALTH_COLOR[o.health] ?? 'text-slate-400'}`}>{o.progress}%</span>
                </div>
                <ProgressBar value={o.progress} color={o.health === 'on_track' ? 'bg-green-500' : o.health === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'} />
              </div>
            ))}
            {okrs.length === 0 && (
              <div>
                <p className="text-xs text-muted-foreground">No active OKRs. Add one to start tracking.</p>
                <button onClick={() => { setActiveTab('okrs') }} className="btn-v3-ghost" style={{ fontSize:11, marginTop:8 }}>+ Add OKR</button>
              </div>
            )}
          </div>

          {/* Report Pack */}
          <div className="col-span-full flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div>
              <div className="text-sm font-semibold">Executive Report Pack</div>
              <div className="text-xs text-muted-foreground mt-0.5">One-click board briefing — OKRs, decisions, stakeholders, risks, next 30-day actions</div>
            </div>
            <button onClick={generateReportPack} disabled={genReport}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl text-sm font-medium hover:bg-cyan-500/15 disabled:opacity-50">
              {genReport ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><TrendingUp className="w-3.5 h-3.5" /> Generate Report Pack</>}
            </button>
          </div>
          {reportPack && (
            <div className="col-span-full bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-cyan-400">Board Report Pack — AI Generated</span>
                <button onClick={() => { navigator.clipboard.writeText(reportPack); setRepCopied(true); setTimeout(() => setRepCopied(false), 2000) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {reportCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {reportCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{reportPack}</pre>
            </div>
          )}
          {/* Open decisions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold">Open Decisions</span>
              </div>
              <button onClick={() => setActiveTab('decisions')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {decisions.filter(d => d.status === 'open').slice(0,4).map(d => (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-sm text-foreground">{d.title}</div>
                  {d.framework_used && <div className="text-xs text-muted-foreground">{d.framework_used}™</div>}
                </div>
              </div>
            ))}
            {decisions.filter(d => d.status === 'open').length === 0 && <p className="text-xs text-muted-foreground">No open decisions.</p>}
          </div>

          {/* Stakeholders due */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold">Stakeholder Alerts</span>
              </div>
            </div>
            {stakeholders.filter(s => s.next_touchpoint && new Date(s.next_touchpoint) <= new Date()).slice(0,4).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className={`text-xs font-semibold w-12 ${IMP_COLOR[s.importance]}`}>{s.importance.toUpperCase()}</div>
                <div>
                  <div className="text-sm text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role} · {s.organisation}</div>
                </div>
              </div>
            ))}
            {stakeholders.filter(s => s.next_touchpoint && new Date(s.next_touchpoint) <= new Date()).length === 0 &&
              <p className="text-xs text-muted-foreground">All stakeholders up to date.</p>}
          </div>

          {/* Principles */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold">Active Principles</span>
            </div>
            {principles.slice(0,4).map(p => (
              <div key={p.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-foreground">{p.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                </div>
              </div>
            ))}
            {principles.length === 0 && <p className="text-xs text-muted-foreground">Add principles to guide your decisions.</p>}
          </div>
        </div>
      )}

      {/* ── OKRs ─────────────────────────────────────────── */}
      {activeTab === 'okrs' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowOKRModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/20">
              <Plus className="w-4 h-4" /> Add Objective
            </button>
          </div>
          <div className="space-y-4">
            {okrs.map(o => (
              <div key={o.id} className={`border rounded-xl p-5 ${HEALTH_BG[o.health] ?? 'bg-card border-border'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{o.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{o.period}</span>
                    <span className={`text-xs font-semibold ${HEALTH_COLOR[o.health]}`}>{o.health.replace('_',' ').toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <ProgressBar value={o.progress} color={o.health === 'on_track' ? 'bg-green-500' : o.health === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'} />
                  <span className="text-sm font-medium text-foreground min-w-[36px]">{o.progress}%</span>
                </div>
                {o.exec_key_results?.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {o.exec_key_results.map(kr => (
                      <div key={kr.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${kr.status === 'on_track' ? 'bg-green-400' : kr.status === 'at_risk' ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <span className="flex-1">{kr.title}</span>
                        <span className="font-medium">{kr.current}/{kr.target}{kr.unit ? ` ${kr.unit}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {okrs.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active OKRs yet.</p>
                <p className="text-xs mt-1">Add your first objective to start tracking performance.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DECISIONS ────────────────────────────────────── */}
      {activeTab === 'decisions' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowDecisionModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/20">
              <Plus className="w-4 h-4" /> Log Decision
            </button>
          </div>
          <div className="space-y-3">
            {decisions.map(d => (
              <div key={d.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground mb-1">{d.title}</div>
                    {d.context && <div className="text-xs text-muted-foreground line-clamp-2">{d.context}</div>}
                    {d.framework_used && <div className="text-xs text-violet-400 mt-1">{d.framework_used}™</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`text-xs px-2 py-0.5 rounded-full border font-medium ${d.status === 'open' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                      {d.status}
                    </div>
                    {d.status === 'open' && (
                      <button onClick={() => analyseDecision(d)}
                        disabled={daaLoading === d.id}
                        className="text-xs px-2 py-0.5 rounded-full border border-violet-500/20 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-50 flex items-center gap-1 transition-colors">
                        {daaLoading === d.id ? '…' : '⚡ DAA™'}
                      </button>
                    )}
                  </div>
                </div>
                {daaAnalysis[d.id] && (
                  <div className="mt-2 bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
                    <div className="text-xs font-semibold text-violet-400 mb-1.5">DAA™ Analysis</div>
                    <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{daaAnalysis[d.id]}</div>
                  </div>
                )}
              </div>
            ))}
            {decisions.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No decisions logged yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STAKEHOLDERS ─────────────────────────────────── */}
      {activeTab === 'stakeholders' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowStakeModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/20">
              <Plus className="w-4 h-4" /> Add Stakeholder
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stakeholders.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.role} · {s.organisation}</div>
                  </div>
                  <span className={`text-xs font-semibold ${IMP_COLOR[s.importance]}`}>{s.importance.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.health_score}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.health_score}</span>
                </div>
                {s.next_touchpoint && (
                  <div className={`text-xs mt-2 ${new Date(s.next_touchpoint) <= new Date() ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {new Date(s.next_touchpoint) <= new Date() ? '⚠ Overdue: ' : 'Next: '}
                    {new Date(s.next_touchpoint).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </div>
            ))}
            {stakeholders.length === 0 && (
              <div className="col-span-2 text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No stakeholders tracked yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TIME ──────────────────────────────────────────── */}

      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Contract Register</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Active and expiring contracts across all entities</p>
            </div>
            <a href="/platform/contracts" className="text-xs text-violet-500 hover:underline">Open full register →</a>
          </div>
          {ctLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse p-8 text-center">Loading contracts…</div>
          ) : contracts.length === 0 ? (
            <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
              <p className="mb-2 font-medium">No contracts registered</p>
              <a href="/platform/contracts" className="text-violet-500 text-xs hover:underline">+ Register a contract</a>
            </div>
          ) : (
            <div className="space-y-2">
              {contracts.map((c: Record<string,any>) => (
                <div key={c.id} className="rounded-lg border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.counterparty} · {c.contract_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{c.value ? '£' + Number(c.value).toLocaleString() : '—'}</p>
                    <p className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.status?.replace('_',' ') ?? 'unknown'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Group P&L</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Aggregated expenses, payroll and contracts</p>
            </div>
            <a href="/platform/financials" className="text-xs text-violet-500 hover:underline">Full P&L →</a>
          </div>
          {finLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse p-8 text-center">Loading financials…</div>
          ) : !financial ? (
            <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
              <p className="mb-2 font-medium">No financial data yet</p>
              <p className="text-xs">Add expenses and contracts to see P&L summary</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Expenses', value: financial?.total_expenses ?? 0, colour: 'text-red-500' },
                { label: 'Payroll', value: financial?.total_payroll ?? 0, colour: 'text-amber-500' },
                { label: 'Contracts', value: financial?.total_contracts ?? 0, colour: 'text-blue-500' },
              ].map(({ label, value, colour }) => (
                <div key={label} className="rounded-xl border p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-xl font-bold ${colour}`}>£{Number(value).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'time' && (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 text-cyan-400/40" />
          <p className="text-sm font-medium text-foreground">Time Sovereignty Agent™ (TSA™)</p>
          <p className="text-xs mt-2 mb-5">Manage protected blocks, run calendar audits, and track your weekly strategic time ratio.</p>
          <a href="/platform/time-sovereignty"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-500/20 transition-colors">
            Open Time Sovereignty Agent →
          </a>
        </div>
      )}

      {/* ── OKR MODAL ────────────────────────────────────── */}
      {showOKRModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">Add Objective</h3>
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Objective title</label>
            <input className={inp} placeholder="e.g. Achieve commercial launch readiness by Q2" value={okrForm.title} onChange={e => setOkrForm(f => ({...f, title: e.target.value}))} />
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Period</label>
            <input className={inp} value={okrForm.period} onChange={e => setOkrForm(f => ({...f, period: e.target.value}))} />
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Description (optional)</label>
            <textarea className={inp + ' h-20 resize-none'} placeholder="Context or strategic intent…" value={okrForm.description} onChange={e => setOkrForm(f => ({...f, description: e.target.value}))} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowOKRModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5">Cancel</button>
              <button onClick={saveOKR} disabled={!okrForm.title || saving} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Objective'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DECISION MODAL ───────────────────────────────── */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">Log Decision</h3>
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Decision title</label>
            <input className={inp} placeholder="e.g. Choose primary deployment region for VeritasEdge" value={decForm.title} onChange={e => setDecForm(f => ({...f, title: e.target.value}))} />
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Context</label>
            <textarea className={inp + ' h-20 resize-none'} placeholder="What's the situation and what's driving this decision?" value={decForm.context} onChange={e => setDecForm(f => ({...f, context: e.target.value}))} />
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Framework</label>
            <select className={sel} value={decForm.framework_used} onChange={e => setDecForm(f => ({...f, framework_used: e.target.value}))}>
              {['POM','OAE','SDL','CVDM','CPA','SCE','AAM'].map(fw => <option key={fw} value={fw}>{fw}™</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowDecisionModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5">Cancel</button>
              <button onClick={saveDecision} disabled={!decForm.title || saving} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Log Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAKEHOLDER MODAL ────────────────────────────── */}
      {showStakeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">Add Stakeholder</h3>
            <input className={inp} placeholder="Full name" value={stakeForm.name} onChange={e => setStakeForm(f => ({...f, name: e.target.value}))} />
            <input className={inp} placeholder="Role / title" value={stakeForm.role} onChange={e => setStakeForm(f => ({...f, role: e.target.value}))} />
            <input className={inp} placeholder="Organisation" value={stakeForm.organisation} onChange={e => setStakeForm(f => ({...f, organisation: e.target.value}))} />
            <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Importance</label>
            <select className={sel} value={stakeForm.importance} onChange={e => setStakeForm(f => ({...f, importance: e.target.value}))}>
              {['critical','high','medium','low'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowStakeModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5">Cancel</button>
              <button onClick={saveStakeholder} disabled={!stakeForm.name || saving} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Stakeholder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
