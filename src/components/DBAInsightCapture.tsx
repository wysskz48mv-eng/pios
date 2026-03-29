'use client'
/**
 * InsightCapture — Universal floating trigger
 *
 * A 💡 button fixed bottom-right on every platform page.
 * Captures revelations across 6 insight types, each routed differently:
 *
 *   📚 DBA / Research      → Academic Hub + supervisor queue
 *   💼 Business Opportunity → Executive OS + OKR pipeline
 *   🎓 CPD / Learning      → Learning Hub + CPD tracker
 *   ®️  IP / Patent         → IP Vault + legal review
 *   🤝 Client Intelligence → Consulting Hub + CRM
 *   ⚡ Product Insight     → Backlog + sprint planning
 *
 * Design principle: capture NOW (< 30 seconds), classify later.
 * NemoClaw surfaces captured insights in the morning brief before they go stale.
 *
 * PIOS v3.2.0 | VeritasIQ Technologies Ltd
 */
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const TYPES = [
  { value: 'dba_thesis',           icon: '📚', label: 'DBA / Research',       color: '#6c8eff', hint: 'Thesis chapter, methodology, literature, supervisor share' },
  { value: 'business_opportunity', icon: '💼', label: 'Business Opportunity',  color: '#10b981', hint: 'Market gap, revenue idea, commercial potential' },
  { value: 'cpd_learning',         icon: '🎓', label: 'CPD / Learning',        color: '#f59e0b', hint: 'Skill, certification, professional development' },
  { value: 'ip_consideration',     icon: '®️',  label: 'IP / Patent',           color: '#9b87f5', hint: 'Novel method, patentable process, trade secret' },
  { value: 'client_intelligence',  icon: '🤝', label: 'Client Intelligence',   color: '#0ecfb0', hint: 'Client insight, opportunity, relationship signal' },
  { value: 'product_insight',      icon: '⚡', label: 'Product / Feature',     color: '#ef4444', hint: 'Platform improvement, UX issue, feature idea' },
  { value: 'general',              icon: '💡', label: 'General',               color: '#94a3b8', hint: 'Uncategorised — classify later' },
]

const THESIS_SECTIONS = [
  { value: '',                  label: 'Not assigned' },
  { value: 'introduction',      label: 'Ch 1 — Introduction' },
  { value: 'literature_review', label: 'Ch 2 — Literature Review' },
  { value: 'methodology',       label: 'Ch 3 — Methodology' },
  { value: 'findings',          label: 'Ch 4 — Findings' },
  { value: 'discussion',        label: 'Ch 5 — Discussion' },
  { value: 'conclusion',        label: 'Ch 6 — Conclusion' },
]

const SOURCES = [
  { value: 'manual',        label: 'General thought' },
  { value: 'sprint',        label: 'Development sprint' },
  { value: 'literature',    label: 'Paper / publication' },
  { value: 'platform_test', label: 'Platform testing' },
  { value: 'client_work',   label: 'Client / FM engagement' },
  { value: 'nemoclaw',      label: 'NemoClaw conversation' },
  { value: 'ai_research',   label: 'AI research session' },
]

const CPD_BODIES = ['RICS', 'BIFM', 'CIBSE', 'CIPD', 'CIOB', 'APM', 'ICSA', 'ILM', 'CMI', 'Other']

