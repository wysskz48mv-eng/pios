/**
 * /platform/knowledge — SE-MIL Knowledge Base
 * Institutional memory engine — search, capture, surface insights
 * PIOS Sprint 38 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Brain, Search, Plus, Zap, Loader2, Copy, Check, Trash2, BookOpen, Tag, ExternalLink, FileText, Lightbulb } from 'lucide-react'

type KnowledgeEntry = {
  id: string; title: string; summary?: string; entry_type: string
  domain: string; tags?: string[]; source?: string; url?: string
  is_search_result?: boolean; created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  note:               'bg-slate-500/10 text-slate-400 border-slate-500/20',
  article:            'bg-blue-500/10 text-blue-400 border-blue-500/20',
  book:               'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paper:              'bg-violet-500/10 text-violet-400 border-violet-500/20',
  case_study:         'bg-teal-500/10 text-teal-400 border-teal-500/20',
  framework:          'bg-purple-500/10 text-purple-400 border-purple-500/20',
  lesson_learned:     'bg-green-500/10 text-green-400 border-green-500/20',
  client_insight:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  market_intelligence:'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  ai_search_result:   'bg-pink-500/10 text-pink-400 border-pink-500/20',
  other:              'bg-slate-500/10 text-slate-400 border-slate-500/20',
}
const DOMAIN_COLOR: Record<string, string> = {
  fm_consulting: 'bg-teal-500/10 text-teal-400',
  academic:      'bg-violet-500/10 text-violet-400',
  saas:          'bg-blue-500/10 text-blue-400',
  business:      'bg-amber-500/10 text-amber-400',
  personal:      'bg-slate-500/10 text-slate-400',
}

const BLANK_FORM = { title:'', summary:'', full_text:'', entry_type:'note', domain:'business', source:'', url:'', tags_raw:'', paste_text:'' }

export default function KnowledgePage() {
  const [entries, setEntries]     = useState<KnowledgeEntry[]>([])
  const [total, setTotal]         = useState(0)
  const [byType, setByType]       = useState<Record<string,number>>({})
  const [byDomain, setByDomain]   = useState<Record<string,number>>({})
  const [loading, setLoading]     = useState(true)

  const [query, setQuery]         = useState('')
  const [domain, setDomain]       = useState('all')
  const [aiAnswer, setAiAnswer]   = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [copied, setCopied]       = useState(false)

  const [mode, setMode]           = useState<'browse'|'add'|'ai'>('browse')
  const [form, setForm]           = useState({ ...BLANK_FORM })
  const [saving, setSaving]       = useState(false)
  const [summarising, setSumm]    = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)

  const load = useCallback(async (q = '', d = 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (q.trim()) params.set('q', q)
      if (d !== 'all') params.set('domain', d)
      const r = await fetch(`/api/knowledge?${params}`)
      const data = await r.json()
      setEntries(data.entries ?? [])
      setTotal(data.total ?? 0)
      setByType(data.byType ?? {})
      setByDomain(data.byDomain ?? {})
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function aiSearch() {
    if (!query.trim()) return
    setSearching(true); setAiAnswer(null)
    try {
      const r = await fetch('/api/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_search', query, domain }),
      })
      const d = await r.json()
      setAiAnswer(d.answer ?? null)
    } catch { /* silent */ }
    setSearching(false)
  }

  async function summariseText() {
    if (!form.paste_text.trim()) return
    setSumm(true); setAiSummary(null)
    try {
      const r = await fetch('/api/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarise', text: form.paste_text, title: form.title || 'Untitled' }),
      })
      const d = await r.json()
      setAiSummary(d.summary ?? null)
      // Pre-fill summary field
      if (d.summary) {
        const lines = d.summary.split('\n')
        const summaryLine = lines.find((l: string) => l.startsWith('1.') || l.startsWith('SUMMARY'))
        if (summaryLine) setForm(p => ({ ...p, summary: summaryLine.replace(/^1\.\s*SUMMARY[:\s]*/i,'').trim() }))
      }
    } catch { /* silent */ }
    setSumm(false)
  }

  async function saveEntry() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const tags = form.tags_raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      await fetch('/api/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...form, tags, full_text: form.paste_text || form.full_text || null }),
      })
      setMode('browse'); setForm({ ...BLANK_FORM }); setAiSummary(null)
      await load(query, domain)
    } catch { /* silent */ }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    setDeleting(id)
    await fetch('/api/knowledge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    setDeleting(null)
    await load(query, domain)
  }

  const DOMAINS = ['all','fm_consulting','academic','saas','business','personal']
  const TYPES = ['note','article','book','paper','case_study','framework','lesson_learned','client_insight','market_intelligence','other']

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-teal-400" />
          <div>
            <h1 className="text-xl font-semibold">SE-MIL Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">Structured Expert Memory &amp; Institutional Learning — {total} entries</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['browse','add','ai'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${mode === m ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {m === 'ai' ? '🧠 AI Search' : m === 'add' ? '+ Add Entry' : '📚 Browse'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-semibold">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Total entries</div>
        </div>
        {Object.entries(byType).sort((a,b) => b[1]-a[1]).slice(0,4).map(([type, count]) => (
          <div key={type} className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-semibold">{count}</div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">{type.replace(/_/g,' ')}</div>
          </div>
        ))}
      </div>

      {/* ── BROWSE MODE ── */}
      {mode === 'browse' && (
        <>
          {/* Search + filter bar */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={e => { setQuery(e.target.value); load(e.target.value, domain) }}
                placeholder="Search titles, summaries, tags…"
                className="pios-input w-full pl-9" />
            </div>
            <select value={domain} onChange={e => { setDomain(e.target.value); load(query, e.target.value) }}
              className="pios-input w-40 capitalize">
              {DOMAINS.map(d => <option key={d} value={d} className="capitalize">{d.replace('_',' ')}</option>)}
            </select>
          </div>

          {/* Domain breakdown */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(byDomain).sort((a,b) => b[1]-a[1]).map(([d, count]) => (
              <button key={d} onClick={() => { setDomain(d); load(query, d) }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all capitalize ${DOMAIN_COLOR[d] ?? 'bg-slate-500/10 text-slate-400'} ${domain === d ? 'ring-1 ring-current' : 'opacity-70 hover:opacity-100'}`}>
                {d.replace('_',' ')} ({count})
              </button>
            ))}
          </div>

          {/* Entry list */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No knowledge entries yet. Use + Add Entry to capture case studies, client insights, market intelligence, or lessons learned. The AI can also search and save from Research Hub.</p>
              <p className="mt-1 text-xs">Start by adding notes, articles, case studies, and lessons learned from your work.</p>
              <button onClick={() => setMode('add')} className="mt-4 px-4 py-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 text-sm hover:bg-teal-500/15">
                + Add first entry
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.filter(e => !e.is_search_result).map(e => (
                <div key={e.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{e.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[e.entry_type] ?? ''}`}>
                          {e.entry_type.replace(/_/g,' ')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${DOMAIN_COLOR[e.domain] ?? 'bg-slate-500/10 text-slate-400'}`}>
                          {e.domain.replace(/_/g,' ')}
                        </span>
                      </div>
                      {e.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{e.summary}</p>
                      )}
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {e.source && <span className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" />{e.source}</span>}
                        {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="text-xs text-blue-400 flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />Link</a>}
                        <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
                      </div>
                      {e.tags?.length ? (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {e.tags.map(t => (
                            <span key={t} className="text-xs bg-muted/40 px-2 py-0.5 rounded flex items-center gap-0.5">
                              <Tag className="w-2.5 h-2.5" />{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button onClick={ev => { ev.stopPropagation(); deleteEntry(e.id) }} disabled={deleting === e.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 flex-shrink-0">
                      {deleting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {expanded === e.id && e.summary && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{e.summary}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── AI SEARCH MODE ── */}
      {mode === 'ai' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold">SE-MIL Semantic Search</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Ask a question and the AI will search your knowledge base, surface relevant entries, and identify gaps.</p>
            <div className="flex gap-3 mb-3">
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aiSearch()}
                placeholder="e.g. What do I know about FM service charge benchmarking in GCC?"
                className="pios-input flex-1" />
              <select value={domain} onChange={e => setDomain(e.target.value)} className="pios-input w-36 capitalize">
                {DOMAINS.map(d => <option key={d} value={d}>{d.replace('_',' ')}</option>)}
              </select>
            </div>
            <button onClick={aiSearch} disabled={!query.trim() || searching || total === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50">
              {searching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…</> : <><Zap className="w-3.5 h-3.5" /> Search Knowledge Base</>}
            </button>
            {total === 0 && (
              <p className="text-xs text-amber-400 mt-2">Add entries first before searching.</p>
            )}
          </div>

          {searching && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground p-4">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              SE-MIL is searching your knowledge base…
            </div>
          )}

          {aiAnswer && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-teal-400">SE-MIL Answer</span>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(aiAnswer); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{aiAnswer}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── ADD ENTRY MODE ── */}
      {mode === 'add' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-400" /> Add Knowledge Entry
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. GCC Service Charge Benchmarking — 2025 Market Rate Analysis"
                className="pios-input w-full" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select value={form.entry_type} onChange={e => setForm(p => ({ ...p, entry_type: e.target.value }))}
                className="pios-input w-full capitalize">
                {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
              <select value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))}
                className="pios-input w-full capitalize">
                {DOMAINS.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d.replace(/_/g,' ')}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Source / Author</label>
              <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                placeholder="e.g. CBRE Research 2025 or John Smith" className="pios-input w-full" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL (optional)</label>
              <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://..." className="pios-input w-full" />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Tags (comma-separated)</label>
              <input value={form.tags_raw} onChange={e => setForm(p => ({ ...p, tags_raw: e.target.value }))}
                placeholder="e.g. benchmarking, gcc, service-charge, 2025" className="pios-input w-full" />
            </div>

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Paste text for AI summarisation (optional)</label>
                <button onClick={summariseText} disabled={!form.paste_text.trim() || summarising}
                  className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50">
                  {summarising ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                  {summarising ? 'Summarising…' : 'AI Summarise'}
                </button>
              </div>
              <textarea value={form.paste_text}
                onChange={e => setForm(p => ({ ...p, paste_text: e.target.value }))}
                rows={4} className="pios-input w-full resize-none font-mono text-xs"
                placeholder="Paste the full text of the article, report, or note here. AI will extract the key insights." />
            </div>

            {aiSummary && (
              <div className="col-span-2 bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-semibold text-teal-400">AI Summary</span>
                </div>
                <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{aiSummary}</pre>
              </div>
            )}

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Summary (edit or write manually)</label>
              <textarea value={form.summary}
                onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
                rows={3} className="pios-input w-full resize-none"
                placeholder="Key insight or summary for this entry…" />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setMode('browse'); setForm({ ...BLANK_FORM }); setAiSummary(null) }}
              className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
            <button onClick={saveEntry} disabled={!form.title.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
