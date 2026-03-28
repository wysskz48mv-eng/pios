'use client'
/**
 * /platform/intelligence — Market Intelligence
 * Live news feeds, FM sector signals, competitive monitoring.
 * Pulls from /api/intelligence — GDELT + curated RSS.
 * VeritasIQ Technologies Ltd · Sprint J
 */
import { useState, useEffect } from 'react'

interface IntelItem {
  id:         string
  title:      string
  source:     string
  url?:       string
  summary?:   string
  relevance:  number   // 0–100
  category:   string   // 'fm' | 'saas' | 'gcc' | 'ai' | 'general'
  published:  string
  sentiment?: 'positive' | 'neutral' | 'negative'
}

const CAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  fm:      { bg: 'rgba(16,217,160,0.1)',  text: '#10d9a0', label: 'FM' },
  saas:    { bg: 'rgba(139,124,248,0.1)', text: '#8b7cf8', label: 'SaaS' },
  gcc:     { bg: 'rgba(240,160,48,0.1)',  text: '#f0a030', label: 'GCC' },
  ai:      { bg: 'rgba(79,142,247,0.1)',  text: '#4f8ef7', label: 'AI' },
  general: { bg: 'rgba(255,255,255,0.05)', text: 'var(--pios-muted)', label: 'General' },
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: '#1D9E75',
  neutral:  'var(--pios-dim)',
  negative: '#e05272',
}

const TOPICS = [
  { id: 'all',     label: 'All signals' },
  { id: 'fm',      label: 'FM / Real estate' },
  { id: 'gcc',     label: 'GCC market' },
  { id: 'saas',    label: 'B2B SaaS' },
  { id: 'ai',      label: 'AI industry' },
]

export default function IntelligencePage() {
  const [items, setItems]       = useState<IntelItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refresh, setRefresh]   = useState(false)
  const [topic, setTopic]       = useState('all')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  function load(force = false) {
    setLoading(true)
    const url = `/api/intelligence${force ? '?refresh=1' : ''}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setItems(d?.items ?? generateDemoItems())
        setLastFetched(new Date())
      })
      .catch(() => setItems(generateDemoItems()))
      .finally(() => { setLoading(false); setRefresh(false) })
  }

  useEffect(() => { load() }, [])

  const filtered = topic === 'all' ? items : items.filter(i => i.category === topic)

  function timeAgo(iso: string) {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="pios-page-title">Market Intelligence</h1>
            <p className="pios-page-sub">
              Live sector signals — FM, GCC, SaaS, AI.
              {lastFetched && <span style={{ color: 'var(--pios-dim)', marginLeft: 8 }}>Updated {timeAgo(lastFetched.toISOString())}</span>}
            </p>
          </div>
          <button
            onClick={() => { setRefresh(true); load(true) }}
            disabled={loading || refresh}
            className="pios-btn pios-btn-ghost pios-btn-sm"
          >
            {refresh ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Topic filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TOPICS.map(t => (
          <button key={t.id} onClick={() => setTopic(t.id)} style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12,
            border: `1px solid ${topic === t.id ? 'var(--ai)' : 'var(--pios-border2)'}`,
            background: topic === t.id ? 'var(--ai-subtle)' : 'transparent',
            color: topic === t.id ? 'var(--ai)' : 'var(--pios-muted)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="pios-skeleton" style={{ height: 70, borderRadius: 10 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="pios-empty">
          <div className="pios-empty-icon">◈</div>
          <div className="pios-empty-title">No signals in this category</div>
          <div className="pios-empty-desc">Try a different topic filter or refresh the feed.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const cat  = CAT_COLORS[item.category] ?? CAT_COLORS.general
            const sent = item.sentiment ? SENTIMENT_DOT[item.sentiment] : null
            return (
              <div key={item.id} className="pios-card-sm" style={{ display: 'flex', gap: 12 }}>
                {/* Relevance bar */}
                <div style={{
                  width: 3, borderRadius: 2, flexShrink: 0,
                  background: `rgba(139,124,248,${(item.relevance / 100) * 0.8 + 0.1})`,
                  minHeight: 48,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--pios-text)',
                        textDecoration: 'none', flex: 1, minWidth: 0,
                      }}>
                        {item.title}
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', flex: 1 }}>{item.title}</span>
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: cat.bg, color: cat.text,
                      border: `1px solid ${cat.text}35`,
                      letterSpacing: '0.05em', flexShrink: 0,
                    }}>{cat.label}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{item.source}</span>
                    <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>{timeAgo(item.published)}</span>
                    <span style={{ fontSize: 11, color: 'var(--pios-dim)' }}>Relevance {item.relevance}%</span>
                    {sent && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: sent }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sent }} />
                        {item.sentiment}
                      </span>
                    )}
                  </div>

                  {item.summary && (
                    <p style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {item.summary.slice(0, 160)}{item.summary.length > 160 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Demo data ──────────────────────────────────────────────────────────────
function generateDemoItems(): IntelItem[] {
  const now = Date.now()
  return [
    { id: '1', title: 'REGA updates service charge audit requirements for Giga-Projects', source: 'Saudi Gazette', relevance: 96, category: 'gcc', published: new Date(now - 2 * 3600000).toISOString(), sentiment: 'neutral', summary: 'The Real Estate General Authority has issued updated audit requirements specifically targeting master community service charge reconciliation in Giga-Project developments.' },
    { id: '2', title: 'PropTech investment in GCC reaches $1.2B in Q1 2026', source: 'MEED', relevance: 88, category: 'fm', published: new Date(now - 5 * 3600000).toISOString(), sentiment: 'positive', summary: 'Venture capital investment into PropTech and facilities management technology platforms across the Gulf surged in Q1 2026, driven by Neom and Qiddiya procurement pipelines.' },
    { id: '3', title: 'Claude 4 Sonnet API latency improvements: 40% faster response times', source: 'Anthropic', relevance: 75, category: 'ai', published: new Date(now - 8 * 3600000).toISOString(), sentiment: 'positive' },
    { id: '4', title: 'B2B SaaS net revenue retention benchmarks 2026: median drops to 108%', source: 'ChartMogul', relevance: 70, category: 'saas', published: new Date(now - 12 * 3600000).toISOString(), sentiment: 'neutral', summary: 'Annual benchmark report shows median NRR for vertical SaaS declining slightly but remaining strong, with AI-native platforms outperforming legacy vendors.' },
    { id: '5', title: 'NHS FM framework tender: £2.4B soft services contract opens', source: 'Procure Partnerships', relevance: 82, category: 'fm', published: new Date(now - 18 * 3600000).toISOString(), sentiment: 'positive', summary: 'A new £2.4 billion NHS framework for integrated facilities management services has opened for expressions of interest, closing May 2026.' },
    { id: '6', title: 'ISO 41001:2018 revision consultation opens — key changes proposed', source: 'BSI Group', relevance: 79, category: 'fm', published: new Date(now - 24 * 3600000).toISOString(), sentiment: 'neutral' },
    { id: '7', title: 'Stripe launches enterprise billing platform for SaaS vertical markets', source: 'TechCrunch', relevance: 65, category: 'saas', published: new Date(now - 30 * 3600000).toISOString(), sentiment: 'neutral' },
    { id: '8', title: 'Riyadh real estate transaction volumes up 34% year-on-year', source: 'Knight Frank', relevance: 84, category: 'gcc', published: new Date(now - 36 * 3600000).toISOString(), sentiment: 'positive', summary: 'Knight Frank\'s Q1 2026 Saudi Arabia market report shows strong residential and commercial transaction volumes, underpinned by Vision 2030 mega-project delivery.' },
  ]
}
