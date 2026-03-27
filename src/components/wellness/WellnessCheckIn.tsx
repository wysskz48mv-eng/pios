'use client'
import { useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// WellnessCheckIn — Wellness Phase 1
// NemoClaw-powered daily check-in with mood/energy/stress/focus scoring,
// purpose anchors, streaks, and AI insight
//  PIOS v3.0 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

type SessionType = 'morning_checkin' | 'evening_review' | 'crisis_support' | 'energy_audit' | 'focus_block' | 'recovery'
type Domain      = 'academic' | 'fm_consulting' | 'saas' | 'business' | 'personal' | 'health'

interface WellnessSession {
  id: string
  session_date: string
  session_type: SessionType
  mood_score?: number
  energy_score?: number
  stress_score?: number
  focus_score?: number
  dominant_domain?: Domain
  notes?: string
  ai_insight?: string
  ai_recommended_actions?: { action: string; priority: string; timeframe: string }[]
  created_at: string
}

interface WellnessStreak {
  streak_type: string
  current_streak: number
  longest_streak: number
  last_activity_date?: string
}

interface PurposeAnchor {
  id: string
  anchor_text: string
  anchor_type: string
  domain?: string
  is_primary: boolean
}

const SESSION_TYPES: { key: SessionType; label: string; icon: string; desc: string }[] = [
  { key: 'morning_checkin', label: 'Morning',      icon: '🌅', desc: 'Start the day with intention' },
  { key: 'evening_review',  label: 'Evening',      icon: '🌙', desc: 'Reflect and wind down'       },
  { key: 'energy_audit',    label: 'Energy Audit', icon: '⚡', desc: 'Mid-day energy check'         },
  { key: 'focus_block',     label: 'Focus Block',  icon: '🎯', desc: 'Pre-deep work check-in'       },
  { key: 'crisis_support',  label: 'Support',      icon: '🛡',  desc: 'Stress management support'   },
  { key: 'recovery',        label: 'Recovery',     icon: '🔄', desc: 'After high-stress period'     },
]

const DOMAINS: { key: Domain; label: string }[] = [
  { key: 'academic',      label: 'Academic'       },
  { key: 'fm_consulting', label: 'FM Consulting'  },
  { key: 'saas',          label: 'SaaS'           },
  { key: 'business',      label: 'Business'       },
  { key: 'personal',      label: 'Personal'       },
  { key: 'health',        label: 'Health'         },
]

function ScoreSlider({ label, value, onChange, color, icon }: {
  label: string; value: number; onChange: (v: number) => void; color: string; icon: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{icon}</span>{label}
        </span>
        <span style={{
          fontSize: 14, fontWeight: 800, color,
          background: color + '18', border: `1px solid ${color}30`,
          padding: '1px 8px', borderRadius: 8, minWidth: 32, textAlign: 'center',
        }}>{value}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'var(--pios-surface3)', borderRadius: 3 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${(value - 1) / 9 * 100}%`,
          background: color, borderRadius: 3, transition: 'width 0.15s',
        }} />
        <input
          type="range" min={1} max={10} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: 'var(--pios-dim)' }}>Low</span>
        <span style={{ fontSize: 9, color: 'var(--pios-dim)' }}>High</span>
      </div>
    </div>
  )
}

function StreakBadge({ streak }: { streak: WellnessStreak }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
      borderRadius: 10,
    }}>
      <span style={{ fontSize: 18 }}>🔥</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: streak.current_streak >= 7 ? '#f97316' : 'var(--pios-text)', lineHeight: 1 }}>
          {streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>
          Best: {streak.longest_streak}
        </div>
      </div>
    </div>
  )
}

export default function WellnessCheckIn() {
  // State
  const [view,          setView]          = useState<'dashboard' | 'checkin' | 'anchors'>('dashboard')
  const [sessions,      setSessions]      = useState<WellnessSession[]>([])
  const [streaks,       setStreaks]       = useState<WellnessStreak[]>([])
  const [anchors,       setAnchors]       = useState<PurposeAnchor[]>([])
  const [loading,       setLoading]       = useState(true)
  const [submitting,    setSubmitting]    = useState(false)
  const [todayDone,     setTodayDone]     = useState(false)
  const [latestInsight, setLatestInsight] = useState<string | null>(null)
  const [latestActions, setLatestActions] = useState<{ action: string; priority: string; timeframe: string }[]>([])

  // Check-in form
  const [gdprConsent,   setGdprConsent]   = useState(false)
  const [sessionType,   setSessionType]   = useState<SessionType>('morning_checkin')
  const [mood,          setMood]          = useState(5)
  const [energy,        setEnergy]        = useState(5)
  const [stress,        setStress]        = useState(5)
  const [focus,         setFocus]         = useState(5)
  const [domain,        setDomain]        = useState<Domain>('business')
  const [notes,         setNotes]         = useState('')

  // Anchor form
  const [newAnchor,     setNewAnchor]     = useState('')
  const [anchorType,    setAnchorType]    = useState<string>('why')
  const [savingAnchor,  setSavingAnchor]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/wellness?view=30d')
      if (!r.ok) return
      const d = await r.json()
      setSessions(d.sessions ?? [])
      setStreaks(d.streaks ?? [])
      setAnchors(d.anchors ?? [])
      setTodayDone(d.stats?.todayDone ?? false)
      // Show last insight if today's session already done
      const today = d.sessions?.[0]
      if (today?.ai_insight) {
        setLatestInsight(today.ai_insight)
        setLatestActions(today.ai_recommended_actions ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function submitCheckIn() {
    if (!gdprConsent) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          session_type: sessionType,
          mood_score: mood, energy_score: energy,
          stress_score: stress, focus_score: focus,
          dominant_domain: domain,
          notes: notes.trim() || null,
          gdpr_consent: gdprConsent,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setLatestInsight(d.ai_insight ?? null)
        setLatestActions(d.ai_recommended_actions ?? [])
        setTodayDone(true)
        setView('dashboard')
        await load()
      }
    } catch { /* silent */ }
    finally { setSubmitting(false) }
  }

  async function saveAnchor() {
    if (!newAnchor.trim()) return
    setSavingAnchor(true)
    try {
      const r = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_anchor',
          anchor_text: newAnchor.trim(),
          anchor_type: anchorType,
          is_primary: anchors.length === 0,
        }),
      })
      if (r.ok) {
        setNewAnchor('')
        await load()
      }
    } catch { /* silent */ }
    finally { setSavingAnchor(false) }
  }

  // Derived stats
  const recent7 = sessions.slice(0, 7)
  const avgMood   = recent7.length ? (recent7.reduce((s, r) => s + (r.mood_score   ?? 5), 0) / recent7.length).toFixed(1) : '—'
  const avgEnergy = recent7.length ? (recent7.reduce((s, r) => s + (r.energy_score ?? 5), 0) / recent7.length).toFixed(1) : '—'
  const avgStress = recent7.length ? (recent7.reduce((s, r) => s + (r.stress_score ?? 5), 0) / recent7.length).toFixed(1) : '—'
  const checkinStreak = streaks.find(s => s.streak_type === 'daily_checkin')
  const primaryAnchor = anchors.find(a => a.is_primary) ?? anchors[0]

  const priorityColor = (p: string) => ({ high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }[p] ?? '#6b7280')

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="spin" style={{ fontSize: 20, color: 'var(--ai)' }}>⟳</div>
      </div>
    )
  }

  return (
    <div className="fade-up" style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Wellness Intelligence
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {todayDone && (
              <span style={{
                marginLeft: 10, padding: '2px 8px', borderRadius: 20, fontSize: 10,
                fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>✓ Checked in today</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setView('anchors')}
            style={{
              padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: view === 'anchors' ? 'rgba(155,135,245,0.15)' : 'var(--pios-surface2)',
              border: `1px solid ${view === 'anchors' ? 'rgba(155,135,245,0.35)' : 'var(--pios-border2)'}`,
              color: view === 'anchors' ? 'var(--ai)' : 'var(--pios-muted)',
            }}>
            ✦ Anchors
          </button>
          {!todayDone && (
            <button
              onClick={() => setView('checkin')}
              style={{
                padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: 'var(--ai)', color: '#08090c', border: 'none',
              }}>
              + Check In
            </button>
          )}
        </div>
      </div>

      {/* ── Dashboard view ── */}
      {view === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Avg Mood',   value: avgMood,   color: '#9b87f5', icon: '◉' },
              { label: 'Avg Energy', value: avgEnergy, color: '#22d3ee', icon: '⚡' },
              { label: 'Avg Stress', value: avgStress, color: '#f97316', icon: '⚠' },
              { label: 'Sessions',   value: sessions.length, color: '#22c55e', icon: '✓' },
            ].map(s => (
              <div key={s.label} className="pios-card-sm" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Streak + primary anchor */}
          <div style={{ display: 'grid', gridTemplateColumns: checkinStreak ? '1fr 1fr' : '1fr', gap: 10 }}>
            {checkinStreak && <StreakBadge streak={checkinStreak} />}
            {primaryAnchor && (
              <div style={{
                padding: '10px 14px', background: 'rgba(155,135,245,0.06)',
                border: '1px solid rgba(155,135,245,0.18)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Purpose Anchor
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.4 }}>
                    {primaryAnchor.anchor_text}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI insight */}
          {latestInsight && (
            <div style={{
              padding: '14px 16px', background: 'rgba(155,135,245,0.06)',
              border: '1px solid rgba(155,135,245,0.15)', borderRadius: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="ai-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)', display: 'inline-block' }} />
                NemoClaw Insight
              </div>
              <p style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.65, marginBottom: latestActions.length ? 10 : 0 }}>
                {latestInsight}
              </p>
              {latestActions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {latestActions.slice(0, 3).map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--pios-muted)' }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: priorityColor(a.priority),
                      }} />
                      {a.action}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--pios-dim)', whiteSpace: 'nowrap' }}>{a.timeframe}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div className="pios-card">
              <div className="pios-section-title" style={{ marginBottom: 12 }}>Recent Sessions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {sessions.slice(0, 7).map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                    borderBottom: '1px solid var(--pios-border)',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>
                      {SESSION_TYPES.find(t => t.key === s.session_type)?.icon ?? '●'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pios-text)' }}>
                        {SESSION_TYPES.find(t => t.key === s.session_type)?.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>
                        {new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { v: s.mood_score,   c: '#9b87f5', t: 'M' },
                        { v: s.energy_score, c: '#22d3ee', t: 'E' },
                        { v: s.stress_score, c: '#f97316', t: 'S' },
                      ].map(({ v, c, t }) => v != null && (
                        <span key={t} style={{
                          fontSize: 11, fontWeight: 700, color: c,
                          background: c + '18', border: `1px solid ${c}30`,
                          padding: '1px 6px', borderRadius: 6,
                        }}>{t}:{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!todayDone && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <p style={{ color: 'var(--pios-dim)', fontSize: 13, marginBottom: 14 }}>
                No check-in yet today. How are you doing?
              </p>
              <button
                onClick={() => setView('checkin')}
                style={{
                  padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'var(--ai)', color: '#08090c', border: 'none', cursor: 'pointer',
                }}>
                Start Check-In
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Check-in form ── */}
      {view === 'checkin' && (
        <div className="pios-card" style={{ maxWidth: 540 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Wellness Check-In</h2>
            <p style={{ fontSize: 12, color: 'var(--pios-muted)' }}>NemoClaw will generate a personalised insight based on your responses.</p>
          </div>

          {/* Session type */}
          <div style={{ marginBottom: 18 }}>
            <div className="pios-section-title">Session Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {SESSION_TYPES.map(t => (
                <button key={t.key} onClick={() => setSessionType(t.key)}
                  style={{
                    padding: '8px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: sessionType === t.key ? 'rgba(155,135,245,0.12)' : 'var(--pios-surface2)',
                    border: `1px solid ${sessionType === t.key ? 'rgba(155,135,245,0.35)' : 'var(--pios-border)'}`,
                    color: sessionType === t.key ? 'var(--ai)' : 'var(--pios-muted)',
                    fontSize: 11, fontWeight: sessionType === t.key ? 700 : 400,
                  }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <ScoreSlider label="Mood"   value={mood}   onChange={setMood}   color="#9b87f5" icon="◉" />
          <ScoreSlider label="Energy" value={energy} onChange={setEnergy} color="#22d3ee" icon="⚡" />
          <ScoreSlider label="Stress" value={stress} onChange={setStress} color="#f97316" icon="⚠" />
          <ScoreSlider label="Focus"  value={focus}  onChange={setFocus}  color="#22c55e" icon="🎯" />

          {/* Domain */}
          <div style={{ marginBottom: 16 }}>
            <div className="pios-section-title">Dominant Domain</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DOMAINS.map(d => (
                <button key={d.key} onClick={() => setDomain(d.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: domain === d.key ? 'rgba(155,135,245,0.12)' : 'transparent',
                    border: `1px solid ${domain === d.key ? 'rgba(155,135,245,0.35)' : 'var(--pios-border)'}`,
                    color: domain === d.key ? 'var(--ai)' : 'var(--pios-muted)',
                  }}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <div className="pios-section-title">Notes (optional)</div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What's on your mind? Any context for today..."
              rows={3}
              style={{
                width: '100%', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                borderRadius: 8, padding: '9px 12px', color: 'var(--pios-text)', fontSize: 13,
                resize: 'vertical', fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </div>

          {/* GDPR consent */}
          <div style={{
            padding: '12px 14px', background: 'rgba(155,135,245,0.04)',
            border: '1px solid rgba(155,135,245,0.12)', borderRadius: 8, marginBottom: 16,
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={gdprConsent} onChange={e => setGdprConsent(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--ai)', flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
                I consent to PIOS recording this wellness data under the UK GDPR journalism/research
                exemption (Art. 89). This data is stored privately, accessible only to me, and I can
                delete it at any time from Settings → Privacy.
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('dashboard')}
              style={{
                flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: '1px solid var(--pios-border2)',
                color: 'var(--pios-muted)', cursor: 'pointer',
              }}>
              Cancel
            </button>
            <button
              onClick={submitCheckIn}
              disabled={!gdprConsent || submitting}
              style={{
                flex: 2, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: !gdprConsent || submitting ? 'rgba(155,135,245,0.35)' : 'var(--ai)',
                border: 'none', color: '#08090c', cursor: !gdprConsent || submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
              {submitting ? (
                <><span className="spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span> Generating insight…</>
              ) : 'Submit & Get Insight →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Purpose anchors view ── */}
      {view === 'anchors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 540 }}>
          <div className="pios-card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Purpose Anchors</h2>
            <p style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Define what drives you. Anchors appear in your daily brief and are reflected back during
              low-energy or high-stress sessions.
            </p>

            {anchors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {anchors.map(a => (
                  <div key={a.id} style={{
                    padding: '10px 14px', background: 'var(--pios-surface2)',
                    border: `1px solid ${a.is_primary ? 'rgba(155,135,245,0.25)' : 'var(--pios-border)'}`,
                    borderRadius: 9, display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1, color: 'var(--ai)' }}>
                      {a.is_primary ? '✦' : '◆'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.5 }}>{a.anchor_text}</div>
                      <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginTop: 2, textTransform: 'capitalize' }}>
                        {a.anchor_type}{a.is_primary ? ' · Primary' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select
                value={anchorType} onChange={e => setAnchorType(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 8, fontSize: 12, flexShrink: 0,
                  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                  color: 'var(--pios-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                {['why','value','goal','mantra','legacy','commitment'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <input
                value={newAnchor} onChange={e => setNewAnchor(e.target.value)}
                placeholder="e.g. To build tools that outlast me..."
                onKeyDown={e => e.key === 'Enter' && saveAnchor()}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                  color: 'var(--pios-text)', fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              />
              <button
                onClick={saveAnchor} disabled={!newAnchor.trim() || savingAnchor}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: 'var(--ai)', color: '#08090c', border: 'none', flexShrink: 0,
                }}>
                {savingAnchor ? '…' : '+'}
              </button>
            </div>
          </div>

          <button onClick={() => setView('dashboard')}
            style={{
              padding: '9px', borderRadius: 9, fontSize: 12, fontWeight: 600,
              background: 'transparent', border: '1px solid var(--pios-border2)',
              color: 'var(--pios-muted)', cursor: 'pointer',
            }}>
            ← Back to dashboard
          </button>
        </div>
      )}
    </div>
  )
}
