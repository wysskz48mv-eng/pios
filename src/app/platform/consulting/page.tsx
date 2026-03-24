/**
 * /platform/consulting — CSA™ Consulting Strategist Agent
 * Framework engine: POM™ OAE™ SDL™ CVDM™ CPA™ SCE™ AAM™
 * PIOS Sprint 23 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Briefcase, Zap, Plus, ChevronDown, Loader2, Copy, Check } from 'lucide-react'

type Framework = { key: string; name: string; desc: string }
type Engagement = { id: string; client_name: string; engagement_type: string; status: string; framework_used: string; brief: string; ai_output: string; created_at: string }

const STATUS_COLOR: Record<string,string> = {
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  proposal:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  on_hold:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const ENG_TYPES = ['strategy','operations','change','commercial','diagnostic','other']

export default function ConsultingPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<'frameworks'|'engagements'|'proposals'>('frameworks')

  // Framework analyser state
  const [selFramework, setSelFramework] = useState<string>('')
  const [situation, setSituation]       = useState('')
  const [engagementId, setEngagementId] = useState('')
  const [analysing, setAnalysing]       = useState(false)
  const [analysis, setAnalysis]         = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)

  // Proposal state
  const [propClient, setPropClient]   = useState('')
  const [propType, setPropType]       = useState('strategy')
  const [propScope, setPropScope]     = useState('')
  const [generating, setGenerating]   = useState(false)
  const [proposal, setProposal]       = useState<string | null>(null)

  // New engagement modal
  const [showEngModal, setShowEngModal] = useState(false)
  const [engForm, setEngForm] = useState({ client_name: '', engagement_type: 'strategy', status: 'active', brief: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fwRes, engRes] = await Promise.all([
        fetch('/api/consulting?mode=frameworks'),
        fetch('/api/consulting'),
      ])
      const [fwData, engData] = await Promise.all([fwRes.json(), engRes.json()])
      setFrameworks(fwData.frameworks ?? [])
      setEngagements(engData.engagements ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runAnalysis() {
    if (!selFramework || !situation.trim()) return
    setAnalysing(true)
    setAnalysis(null)
    try {
      const r = await fetch('/api/consulting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_framework',
          framework_key: selFramework,
          situation: situation.trim(),
          engagement_id: engagementId || undefined,
        }),
      })
      const d = await r.json()
      setAnalysis(d.analysis ?? 'No output returned.')
    } catch { setAnalysis('Error generating analysis. Please try again.') }
    setAnalysing(false)
  }

  async function generateProposal() {
    if (!propClient.trim() || !propScope.trim()) return
    setGenerating(true)
    setProposal(null)
    try {
      const r = await fetch('/api/consulting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_proposal',
          client_name: propClient,
          engagement_type: propType,
          scope: propScope,
        }),
      })
      const d = await r.json()
      setProposal(d.proposal ?? 'Error generating proposal.')
    } catch { setProposal('Error generating proposal. Please try again.') }
    setGenerating(false)
  }

  async function saveEngagement() {
    setSaving(true)
    await fetch('/api/consulting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_engagement', payload: engForm }),
    })
    setShowEngModal(false)
    setEngForm({ client_name: '', engagement_type: 'strategy', status: 'active', brief: '' })
    setSaving(false)
    load()
  }

  function copyAnalysis() {
    if (!analysis) return
    navigator.clipboard.writeText(analysis)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inp = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 mb-3"
  const sel = inp + " appearance-none"

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground text-sm animate-pulse">Loading Consulting Engine…</div>
    </div>
  )

  return (
    <div className="p-6 min-h-screen max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold">Consulting Strategist</h1>
            <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full font-medium">CSA™</span>
          </div>
          <p className="text-sm text-muted-foreground">Proprietary framework engine — 15 analytical models, zero third-party IP</p>
        </div>
        <button onClick={() => setShowEngModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/20">
          <Plus className="w-4 h-4" /> New Engagement
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        {(['frameworks','engagements','proposals'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── FRAMEWORKS TAB ──────────────────────────────────── */}
      {activeTab === 'frameworks' && (
        <div className="grid grid-cols-5 gap-5">
          {/* Framework selector */}
          <div className="col-span-2 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Select framework</p>
            {frameworks.map(fw => (
              <button key={fw.key} onClick={() => setSelFramework(fw.key)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selFramework === fw.key
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-card border-border hover:bg-white/5'}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold tracking-wide ${selFramework === fw.key ? 'text-violet-400' : 'text-muted-foreground'}`}>{fw.key}™</span>
                  {selFramework === fw.key && <ChevronDown className="w-3 h-3 text-violet-400" />}
                </div>
                <div className={`text-sm font-medium leading-tight ${selFramework === fw.key ? 'text-foreground' : 'text-foreground/80'}`}>{fw.name}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{fw.desc}</div>
              </button>
            ))}
          </div>

          {/* Analysis input + output */}
          <div className="col-span-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Situation / context</p>
            <textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              placeholder={selFramework
                ? `Describe the situation you want to analyse using ${selFramework}™…\n\nInclude: what's happening, who's involved, what decisions are pending, any constraints.`
                : 'Select a framework on the left, then describe your situation here…'}
              className="w-full h-36 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/40 resize-none mb-3"
            />

            {engagements.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Link to engagement (optional)</label>
                <select value={engagementId} onChange={e => setEngagementId(e.target.value)} className={sel}>
                  <option value="">— none —</option>
                  {engagements.map(e => <option key={e.id} value={e.id}>{e.client_name} · {e.engagement_type}</option>)}
                </select>
              </div>
            )}

            <button onClick={runAnalysis} disabled={!selFramework || !situation.trim() || analysing}
              className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-600 transition-colors flex items-center justify-center gap-2 mb-5">
              {analysing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><Zap className="w-4 h-4" /> Run {selFramework ? `${selFramework}™` : 'Framework'} Analysis</>}
            </button>

            {analysis && (
              <div className="bg-card border border-border rounded-xl p-5 relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">CSA™ Analysis — {selFramework}™</span>
                  </div>
                  <button onClick={copyAnalysis} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    {copied ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{analysis}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENGAGEMENTS TAB ──────────────────────────────────── */}
      {activeTab === 'engagements' && (
        <div className="space-y-3">
          {engagements.map(e => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-base font-semibold text-foreground">{e.client_name}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">{e.engagement_type}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.framework_used && (
                    <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">{e.framework_used}™</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[e.status] ?? ''}`}>{e.status}</span>
                </div>
              </div>
              {e.brief && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{e.brief}</p>}
              {e.ai_output && (
                <div className="mt-3 bg-white/3 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last AI output</div>
                  <p className="text-xs text-foreground/70 line-clamp-3">{e.ai_output}</p>
                </div>
              )}
            </div>
          ))}
          {engagements.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No engagements yet.</p>
              <p className="text-xs mt-1">Add a client engagement to start tracking and linking framework analyses.</p>
            </div>
          )}
        </div>
      )}

      {/* ── PROPOSALS TAB ──────────────────────────────────── */}
      {activeTab === 'proposals' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Generate proposal section</p>
            <label className="text-xs text-muted-foreground block mb-1">Client name</label>
            <input value={propClient} onChange={e => setPropClient(e.target.value)} placeholder="e.g. Qiddiya Investment Company" className={inp} />
            <label className="text-xs text-muted-foreground block mb-1">Engagement type</label>
            <select value={propType} onChange={e => setPropType(e.target.value)} className={sel}>
              {ENG_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
            <label className="text-xs text-muted-foreground block mb-1">Scope summary</label>
            <textarea value={propScope} onChange={e => setPropScope(e.target.value)}
              placeholder="Describe the engagement scope, objectives and key deliverables…"
              className="w-full h-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/40 resize-none mb-4" />
            <button onClick={generateProposal} disabled={!propClient.trim() || !propScope.trim() || generating}
              className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-600 flex items-center justify-center gap-2">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Proposal Section</>}
            </button>
          </div>

          <div>
            {proposal ? (
              <div className="bg-card border border-border rounded-xl p-5 h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">CSA™ Proposal Draft</span>
                  <button onClick={() => { navigator.clipboard.writeText(proposal); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {copied ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-96">{proposal}</div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground bg-card border border-border rounded-xl">
                <div>
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Proposal will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ENGAGEMENT MODAL ─────────────────────────────────── */}
      {showEngModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">New Engagement</h3>
            <input className={inp} placeholder="Client name" value={engForm.client_name} onChange={e => setEngForm(f=>({...f,client_name:e.target.value}))} />
            <label className="text-xs text-muted-foreground block mb-1">Type</label>
            <select className={sel} value={engForm.engagement_type} onChange={e => setEngForm(f=>({...f,engagement_type:e.target.value}))}>
              {ENG_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <select className={sel} value={engForm.status} onChange={e => setEngForm(f=>({...f,status:e.target.value}))}>
              {['active','proposal','on_hold','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <textarea className={inp+' h-20 resize-none'} placeholder="Brief description…" value={engForm.brief} onChange={e => setEngForm(f=>({...f,brief:e.target.value}))} />
            <div className="flex gap-2 mt-1">
              <button onClick={()=>setShowEngModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5">Cancel</button>
              <button onClick={saveEngagement} disabled={!engForm.client_name||saving} className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
