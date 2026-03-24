/**
 * /platform/comms — BICA™ Board & Investor Comms + SIA™ Signal Briefs
 * PIOS Sprint 24 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Zap, Radio, FileText, Plus, Loader2, Copy, Check, Archive } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
type Template  = { key: string; label: string; desc: string; sections: string[] }
type Comms     = { id: string; title: string; comms_type: string; audience: string; period: string; tone: string; content: string; status: string; word_count: number; created_at: string }
type SIABrief  = { id: string; title: string; content: string; sectors: string[]; cadence: string; created_at: string }
type Sector    = { key: string; label: string }

const STATUS_COLOR: Record<string,string> = {
  draft:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  reviewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sent:     'bg-green-500/10 text-green-400 border-green-500/20',
  archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}
const TONES = ['formal','confident','balanced','direct']

// ── Input helpers ──────────────────────────────────────────────
function FInput({ label, value, onChange, placeholder, textarea = false }: {
  label: string; value: string; onChange: (v:string)=>void; placeholder?: string; textarea?: boolean
}) {
  const cls = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/40 mb-3"
  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls+" resize-none"} />
        : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={cls} />}
    </div>
  )
}

export default function CommsPage() {
  const [activeTab, setActiveTab] = useState<'bica'|'sia'|'history'>('bica')

  // BICA state
  const [templates, setTemplates]     = useState<Template[]>([])
  const [selTemplate, setSelTemplate] = useState<string>('')
  const [commsHistory, setCommsHistory] = useState<Comms[]>([])
  const [audience, setAudience]       = useState('')
  const [period, setPeriod]           = useState(`Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}`)
  const [tone, setTone]               = useState('confident')
  const [inputs, setInputs]           = useState<Record<string,string>>({})
  const [generating, setGenerating]   = useState(false)
  const [generatedComms, setGeneratedComms] = useState<{content:string;word_count:number;id?:string}|null>(null)
  const [copied, setCopied]           = useState(false)

  // SIA state
  const [sectors, setSectors]         = useState<Sector[]>([])
  const [selSectors, setSelSectors]   = useState<string[]>(['strategy','technology','market'])
  const [siaBriefs, setSiaBriefs]     = useState<SIABrief[]>([])
  const [briefCadence, setBriefCadence] = useState<'weekly'|'daily'>('weekly')
  const [briefing, setBriefing]       = useState(false)
  const [latestBrief, setLatestBrief] = useState<string|null>(null)

  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tplRes, histRes, siaRes] = await Promise.all([
        fetch('/api/bica?mode=templates'),
        fetch('/api/bica'),
        fetch('/api/sia'),
      ])
      const [tplD, histD, siaD] = await Promise.all([tplRes.json(), histRes.json(), siaRes.json()])
      setTemplates(tplD.templates ?? [])
      setCommsHistory(histD.comms ?? [])
      setSectors(siaD.sectors ?? [])
      setSiaBriefs(siaD.briefs ?? [])
    } catch { /**/ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Reset inputs when template changes
  useEffect(() => {
    setInputs({})
    setGeneratedComms(null)
  }, [selTemplate])

  const currentTemplate = templates.find(t => t.key === selTemplate)

  async function generate() {
    if (!selTemplate) return
    setGenerating(true)
    setGeneratedComms(null)
    try {
      const r = await fetch('/api/bica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', comms_type: selTemplate, audience, period, tone, inputs }),
      })
      const d = await r.json()
      if (d.content) setGeneratedComms({ content: d.content, word_count: d.word_count, id: d.id })
    } catch { /**/ }
    setGenerating(false)
  }

  async function generateBrief() {
    if (!selSectors.length) return
    setBriefing(true)
    setLatestBrief(null)
    try {
      const r = await fetch('/api/sia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_brief', sectors: selSectors, cadence: briefCadence }),
      })
      const d = await r.json()
      if (d.content) { setLatestBrief(d.content); load() }
    } catch { /**/ }
    setBriefing(false)
  }

  async function archiveComms(id: string) {
    await fetch('/api/bica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id, status: 'archived' }),
    })
    load()
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inp = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/40 mb-3"

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground text-sm animate-pulse">Loading Comms Hub…</div>
    </div>
  )

  return (
    <div className="p-6 min-h-screen max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h1 className="text-xl font-bold">Intelligence & Comms</h1>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">BICA™ · SIA™</span>
          </div>
          <p className="text-sm text-muted-foreground">Board packs · investor updates · strategic signal briefs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        {([['bica','Board & Investor Comms'],['sia','Signal Intelligence'],['history','History']] as const).map(([t,label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── BICA TAB ─────────────────────────────────────────── */}
      {activeTab === 'bica' && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left: template + config */}
          <div className="col-span-2 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Communication type</p>
              <div className="space-y-2">
                {templates.map(t => (
                  <button key={t.key} onClick={() => setSelTemplate(t.key)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selTemplate === t.key ? 'bg-blue-500/10 border-blue-500/30' : 'bg-card border-border hover:bg-white/5'}`}>
                    <div className={`text-sm font-medium ${selTemplate === t.key ? 'text-foreground' : 'text-foreground/80'}`}>{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {selTemplate && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <FInput label="Audience" value={audience} onChange={setAudience} placeholder="e.g. Board of Directors, Seed investors" />
                <FInput label="Period" value={period} onChange={setPeriod} placeholder="e.g. Q1 2026, March 2026" />
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Tone</label>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {TONES.map(t => (
                      <button key={t} onClick={() => setTone(t)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${tone === t ? 'bg-violet-500 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={generate} disabled={generating}
                  className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 flex items-center justify-center gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate {currentTemplate?.label}</>}
                </button>
              </div>
            )}
          </div>

          {/* Right: input fields + output */}
          <div className="col-span-3">
            {selTemplate && currentTemplate && !generatedComms && (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">Optional context (improves output)</p>
                <div className="space-y-1">
                  {currentTemplate.sections.slice(0, 5).map(section => (
                    <FInput
                      key={section}
                      label={section}
                      value={inputs[section] ?? ''}
                      onChange={v => setInputs(prev => ({...prev, [section]: v}))}
                      placeholder={`Key points for "${section}" section…`}
                      textarea={true}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">All fields optional — BICA™ uses live OKR data and professional judgment where inputs are blank.</p>
              </div>
            )}

            {generatedComms && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">BICA™ — {currentTemplate?.label}</span>
                    <span className="text-xs text-muted-foreground">{generatedComms.word_count} words</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyText(generatedComms.content)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      {copied ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                    <button onClick={() => setGeneratedComms(null)} className="text-xs text-muted-foreground hover:text-foreground">New draft</button>
                  </div>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[560px]">{generatedComms.content}</div>
              </div>
            )}

            {!selTemplate && (
              <div className="flex items-center justify-center h-full min-h-64 text-muted-foreground bg-card border border-border rounded-xl">
                <div className="text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a communication type to begin</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIA TAB ──────────────────────────────────────────── */}
      {activeTab === 'sia' && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left: sector config */}
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Intelligence sectors</p>
            <div className="space-y-2 mb-4">
              {sectors.map(s => (
                <button key={s.key}
                  onClick={() => setSelSectors(prev => prev.includes(s.key) ? prev.filter(x=>x!==s.key) : [...prev, s.key])}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${selSectors.includes(s.key) ? 'bg-violet-500/10 border-violet-500/30' : 'bg-card border-border hover:bg-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selSectors.includes(s.key) ? 'bg-violet-400' : 'bg-white/20'}`} />
                  <span className={`text-sm ${selSectors.includes(s.key) ? 'text-foreground font-medium' : 'text-foreground/70'}`}>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Cadence</p>
              <div className="flex gap-2">
                {(['weekly','daily'] as const).map(c => (
                  <button key={c} onClick={() => setBriefCadence(c)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${briefCadence === c ? 'bg-violet-500 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generateBrief} disabled={briefing || !selSectors.length}
              className="w-full py-2.5 rounded-xl bg-violet-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-600 flex items-center justify-center gap-2">
              {briefing ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Radio className="w-4 h-4" /> Generate Signal Brief</>}
            </button>
            <p className="text-xs text-muted-foreground text-center mt-2">{selSectors.length} sector{selSectors.length !== 1 ? 's' : ''} selected</p>
          </div>

          {/* Right: latest brief */}
          <div className="col-span-3">
            {latestBrief ? (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">SIA™ Signal Brief</span>
                  </div>
                  <button onClick={() => copyText(latestBrief)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {copied ? <><Check className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[560px]">{latestBrief}</div>
              </div>
            ) : siaBriefs.length > 0 ? (
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Last brief</p>
                <p className="text-xs text-muted-foreground mb-3">{new Date(siaBriefs[0].created_at).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</p>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[480px]">{siaBriefs[0].content}</div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-64 text-muted-foreground bg-card border border-border rounded-xl">
                <div className="text-center">
                  <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select sectors and generate your first Signal Brief</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {commsHistory.length > 0 ? commsHistory.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.audience && `${c.audience} · `}{c.word_count} words · {new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
                  {c.status !== 'archived' && (
                    <button onClick={() => archiveComms(c.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {c.content && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.content.slice(0, 200)}…</p>
              )}
            </div>
          )) : (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No communications generated yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
