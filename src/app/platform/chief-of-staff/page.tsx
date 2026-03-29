'use client'
/**
 * /platform/chief-of-staff — NemoClaw™ Chief of Staff
 *
 * Strategic command centre — distinct from the PA layer.
 * PA: hours/days. CoS: weeks/quarters.
 *
 * Three columns:
 *   LEFT:   Portfolio health (workstreams with RAG)
 *   CENTRE: This week / next week / critical path
 *   RIGHT:  Strategic intelligence + pre-meeting briefs
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+2
 */

import { useState, useEffect, useCallback } from 'react'

/* ── Types ──────────────────────────────────────────────────── */
interface Workstream {
  id: string; name: string; domain: string; product?: string
  rag_status: 'red' | 'amber' | 'green'; status: string
  next_milestone?: string; next_milestone_date?: string
  blocking_issue?: string; last_updated: string
  description?: string
}
interface StrategicReview {
  id: string; review_date: string; week_summary?: string
  next_week?: string; quarter_view?: string
  ai_risks?: string[]; ai_priorities?: string[]
}
interface DecisionBrief {
  id: string; decision_id: string; decision_type: string
  options?: {label:string;pros:string;cons:string;risk:string}[]
  recommendation?: string; needed_by?: string
  decision?: { title: string }
}
interface Commitment {
  id: string; text: string; made_to?: string; due_date?: string
  status: string; source_type?: string
}

/* ── RAG config ─────────────────────────────────────────────── */
const RAG = {
  red:   { colour: '#dc3c3c', bg: 'rgba(220,60,60,0.08)',   dot: '●', label: 'At risk' },
  amber: { colour: '#f0a030', bg: 'rgba(240,160,48,0.08)',  dot: '●', label: 'Monitor' },
  green: { colour: '#10d9a0', bg: 'rgba(16,217,160,0.08)',  dot: '●', label: 'On track' },
}

/* ── Domain colours ─────────────────────────────────────────── */
const DOMAIN_COLOURS: Record<string, string> = {
  veritas_edge: 'var(--ai)', pios: 'var(--academic)',
  investiscript: 'var(--fm)', dba: 'var(--warn)',
  aecom: 'var(--pios-muted)', creative: 'var(--pios-dim)',
  legal: 'var(--dng)', commercial: 'var(--academic)',
}

