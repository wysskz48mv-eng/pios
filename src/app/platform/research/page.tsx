'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Research Hub — Academic database search, journal watchlist, CFP tracker,
// literature import guide (Scopus, Mendeley, Zotero)
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = '#6c8eff'
const TABS = ['search', 'journals', 'cfp', 'library', 'import'] as const
type Tab = typeof TABS[number]

const DB_OPTIONS = [
  { value: 'scopus',         label: 'Scopus',              note: 'Largest abstract/citation DB — primary for DBA' },
  { value: 'web_of_science', label: 'Web of Science',      note: 'High-quality journal index' },
  { value: 'google_scholar', label: 'Google Scholar',      note: 'Broad coverage, free access' },
  { value: 'emerald',        label: 'Emerald Insight',     note: 'FM, management, built environment' },
  { value: 'taylor_francis', label: 'Taylor & Francis',    note: 'Construction, FM, social science' },
  { value: 'ieee',           label: 'IEEE Xplore',         note: 'Technology, AI, engineering' },
]

const STATUS_COLOURS: Record<string, string> = {
  researching: '#64748b', drafting: '#6c8eff', submitted: '#f59e0b',
  under_review: '#a78bfa', accepted: '#22c55e', rejected: '#ef4444', published: '#2dd4a0',
}

const CFP_STATUS_COLOURS: Record<string, string> = {
  new: '#6c8eff', considering: '#f59e0b', planning: '#2dd4a0', dismissed: '#64748b',
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', fontSize: 13, fontWeight: active ? 600 : 400,
      border: 'none', borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
      background: 'none', cursor: 'pointer', color: active ? ACCENT : 'var(--pios-muted)',
      marginBottom: -1, transition: 'all 0.15s',
    }}>{children}</button>
  )
}

