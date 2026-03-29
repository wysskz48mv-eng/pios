'use client'
/**
 * /platform/literature — Literature Intelligence Agent
 *
 * Active publication monitoring with viva risk scoring.
 * Crawls Semantic Scholar, CrossRef, and OpenAlex in real-time.
 * Surfaces gaps against existing library. Scores by viva risk.
 *
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { useState, useEffect } from 'react'

const C = {
  bg:'var(--pios-bg)', surface:'var(--pios-surface)', surface2:'var(--pios-surface2)',
  border:'var(--pios-border)', border2:'var(--pios-border2)',
  text:'var(--pios-text)', sub:'var(--pios-sub)', muted:'var(--pios-muted)', dim:'var(--pios-dim)',
  ai:'var(--ai)', academic:'var(--academic)', dng:'var(--dng)', fm:'var(--fm)',
}

const RISK_CONFIG = {
  high:   { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   label:'High viva risk',    icon:'🔴' },
  medium: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  label:'Medium viva risk',  icon:'🟡' },
  low:    { color:'#10b981', bg:'rgba(16,185,129,0.1)',  label:'Low viva risk',     icon:'🟢' },
}

const DEFAULT_KEYWORDS = [
  'AI-enabled facilities management cost forecasting',
  'service charge governance GCC master community',
  'sociotechnical systems facilities management',
  'machine learning maintenance cost prediction built environment',
  'progressive user profiling AI professional systems',
  'human-in-the-loop AI governance SaaS',
]

interface Paper {
  id: string; title: string; authors: string[]; year: number
  citations: number; abstract: string; source: string
  doi?: string; url?: string; relevance?: number
  viva_risk?: 'high' | 'medium' | 'low'; gap?: boolean
}

interface ScanResult {
  total_found: number; gaps_found: number; high_viva_risk: number
  library_size: number; papers: Paper[]; searched_at: string
}

export default function LiteraturePage() {
  const [scanning,     setScanning]     = useState(false)
  const [result,       setResult]       = useState<ScanResult | null>(null)
  const [gapReport,    setGapReport]    = useState<any>(null)
  const [analysing,    setAnalysing]    = useState(false)
  const [activeTab,    setActiveTab]    = useState<'all'|'gaps'|'high_risk'>('high_risk')
  const [keywords,     setKeywords]     = useState<string[]>(DEFAULT_KEYWORDS)
  const [editKw,       setEditKw]       = useState(false)
  const [newKw,        setNewKw]        = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  async function scan() {
    setScanning(true); setResult(null); setGapReport(null)
    try {
      const r = await fetch('/api/literature-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'scan', keywords: keywords.slice(0, 4), limit: 6 }),
      })
      const d = await r.json()
      if (d.ok) setResult(d)
    } finally { setScanning(false) }
  }

  async function analyseGaps() {
    if (!result) return
    setAnalysing(true)
    try {
      const r = await fetch('/api/literature-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'gap', papers: result.papers }),
      })
      const d = await r.json()
      if (d.ok) setGapReport(d)
    } finally { setAnalysing(false) }
  }

  const papers = result?.papers ?? []
  const shown  = activeTab === 'all'       ? papers
               : activeTab === 'gaps'      ? papers.filter(p => p.gap)
               :                             papers.filter(p => p.viva_risk === 'high' && p.gap)

  const inputStyle = {
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '8px 12px', color: C.text, fontSize: 13,
    fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <div className="fade-up">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ fontSize:22 }}>🔍</div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:400, margin:0, letterSpacing:'-0.02em' }}>
              Literature Intelligence Agent
            </h1>
          </div>
          <p style={{ fontSize:13, color:C.muted, margin:0, lineHeight:1.6 }}>
            Crawls Semantic Scholar, CrossRef and OpenAlex for publications you may have missed.<br/>
            Scores each by <strong style={{ color:C.text }}>viva risk</strong> — high-citation papers in your domain not in your library.
          </p>
        </div>
        <button onClick={scan} disabled={scanning} style={{
          padding:'10px 22px', borderRadius:10, border:'none', cursor: scanning ? 'not-allowed' : 'pointer',
          background:'linear-gradient(135deg, var(--academic), var(--ai))',
          color:'#fff', fontSize:13, fontWeight:700, opacity: scanning ? 0.7 : 1,
          fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:8,
        }}>
          {scanning ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> Scanning…</> : '🔍 Scan for new papers →'}
        </button>
      </div>

      {/* Keyword configuration */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: editKw ? 12 : 0 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.dim, marginBottom:4 }}>
              Search keywords ({keywords.length})
            </div>
            {!editKw && (
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
                {keywords.map((kw, i) => (
                  <span key={i} style={{ fontSize:11, padding:'2px 10px', borderRadius:20, background:'rgba(108,142,255,0.1)', color:'var(--academic)', border:'1px solid rgba(108,142,255,0.2)' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setEditKw(!editKw)} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:7, padding:'5px 12px', cursor:'pointer', fontSize:11, color:C.muted, fontFamily:'var(--font-sans)' }}>
            {editKw ? '✓ Done' : '✎ Edit'}
          </button>
        </div>
        {editKw && (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
            {keywords.map((kw, i) => (
              <div key={i} style={{ display:'flex', gap:8 }}>
                <input value={kw} onChange={e => setKeywords(ks => ks.map((k, j) => j === i ? e.target.value : k))} style={inputStyle} />
                <button onClick={() => setKeywords(ks => ks.filter((_, j) => j !== i))} style={{ padding:'0 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'none', color:C.muted, cursor:'pointer', flexShrink:0 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Add keyword or phrase…" style={inputStyle} onKeyDown={e => { if (e.key === 'Enter' && newKw.trim()) { setKeywords(ks => [...ks, newKw.trim()]); setNewKw('') }}} />
              <button onClick={() => { if (newKw.trim()) { setKeywords(ks => [...ks, newKw.trim()]); setNewKw('') }}} style={{ padding:'0 14px', borderRadius:7, border:'none', background:'var(--academic)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, flexShrink:0 }}>+ Add</button>
            </div>
          </div>
        )}
      </div>

      {/* Scan results */}
      {result && (
        <>
          {/* Stats strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Papers found',    value:result.total_found,    color:C.ai       },
              { label:'Not in library',  value:result.gaps_found,     color:'#f59e0b'  },
              { label:'High viva risk',  value:result.high_viva_risk, color:'#ef4444'  },
              { label:'Library size',    value:result.library_size,   color:C.fm       },
            ].map(s => (
              <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:10, color:C.dim, marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:s.color, fontVariantNumeric:'tabular-nums' as const }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Gap analysis */}
          {!gapReport && result.high_viva_risk > 0 && (
            <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ fontSize:13, color:C.text }}>
                <strong style={{ color:'#ef4444' }}>⚠ {result.high_viva_risk} high viva-risk paper{result.high_viva_risk > 1 ? 's' : ''}</strong> found not in your library.
                Get NemoClaw's specific recommendations.
              </div>
              <button onClick={analyseGaps} disabled={analysing} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, opacity: analysing ? 0.7 : 1 }}>
                {analysing ? '⟳ Analysing…' : '⚠ Analyse gaps →'}
              </button>
            </div>
          )}

          {/* Gap report */}
          {gapReport && (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'18px 20px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.dim }}>NemoClaw Gap Analysis</div>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700,
                  background: gapReport.viva_readiness === 'strong' ? 'rgba(16,185,129,0.15)' : gapReport.viva_readiness === 'moderate' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: gapReport.viva_readiness === 'strong' ? '#10b981' : gapReport.viva_readiness === 'moderate' ? '#f59e0b' : '#ef4444',
                }}>
                  Viva readiness: {gapReport.viva_readiness?.toUpperCase()}
                </span>
              </div>
              {gapReport.recommendation && (
                <div style={{ fontSize:13, color:C.sub, lineHeight:1.75, whiteSpace:'pre-wrap' as const }}>
                  {gapReport.recommendation}
                </div>
              )}
            </div>
          )}

          {/* Tab filter */}
          <div style={{ display:'flex', gap:4, marginBottom:14, background:C.surface2, borderRadius:9, padding:3 }}>
            {([['high_risk', `🔴 High risk (${result.high_viva_risk})`], ['gaps', `⚠ All gaps (${result.gaps_found})`], ['all', `All papers (${result.total_found})`]] as [string, string][]).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} style={{
                flex:1, padding:'7px 12px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:12, fontWeight: activeTab === tab ? 700 : 400,
                background: activeTab === tab ? C.surface : 'transparent',
                color: activeTab === tab ? C.text : C.muted,
                fontFamily:'var(--font-sans)',
              }}>{label}</button>
            ))}
          </div>

          {/* Paper list */}
          <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
            {shown.length === 0 && (
              <div style={{ textAlign:'center', padding:'32px 0', color:C.dim, fontSize:13 }}>
                No papers in this filter.
              </div>
            )}
            {shown.map(paper => {
              const risk = RISK_CONFIG[paper.viva_risk ?? 'low']
              const isOpen = expanded === paper.id
              return (
                <div key={paper.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                  <div onClick={() => setExpanded(isOpen ? null : paper.id)} style={{ padding:'14px 16px', cursor:'pointer', display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{risk.icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, flexWrap:'wrap' as const, marginBottom:4 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:C.text, flex:1 }}>{paper.title}</div>
                        {paper.gap && <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:risk.bg, color:risk.color, flexShrink:0, whiteSpace:'nowrap' as const }}>NOT IN LIBRARY</span>}
                      </div>
                      <div style={{ fontSize:11, color:C.dim }}>
                        {paper.authors.slice(0,3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''} · {paper.year} · {paper.citations} citations · {paper.source}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:C.dim, flexShrink:0 }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                  {isOpen && (
                    <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${C.border}` }}>
                      {paper.abstract && (
                        <p style={{ fontSize:12, color:C.sub, lineHeight:1.7, marginBottom:12, marginTop:12 }}>{paper.abstract}…</p>
                      )}
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap' as const }}>
                        {paper.url && (
                          <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:7, background:'var(--academic)', color:'#fff', textDecoration:'none' }}>
                            View paper →
                          </a>
                        )}
                        {paper.doi && (
                          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, padding:'6px 14px', borderRadius:7, border:`1px solid ${C.border}`, color:C.muted, textDecoration:'none' }}>
                            DOI: {paper.doi.slice(0, 30)}…
                          </a>
                        )}
                        <button
                          onClick={async () => {
                            await fetch('/api/literature', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                title: paper.title, authors: paper.authors.join(', '),
                                year: paper.year, doi: paper.doi, url: paper.url,
                                abstract: paper.abstract, source: paper.source,
                                notes: `Added via Literature Intelligence Agent. ${paper.citations} citations. Viva risk: ${paper.viva_risk}.`,
                              }),
                            })
                            alert('Added to your literature library')
                          }}
                          style={{ fontSize:12, padding:'6px 14px', borderRadius:7, border:`1px solid ${C.border}`, background:'none', color:C.text, cursor:'pointer', fontFamily:'var(--font-sans)' }}
                        >
                          + Add to library
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ fontSize:11, color:C.dim, textAlign:'center', marginTop:16 }}>
            Scanned at {new Date(result.searched_at).toLocaleTimeString('en-GB')} · Sources: Semantic Scholar, CrossRef, OpenAlex · Free academic APIs
          </div>
        </>
      )}

      {!result && !scanning && (
        <div style={{ textAlign:'center', padding:'48px 24px', color:C.dim }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📚</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.sub, marginBottom:8 }}>Literature Intelligence Agent</div>
          <div style={{ fontSize:13, lineHeight:1.7, maxWidth:480, margin:'0 auto' }}>
            Click <strong style={{ color:C.text }}>Scan for new papers</strong> to crawl three academic databases
            and surface publications you may have missed — with viva risk scoring.
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