export default function InsightCapture() {
  const pathname = usePathname()
  const [open,       setOpen]       = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [pendingCt,  setPendingCt]  = useState(0)

  // Form state
  const [insightType, setInsightType] = useState('general')
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [source,      setSource]      = useState('manual')
  const [priority,    setPriority]    = useState('medium')
  const [reviewBy,    setReviewBy]    = useState('')
  // Type-specific
  const [thesisSection,    setThesisSection]    = useState('')
  const [supervisorShare,  setSupervisorShare]   = useState(false)
  const [cpdBody,          setCpdBody]           = useState('')
  const [marketSegment,    setMarketSegment]     = useState('')
  const [ipType,           setIpType]            = useState('')
  const [clientOrg,        setClientOrg]         = useState('')
  const [platform,         setPlatform]          = useState('')

  const pageContext = pathname?.replace('/platform/', '') ?? ''
  const activeType = TYPES.find(t => t.value === insightType)!

  useEffect(() => {
    if (!open) return
    fetch('/api/insights?status=captured&limit=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.stats) setPendingCt(d.stats.captured ?? 0) })
      .catch(() => {})
  }, [open, saved])

  function reset() {
    setTitle(''); setBody(''); setInsightType('general')
    setSource('manual'); setPriority('medium'); setReviewBy('')
    setThesisSection(''); setSupervisorShare(false)
    setCpdBody(''); setMarketSegment(''); setIpType('')
    setClientOrg(''); setPlatform('')
  }

  async function save() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(), body: body.trim(),
        insight_type: insightType, source_type: source,
        source_context: pageContext || undefined,
        priority, review_by: reviewBy || null,
      }
      if (insightType === 'dba_thesis') {
        payload.thesis_section = thesisSection || null
        payload.supervisor_share = supervisorShare
      }
      if (insightType === 'cpd_learning')        payload.cpd_body = cpdBody || null
      if (insightType === 'business_opportunity') payload.market_segment = marketSegment || null
      if (insightType === 'ip_consideration')     payload.ip_type = ipType || null
      if (insightType === 'client_intelligence')  payload.client_org = clientOrg || null
      if (insightType === 'product_insight')      payload.platform = platform || null

      const r = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) {
        setSaved(true)
        setTimeout(() => { setSaved(false); setOpen(false); reset() }, 1500)
      }
    } finally { setSaving(false) }
  }

  const S = {
    label: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)',
      display: 'block', marginBottom: 5 },
    input: {
      width: '100%', background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
      padding: '8px 11px', color: '#f4f4f5', fontSize: 13,
      fontFamily: 'var(--font-sans)', outline: 'none',
      boxSizing: 'border-box' as const,
    },
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Capture an insight"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 46, height: 46, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(108,142,255,0.9), rgba(139,92,246,0.9))',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 4px 20px rgba(108,142,255,0.4)',
          cursor: 'pointer', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.transform = 'scale(1.1)'
          b.style.boxShadow = '0 6px 28px rgba(108,142,255,0.6)'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement
          b.style.transform = 'scale(1)'
          b.style.boxShadow = '0 4px 20px rgba(108,142,255,0.4)'
        }}
      >
        💡
        {pendingCt > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 19, height: 19, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #080808',
            fontSize: 9, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {pendingCt > 9 ? '9+' : pendingCt}
          </div>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); reset() } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 540,
            background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18, padding: '22px 22px 18px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ fontSize: 26 }}>{activeType.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5' }}>Capture Insight</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                  {pageContext ? `from ${pageContext}` : 'capture now · classify later · NemoClaw resurfaces it'}
                </div>
              </div>
              <button onClick={() => { setOpen(false); reset() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>

            {saved ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{activeType.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>Insight captured</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  Routed to: {insightType === 'dba_thesis' ? 'Academic Hub' : insightType === 'business_opportunity' ? 'Executive OS' : insightType === 'cpd_learning' ? 'Learning Hub' : insightType === 'ip_consideration' ? 'IP Vault' : insightType === 'client_intelligence' ? 'Consulting Hub' : insightType === 'product_insight' ? 'Product backlog' : 'Morning brief'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

                {/* Type selector */}
                <div>
                  <label style={S.label}>What kind of insight?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {TYPES.map(t => (
                      <button key={t.value} onClick={() => setInsightType(t.value)} style={{
                        padding: '7px 4px', borderRadius: 9, cursor: 'pointer',
                        background: insightType === t.value ? `${t.color}20` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${insightType === t.value ? t.color : 'rgba(255,255,255,0.08)'}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        transition: 'all 0.12s',
                      }}>
                        <span style={{ fontSize: 14 }}>{t.icon}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: insightType === t.value ? t.color : 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  {activeType.hint && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5, fontStyle: 'italic' }}>
                      {activeType.hint}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label style={S.label}>Title *</label>
                  <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="What's the insight in one line?"
                    style={S.input} />
                </div>

                {/* Body */}
                <div>
                  <label style={S.label}>Detail *</label>
                  <textarea value={body} onChange={e => setBody(e.target.value)}
                    placeholder="Why does this matter? What should you do with it? What are the implications?"
                    rows={3} style={{ ...S.input, resize: 'vertical' as const, minHeight: 80 }} />
                </div>

                {/* Type-specific fields */}
                {insightType === 'dba_thesis' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={S.label}>Thesis chapter</label>
                      <select value={thesisSection} onChange={e => setThesisSection(e.target.value)} style={S.input}>
                        {THESIS_SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', paddingBottom: 2 }}>
                      <input type="checkbox" checked={supervisorShare} onChange={e => setSupervisorShare(e.target.checked)} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Share with supervisors</span>
                    </label>
                  </div>
                )}

                {insightType === 'cpd_learning' && (
                  <div>
                    <label style={S.label}>CPD body</label>
                    <select value={cpdBody} onChange={e => setCpdBody(e.target.value)} style={S.input}>
                      <option value="">Not specified</option>
                      {CPD_BODIES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}

                {insightType === 'business_opportunity' && (
                  <div>
                    <label style={S.label}>Market segment</label>
                    <input value={marketSegment} onChange={e => setMarketSegment(e.target.value)}
                      placeholder="e.g. GCC master communities, UK NHS FM, GCC PropTech"
                      style={S.input} />
                  </div>
                )}

                {insightType === 'ip_consideration' && (
                  <div>
                    <label style={S.label}>IP type</label>
                    <select value={ipType} onChange={e => setIpType(e.target.value)} style={S.input}>
                      <option value="">Not specified</option>
                      <option value="patent">Patent</option>
                      <option value="trade_secret">Trade secret</option>
                      <option value="trademark">Trademark</option>
                      <option value="copyright">Copyright</option>
                    </select>
                  </div>
                )}

                {insightType === 'client_intelligence' && (
                  <div>
                    <label style={S.label}>Client / organisation</label>
                    <input value={clientOrg} onChange={e => setClientOrg(e.target.value)}
                      placeholder="e.g. Qiddiya Investment Company"
                      style={S.input} />
                  </div>
                )}

                {insightType === 'product_insight' && (
                  <div>
                    <label style={S.label}>Platform</label>
                    <select value={platform} onChange={e => setPlatform(e.target.value)} style={S.input}>
                      <option value="">Not specified</option>
                      <option value="PIOS">PIOS</option>
                      <option value="VeritasEdge">VeritasEdge™</option>
                      <option value="InvestiScript">InvestiScript™</option>
                      <option value="All">All platforms</option>
                    </select>
                  </div>
                )}

                {/* Priority + Review date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={S.label}>Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} style={S.input}>
                      <option value="high">High — this week</option>
                      <option value="medium">Medium — this month</option>
                      <option value="low">Low — park for now</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Review by (optional)</label>
                    <input type="date" value={reviewBy} onChange={e => setReviewBy(e.target.value)} style={S.input} />
                  </div>
                </div>

                {/* Source */}
                <div>
                  <label style={S.label}>What triggered this?</label>
                  <select value={source} onChange={e => setSource(e.target.value)} style={S.input}>
                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  <button onClick={save} disabled={saving || !title.trim() || !body.trim()} style={{
                    flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                    background: `linear-gradient(135deg, ${activeType.color}, rgba(139,92,246,0.9))`,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: saving || !title.trim() || !body.trim() ? 0.5 : 1,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {saving ? '⟳ Capturing…' : `${activeType.icon} Capture →`}
                  </button>
                  <button onClick={() => { setOpen(false); reset() }} style={{
                    padding: '10px 16px', borderRadius: 9, background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