function Badge({ status, map }: { status: string; map: Record<string, string> }) {
  const c = map[status] ?? '#64748b'
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: c + '20', color: c, whiteSpace: 'nowrap' as const, fontWeight: 600 }}>{status.replace(/_/g, ' ')}</span>
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pios-muted)', fontSize: 13, padding: '24px 0' }}>
    <div style={{ width: 14, height: 14, border: '2px solid rgba(108,142,255,0.2)', borderTop: `2px solid ${ACCENT}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    Working…
  </div>
}

// ── DATABASE SEARCH TAB ───────────────────────────────────────────────────────
function SearchTab() {
  const [query,      setQuery]      = useState('')
  const [database,   setDatabase]   = useState('scopus')
  const [yearFrom,   setYearFrom]   = useState('')
  const [yearTo,     setYearTo]     = useState('')
  const [maxResults, setMaxResults] = useState(10)
  const [loading,    setLoading]    = useState(false)
  const [results,    setResults]    = useState<any[]>([])
  const [guardSummary, setGuardSummary] = useState<any>(null)
  const [meta,       setMeta]       = useState<any>(null)
  const [history,    setHistory]    = useState<any[]>([])
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('database_searches').select('query,database_name,result_count,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(8)
        .then(({ data }) => setHistory(data ?? []))
    })
  }, [])

  async function search() {
    if (!query.trim()) return
    setLoading(true); setResults([]); setMeta(null); setGuardSummary(null)
    const res = await fetch('/api/research/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, database, yearFrom: yearFrom || undefined, yearTo: yearTo || undefined, maxResults }),
    })
    const data = await res.json()
    setResults(data.results ?? [])
    if (data.guardSummary) setGuardSummary(data.guardSummary)
    setMeta(data)
    setLoading(false)
  }

  function toggleExpand(i: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  return (
    <div>
      <div className="pios-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
          <input className="pios-input" placeholder='e.g. AI predictive maintenance facilities management GCC'
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ fontSize: 14 }} />
          <button className="pios-btn pios-btn-primary" onClick={search} disabled={loading || !query.trim()} style={{ fontSize: 13, minWidth: 100 }}>
            {loading ? '⟳ Searching…' : '🔍 Search'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <select className="pios-input" style={{ width: 'auto', fontSize: 12 }} value={database} onChange={e => setDatabase(e.target.value)}>
            {DB_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <input className="pios-input" placeholder="Year from" type="number" style={{ width: 110, fontSize: 12 }} value={yearFrom} onChange={e => setYearFrom(e.target.value)} />
          <input className="pios-input" placeholder="Year to" type="number" style={{ width: 100, fontSize: 12 }} value={yearTo} onChange={e => setYearTo(e.target.value)} />
          <select className="pios-input" style={{ width: 'auto', fontSize: 12 }} value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value))}>
            {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} results</option>)}
          </select>
        </div>
        {database && (
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>
            {DB_OPTIONS.find(d => d.value === database)?.note} ·{' '}
            <span style={{ color: '#f59e0b' }}>AI-assisted — verify results in your institutional access portal</span>
          </p>
        )}
      </div>

      {/* Suggested searches */}
      {!results.length && !loading && (
        <div className="pios-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Suggested searches for your DBA</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
            {[
              'AI adoption facilities management GCC sensemaking',
              'predictive maintenance built environment machine learning',
              'service charge management software PropTech',
              'Science Technology Studies digital transformation FM',
              'ISO 55001 asset management artificial intelligence',
              'smart building IoT facilities management Saudi Arabia',
              'Weick sensemaking organizational decision-making technology',
              'digital twin facilities management lifecycle',
            ].map(s => (
              <button key={s} onClick={() => { setQuery(s); }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <Spinner />}

      {/* Results */}
      {results.length > 0 && (
        <div>
          {meta && (
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{results.length} results</span>
                <span style={{ fontSize: 12, color: 'var(--pios-muted)', marginLeft: 8 }}>of ~{meta.totalFound?.toLocaleString()} found in {DB_OPTIONS.find(d => d.value === meta.database)?.label}</span>
              </div>
            </div>
          )}
          {meta?.aiGuidance && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(108,142,255,0.08)', borderLeft: `3px solid ${ACCENT}`, fontSize: 12, color: 'var(--pios-text)', marginBottom: 14, lineHeight: 1.6 }}>
              💡 <strong>AI guidance:</strong> {meta.aiGuidance}
            </div>
          )}
          {guardSummary && (
            <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:14, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap',
              background: guardSummary.fabricated_risk > 0 ? 'rgba(239,68,68,0.07)' : guardSummary.needs_review > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(34,197,94,0.07)',
              border: `1px solid ${guardSummary.fabricated_risk > 0 ? 'rgba(239,68,68,0.2)' : guardSummary.needs_review > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
              <span style={{ fontSize:12, fontWeight:600, color: guardSummary.fabricated_risk > 0 ? '#ef4444' : guardSummary.needs_review > 0 ? '#f59e0b' : '#22c55e' }}>
                🔍 Citation Guard:
              </span>
              <span style={{ fontSize:12, color:'var(--pios-muted)' }}>
                {guardSummary.verified} verified · {guardSummary.needs_review} needs review · {guardSummary.fabricated_risk} unverifiable
              </span>
              {guardSummary.warning && <span style={{ fontSize:11, color:'#f59e0b' }}>⚠ {guardSummary.warning}</span>}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} className="pios-card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 4, color: 'var(--pios-text)' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                      <span>{r.authors?.slice(0, 3).join(', ')}{r.authors?.length > 3 ? ' et al.' : ''}</span>
                      <span>·</span>
                      <span style={{ fontStyle: 'italic' }}>{r.journal}</span>
                      <span>·</span>
                      <span>{r.year}</span>
                      {r.citations > 0 && <><span>·</span><span>{r.citations} citations</span></>}
                      {r.open_access && <span style={{ color: '#22c55e', fontWeight: 600 }}>OA</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    {r.provenance_label && (() => {
                      const badges: Record<string,{text:string,colour:string,bg:string}> = {
                        AI_VERIFIED:    { text:'✓ Verified',       colour:'#22c55e', bg:'rgba(34,197,94,0.1)' },
                        AI_UNVERIFIED:  { text:'⚠ Unverified',     colour:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
                        FABRICATED_RISK:{ text:'✗ Check manually', colour:'#ef4444', bg:'rgba(239,68,68,0.1)' },
                      }
                      const b = badges[r.provenance_label]
                      return b ? (
                        <span title={r.verification_note ?? r.hitl_reason ?? ''} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600, background:b.bg, color:b.colour }}>
                          {b.text}
                        </span>
                      ) : null
                    })()}
                    <button onClick={() => toggleExpand(i)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>
                      {expanded.has(i) ? 'Less ▲' : 'More ▼'}
                    </button>
                  </div>
                </div>
                {expanded.has(i) && (
                  <div style={{ borderTop: '1px solid var(--pios-border)', paddingTop: 10, marginTop: 8 }}>
                    {r.abstract && <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65, marginBottom: 10 }}>{r.abstract}</p>}
                    {r.relevance_notes && (
                      <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(108,142,255,0.08)', fontSize: 12, color: 'var(--pios-text)', marginBottom: 10 }}>
                        🎓 <strong>Relevance to your DBA:</strong> {r.relevance_notes}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      {r.keywords?.slice(0, 6).map((k: string) => (
                        <span key={k} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--pios-surface2)', color: 'var(--pios-muted)' }}>{k}</span>
                      ))}
                      {r.doi && (
                        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: ACCENT, marginLeft: 'auto' }}>
                          DOI: {r.doi} →
                        </a>
                      )}
                      {r.crossref_title && r.provenance_label === 'FABRICATED_RISK' && (
                        <div style={{ width:'100%', marginTop:6, padding:'6px 10px', borderRadius:6, background:'rgba(239,68,68,0.08)', fontSize:11, color:'#ef4444' }}>
                          ⚠ CrossRef title: "{r.crossref_title}" — differs from AI output. Verify before citing.
                        </div>
                      )}
                      {r.requires_hitl && r.hitl_reason && (
                        <div style={{ width:'100%', marginTop:4, fontSize:11, color:'#f59e0b' }}>HITL: {r.hitl_reason}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 12, textAlign: 'center' as const }}>
            AI-assisted results. Verify via your institutional Scopus / Web of Science portal before citing.
          </p>
        </div>
      )}

      {/* Recent search history */}
      {history.length > 0 && !results.length && !loading && (
        <div className="pios-card" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Recent searches</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {history.map((h, i) => (
              <button key={i} onClick={() => setQuery(h.query)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                <span style={{ fontSize: 12, color: 'var(--pios-text)' }}>{h.query}</span>
                <span style={{ fontSize: 11, color: 'var(--pios-dim)', whiteSpace: 'nowrap' as const }}>{h.database_name} · {h.result_count} results</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── JOURNAL WATCHLIST TAB ─────────────────────────────────────────────────────
function JournalsTab() {
  const [journals, setJournals] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [guidelines, setGuidelines] = useState<any>(null)
  const [guideLoading, setGuideLoading] = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState({ journal_name: '', publisher: '', impact_factor: '', quartile: 'Q2', subject_area: '', submission_url: '', guidelines_url: '', priority: 'medium' })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/research/journals')
    const data = await res.json()
    setJournals(data.journals ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function getGuidelines(j: any) {
    setSelected(j); setGuidelines(null); setGuideLoading(true)
    const res = await fetch('/api/research/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_guidelines', id: j.id, journalName: j.journal_name, publisher: j.publisher, guidelinesUrl: j.guidelines_url }),
    })
    const data = await res.json()
    setGuidelines(data.guidelines)
    setGuideLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/research/journals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', id, status }) })
    load()
  }

  async function addJournal() {
    if (!addForm.journal_name.trim()) return
    setSaving(true)
    await fetch('/api/research/journals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', journal: { ...addForm, impact_factor: parseFloat(addForm.impact_factor) || null } }),
    })
    setAddForm({ journal_name: '', publisher: '', impact_factor: '', quartile: 'Q2', subject_area: '', submission_url: '', guidelines_url: '', priority: 'medium' })
    setShowAdd(false); setSaving(false); load()
  }

  async function deleteJournal(id: string) {
    if (!confirm('Remove this journal from your watchlist?')) return
    await fetch('/api/research/journals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    if (selected?.id === id) setSelected(null)
    load()
  }

  const priorityColor = (p: string) => ({ high: '#ef4444', medium: '#f59e0b', low: '#64748b', watch: '#6c8eff' })[p] ?? '#64748b'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
      {/* Left — journal list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{journals.length} journals tracked</span>
          <button className="pios-btn pios-btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 12 }}>+ Add journal</button>
        </div>

        {showAdd && (
          <div className="pios-card" style={{ marginBottom: 14, borderColor: ACCENT + '40' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input className="pios-input" placeholder="Journal name *" value={addForm.journal_name} onChange={e => setAddForm(p => ({ ...p, journal_name: e.target.value }))} />
              <input className="pios-input" placeholder="Publisher" value={addForm.publisher} onChange={e => setAddForm(p => ({ ...p, publisher: e.target.value }))} />
              <input className="pios-input" placeholder="Impact factor" type="number" step="0.1" value={addForm.impact_factor} onChange={e => setAddForm(p => ({ ...p, impact_factor: e.target.value }))} />
              <select className="pios-input" value={addForm.quartile} onChange={e => setAddForm(p => ({ ...p, quartile: e.target.value }))}>
                {['Q1', 'Q2', 'Q3', 'Q4', 'Unranked'].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <input className="pios-input" placeholder="Subject area" value={addForm.subject_area} onChange={e => setAddForm(p => ({ ...p, subject_area: e.target.value }))} />
              <select className="pios-input" value={addForm.priority} onChange={e => setAddForm(p => ({ ...p, priority: e.target.value }))}>
                {[['high', 'High priority'], ['medium', 'Medium'], ['low', 'Low'], ['watch', 'Watch']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <input className="pios-input" placeholder="Submission URL" value={addForm.submission_url} onChange={e => setAddForm(p => ({ ...p, submission_url: e.target.value }))} style={{ marginBottom: 8 }} />
            <input className="pios-input" placeholder="Author guidelines URL" value={addForm.guidelines_url} onChange={e => setAddForm(p => ({ ...p, guidelines_url: e.target.value }))} style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pios-btn pios-btn-primary" onClick={addJournal} disabled={saving} style={{ fontSize: 12 }}>{saving ? 'Adding…' : 'Add journal'}</button>
              <button className="pios-btn pios-btn-ghost" onClick={() => setShowAdd(false)} style={{ fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        )}

        {loading ? <Spinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {journals.map(j => (
              <div key={j.id} onClick={() => setSelected(selected?.id === j.id ? null : j)} className="pios-card"
                style={{ padding: '14px 16px', cursor: 'pointer', border: `1px solid ${selected?.id === j.id ? ACCENT + '60' : 'var(--pios-border)'}`, background: selected?.id === j.id ? 'rgba(108,142,255,0.05)' : 'var(--pios-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{j.journal_name}</span>
                      <Badge status={j.status} map={STATUS_COLOURS} />
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: priorityColor(j.priority) + '20', color: priorityColor(j.priority), fontWeight: 600 }}>{j.priority}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--pios-dim)', flexWrap: 'wrap' as const }}>
                      {j.publisher && <span>{j.publisher}</span>}
                      {j.impact_factor && <><span>·</span><span>IF {j.impact_factor}</span></>}
                      {j.quartile && <><span>·</span><span style={{ fontWeight: 600, color: j.quartile === 'Q1' ? '#22c55e' : j.quartile === 'Q2' ? ACCENT : 'var(--pios-dim)' }}>{j.quartile}</span></>}
                      {j.is_scopus_indexed && <><span>·</span><span style={{ color: '#f59e0b' }}>Scopus</span></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); getGuidelines(j) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: ACCENT }}>Guidelines</button>
                    <button onClick={e => { e.stopPropagation(); deleteJournal(j.id) }} style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>Status:</span>
                  <select value={j.status} onClick={e => e.stopPropagation()} onChange={e => updateStatus(j.id, e.target.value)}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 12, border: 'none', cursor: 'pointer', background: (STATUS_COLOURS[j.status] ?? '#64748b') + '20', color: STATUS_COLOURS[j.status] ?? '#64748b', fontWeight: 600, outline: 'none' }}>
                    {['researching', 'drafting', 'submitted', 'under_review', 'accepted', 'rejected', 'published'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  {j.submission_url && (
                    <a href={j.submission_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: ACCENT, marginLeft: 'auto' }}>Submit →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — guidelines panel */}
      {selected && (
        <div>
          <div className="pios-card" style={{ position: 'sticky', top: 20, borderLeft: `3px solid ${ACCENT}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{selected.journal_name}</div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{selected.publisher}</div>
              </div>
              <button onClick={() => { setSelected(null); setGuidelines(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-muted)', fontSize: 16 }}>✕</button>
            </div>

            {!guidelines && !guideLoading && (
              <button className="pios-btn pios-btn-primary" onClick={() => getGuidelines(selected)} style={{ fontSize: 12, width: '100%' }}>
                Get author guidelines summary
              </button>
            )}

            {guideLoading && <Spinner />}

            {guidelines && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Word limit', value: guidelines.word_limit ? `${guidelines.word_limit?.toLocaleString()} words` : '—' },
                    { label: 'Abstract', value: guidelines.abstract_words ? `${guidelines.abstract_words} words` : '—' },
                    { label: 'Review process', value: guidelines.blind_review ?? '—' },
                    { label: 'Submission', value: guidelines.submission_system ?? '—' },
                    { label: 'References', value: guidelines.reference_style ?? '—' },
                    { label: 'Timeline', value: guidelines.typical_timeline ?? '—' },
                  ].map(f => (
                    <div key={f.label} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--pios-surface2)' }}>
                      <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{f.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {guidelines.fit_assessment && (
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(108,142,255,0.08)', borderLeft: `2px solid ${ACCENT}`, fontSize: 12, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: ACCENT }}>Fit for your DBA research</div>
                    {guidelines.fit_assessment}
                  </div>
                )}

                {guidelines.key_requirements?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Key requirements</div>
                    {guidelines.key_requirements.map((r: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--pios-border)', color: 'var(--pios-text)', display: 'flex', gap: 8 }}>
                        <span style={{ color: ACCENT, flexShrink: 0 }}>✓</span>{r}
                      </div>
                    ))}
                  </div>
                )}

                {guidelines.submission_checklist?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Submission checklist</div>
                    {guidelines.submission_checklist.map((item: string, i: number) => (
                      <label key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--pios-border)', cursor: 'pointer', fontSize: 12 }}>
                        <input type="checkbox" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                )}

                {selected.guidelines_url && (
                  <a href={selected.guidelines_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center' as const, padding: '8px', borderRadius: 8, border: `1px solid ${ACCENT}40`, color: ACCENT, fontSize: 12, textDecoration: 'none' }}>
                    View official guidelines →
                  </a>
                )}
                <p style={{ fontSize: 10, color: 'var(--pios-dim)', textAlign: 'center' as const }}>AI-generated summary. Always verify at the official author guidelines page.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CALLS FOR PAPERS TAB ──────────────────────────────────────────────────────
function CFPTab() {
  const [saved,    setSaved]    = useState<any[]>([])
  const [live,     setLive]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/research/cfp').then(r => r.json()).then(d => setSaved(d.calls ?? []))
  }, [])

  async function fetchCFPs() {
    setLoading(true); setLive([])
    const res = await fetch('/api/research/cfp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetch' }) })
    const data = await res.json()
    setLive(data.calls ?? [])
    setLoading(false)
  }

  async function saveCFP(cfp: any) {
    setSavingId(cfp.title)
    await fetch('/api/research/cfp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', cfp }) })
    const res = await fetch('/api/research/cfp')
    const data = await res.json()
    setSaved(data.calls ?? [])
    setSavingId(null)
  }

  async function updateCFPStatus(id: string, status: string) {
    await fetch('/api/research/cfp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_status', id, status }) })
    const res = await fetch('/api/research/cfp')
    setSaved((await res.json()).calls ?? [])
  }

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{saved.length} tracked · Click "Find CFPs" to discover new ones</span>
        <button className="pios-btn pios-btn-primary" onClick={fetchCFPs} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? '⟳ Searching…' : '🔍 Find CFPs'}
        </button>
      </div>

      {loading && <Spinner />}

      {/* Live results */}
      {live.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Discovered ({live.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {live.map((cfp, i) => {
              const days = cfp.deadline ? daysUntil(cfp.deadline) : null
              return (
                <div key={i} className="pios-card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{cfp.title}</span>
                      {cfp.relevance_score >= 4 && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, background: '#22c55e20', color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>High match</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 4 }}>{cfp.journal_name || cfp.conference_name}</div>
                    {cfp.topic_summary && <p style={{ fontSize: 12, color: 'var(--pios-dim)', lineHeight: 1.5, marginBottom: 6 }}>{cfp.topic_summary}</p>}
                    {cfp.relevance_reason && <p style={{ fontSize: 11, color: ACCENT, fontStyle: 'italic' }}>→ {cfp.relevance_reason}</p>}
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    {days !== null && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: days < 30 ? '#ef4444' : days < 60 ? '#f59e0b' : '#22c55e', marginBottom: 4 }}>{days}d left</div>
                    )}
                    {cfp.deadline && <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 8 }}>{cfp.deadline}</div>}
                    <button onClick={() => saveCFP(cfp)} disabled={savingId === cfp.title} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `1px solid ${ACCENT}`, background: 'none', cursor: 'pointer', color: ACCENT }}>
                      {savingId === cfp.title ? 'Saving…' : '+ Track'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Saved CFPs */}
      {saved.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Tracked ({saved.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {saved.map(cfp => {
              const days = cfp.deadline ? daysUntil(cfp.deadline) : null
              return (
                <div key={cfp.id} className="pios-card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{cfp.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{cfp.journal_name}</div>
                  </div>
                  {days !== null && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: days < 14 ? '#ef4444' : days < 30 ? '#f59e0b' : 'var(--pios-muted)', flexShrink: 0 }}>
                      {days > 0 ? `${days}d` : 'Passed'}
                    </div>
                  )}
                  <select value={cfp.status} onChange={e => updateCFPStatus(cfp.id, e.target.value)}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 12, border: 'none', cursor: 'pointer', background: (CFP_STATUS_COLOURS[cfp.status] ?? '#64748b') + '20', color: CFP_STATUS_COLOURS[cfp.status] ?? '#64748b', fontWeight: 600, outline: 'none' }}>
                    {['new', 'considering', 'planning', 'dismissed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {cfp.submission_url && (
                    <a href={cfp.submission_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ACCENT, flexShrink: 0 }}>View →</a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {saved.length === 0 && !loading && live.length === 0 && (
        <div className="pios-card" style={{ textAlign: 'center' as const, padding: '48px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📣</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>No CFPs tracked yet</div>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 16 }}>Click "Find CFPs" to discover calls for papers and special issues relevant to your DBA research.</p>
          <button className="pios-btn pios-btn-primary" onClick={fetchCFPs} style={{ fontSize: 13 }}>Find CFPs now</button>
        </div>
      )}
    </div>
  )
}

// ── IMPORT & CONNECT TAB ──────────────────────────────────────────────────────
function ImportTab() {
  const [supabase] = useState(() => createClient())
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState({ title: '', authors: '', year: '', journal: '', doi: '', url: '', source_type: 'journal', notes: '', tags: '' })

  async function manualImport() {
    if (!manualForm.title.trim()) return
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImporting(false); return }
    await supabase.from('literature_items').insert({
      user_id: user.id,
      title: manualForm.title,
      authors: manualForm.authors.split(',').map(a => a.trim()).filter(Boolean),
      year: parseInt(manualForm.year) || null,
      journal: manualForm.journal || null,
      doi: manualForm.doi || null,
      url: manualForm.url || null,
      source_type: manualForm.source_type,
      notes: manualForm.notes || null,
      tags: manualForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      read_status: 'unread',
    })
    setImportResult('✓ Added to your literature library')
    setManualForm({ title: '', authors: '', year: '', journal: '', doi: '', url: '', source_type: 'journal', notes: '', tags: '' })
    setImporting(false)
    setTimeout(() => setImportResult(null), 3000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Institutional DB access guide */}
      <div>
        <div className="pios-card" style={{ marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Scopus — Institutional Access</div>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            University of Portsmouth provides Scopus access. The PIOS search tab uses AI to simulate results — for authoritative data, use your institutional login.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 12 }}>
            {[
              { step: '1', text: 'Go to library.port.ac.uk → Databases A-Z → Scopus' },
              { step: '2', text: 'Sign in with your University of Portsmouth credentials' },
              { step: '3', text: 'Run your search, select papers, click Export → CSV/RIS' },
              { step: '4', text: 'Import the CSV into Mendeley or Zotero (see right panel)' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, background: ACCENT + '20', color: ACCENT, fontWeight: 700, flexShrink: 0 }}>{s.step}</span>
                <span style={{ color: 'var(--pios-muted)', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
          <a href="https://www.scopus.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: ACCENT }}>Open Scopus →</a>
        </div>

        <div className="pios-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>ISO Standards Access</div>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            ISO standards relevant to your DBA (ISO 55001, ISO 41001, ISO 15686) are available via BSI and through the UoP library.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {[
              { name: 'BSI Membership (via UoP)', url: 'https://www.bsigroup.com', desc: 'Free access via institutional membership' },
              { name: 'ISO Online Browsing Platform', url: 'https://www.iso.org/obp', desc: 'Preview standard scope and structure' },
              { name: 'UoP Library E-Standards', url: 'https://library.port.ac.uk', desc: 'Search "standards" in the library portal' },
            ].map(r => (
              <div key={r.name} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--pios-surface2)' }}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', display: 'block', marginBottom: 2 }}>{r.name} →</a>
                <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mendeley / Zotero + manual import */}
      <div>
        <div className="pios-card" style={{ marginBottom: 14, borderLeft: '3px solid #a78bfa' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Mendeley & Zotero</div>
          <p style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.65, marginBottom: 12 }}>
            PIOS tracks literature in its own database. These tools work alongside PIOS for PDF management and citation generation.
          </p>
          {[
            { name: 'Mendeley Reference Manager', url: 'https://www.mendeley.com', desc: 'Download desktop app → Import Scopus CSV → Cite in Word/Google Docs', colour: '#a78bfa' },
            { name: 'Zotero', url: 'https://www.zotero.org', desc: 'Browser plugin auto-captures papers from Scopus, publisher sites. Sync with PIOS via Zotero key field.', colour: '#CC2936' },
          ].map(t => (
            <div key={t.name} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--pios-surface2)', marginBottom: 8 }}>
              <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: t.colour, display: 'block', marginBottom: 4 }}>{t.name} →</a>
              <p style={{ fontSize: 11, color: 'var(--pios-dim)', lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
            </div>
          ))}
        </div>

        {/* Manual import */}
        <div className="pios-card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Add to literature library</div>
          {importResult && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#22c55e20', color: '#22c55e', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{importResult}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <input className="pios-input" placeholder="Title *" value={manualForm.title} onChange={e => setManualForm(p => ({ ...p, title: e.target.value }))} />
            <input className="pios-input" placeholder="Authors (comma-separated)" value={manualForm.authors} onChange={e => setManualForm(p => ({ ...p, authors: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input className="pios-input" placeholder="Year" type="number" value={manualForm.year} onChange={e => setManualForm(p => ({ ...p, year: e.target.value }))} />
              <select className="pios-input" value={manualForm.source_type} onChange={e => setManualForm(p => ({ ...p, source_type: e.target.value }))}>
                {['journal', 'book', 'conference', 'report', 'thesis', 'website', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="pios-input" placeholder="DOI" value={manualForm.doi} onChange={e => setManualForm(p => ({ ...p, doi: e.target.value }))} />
            </div>
            <input className="pios-input" placeholder="Journal name" value={manualForm.journal} onChange={e => setManualForm(p => ({ ...p, journal: e.target.value }))} />
            <input className="pios-input" placeholder="URL" value={manualForm.url} onChange={e => setManualForm(p => ({ ...p, url: e.target.value }))} />
            <input className="pios-input" placeholder="Tags (comma-separated)" value={manualForm.tags} onChange={e => setManualForm(p => ({ ...p, tags: e.target.value }))} />
            <textarea className="pios-input" placeholder="Notes…" rows={2} style={{ resize: 'vertical' as const, fontFamily: 'inherit' }} value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))} />
            <button className="pios-btn pios-btn-primary" onClick={manualImport} disabled={importing || !manualForm.title.trim()} style={{ fontSize: 12 }}>
              {importing ? 'Adding…' : 'Add to library'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── LITERATURE LIBRARY TAB ────────────────────────────────────────────────────
function LibraryTab() {
  const supabase = createClient()
  const [items,    setItems]    = useState<any[]>([])
  const [stats,    setStats]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [filter,   setFilter]   = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search,   setSearch]   = useState('')
  const [aiLoading, setAiLoading] = useState<string|null>(null)
  const [deleting,  setDeleting]  = useState<string|null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportText, setExportText] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('read_status', filter)
    if (typeFilter !== 'all') params.set('source_type', typeFilter)
    if (search.trim()) params.set('q', search.trim())
    const res = await fetch(`/api/literature?${params}`)
    const d = await res.json()
    setItems(d.items ?? [])
    setStats(d.stats)
    setLoading(false)
  }, [filter, typeFilter, search])

  useEffect(() => { load() }, [load])

  async function updateItem(id: string, updates: any) {
    await fetch('/api/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, ...updates }) })
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (selected?.id === id) setSelected((p: any) => ({ ...p, ...updates }))
  }

  async function generateSummary(id: string) {
    setAiLoading(id)
    const res = await fetch('/api/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_summary', id }) })
    const d = await res.json()
    if (d.summary) {
      const updates = { ai_summary: d.summary, citation_apa: d.citation_apa, themes: d.suggested_themes ?? [], relevance: d.suggested_relevance_score, _guard: d.guard ?? null }
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
      if (selected?.id === id) setSelected((p: any) => ({ ...p, ...updates }))
    }
    setAiLoading(null)
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove from library?')) return
    setDeleting(id)
    await fetch('/api/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeleting(null)
  }

  async function exportLibrary(fmt: 'apa' | 'bibtex') {
    setExporting(true)
    const res = await fetch('/api/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export', format: fmt }) })
    const d = await res.json()
    setExportText(d.export ?? '')
    setExporting(false)
  }

  const READ_COLOURS: Record<string, string> = { unread: '#64748b', reading: '#6c8eff', read: '#22c55e', revisit: '#f59e0b' }
  const TYPE_ICONS:   Record<string, string> = { journal: '📄', book: '📚', conference: '🎤', report: '📋', thesis: '🎓', website: '🌐', other: '📁' }

  return (
    <div>
      {/* Stats */}
      {stats && stats.total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total', val: stats.total, c: '#6c8eff', f: 'all' },
            { label: 'Unread', val: stats.unread, c: '#64748b', f: 'unread' },
            { label: 'Reading', val: stats.reading, c: '#6c8eff', f: 'reading' },
            { label: 'Read', val: stats.read, c: '#22c55e', f: 'read' },
            { label: 'Revisit', val: stats.revisit, c: '#f59e0b', f: 'revisit' },
          ].map(s => (
            <div key={s.label} className="pios-card-sm" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setFilter(s.f)}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.c, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input className="pios-input" placeholder="Search title, journal, notes…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            style={{ paddingLeft: 28, fontSize: 12 }} />
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--pios-dim)', fontSize: 13 }}>🔍</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          {[['all','All'],['unread','Unread'],['reading','Reading'],['read','Read'],['revisit','Revisit']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, border: '1px solid var(--pios-border)', background: filter===v?'var(--pios-surface)':'transparent', color: filter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight: filter===v?600:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all','All'],['journal','Journal'],['book','Book'],['conference','Conf'],['report','Report'],['thesis','Thesis']].map(([v,l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, border: 'none', background: typeFilter===v?ACCENT+'20':'var(--pios-surface2)', color: typeFilter===v?ACCENT:'var(--pios-muted)', fontWeight: typeFilter===v?600:400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={() => exportLibrary('apa')} disabled={exporting} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>{exporting?'⟳':'⬇'} APA</button>
          <button onClick={() => exportLibrary('bibtex')} disabled={exporting} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>{exporting?'⟳':'⬇'} BibTeX</button>
        </div>
      </div>

      {/* Export output */}
      {exportText !== null && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Export ready — click to select all</span>
            <button onClick={() => setExportText(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-muted)', fontSize: 13 }}>✕</button>
          </div>
          <textarea readOnly value={exportText} rows={8}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 6, padding: '10px', color: 'var(--pios-text)', resize: 'vertical' as const }}
            onClick={e => (e.target as HTMLTextAreaElement).select()} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* List */}
        <div>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center' as const, color: 'var(--pios-muted)', fontSize: 13 }}>Loading library…</div>
          ) : items.length === 0 ? (
            <div className="pios-card" style={{ textAlign: 'center' as const, padding: '48px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Library is empty</div>
              <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>Add papers via the ⬇ Import & Connect tab or the 🔍 Database Search tab.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {items.map(item => (
                <div key={item.id} onClick={() => setSelected(selected?.id===item.id ? null : item)}
                  className="pios-card" style={{ padding: '12px 16px', cursor: 'pointer',
                    border: `1px solid ${selected?.id===item.id ? ACCENT+'50' : 'var(--pios-border)'}`,
                    background: selected?.id===item.id ? ACCENT+'05' : 'var(--pios-surface)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{TYPE_ICONS[item.source_type] ?? '📄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--pios-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                        {item.authors?.length > 0 && <span>{(item.authors as string[]).slice(0,2).join(', ')}{item.authors.length > 2 ? ' et al.' : ''}</span>}
                        {item.year && <><span>·</span><span>{item.year}</span></>}
                        {item.journal && <><span>·</span><span style={{ fontStyle: 'italic' }}>{item.journal}</span></>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                        <select value={item.read_status} onClick={e => e.stopPropagation()}
                          onChange={e => updateItem(item.id, { read_status: e.target.value })}
                          style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, border: 'none', cursor: 'pointer', background: (READ_COLOURS[item.read_status]??'#64748b')+'20', color: READ_COLOURS[item.read_status]??'#64748b', fontWeight: 600, outline: 'none' }}>
                          {['unread','reading','read','revisit'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {item.relevance && <span style={{ fontSize: 11, color: '#f59e0b' }}>{'★'.repeat(item.relevance)}{'☆'.repeat(5-item.relevance)}</span>}
                        {item.ai_summary && <span style={{ fontSize: 10, color: '#a78bfa' }}>✦ AI</span>}
                        {item.doi && <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: ACCENT }}>DOI →</a>}
                        {(item.tags as string[])?.slice(0,3).map((t: string) => (
                          <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'var(--pios-surface2)', color: 'var(--pios-dim)' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} disabled={deleting===item.id}
                      style={{ fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.2)', background: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0, opacity: 0.6 }}>
                      {deleting===item.id ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <div>
            <div className="pios-card" style={{ position: 'sticky', top: 20, borderLeft: `3px solid ${ACCENT}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{selected.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
                    {(selected.authors as string[])?.join(', ')} {selected.year ? `(${selected.year})` : ''}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-muted)', fontSize: 16, marginLeft: 8 }}>✕</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Relevance:</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => updateItem(selected.id, { relevance: n })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: n<=(selected.relevance??0)?'#f59e0b':'var(--pios-dim)', padding: '0 1px', lineHeight: 1 }}>★</button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Notes</div>
                <textarea className="pios-input" rows={3} placeholder="Add reading notes…"
                  defaultValue={selected.notes ?? ''}
                  onBlur={e => updateItem(selected.id, { notes: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' as const, fontFamily: 'inherit', fontSize: 12 }} />
              </div>

              {selected.ai_summary ? (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>✦ AI Summary</div>
                  <p style={{ fontSize: 12, color: 'var(--pios-text)', lineHeight: 1.65, marginBottom: 8 }}>{selected.ai_summary}</p>
                  {selected._guard && (
                    <div style={{ marginBottom:6, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                      background: selected._guard.provenance_label==='AI_VERIFIED' ? 'rgba(34,197,94,0.08)' : selected._guard.provenance_label==='FABRICATED_RISK' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                      color: selected._guard.provenance_label==='AI_VERIFIED' ? '#22c55e' : selected._guard.provenance_label==='FABRICATED_RISK' ? '#ef4444' : '#f59e0b',
                    }}>
                      {selected._guard.provenance_label==='AI_VERIFIED' ? '✓ CrossRef verified' :
                       selected._guard.provenance_label==='FABRICATED_RISK' ? '✗ Not found in CrossRef — verify before citing' :
                       '⚠ Partial verification'}
                      {selected._guard.hitl_reason && <span style={{ fontWeight:400, marginLeft:6 }}>· {selected._guard.hitl_reason}</span>}
                    </div>
                  )}
                  {selected.citation_apa && (
                    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--pios-surface2)', fontSize: 11, color: 'var(--pios-muted)', fontStyle: 'italic' }}>
                      {selected.citation_apa}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => generateSummary(selected.id)} disabled={aiLoading===selected.id}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed rgba(167,139,250,0.3)', background: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: 12, marginBottom: 12 }}>
                  {aiLoading===selected.id ? '⟳ Generating…' : '✦ Generate AI summary + APA citation'}
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Type',   value: selected.source_type },
                  { label: 'Journal',value: selected.journal ?? '—' },
                  { label: 'DOI',    value: selected.doi ?? '—' },
                  { label: 'Added',  value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-GB') : '—' },
                ].map(f => (
                  <div key={f.label} style={{ padding: '6px 8px', borderRadius: 5, background: 'var(--pios-surface2)' }}>
                    <div style={{ fontSize: 9, color: 'var(--pios-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              {(selected.themes as string[])?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                  {(selected.themes as string[]).map((t: string) => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#a78bfa20', color: '#a78bfa' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>('search')

  return (
    <div className="fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Research Hub</h1>
        <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
          Academic database search · Journal watchlist · Calls for papers · Literature import
        </p>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--pios-border)', marginBottom: 20 }}>
        <TabBtn active={tab === 'search'}   onClick={() => setTab('search')}>🔍 Database Search</TabBtn>
        <TabBtn active={tab === 'journals'} onClick={() => setTab('journals')}>📔 Journal Watchlist</TabBtn>
        <TabBtn active={tab === 'cfp'}      onClick={() => setTab('cfp')}>📣 Calls for Papers</TabBtn>
        <TabBtn active={tab === 'library'}  onClick={() => setTab('library')}>📚 My Library</TabBtn>
        <TabBtn active={tab === 'import'}   onClick={() => setTab('import')}>⬇ Import & Connect</TabBtn>
      </div>

      {tab === 'search'   && <SearchTab />}
      {tab === 'journals' && <JournalsTab />}
      {tab === 'cfp'      && <CFPTab />}
      {tab === 'library'  && <LibraryTab />}
      {tab === 'import'   && <ImportTab />}
    </div>
  )
}
