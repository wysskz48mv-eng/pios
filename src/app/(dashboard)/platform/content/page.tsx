'use client'
/**
 * /platform/content — Content Studio
 * Blood Oath Chronicles (and future series) production pipeline.
 * Manage episodes: draft → review → approve → publish.
 * Compare manuscript vs published. Schedule review jobs.
 * VeritasIQ Technologies Ltd · Content Pipeline Sprint
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
interface Series {
  id: string; title: string; slug: string; platform: string
  platform_url?: string; studio_url?: string; status: string
  total_episodes: number; published_episodes: number; current_episode: number
  word_target: number; genre?: string
}

interface Episode {
  id: string; episode_number: number; title: string; status: string
  word_count?: number; review_score?: number; consistency_score?: number
  manuscript_matches_published?: boolean; last_compared_at?: string
  approved_at?: string; published_at?: string; updated_at: string
  cliffhanger?: string; episode_arc?: string
}

interface ReviewJob {
  id: string; job_type: string; status: string
  episode_from?: number; episode_to?: number
  overall_score?: number; summary?: string; completed_at?: string
  findings?: ReviewFinding[]
}

interface ReviewFinding {
  episode?: number; type: string; severity: 'critical' | 'major' | 'minor' | 'suggestion'
  description: string; recommendation: string; adopted?: boolean
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; label: string; bg: string }> = {
  draft:              { color: 'var(--pios-muted)', label: 'Draft',             bg: 'rgba(255,255,255,0.05)' },
  manuscript_ready:   { color: '#f0a030',           label: 'Manuscript ready',  bg: 'rgba(240,160,48,0.08)' },
  review_pending:     { color: '#4f8ef7',           label: 'Review pending',    bg: 'rgba(79,142,247,0.08)' },
  review_complete:    { color: '#8b7cf8',           label: 'Review complete',   bg: 'rgba(139,124,248,0.08)' },
  approved:           { color: '#1D9E75',           label: 'Approved',          bg: 'rgba(29,158,117,0.08)' },
  publishing:         { color: '#f0a030',           label: 'Publishing…',       bg: 'rgba(240,160,48,0.08)' },
  published:          { color: '#1D9E75',           label: 'Published',         bg: 'rgba(29,158,117,0.06)' },
  needs_update:       { color: '#e05272',           label: 'Needs update',      bg: 'rgba(224,82,114,0.08)' },
}

const SEVERITY_COLOR = { critical: '#e05272', major: '#f0a030', minor: '#4f8ef7', suggestion: 'var(--pios-muted)' }

// ── Component ──────────────────────────────────────────────────────────────
export default function ContentStudioPage() {
  const [series, setSeries]           = useState<Series | null>(null)
  const [episodes, setEpisodes]       = useState<Episode[]>([])
  const [jobs, setJobs]               = useState<ReviewJob[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<'pipeline' | 'compare' | 'review' | 'schedule'>('pipeline')
  const [selectedEp, setSelectedEp]   = useState<Episode | null>(null)
  const [epDetail, setEpDetail]       = useState<{ manuscript?: string; published?: string } | null>(null)
  const [jobRunning, setJobRunning]   = useState(false)
  const [compareRange, setCompareRange] = useState({ from: 1, to: 10 })
  const [activeJob, setActiveJob]     = useState<ReviewJob | null>(null)
  const [publishing, setPublishing]   = useState<string | null>(null)

  const load = useCallback(async () => {
    const [serRes, epRes, jobRes] = await Promise.all([
      fetch('/api/content/series'),
      fetch('/api/content/episodes?limit=100'),
      fetch('/api/content/review-agent?limit=10'),
    ])
    if (serRes.ok) setSeries((await serRes.json()).series)
    if (epRes.ok)  setEpisodes((await epRes.json()).episodes ?? [])
    if (jobRes.ok) setJobs((await jobRes.json()).jobs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function openEpisode(ep: Episode) {
    setSelectedEp(ep)
    setView('compare')
    const r = await fetch(`/api/content/episodes/${ep.id}`)
    if (r.ok) {
      const d = await r.json()
      setEpDetail({ manuscript: d.manuscript_text, published: d.published_text })
    }
  }

  async function runReviewJob(type: string, from: number, to: number) {
    setJobRunning(true)
    try {
      const r = await fetch('/api/content/review-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: type, episode_from: from, episode_to: to, series_id: series?.id }),
      })
      const d = await r.json()
      setActiveJob(d.job)
      setView('review')
      await load()
    } finally {
      setJobRunning(false)
    }
  }

  async function publishEpisode(ep: Episode) {
    setPublishing(ep.id)
    try {
      const r = await fetch('/api/content/pocket-fm/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode_id: ep.id, series_id: series?.id }),
      })
      const d = await r.json()
      if (r.ok && d.success) {
        setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, status: 'published', published_at: new Date().toISOString() } : e))
      }
    } finally {
      setPublishing(null) }
  }

  async function adoptRecommendation(jobId: string, findingIdx: number) {
    await fetch(`/api/content/review-agent/${jobId}/adopt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finding_index: findingIdx }),
    })
    setActiveJob(prev => prev ? {
      ...prev,
      findings: prev.findings?.map((f, i) => i === findingIdx ? { ...f, adopted: true } : f),
    } : null)
  }

  // ── Derived stats ──────────────────────────────────────────────────────
  const needsUpdate     = episodes.filter(e => e.status === 'needs_update' || !e.manuscript_matches_published).length
  const pendingReview   = episodes.filter(e => e.status === 'manuscript_ready').length
  const readyToPublish  = episodes.filter(e => e.status === 'approved').length
  const publishedCount  = episodes.filter(e => e.status === 'published').length
  const wordCountIssues = episodes.filter(e => e.word_count && (e.word_count < 1300 || e.word_count > 1450)).length

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
      {[1,2,3].map(i => <div key={i} className="pios-skeleton" style={{ height: 80, borderRadius: 10 }} />)}
    </div>
  )

  return (
    <div style={{ maxWidth: 940 }}>

      {/* ── HEADER ── */}
      <div className="pios-page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 className="pios-page-title" style={{ margin: 0 }}>Content Studio</h1>
              {series && <span className="pios-badge pios-badge-ai" style={{ fontSize: 9 }}>PRODUCTION</span>}
            </div>
            <p className="pios-page-sub">
              {series ? `${series.title} · Ep ${series.current_episode} active · ${publishedCount} published` : 'Manage your Pocket FM series'}
            </p>
          </div>
          {series?.studio_url && (
            <a href={series.studio_url} target="_blank" rel="noopener noreferrer" className="pios-btn pios-btn-ghost pios-btn-sm">
              Open Pocket FM Studio ↗
            </a>
          )}
        </div>
      </div>

      {/* ── ALERT BAR ── */}
      {needsUpdate > 0 && (
        <div style={{
          padding: '12px 18px', borderRadius: 8, marginBottom: 20,
          background: 'rgba(224,82,114,0.08)', border: '1px solid rgba(224,82,114,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ fontSize: 13, color: '#e05272' }}>
            ⚠ {needsUpdate} episode{needsUpdate > 1 ? 's have' : ' has'} a mismatch between manuscript and published version
          </div>
          <button
            onClick={() => { setView('compare'); setCompareRange({ from: 1, to: 71 }) }}
            style={{
              padding: '5px 12px', borderRadius: 5, fontSize: 12,
              background: 'rgba(224,82,114,0.12)', color: '#e05272',
              border: '1px solid rgba(224,82,114,0.25)', cursor: 'pointer', flexShrink: 0,
            }}
          >Run compare →</button>
        </div>
      )}

      {/* ── KPI STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Needs update',      value: needsUpdate,    color: '#e05272' },
          { label: 'Word count issues', value: wordCountIssues,color: wordCountIssues > 0 ? '#f0a030' : 'var(--pios-dim)', sub: '< 1,300 or > 1,450' },
          { label: 'Awaiting review',   value: pendingReview,  color: '#4f8ef7' },
          { label: 'Ready to publish',  value: readyToPublish, color: '#1D9E75' },
          { label: 'Published',         value: publishedCount, color: '#8b7cf8' },
        ].map(k => (
          <div key={k.label} className="pios-stat">
            <div className="pios-stat-label">{k.label}</div>
            <div className="pios-stat-value" style={{ color: k.color, fontSize: 20 }}>{k.value}</div>
            {k.sub && <div className="pios-stat-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── VIEW TABS ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--pios-border)' }}>
        {[
          { key: 'pipeline', label: '▦ Episode pipeline' },
          { key: 'compare',  label: '⇌ Compare versions' },
          { key: 'review',   label: '◉ AI review agent' },
          { key: 'schedule', label: '◷ Scheduled tasks' },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key as typeof view)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            fontSize: 13, fontWeight: view === t.key ? 600 : 400,
            color: view === t.key ? 'var(--pios-text)' : 'var(--pios-muted)',
            cursor: 'pointer',
            borderBottom: view === t.key ? '2px solid var(--ai)' : '2px solid transparent',
            marginBottom: -1, fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ PIPELINE VIEW ══ */}
      {view === 'pipeline' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--pios-muted)' }}>{episodes.length} episodes tracked</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => runReviewJob('batch_compare', 1, 71)}
                disabled={jobRunning}
                className="pios-btn pios-btn-ghost pios-btn-sm"
              >
                {jobRunning ? '◎ Running…' : '⇌ Compare ep 1–71'}
              </button>
              <Link href="/platform/content/new-episode" className="pios-btn pios-btn-primary pios-btn-sm">
                + New episode
              </Link>
            </div>
          </div>

          {episodes.length === 0 ? (
            <div className="pios-empty">
              <div className="pios-empty-icon">◈</div>
              <div className="pios-empty-title">No episodes tracked yet</div>
              <div className="pios-empty-desc">Add your Blood Oath Chronicles episodes to start managing the pipeline.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodes.map(ep => {
                const sc    = STATUS_CFG[ep.status] ?? STATUS_CFG.draft
                const mismatch = !ep.manuscript_matches_published && ep.status === 'published'
                return (
                  <div
                    key={ep.id}
                    onClick={() => openEpisode(ep)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
                      background: mismatch ? 'rgba(224,82,114,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${mismatch ? 'rgba(224,82,114,0.2)' : 'var(--pios-border)'}`,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = mismatch ? 'rgba(224,82,114,0.05)' : 'rgba(255,255,255,0.02)')}
                  >
                    {/* Episode number */}
                    <span style={{
                      width: 36, textAlign: 'center', fontSize: 11, fontWeight: 700,
                      color: 'var(--pios-muted)', fontFamily: 'monospace', flexShrink: 0,
                    }}>
                      {String(ep.episode_number).padStart(3, '0')}
                    </span>

                    {/* Title */}
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ep.title}
                    </span>

                    {/* Mismatch warning */}
                    {mismatch && (
                      <span style={{ fontSize: 10, color: '#e05272', fontWeight: 700, flexShrink: 0 }}>⚠ MISMATCH</span>
                    )}

                    {/* Review score */}
                    {ep.review_score !== undefined && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        color: ep.review_score >= 80 ? '#1D9E75' : ep.review_score >= 60 ? '#f0a030' : '#e05272',
                      }}>
                        {ep.review_score}
                      </span>
                    )}

                    {/* Word count with range indicator */}
                    {ep.word_count && (
                      <span style={{
                        fontSize: 11, flexShrink: 0,
                        color: ep.word_count >= 1300 && ep.word_count <= 1450
                          ? 'var(--pios-dim)'
                          : ep.word_count < 1300 ? '#e05272' : '#f0a030',
                        fontFamily: 'monospace',
                      }}>
                        {ep.word_count.toLocaleString()}w
                        {ep.word_count < 1300 && ' ↓'}
                        {ep.word_count > 1450 && ' ↑'}
                      </span>
                    )}

                    {/* Status badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, flexShrink: 0,
                      background: sc.bg, color: sc.color,
                      border: `1px solid ${sc.color}40`, letterSpacing: '0.04em',
                    }}>{sc.label}</span>

                    {/* Publish button if approved */}
                    {ep.status === 'approved' && (
                      <button
                        onClick={e => { e.stopPropagation(); publishEpisode(ep) }}
                        disabled={publishing === ep.id}
                        style={{
                          padding: '4px 10px', borderRadius: 5, fontSize: 11,
                          background: '#1D9E75', color: '#fff', border: 'none',
                          cursor: publishing === ep.id ? 'not-allowed' : 'pointer', flexShrink: 0,
                          opacity: publishing === ep.id ? 0.6 : 1,
                        }}
                      >
                        {publishing === ep.id ? '…' : 'Publish'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ COMPARE VIEW ══ */}
      {view === 'compare' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Manuscript vs Published Comparison</h2>
            <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 16 }}>
              The agent fetches the published text from Pocket FM and compares it word-by-word against your current manuscript. Episodes with differences are flagged for your review. Target: <strong style={{ color: 'var(--pios-sub)' }}>1,300–1,450 words</strong> per episode.
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>From episode</label>
                <input className="pios-input" type="number" value={compareRange.from} min={1}
                  onChange={e => setCompareRange(r => ({ ...r, from: +e.target.value }))}
                  style={{ width: 90 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>To episode</label>
                <input className="pios-input" type="number" value={compareRange.to} min={1}
                  onChange={e => setCompareRange(r => ({ ...r, to: +e.target.value }))}
                  style={{ width: 90 }} />
              </div>
              <button
                onClick={() => runReviewJob('batch_compare', compareRange.from, compareRange.to)}
                disabled={jobRunning}
                className="pios-btn pios-btn-primary"
              >
                {jobRunning ? '◎ Comparing…' : '⇌ Run comparison'}
              </button>
            </div>
          </div>

          {selectedEp && epDetail && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button onClick={() => setSelectedEp(null)} style={{ background: 'none', border: 'none', color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Ep {selectedEp.episode_number}: {selectedEp.title}</span>
                {!selectedEp.manuscript_matches_published && (
                  <span style={{ fontSize: 10, color: '#e05272', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(224,82,114,0.1)', border: '1px solid rgba(224,82,114,0.2)' }}>
                    MISMATCH DETECTED
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Current manuscript (source of truth)', text: epDetail.manuscript, color: '#1D9E75' },
                  { label: 'Published version (on Pocket FM)', text: epDetail.published, color: '#4f8ef7' },
                ].map(pane => (
                  <div key={pane.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: pane.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {pane.label}
                    </div>
                    <textarea
                      value={pane.text ?? 'Not available — run comparison to fetch'}
                      readOnly={pane.label.includes('Published')}
                      onChange={pane.label.includes('manuscript') ? e => setEpDetail(d => ({ ...d, manuscript: e.target.value })) : undefined}
                      style={{
                        width: '100%', height: 360, padding: 14,
                        background: 'var(--pios-surface2)', border: `1px solid ${pane.color}30`,
                        borderRadius: 8, color: 'var(--pios-sub)', fontSize: 12, lineHeight: 1.7,
                        fontFamily: "'DM Sans', system-ui, sans-serif", resize: 'vertical', outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  onClick={async () => {
                    await fetch(`/api/content/episodes/${selectedEp.id}`, {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ manuscript_text: epDetail.manuscript }),
                    })
                  }}
                  className="pios-btn pios-btn-primary pios-btn-sm"
                >Save manuscript</button>
                <button
                  onClick={() => runReviewJob('single_review', selectedEp.episode_number, selectedEp.episode_number)}
                  disabled={jobRunning}
                  className="pios-btn pios-btn-ghost pios-btn-sm"
                >
                  ◉ AI review this episode
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ REVIEW AGENT VIEW ══ */}
      {view === 'review' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>AI Review Agent</h2>
            <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 16 }}>
              The agent analyses episodes against your story bible, checks narrative consistency, scores storytelling strategy adherence, and produces recommendations for adoption before publishing.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { type: 'consistency_audit', label: '⇌ Consistency audit (ep 1–71)', from: 1, to: 71 },
                { type: 'strategy_check',    label: '◎ Strategy check (ep 60–71)',   from: 60, to: 71 },
                { type: 'single_review',     label: '✦ Review latest episode',        from: series?.current_episode ?? 71, to: series?.current_episode ?? 71 },
              ].map(job => (
                <button
                  key={job.type}
                  onClick={() => runReviewJob(job.type, job.from, job.to)}
                  disabled={jobRunning}
                  className="pios-btn pios-btn-ghost pios-btn-sm"
                >
                  {jobRunning ? '◎ Running…' : job.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active job results */}
          {activeJob && (
            <div className="pios-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {activeJob.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--pios-muted)', marginLeft: 10 }}>
                    Ep {activeJob.episode_from}–{activeJob.episode_to}
                  </span>
                </div>
                {activeJob.overall_score !== undefined && (
                  <span style={{
                    fontSize: 22, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: activeJob.overall_score >= 80 ? '#1D9E75' : activeJob.overall_score >= 60 ? '#f0a030' : '#e05272',
                  }}>{activeJob.overall_score}</span>
                )}
              </div>

              {activeJob.summary && (
                <p style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.7, marginBottom: 16 }}>
                  {activeJob.summary}
                </p>
              )}

              {(activeJob.findings ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                    Findings — click to adopt
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(activeJob.findings ?? []).map((f, i) => (
                      <div key={i} style={{
                        padding: '12px 14px', borderRadius: 8,
                        background: f.adopted ? 'rgba(29,158,117,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${f.adopted ? 'rgba(29,158,117,0.2)' : SEVERITY_COLOR[f.severity] + '30'}`,
                        opacity: f.adopted ? 0.7 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, flexShrink: 0, marginTop: 2,
                            color: SEVERITY_COLOR[f.severity],
                            background: SEVERITY_COLOR[f.severity] + '18',
                            border: `1px solid ${SEVERITY_COLOR[f.severity]}40`,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>{f.severity}</span>
                          <div style={{ flex: 1 }}>
                            {f.episode && <span style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 3, display: 'block' }}>Episode {f.episode}</span>}
                            <p style={{ fontSize: 13, color: 'var(--pios-text)', margin: '0 0 4px', fontWeight: 500 }}>{f.description}</p>
                            <p style={{ fontSize: 12, color: 'var(--pios-muted)', margin: 0 }}>{f.recommendation}</p>
                          </div>
                          {!f.adopted ? (
                            <button
                              onClick={() => adoptRecommendation(activeJob.id, i)}
                              style={{
                                padding: '4px 10px', borderRadius: 5, fontSize: 11,
                                background: 'rgba(29,158,117,0.1)', color: '#1D9E75',
                                border: '1px solid rgba(29,158,117,0.25)', cursor: 'pointer', flexShrink: 0,
                              }}
                            >Adopt</button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#1D9E75', flexShrink: 0 }}>✓ Adopted</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Past jobs */}
          {jobs.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Recent jobs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {jobs.map(job => (
                  <div key={job.id} className="pios-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, flex: 1, color: 'var(--pios-sub)' }}>
                      {job.job_type.replace(/_/g, ' ')} · ep {job.episode_from}–{job.episode_to}
                    </span>
                    {job.overall_score !== undefined && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: job.overall_score >= 80 ? '#1D9E75' : '#f0a030' }}>
                        {job.overall_score}
                      </span>
                    )}
                    <span className={`pios-badge ${job.status === 'complete' ? 'pios-badge-ok' : 'pios-badge-warn'}`} style={{ fontSize: 9 }}>
                      {job.status}
                    </span>
                    <button onClick={() => setActiveJob(job)} style={{
                      background: 'none', border: 'none', color: 'var(--ai)', cursor: 'pointer', fontSize: 12,
                    }}>View →</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ SCHEDULE VIEW ══ */}
      {view === 'schedule' && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Scheduled Tasks</h2>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 24 }}>
            Recurring production tasks that run automatically. The crawl agent executes reviews, the compare job checks for manuscript drift, and publishing reminders keep the pipeline moving.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                name:     'Weekly manuscript vs published compare',
                schedule: 'Every Monday 08:00',
                type:     'batch_compare',
                desc:     'Compares all published episodes against current manuscript. Flags any that have drifted.',
                status:   'active',
                last_run: '25 Mar 2026',
                next_run: '31 Mar 2026',
                color:    '#4f8ef7',
              },
              {
                name:     'Consistency audit — rolling window',
                schedule: 'Every Friday 08:00',
                type:     'consistency_audit',
                desc:     'Audits the last 10 published episodes for character consistency, timeline accuracy, and continuity errors.',
                status:   'active',
                last_run: '22 Mar 2026',
                next_run: '29 Mar 2026',
                color:    '#8b7cf8',
              },
              {
                name:     'New episode strategy review',
                schedule: 'After each new draft saved',
                type:     'single_review',
                desc:     'Runs automatically when a new episode draft is saved. Scores against the Matryoshka storytelling strategy before you approve.',
                status:   'active',
                last_run: '27 Mar 2026',
                next_run: 'On next draft save',
                color:    '#10d9a0',
              },
              {
                name:     'Publish reminder',
                schedule: 'Daily 07:00 (morning brief)',
                type:     'reminder',
                desc:     'Included in your PIOS morning brief: count of approved episodes ready to publish, pending reviews, and any mismatches.',
                status:   'active',
                last_run: 'Today',
                next_run: 'Tomorrow 07:00',
                color:    '#f0a030',
              },
            ].map(task => (
              <div key={task.name} className="pios-card" style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 4, borderRadius: 2, background: task.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pios-text)' }}>{task.name}</span>
                    <span className="pios-badge pios-badge-ok" style={{ fontSize: 9 }}>{task.status.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>{task.desc}</p>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>
                      <span style={{ color: 'var(--pios-muted)' }}>Schedule: </span>{task.schedule}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>
                      <span style={{ color: 'var(--pios-muted)' }}>Last: </span>{task.last_run}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pios-dim)' }}>
                      <span style={{ color: 'var(--pios-muted)' }}>Next: </span>{task.next_run}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => runReviewJob(task.type, 1, series?.current_episode ?? 71)}
                  disabled={jobRunning || task.type === 'reminder'}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 11, flexShrink: 0, alignSelf: 'flex-start',
                    background: task.type === 'reminder' ? 'transparent' : task.color + '18',
                    color: task.type === 'reminder' ? 'var(--pios-dim)' : task.color,
                    border: `1px solid ${task.color}35`,
                    cursor: task.type === 'reminder' || jobRunning ? 'not-allowed' : 'pointer',
                    opacity: task.type === 'reminder' ? 0.5 : 1,
                  }}
                >
                  {task.type === 'reminder' ? 'Via brief' : 'Run now'}
                </button>
              </div>
            ))}
          </div>

          {/* Morning brief integration note */}
          <div style={{
            marginTop: 20, padding: '14px 18px', borderRadius: 8,
            background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.2)',
            fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--ai)' }}>◉ NemoClaw™ morning brief integration:</strong> Content pipeline status is automatically included in your 07:00 brief. Episodes pending approval, mismatches found, and the next scheduled publish are surfaced every morning without you having to check manually.
          </div>
        </div>
      )}
    </div>
  )
}
