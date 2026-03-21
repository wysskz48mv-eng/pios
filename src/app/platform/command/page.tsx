'use client'
import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Live Command Centre — platform metrics + configurable intelligence feeds
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--pios-surface)',
  border: '1px solid var(--pios-border)',
  borderRadius: 12,
  padding: '20px 24px',
}
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--pios-dim)', marginBottom: 4 }
const BIG: React.CSSProperties   = { fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--pios-text)' }
const SUB: React.CSSProperties   = { fontSize: 12, color: 'var(--pios-muted)', marginTop: 4 }

const CATEGORY_COLOURS: Record<string, string> = {
  industry: '#2dd4a0', technology: '#6c8eff', regulatory: '#a78bfa',
  academic: '#f59e0b', business: '#e05a7a', personal: '#94a3b8',
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:ok?'#22c55e':'#ef4444', marginRight:6, flexShrink:0, boxShadow:ok?'0 0 6px rgba(34,197,94,0.5)':'0 0 6px rgba(239,68,68,0.5)' }} />
}
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:`${color}20`, color }}>{children}</span>
}
function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--pios-muted)', fontSize:13 }}><div style={{ width:14, height:14, border:'2px solid rgba(167,139,250,0.2)', borderTop:'2px solid #a78bfa', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />{label}</div>
}
function formatSAR(n: number) {
  if (n >= 1_000_000) return `SAR ${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `SAR ${(n/1_000).toFixed(0)}K`
  return `SAR ${n}`
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff/60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins/60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs/24)}d ago`
}

// ── Feed item card ────────────────────────────────────────────────────────────
function FeedItem({ item, showRelevance }: { item: any; showRelevance: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ padding:'12px 0', borderBottom:'1px solid var(--pios-border)', cursor:'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4, marginBottom:3 }}>{item.headline}</div>
          <div style={{ fontSize:11, color:'var(--pios-dim)', display:'flex', gap:10, flexWrap:'wrap' as const, alignItems:'center' }}>
            <span>{item.source}</span>
            <span>·</span>
            <span>{item.published_relative ?? 'Recent'}</span>
            {item.category_tag && <Pill color="#64748b">{item.category_tag}</Pill>}
            {showRelevance && item.relevance >= 4 && <Pill color="#22c55e">High relevance</Pill>}
          </div>
        </div>
        <span style={{ fontSize:16, marginTop:1, flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--pios-border)' }}>
          {item.summary && <p style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.6, marginBottom:8 }}>{item.summary}</p>}
          {item.insight && (
            <div style={{ padding:'8px 12px', borderRadius:6, background:'rgba(108,142,255,0.08)', borderLeft:'2px solid #6c8eff', fontSize:12, color:'var(--pios-text)' }}>
              💡 {item.insight}
            </div>
          )}
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-block', marginTop:8, fontSize:11, color:'#6c8eff' }}
              onClick={e => e.stopPropagation()}>
              Read source →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Feed card ─────────────────────────────────────────────────────────────────
function FeedCard({ feed, showRelevance, onRefresh, onEdit, onDelete }: {
  feed: any; showRelevance: boolean;
  onRefresh: (id: string) => void;
  onEdit: (feed: any) => void;
  onDelete: (id: string) => void;
}) {
  const [fetching, setFetching]   = useState(false)
  const [items, setItems]         = useState<any[]>(feed.cached_items ?? [])
  const accentColor = CATEGORY_COLOURS[feed.category] ?? '#94a3b8'

  async function refresh() {
    setFetching(true)
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', id: feed.id }),
    })
    const data = await res.json()
    if (data.items) setItems(data.items)
    setFetching(false)
    onRefresh(feed.id)
  }

  return (
    <div style={{ ...CARD, borderTop: `3px solid ${accentColor}`, padding:0, overflow:'hidden' }}>
      {/* Feed header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--pios-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:20 }}>{feed.emoji}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{feed.label}</div>
            {feed.last_fetched && (
              <div style={{ fontSize:10, color:'var(--pios-dim)' }}>Updated {timeAgo(feed.last_fetched)}</div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button onClick={refresh} disabled={fetching} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--pios-border)', background:'none', color:'var(--pios-muted)', cursor:'pointer' }}>
            {fetching ? '⟳' : '↻ Refresh'}
          </button>
          <button onClick={() => onEdit(feed)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--pios-border)', background:'none', color:'var(--pios-muted)', cursor:'pointer' }}>✎</button>
          <button onClick={() => onDelete(feed.id)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'none', color:'#ef4444', cursor:'pointer' }}>✕</button>
        </div>
      </div>

      {/* Feed content */}
      <div style={{ padding:'0 20px', maxHeight:480, overflowY:'auto' as const }}>
        {fetching ? (
          <div style={{ padding:'24px 0' }}><Spinner label="Fetching intelligence…" /></div>
        ) : items.length === 0 ? (
          <div style={{ padding:'24px 0', textAlign:'center' as const }}>
            <p style={{ fontSize:13, color:'var(--pios-dim)', marginBottom:12 }}>No content fetched yet.</p>
            <button onClick={refresh} style={{ fontSize:12, padding:'6px 16px', borderRadius:8, border:'1px solid var(--pios-border)', background:'none', color:'var(--pios-text)', cursor:'pointer' }}>
              Fetch now →
            </button>
          </div>
        ) : items.map((item, i) => (
          <FeedItem key={i} item={item} showRelevance={showRelevance} />
        ))}
      </div>

      {feed.description && (
        <div style={{ padding:'8px 20px', borderTop:'1px solid var(--pios-border)', fontSize:11, color:'var(--pios-dim)' }}>
          {feed.description}
        </div>
      )}
    </div>
  )
}

