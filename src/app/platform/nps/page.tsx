/**
 * /platform/nps — PIOS Platform Feedback (SRAF D-02)
 * Obsidian Command v3.0.2 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState } from 'react'
import { CheckCircle2, Loader2, MessageSquare } from 'lucide-react'

type Score = 1 | 2 | 3 | 4 | 5

export default function NPSSurveyPage() {
  const [stability,   setStability]   = useState<Score | null>(null)
  const [performance, setPerformance] = useState<Score | null>(null)
  const [featureFit,  setFeatureFit]  = useState<Score | null>(null)
  const [nps,         setNps]         = useState<number | null>(null)
  const [feedback,    setFeedback]    = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const cps = stability && performance && featureFit
    ? ((stability + performance + featureFit) / 15) * 100
    : null

  const canSubmit = stability && performance && featureFit && nps !== null

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/nps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'pios', stability, performance, security: true,
          feature_fit: featureFit, nps,
          cps: cps?.toFixed(2),
          open_feedback: feedback.trim() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Submission failed')
      setSubmitted(true)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') }
    setSubmitting(false)
  }

  const inp: React.CSSProperties = {
    display: 'block', width: '100%', padding: '9px 13px',
    background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
    borderRadius: 8, color: 'var(--pios-text)', fontSize: 13.5,
    fontFamily: 'var(--font-sans)', outline: 'none',
    resize: 'vertical' as const, transition: 'border-color 0.15s',
  }

  function ScoreRow({ label, value, onChange }: { label: string; value: Score | null; onChange: (v: Score) => void }) {
    return (
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--pios-text)' }}>{label}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {([1, 2, 3, 4, 5] as Score[]).map(v => (
            <button key={v} onClick={() => onChange(v)} style={{
              width: 40, height: 40, borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
              background: value === v ? 'var(--ai)' : 'var(--pios-surface2)',
              borderColor: value === v ? 'var(--ai)' : 'var(--pios-border2)',
              color: value === v ? '#fff' : 'var(--pios-muted)',
            }}>{v}</button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--pios-muted)', marginLeft: 4 }}>
            {value ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][value] : ''}
          </span>
        </div>
      </div>
    )
  }

  if (submitted) return (
    <div className="fade-up" style={{ maxWidth: 520, margin: '80px auto 0', textAlign: 'center' }}>
      <CheckCircle2 size={48} color="var(--fm)" style={{ margin: '0 auto 16px' }} />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.03em', marginBottom: 8 }}>
        Thank you for your feedback.
      </h1>
      <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 24, lineHeight: 1.7 }}>
        Your response helps improve PIOS. It has been recorded.
      </p>
      {cps !== null && (
        <div style={{ display: 'inline-block', background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 14, padding: '20px 36px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400, color: 'var(--ai3)', lineHeight: 1, marginBottom: 4 }}>
            {cps.toFixed(0)}%
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pios-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            Composite Platform Score
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div className="fade-up" style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <MessageSquare size={18} color="var(--ai3)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.03em' }}>
            Platform Feedback
          </h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
          SRAF D-02 pilot — takes 2 minutes. Helps us improve PIOS before wider rollout.
        </p>
      </div>

      {/* Scores card */}
      <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>
        <ScoreRow label="Platform stability (uptime, no crashes)" value={stability} onChange={setStability} />
        <ScoreRow label="Response speed & performance" value={performance} onChange={setPerformance} />
        <ScoreRow label="Feature fit for your workflow" value={featureFit} onChange={setFeatureFit} />
      </div>

      {/* NPS card */}
      <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>
          How likely are you to recommend PIOS to a colleague?
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pios-dim)', marginBottom: 14, letterSpacing: '0.04em' }}>
          0 = not at all likely · 10 = extremely likely
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
          {Array.from({ length: 11 }, (_, i) => i).map(v => (
            <button key={v} onClick={() => setNps(v)} style={{
              width: 38, height: 38, borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
              background: nps === v ? 'var(--ai)' : 'var(--pios-surface2)',
              borderColor: nps === v ? 'var(--ai)' : 'var(--pios-border2)',
              color: nps === v ? '#fff' : 'var(--pios-muted)',
            }}>{v}</button>
          ))}
        </div>
        {nps !== null && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pios-muted)', marginTop: 10, letterSpacing: '0.04em' }}>
            {nps >= 9 ? '▲ Promoter' : nps >= 7 ? '— Passive' : '▼ Detractor'}
          </p>
        )}
      </div>

      {/* Feedback card */}
      <div style={{ background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Any other feedback? (optional)</p>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={3}
          placeholder="What's working well? What should we improve?"
          style={inp}
          onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--ai)'}
          onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--pios-border2)'}
        />
      </div>

      {cps !== null && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--pios-muted)', marginBottom: 14 }}>
          Composite score: <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ai3)' }}>{cps.toFixed(0)}%</span>
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center', marginBottom: 12 }}>{error}</p>
      )}

      <button onClick={submit} disabled={!canSubmit || submitting} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px', borderRadius: 10, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
        background: canSubmit ? 'var(--ai)' : 'rgba(99,73,255,0.3)',
        color: '#fff', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s', opacity: submitting ? 0.7 : 1,
      }}>
        {submitting
          ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Submitting…</>
          : 'Submit Feedback'}
      </button>
    </div>
  )
}
