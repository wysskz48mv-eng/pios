'use client'
import { useState } from 'react'
import { CheckCircle2, Star, Loader2, MessageSquare } from 'lucide-react'

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
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'pios',
          stability,
          performance,
          security: true,
          feature_fit: featureFit,
          nps,
          cps: cps?.toFixed(2),
          open_feedback: feedback.trim() || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Submission failed')
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
    setSubmitting(false)
  }

  const ScoreRow = ({
    label, value, onChange,
  }: { label: string; value: Score | null; onChange: (v: Score) => void }) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5] as Score[]).map(v => (
          <button key={v} onClick={() => onChange(v)}
            className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all
              ${value === v
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:border-primary/50 hover:text-foreground'}`}>
            {v}
          </button>
        ))}
        <span className="text-xs text-[var(--pios-muted)] self-center ml-1">
          {value ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][value] : ''}
        </span>
      </div>
    </div>
  )

  if (submitted) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4 pt-20">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        <h1 className="text-xl font-bold">Thank you for your feedback</h1>
        <p className="text-[var(--pios-muted)] text-sm">
          Your response helps improve PIOS. It has been recorded anonymously.
        </p>
        {cps !== null && (
          <div className="inline-block bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl px-6 py-4">
            <p className="text-3xl font-bold text-primary">{cps.toFixed(0)}%</p>
            <p className="text-xs text-[var(--pios-muted)]">Composite Platform Score</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" /> Platform Feedback
        </h1>
        <p className="text-sm text-[var(--pios-muted)] mt-1">
          SRAF D-02 pilot — takes 2 minutes. Helps us improve PIOS before wider rollout.
        </p>
      </div>

      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5 space-y-5">
        <ScoreRow label="Platform stability (uptime, no crashes)" value={stability} onChange={setStability} />
        <ScoreRow label="Response speed & performance" value={performance} onChange={setPerformance} />
        <ScoreRow label="Feature fit for your workflow" value={featureFit} onChange={setFeatureFit} />
      </div>

      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium">
          How likely are you to recommend PIOS to a colleague?
        </p>
        <p className="text-xs text-[var(--pios-muted)]">0 = Not at all likely · 10 = Extremely likely</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, i) => i).map(v => (
            <button key={v} onClick={() => setNps(v)}
              className={`w-9 h-9 rounded-lg text-xs font-bold border transition-all
                ${nps === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:border-primary/50'}`}>
              {v}
            </button>
          ))}
        </div>
        {nps !== null && (
          <p className="text-xs text-[var(--pios-muted)]">
            {nps >= 9 ? '🟢 Promoter' : nps >= 7 ? '🟡 Passive' : '🔴 Detractor'}
          </p>
        )}
      </div>

      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium">Any other feedback? (optional)</p>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={3}
          placeholder="What's working well? What should we improve?"
          className="w-full px-3 py-2 text-sm border border-[var(--pios-border)] rounded-lg bg-background focus:outline-none focus:border-primary/60 resize-none" />
      </div>

      {cps !== null && (
        <div className="text-center text-xs text-[var(--pios-muted)]">
          Your composite score: <span className="font-bold text-primary">{cps.toFixed(0)}%</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <button onClick={submit} disabled={!canSubmit || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className="w-5 h-5" />}
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </div>
  )
}
