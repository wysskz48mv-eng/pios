'use client'
/**
 * /platform/wellness — Daily Wellness Check-in
 * Log mood, energy, stress, focus. View streak. Get AI insight.
 * VeritasIQ Technologies Ltd · PIOS
 */
import { useState, useEffect } from 'react'

interface WellnessSession {
  mood_score:    number
  energy_score?: number
  stress_score?: number
  focus_score?:  number
  notes?:        string
  ai_insight?:   string
  session_date:  string
}

interface Streak {
  current_streak:     number
  longest_streak:     number
  last_activity_date: string
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Very low', 2: 'Low', 3: 'Below average', 4: 'Slightly low',
  5: 'Neutral', 6: 'Slightly good', 7: 'Good', 8: 'Very good',
  9: 'Excellent', 10: 'Peak',
}

function scoreColor(n: number): string {
  if (n >= 8) return '#1D9E75'
  if (n >= 6) return '#10d9a0'
  if (n >= 4) return '#f0a030'
  return '#e05272'
}

function ScoreSlider({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (n: number) => void; color: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-sub)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(value) }}>
          {value}/10 — {SCORE_LABELS[value]}
        </span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: scoreColor(value), height: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>1 — Low</span>
        <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>10 — Peak</span>
      </div>
    </div>
  )
}

export default function WellnessPage() {
  const [today, setToday]           = useState<WellnessSession | null>(null)
  const [streak, setStreak]         = useState<Streak | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  const [mood,    setMood]    = useState(7)
  const [energy,  setEnergy]  = useState(7)
  const [stress,  setStress]  = useState(5)
  const [focus,   setFocus]   = useState(7)
  const [notes,   setNotes]   = useState('')

  useEffect(() => {
    fetch('/api/wellness/checkin')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.today) {
          setToday(d.today)
          setMood(d.today.mood_score ?? 7)
          setEnergy(d.today.energy_score ?? 7)
          setStress(d.today.stress_score ?? 5)
          setFocus(d.today.focus_score ?? 7)
          setNotes(d.today.notes ?? '')
          setSaved(true)
        }
        setStreak(d?.streak ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function submit() {
    setSaving(true)
    try {
      const r = await fetch('/api/wellness/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mood_score:      mood,
          energy_score:    energy,
          stress_score:    stress,
          focus_score:     focus,
          notes:           notes || undefined,
          generate_insight: true,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setToday(d.session)
        setStreak(d.streak)
        setSaved(true)
      }
    } finally {
      setSaving(false) }
  }

  const overallScore = Math.round((mood + energy + (10 - stress) + focus) / 4)

  if (loading) return (
    <div style={{ maxWidth: 600 }}>
      <div className="pios-skeleton" style={{ height: 120, borderRadius: 10, marginBottom: 16 }} />
      <div className="pios-skeleton" style={{ height: 280, borderRadius: 10 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="pios-page-header">
        <h1 className="pios-page-title">Daily Wellness Check-in</h1>
        <p className="pios-page-sub">Track your energy, mood, and focus. NemoClaw™ factors this into your morning brief.</p>
      </div>

      {/* Streak */}
      {streak && (
        <div className="pios-card-sm" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 28 }}>🔥</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f0a030', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
              {streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>
              Current streak · Best: {streak.longest_streak} days
            </div>
          </div>
          {saved && (
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#1D9E75', padding: '4px 10px', borderRadius: 5, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)' }}>
              ✓ Logged today
            </div>
          )}
        </div>
      )}

      {/* Check-in form */}
      <div className="pios-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {saved ? 'Today\'s check-in' : 'How are you today?'}
          </h2>
          <div style={{
            fontSize: 18, fontWeight: 800, color: scoreColor(overallScore),
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {overallScore}/10
          </div>
        </div>

        <ScoreSlider label="Mood"    value={mood}   onChange={setMood}   color={scoreColor(mood)} />
        <ScoreSlider label="Energy"  value={energy} onChange={setEnergy} color={scoreColor(energy)} />
        <ScoreSlider label="Stress"  value={stress} onChange={setStress} color={scoreColor(10 - stress)} />
        <ScoreSlider label="Focus"   value={focus}  onChange={setFocus}  color={scoreColor(focus)} />

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Notes (optional)
          </label>
          <textarea
            className="pios-input pios-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything affecting your day — meetings, deadlines, wins..."
            rows={2}
          />
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="pios-btn pios-btn-primary"
          style={{ width: '100%' }}
        >
          {saving ? '◎ Saving...' : saved ? '↻ Update check-in' : '✓ Log check-in'}
        </button>
      </div>

      {/* AI insight */}
      {today?.ai_insight && (
        <div style={{
          marginTop: 16, padding: '16px 20px', borderRadius: 10,
          background: 'rgba(139,124,248,0.06)',
          border: '1px solid rgba(139,124,248,0.2)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            ✦ NemoClaw™ insight
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.7 }}>
            {today.ai_insight}
          </p>
        </div>
      )}
    </div>
  )
}