/* ── Main page ───────────────────────────────────────────────── */
export default function ChiefOfStaffPage() {
  const [workstreams, setWorkstreams]   = useState<Workstream[]>([])
  const [review, setReview]             = useState<StrategicReview | null>(null)
  const [briefs, setBriefs]             = useState<DecisionBrief[]>([])
  const [commitments, setCommitments]   = useState<Commitment[]>([])
  const [loading, setLoading]           = useState(true)
  const [generating, setGenerating]     = useState(false)
  const [selected, setSelected]         = useState<Workstream | null>(null)
  const [briefModal, setBriefModal]     = useState<DecisionBrief | null>(null)
  const [editingWs, setEditingWs]       = useState<string | null>(null)
  const [editNote, setEditNote]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wsRes, reviewRes, briefsRes, commitRes] = await Promise.allSettled([
        fetch('/api/cos/workstreams').then(r => r.ok ? r.json() : {}),
        fetch('/api/cos/review/latest').then(r => r.ok ? r.json() : {}),
        fetch('/api/cos/decision-briefs').then(r => r.ok ? r.json() : {}),
        fetch('/api/cos/commitments').then(r => r.ok ? r.json() : {}),
      ])
      if (wsRes.status     === 'fulfilled') setWorkstreams(wsRes.value.workstreams ?? [])
      if (reviewRes.status === 'fulfilled') setReview(reviewRes.value.review ?? null)
      if (briefsRes.status === 'fulfilled') setBriefs(briefsRes.value.briefs ?? [])
      if (commitRes.status === 'fulfilled') setCommitments(commitRes.value.commitments ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const generateReview = async () => {
    setGenerating(true)
    await fetch('/api/cos/review/generate', { method: 'POST' })
    await load()
    setGenerating(false)
  }

  const updateRAG = async (id: string, rag: string, note?: string) => {
    await fetch(`/api/cos/workstreams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rag_status: rag, blocking_issue: note }),
    })
    setEditingWs(null)
    load()
  }

  /* ── Computed ── */
  const byRAG = (r: 'red'|'amber'|'green') => workstreams.filter(w => w.rag_status === r)
  const dueSoon = commitments.filter(c => {
    if (!c.due_date || c.status !== 'open') return false
    return Math.ceil((new Date(c.due_date).getTime() - Date.now()) / 86400000) <= 7
  })

  if (loading) return <div style={{ padding: 32, color: 'var(--pios-muted)', fontSize: 14 }}>Loading...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ══ LEFT: Portfolio health ══════════════════════════════ */}
      <div style={{ borderRight: '1px solid var(--pios-border)', overflowY: 'auto', padding: '20px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', letterSpacing: '-0.01em' }}>Portfolio</div>
          <a href="/platform/chief-of-staff/workstreams/new" style={{ fontSize: 11, color: 'var(--ai)', textDecoration: 'none' }}>+ Add</a>
        </div>

        {/* RAG summary */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['red','amber','green'] as const).map(r => (
            <div key={r} style={{ flex: 1, padding: '6px 8px', background: RAG[r].bg, borderRadius: 7, textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: RAG[r].colour }}>{byRAG(r).length}</div>
              <div style={{ fontSize: 9, color: RAG[r].colour, fontWeight: 700, textTransform: 'uppercase' }}>{RAG[r].label}</div>
            </div>
          ))}
        </div>

        {/* Workstream list */}
        {workstreams.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--pios-dim)', textAlign: 'center', padding: '20px 0' }}>
            No workstreams yet.<br />
            <a href="/platform/chief-of-staff/workstreams/new" style={{ color: 'var(--ai)', fontSize: 11 }}>Set up your portfolio →</a>
          </div>
        ) : (
          // Sort: red first, then amber, then green
          [...workstreams].sort((a,b) => {
            const order = {red:0,amber:1,green:2}
            return order[a.rag_status] - order[b.rag_status]
          }).map(ws => {
            const rag = RAG[ws.rag_status]
            const isSelected = selected?.id === ws.id

            return (
              <div key={ws.id} onClick={() => setSelected(isSelected ? null : ws)}
                style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, border: `1px solid ${isSelected ? rag.colour : 'var(--pios-border)'}`, background: isSelected ? rag.bg : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: rag.colour, fontSize: 10 }}>{rag.dot}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--pios-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${DOMAIN_COLOURS[ws.domain] ?? 'var(--pios-muted)'}22`, color: DOMAIN_COLOURS[ws.domain] ?? 'var(--pios-muted)', flexShrink: 0 }}>
                    {ws.domain?.replace('_', ' ')}
                  </span>
                </div>

                {ws.next_milestone && (
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    → {ws.next_milestone}
                    {ws.next_milestone_date && (
                      <span style={{ color: 'var(--pios-dim)', marginLeft: 4 }}>
                        {new Date(ws.next_milestone_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
                      </span>
                    )}
                  </div>
                )}

                {ws.blocking_issue && (
                  <div style={{ fontSize: 10, color: rag.colour, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ⚑ {ws.blocking_issue}
                  </div>
                )}

                {/* Quick RAG update */}
                {isSelected && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--pios-border)' }}>
                    {editingWs === ws.id ? (
                      <div>
                        <input style={{ width: '100%', padding: '5px 8px', fontSize: 11, border: '1px solid var(--pios-border)', borderRadius: 5, background: 'var(--pios-bg)', color: 'var(--pios-text)', marginBottom: 6, boxSizing: 'border-box' }}
                          placeholder="Note or blocker..." value={editNote} onChange={e => setEditNote(e.target.value)} />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['green','amber','red'] as const).map(r => (
                            <button key={r} onClick={() => updateRAG(ws.id, r, editNote)}
                              style={{ flex: 1, padding: '4px', background: RAG[r].bg, border: `1px solid ${RAG[r].colour}`, borderRadius: 4, color: RAG[r].colour, fontSize: 9, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditingWs(ws.id)}
                        style={{ fontSize: 10, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Update status →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ══ CENTRE: This week ═══════════════════════════════════ */}
      <div style={{ overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--pios-text)', margin: 0, letterSpacing: '-0.02em' }}>Chief of Staff</h1>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>Strategic intelligence · Week of {new Date().toLocaleDateString('en-GB', {day:'numeric',month:'long'})}</div>
          </div>
          <button onClick={generateReview} disabled={generating}
            style={{ padding: '7px 14px', background: generating ? 'var(--pios-border)' : 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: generating ? 'wait' : 'pointer' }}>
            {generating ? 'Generating...' : '✦ Generate weekly review'}
          </button>
        </div>

        {/* Weekly review */}
        {review ? (
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Week ending {new Date(review.review_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
            </div>

            {review.week_summary && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 6 }}>This week</div>
                <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{review.week_summary}</div>
              </div>
            )}

            {review.next_week && (
              <div style={{ marginBottom: 14, paddingTop: 14, borderTop: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 6 }}>Next week — critical path</div>
                <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{review.next_week}</div>
              </div>
            )}

            {review.ai_risks && review.ai_risks.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dng)', marginBottom: 8 }}>⚑ Risk watch</div>
                {review.ai_risks.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 5, paddingLeft: 10, borderLeft: '2px solid var(--dng)' }}>{r}</div>
                ))}
              </div>
            )}

            {review.ai_priorities && review.ai_priorities.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fm)', marginBottom: 8 }}>↑ NemoClaw™ priorities</div>
                {review.ai_priorities.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 5, paddingLeft: 10, borderLeft: '2px solid var(--fm)' }}>{p}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 24, color: 'var(--ai)', marginBottom: 10 }}>◈</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 6 }}>No weekly review yet</div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16 }}>
              Generate your first strategic review — NemoClaw™ reads your OKRs, decisions, and workstreams.
            </div>
            <button onClick={generateReview} disabled={generating}
              style={{ padding: '9px 18px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {generating ? 'Generating...' : 'Generate now →'}
            </button>
          </div>
        )}

        {/* Commitments due */}
        {dueSoon.length > 0 && (
          <div style={{ background: 'var(--pios-card)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dng)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>⚑ Commitments due this week</div>
            {dueSoon.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dng)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--pios-text)' }}>{c.text}</div>
                  {c.made_to && <div style={{ fontSize: 11, color: 'var(--pios-dim)' }}>To: {c.made_to}</div>}
                </div>
                {c.due_date && (
                  <div style={{ fontSize: 10, color: 'var(--dng)', flexShrink: 0 }}>
                    {new Date(c.due_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Decision briefs */}
        {briefs.length > 0 && (
          <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--academic)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              ◈ Decision briefs ({briefs.length})
            </div>
            {briefs.map(brief => (
              <div key={brief.id} onClick={() => setBriefModal(brief)}
                style={{ padding: '10px 12px', background: 'var(--pios-bg)', borderRadius: 8, marginBottom: 6, cursor: 'pointer', border: '1px solid var(--pios-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>
                  {brief.decision?.title ?? 'Decision brief'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--pios-dim)', textTransform: 'capitalize' }}>{brief.decision_type}</span>
                  {brief.needed_by && (
                    <span style={{ fontSize: 10, color: 'var(--warn)' }}>
                      Needed by {new Date(brief.needed_by).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ai)', marginTop: 4 }}>View structured options →</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ RIGHT: Intelligence ═════════════════════════════════ */}
      <div style={{ borderLeft: '1px solid var(--pios-border)', overflowY: 'auto', padding: '20px 16px' }}>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 16, letterSpacing: '-0.01em' }}>Intelligence</div>

        {/* Quarter view */}
        {review?.quarter_view && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Q2 2026 view</div>
            <div style={{ fontSize: 12, color: 'var(--pios-text)', lineHeight: 1.7, padding: '10px 12px', background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 8 }}>
              {review.quarter_view}
            </div>
          </div>
        )}

        {/* Workstream detail panel */}
        {selected && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--pios-card)', border: `1px solid ${RAG[selected.rag_status].colour}`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 8 }}>{selected.name}</div>
            {selected.description && <div style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.6, marginBottom: 8 }}>{selected.description}</div>}
            <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 4 }}>
              Last updated {new Date(selected.last_updated).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}
            </div>
            <div style={{ fontSize: 11, color: RAG[selected.rag_status].colour, fontWeight: 500 }}>
              {RAG[selected.rag_status].dot} {RAG[selected.rag_status].label}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Red workstreams', value: byRAG('red').length, colour: 'var(--dng)' },
            { label: 'Amber',          value: byRAG('amber').length, colour: 'var(--warn)' },
            { label: 'Open decisions', value: briefs.length,        colour: 'var(--academic)' },
            { label: 'Commitments due', value: dueSoon.length,     colour: 'var(--dng)' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 10px', background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 7 }}>
              <div style={{ fontSize: 18, fontWeight: 400, color: s.colour, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--pios-dim)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { href: '/platform/chief-of-staff/board-prep',   label: '→ Board prep generator' },
            { href: '/platform/chief-of-staff/horizon',      label: '→ Horizon scanner' },
            { href: '/platform/chief-of-staff/commitments',  label: '→ All commitments' },
          ].map(l => (
            <a key={l.href} href={l.href}
              style={{ fontSize: 12, color: 'var(--ai)', textDecoration: 'none', padding: '7px 10px', border: '1px solid var(--pios-border)', borderRadius: 6 }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* ══ DECISION BRIEF MODAL ═══════════════════════════════ */}
      {briefModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--pios-card)', borderRadius: 14, padding: 28, maxWidth: 580, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--academic)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Decision brief · {briefModal.decision_type}</div>
                <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--pios-text)', margin: 0 }}>{briefModal.decision?.title}</h2>
              </div>
              <button onClick={() => setBriefModal(null)} style={{ background: 'none', border: 'none', color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {briefModal.recommendation && (
              <div style={{ background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)', marginBottom: 6 }}>NemoClaw™ recommendation</div>
                <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.7 }}>{briefModal.recommendation}</div>
              </div>
            )}

            {briefModal.options && briefModal.options.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Structured options</div>
                {briefModal.options.map((opt, i) => (
                  <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--pios-border)', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 6 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--fm)', marginBottom: 3 }}>✓ {opt.pros}</div>
                    <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 3 }}>✗ {opt.cons}</div>
                    <div style={{ fontSize: 11, color: 'var(--dng)' }}>⚑ Risk: {opt.risk}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Accept recommendation
              </button>
              <button onClick={() => setBriefModal(null)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