// ── Add / Edit feed modal ─────────────────────────────────────────────────────
const DEFAULT_FORM = { label:'', description:'', emoji:'📰', topic:'', keywords:'', sources:'', exclude_terms:'', category:'industry', layout:'cards', refresh_freq:'daily', max_items:8, is_active:true }

function FeedFormModal({ feed, onSave, onClose }: { feed: any|null; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState(feed ? {
    ...feed,
    keywords: (feed.keywords ?? []).join(', '),
    sources:  (feed.sources  ?? []).join(', '),
    exclude_terms: (feed.exclude_terms ?? []).join(', '),
  } : DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  function f(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.label.trim() || !form.topic.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      keywords:      form.keywords.split(',').map((s: string) => s.trim()).filter(Boolean),
      sources:       form.sources.split(',').map((s: string) => s.trim()).filter(Boolean),
      exclude_terms: form.exclude_terms.split(',').map((s: string) => s.trim()).filter(Boolean),
      max_items:     parseInt(String(form.max_items)) || 8,
    }
    await onSave(payload)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--pios-surface)', borderRadius:16, border:'1px solid var(--pios-border)', padding:28, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' as const }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>{feed ? 'Edit feed' : 'Add new feed'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--pios-muted)' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column' as const, gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'52px 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Icon</div>
              <input className="pios-input" value={form.emoji} onChange={e=>f('emoji',e.target.value)} style={{ textAlign:'center', fontSize:20 }} maxLength={2} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Feed label *</div>
              <input className="pios-input" placeholder="e.g. GCC FM Market" value={form.label} onChange={e=>f('label',e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Topic / search prompt * <span style={{ color:'var(--pios-dim)' }}>(what to search for)</span></div>
            <input className="pios-input" placeholder="e.g. facilities management GCC Saudi Arabia UAE market news" value={form.topic} onChange={e=>f('topic',e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Description</div>
            <input className="pios-input" placeholder="Brief description of what this feed covers" value={form.description} onChange={e=>f('description',e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Keywords <span style={{ color:'var(--pios-dim)' }}>(comma-separated)</span></div>
            <input className="pios-input" placeholder="NEOM, Qiddiya, smart buildings, ISO 55001" value={form.keywords} onChange={e=>f('keywords',e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Preferred sources <span style={{ color:'var(--pios-dim)' }}>(comma-separated)</span></div>
            <input className="pios-input" placeholder="FM World, MEED, RICS, Arab News" value={form.sources} onChange={e=>f('sources',e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Exclude terms <span style={{ color:'var(--pios-dim)' }}>(comma-separated)</span></div>
            <input className="pios-input" placeholder="terms to filter out" value={form.exclude_terms} onChange={e=>f('exclude_terms',e.target.value)} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Category</div>
              <select className="pios-input" value={form.category} onChange={e=>f('category',e.target.value)}>
                {Object.entries({ industry:'Industry', technology:'Technology', regulatory:'Regulatory', academic:'Academic', business:'Business', personal:'Personal' }).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Refresh</div>
              <select className="pios-input" value={form.refresh_freq} onChange={e=>f('refresh_freq',e.target.value)}>
                {[['daily','Daily'],['hourly','Hourly'],['weekly','Weekly']].map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Max items</div>
              <input className="pios-input" type="number" min={3} max={20} value={form.max_items} onChange={e=>f('max_items',e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button className="pios-btn pios-btn-primary" onClick={save} disabled={saving || !form.label.trim() || !form.topic.trim()} style={{ flex:1 }}>
            {saving ? 'Saving…' : feed ? 'Save changes' : 'Add feed'}
          </button>
          <button className="pios-btn pios-btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommandPage() {
  const [se, setSe]             = useState<any>(null)
  const [is_, setIs]            = useState<any>(null)
  const [gh, setGh]             = useState<any>(null)
  const [feeds, setFeeds]       = useState<any[]>([])
  const [feedSettings, setFeedSettings] = useState<any>({ command_layout:'grid', brief_include_feeds:true, show_relevance:true })
  const [loading, setLoading]   = useState(true)
  const [feedsLoading,       setFeedsLoading]       = useState(true)
  const [deleteFeedConfirm, setDeleteFeedConfirm] = useState<string|null>(null)
  const [lastRefresh, setLastRefresh]   = useState<Date|null>(null)
  const [editingFeed, setEditingFeed]   = useState<any|null>(null)
  const [showAddFeed, setShowAddFeed]   = useState(false)
  const [activeTab, setActiveTab]       = useState<'platforms'|'feeds'>('platforms')

  const loadPlatforms = useCallback(async () => {
    setLoading(true)
    const [seR, isR, ghR] = await Promise.all([
      fetch('/api/live/sustainedge').then(r=>r.json()).catch(()=>({ connected:false })),
      fetch('/api/live/investiscript').then(r=>r.json()).catch(()=>({ connected:false })),
      fetch('/api/live/github').then(r=>r.json()).catch(()=>({ connected:false })),
    ])
    setSe(seR); setIs(isR); setGh(ghR)
    setLastRefresh(new Date()); setLoading(false)
  }, [])

  const loadFeeds = useCallback(async () => {
    setFeedsLoading(true)
    const res = await fetch('/api/feeds').catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setFeeds(data.topics ?? [])
      if (data.settings) setFeedSettings(data.settings)
    }
    setFeedsLoading(false)
  }, [])

  useEffect(() => { loadPlatforms(); loadFeeds() }, [loadPlatforms, loadFeeds])

  async function handleAddFeed(data: any) {
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add', topic: data }) })
    loadFeeds()
  }

  async function handleEditFeed(data: any) {
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update', id: editingFeed.id, ...data }) })
    loadFeeds()
  }

  async function handleDeleteFeed(id: string) {
    if (deleteFeedConfirm !== id) { setDeleteFeedConfirm(id); return }
    setDeleteFeedConfirm(null)
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete', id }) })
    setFeeds(prev => prev.filter(f => f.id !== id))
  }

  async function refreshAllFeeds() {
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'fetch_all' }) })
    loadFeeds()
  }

  async function updateFeedSetting(key: string, value: any) {
    const next = { ...feedSettings, [key]: value }
    setFeedSettings(next)
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'settings', ...next }) })
  }

  const seData = se?.snapshot
  const isData = is_?.snapshot
  const ghRepos = gh?.repos ?? {}
  const activeFeeds = feeds.filter(f => f.is_active)

  return (
    <div className="fade-in">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Live Command Centre</h1>
          <p style={{ fontSize:13, color:'var(--pios-muted)' }}>
            Platform metrics · Configurable intelligence feeds
            {lastRefresh && <span style={{ marginLeft:12, color:'var(--pios-dim)' }}>Updated {timeAgo(lastRefresh.toISOString())}</span>}
          </p>
        </div>
        <button onClick={loadPlatforms} disabled={loading} className="pios-btn pios-btn-ghost" style={{ fontSize:12, opacity:loading?0.5:1 }}>
          {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid var(--pios-border)', paddingBottom:0 }}>
        {([['platforms','⚡ Platform Metrics'],['feeds','📡 Intelligence Feeds']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding:'8px 16px', fontSize:13, fontWeight:activeTab===tab?600:400, border:'none', borderBottom: activeTab===tab?'2px solid #6c8eff':'2px solid transparent', background:'none', cursor:'pointer',
            color: activeTab===tab?'#6c8eff':'var(--pios-muted)', marginBottom:-1,
          }}>{label}</button>
        ))}
      </div>

      {/* ── PLATFORM METRICS TAB ─────────────────────────────────────────────── */}
      {activeTab === 'platforms' && (
        <>
          {/* Connection bar */}
          <div style={{ ...CARD, marginBottom:20, padding:'12px 20px', display:'flex', gap:24, flexWrap:'wrap' as const }}>
            {[{ label:'SustainEdge DB', ok:se?.connected },{ label:'InvestiScript DB', ok:is_?.connected },{ label:'GitHub', ok:gh?.connected }]
              .map(({ label, ok }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', fontSize:13 }}>
                <StatusDot ok={!!ok} />
                <span style={{ color:ok?'var(--pios-text)':'var(--pios-dim)' }}>{label}</span>
                {!ok && <span style={{ marginLeft:6, fontSize:11, color:'#ef4444' }}>· Not configured</span>}
              </div>
            ))}
          </div>

          {/* SustainEdge */}
          <div style={{ marginBottom:8 }}><div style={{ ...LABEL, fontSize:12, marginBottom:12 }}>⚡ SustainEdge · Service Charge Platform</div></div>
          {!se?.connected ? (
            <div style={{ ...CARD, marginBottom:20, color:'var(--pios-muted)', fontSize:13 }}>{loading ? <Spinner /> : <>Configure <code>SUPABASE_SE_SERVICE_KEY</code> in Vercel to connect.</>}</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
              {[
                { label:'SaaS Orgs',      big:seData?.tenants?.total??'—',                    sub:seData?.tenants?.list?.map((t:any)=>t.name).join(', ')||'No orgs yet' },
                { label:'Projects',       big:seData?.projects?.total??'—',                   sub:`${seData?.projects?.active??0} active · ${seData?.projects?.list?.join(', ')||''}` },
                { label:'Asset Portfolio',big:seData?.assets?.totalValueSAR?formatSAR(seData.assets.totalValueSAR):'—', sub:`${seData?.assets?.total??0} assets · ${seData?.assets?.active??0} operational` },
                { label:'OBE Engine',     big:seData?.obe?'✓ Live':'—',                       sub:seData?.obe?.lastRun?`Last run ${timeAgo(seData.obe.lastRun)}`:'No OBE runs yet' },
                { label:'AI Agents',      big:seData?.agents?.recentRuns??'—',                sub:`${seData?.agents?.total??0} total · ${seData?.agents?.byType?Object.keys(seData.agents.byType).length:0} types` },
                { label:'Allocations',    big:seData?.allocations?.total??'—',                sub:`${seData?.allocations?.pending??0} pending JCV` },
              ].map(s => (
                <div key={s.label} style={CARD}>
                  <div style={LABEL}>{s.label}</div>
                  <div style={s.big?.toString().length>6?{...BIG,fontSize:18}:BIG}>{s.big}</div>
                  <div style={SUB}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* InvestiScript */}
          <div style={{ marginBottom:8 }}><div style={{ ...LABEL, fontSize:12, marginBottom:12 }}>🔍 InvestiScript · AI Investigative Journalism</div></div>
          {!is_?.connected ? (
            <div style={{ ...CARD, marginBottom:20, color:'var(--pios-muted)', fontSize:13 }}>{loading ? <Spinner /> : <>Configure <code>SUPABASE_IS_SERVICE_KEY</code> in Vercel to connect.</>}</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
              {[
                { label:'Newsrooms',       big:isData?.organisations?.total??'—',         sub:`${isData?.organisations?.recentNew??0} new (30d)` },
                { label:'Active Trials',   big:isData?.organisations?.trialing??'—',       sub:`${isData?.organisations?.expiredTrial??0} expired` },
                { label:'Paid Orgs',       big:isData?.organisations?.active??'—',         sub:isData?.organisations?.byPlan?Object.entries(isData.organisations.byPlan).map(([k,v])=>`${k}: ${v}`).join(' · '):'No paid plans' },
                { label:'Investigations',  big:isData?.investigations?.total??'—',         sub:`${isData?.investigations?.recentWeek??0} this week` },
                { label:'Users',           big:isData?.users?.total??'—',                  sub:`${isData?.users?.recentSignups??0} last 30 days` },
                { label:'AI Tokens (30d)', big:isData?.apiUsage?.totalTokens!=null?`${(isData.apiUsage.totalTokens/1000).toFixed(0)}K`:'—', sub:isData?.apiUsage?.costUsd!=null?`$${isData.apiUsage.costUsd} cost`:'tokens used' },
              ].map(s => (
                <div key={s.label} style={CARD}><div style={LABEL}>{s.label}</div><div style={BIG}>{s.big}</div><div style={SUB}>{s.sub}</div></div>
              ))}
            </div>
          )}

          {/* GitHub */}
          <div style={{ marginBottom:8 }}><div style={{ ...LABEL, fontSize:12, marginBottom:12 }}>⬡ GitHub · Recent Commits</div></div>
          {!gh?.connected ? (
            <div style={{ ...CARD, marginBottom:20, color:'var(--pios-muted)', fontSize:13 }}>{loading ? <Spinner /> : <>Configure <code>GITHUB_PAT</code> in Vercel to connect.</>}</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12, marginBottom:20 }}>
              {Object.entries(ghRepos).map(([key, repo]: [string, any]) => (
                <div key={key} style={CARD}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{repo.label}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {repo.head && <code style={{ fontSize:11, color:'var(--pios-muted)', background:'rgba(255,255,255,0.05)', padding:'2px 6px', borderRadius:4 }}>{repo.head}</code>}
                      {repo.openIssues > 0 && <Pill color="#f59e0b">{repo.openIssues} issues</Pill>}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
                    {(repo.commits ?? []).map((c: any) => (
                      <div key={c.sha} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                        <code style={{ fontSize:10, color:'#a78bfa', flexShrink:0, marginTop:2 }}>{c.sha}</code>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{c.message}</div>
                          <div style={{ fontSize:11, color:'var(--pios-dim)' }}>{c.author} · {timeAgo(c.date)}</div>
                        </div>
                      </div>
                    ))}
                    {!repo.commits?.length && <div style={{ fontSize:12, color:'var(--pios-dim)' }}>No commits found</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!se?.connected || !is_?.connected || !gh?.connected) && !loading && (
            <div style={{ ...CARD, marginTop:8, borderColor:'rgba(167,139,250,0.3)', background:'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'#a78bfa' }}>⚙ Vercel Environment Variables Needed</div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:8, fontSize:12 }}>
                {!se?.connected && <div><code style={{ color:'#f59e0b' }}>SUPABASE_SE_SERVICE_KEY</code><span style={{ color:'var(--pios-muted)', marginLeft:8 }}>→ SustainEdge service role key (Project oxqqzxvuksgzeeyhufhp)</span></div>}
                {!is_?.connected && <div><code style={{ color:'#f59e0b' }}>SUPABASE_IS_SERVICE_KEY</code><span style={{ color:'var(--pios-muted)', marginLeft:8 }}>→ InvestiScript service role key (Project dexsdwqkunnmhxcwayda)</span></div>}
                {!gh?.connected && <div><code style={{ color:'#f59e0b' }}>GITHUB_PAT</code><span style={{ color:'var(--pios-muted)', marginLeft:8 }}>→ GitHub PAT with repo scope</span></div>}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── INTELLIGENCE FEEDS TAB ──────────────────────────────────────────── */}
      {activeTab === 'feeds' && (
        <>
          {/* Feeds toolbar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' as const }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:13, color:'var(--pios-muted)' }}>{activeFeeds.length} active feed{activeFeeds.length !== 1 ? 's' : ''}</span>
              <button onClick={refreshAllFeeds} className="pios-btn pios-btn-ghost" style={{ fontSize:12 }}>↻ Refresh all</button>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* Layout toggle */}
              <div style={{ display:'flex', gap:2, padding:2, borderRadius:8, border:'1px solid var(--pios-border)', background:'var(--pios-surface2)' }}>
                {[['grid','▦'],['list','☰']].map(([layout, icon]) => (
                  <button key={layout} onClick={() => updateFeedSetting('command_layout', layout)} style={{ padding:'4px 10px', borderRadius:6, border:'none', fontSize:13, cursor:'pointer', background: feedSettings.command_layout===layout ? 'var(--pios-surface)' : 'transparent', color: feedSettings.command_layout===layout ? 'var(--pios-text)' : 'var(--pios-dim)' }}>{icon}</button>
                ))}
              </div>
              {/* Relevance toggle */}
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--pios-muted)', cursor:'pointer' }}>
                <input type="checkbox" checked={feedSettings.show_relevance} onChange={e => updateFeedSetting('show_relevance', e.target.checked)} />
                Show relevance
              </label>
              {/* Brief toggle */}
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--pios-muted)', cursor:'pointer' }}>
                <input type="checkbox" checked={feedSettings.brief_include_feeds} onChange={e => updateFeedSetting('brief_include_feeds', e.target.checked)} />
                Include in brief
              </label>
              <button onClick={() => setShowAddFeed(true)} className="pios-btn pios-btn-primary" style={{ fontSize:12 }}>+ Add feed</button>
            </div>
          </div>

          {feedsLoading ? (
            <div style={{ padding:'40px 0', textAlign:'center' as const }}><Spinner label="Loading feeds…" /></div>
          ) : feeds.length === 0 ? (
            <div style={{ ...CARD, textAlign:'center' as const, padding:'48px 24px' }}>
              <div style={{ fontSize:32, marginBottom:16 }}>📡</div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>No feeds configured</div>
              <p style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:20, maxWidth:400, margin:'0 auto 20px' }}>
                Run migration 005 in Supabase to seed your default feeds, or add your first custom feed now.
              </p>
              <button onClick={() => setShowAddFeed(true)} className="pios-btn pios-btn-primary" style={{ fontSize:13 }}>Add your first feed</button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: feedSettings.command_layout === 'list' ? '1fr' : 'repeat(auto-fill,minmax(380px,1fr))',
              gap: 16,
            }}>
              {feeds.filter(f => f.is_active).map(feed => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  showRelevance={feedSettings.show_relevance}
                  onRefresh={loadFeeds}
                  onEdit={f => setEditingFeed(f)}
                  onDelete={handleDeleteFeed}
                />
              ))}
            </div>
          )}

          {/* Inactive feeds */}
          {feeds.some(f => !f.is_active) && (
            <div style={{ marginTop:24 }}>
              <div style={{ ...LABEL, marginBottom:12 }}>Inactive feeds</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8 }}>
                {feeds.filter(f => !f.is_active).map(f => (
                  <button key={f.id} onClick={() => setEditingFeed(f)} style={{ padding:'6px 14px', borderRadius:20, border:'1px solid var(--pios-border)', background:'none', cursor:'pointer', fontSize:12, color:'var(--pios-muted)', display:'flex', alignItems:'center', gap:6 }}>
                    {f.emoji} {f.label} <span style={{ color:'var(--pios-dim)' }}>· tap to edit</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit modal */}
      {(showAddFeed || editingFeed) && (
        <FeedFormModal
          feed={editingFeed}
          onSave={editingFeed ? handleEditFeed : handleAddFeed}
          onClose={() => { setShowAddFeed(false); setEditingFeed(null) }}
        />
      )}
    </div>
  )
}
