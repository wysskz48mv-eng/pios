'use client'
/**
 * /platform/coaching — NemoClaw™ Coaching Hub
 *
 * Five coaching modes:
 *   daily_reflection  — morning check-in, draws from yesterday's activity
 *   situation_prep    — before a high-stakes event
 *   role_play         — practice with a simulated stakeholder
 *   debrief           — post-event processing
 *   deep              — structured 30-45min deep session
 *
 * Every session is context-aware:
 *   - Current OKRs + progress
 *   - Open decisions
 *   - Upcoming/recent calendar events
 *   - Stakeholder dynamics
 *   - Coaching history and patterns
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/* ── Types ──────────────────────────────────────────────────── */
type CoachMode = 'daily_reflection' | 'situation_prep' | 'role_play' | 'debrief' | 'deep'
interface Message { role: 'user' | 'coach'; content: string; ts: string }
interface CoachingGoal { id: string; title: string; goal_type: string; status: string }
interface CoachingSession {
  id: string; mode: CoachMode; title: string; session_date: string
  summary?: string; themes?: string[]; user_rating?: number; duration_minutes?: number
}
interface CoachingProfile {
  strengths?: {theme:string;evidence:string}[]
  recurring_themes?: {theme:string;count:number}[]
  growth_edges?: {area:string;progress:string}[]
  session_count?: number
}

/* ── Mode config ────────────────────────────────────────────── */
const MODES: { key: CoachMode; label: string; icon: string; desc: string; duration: string }[] = [
  { key: 'daily_reflection', label: 'Daily reflection',  icon: '◎', desc: 'Review yesterday, set today\'s intention', duration: '5–10 min' },
  { key: 'situation_prep',   label: 'Situation prep',    icon: '◈', desc: 'Prepare for a high-stakes event or conversation', duration: '10–15 min' },
  { key: 'role_play',        label: 'Role-play',         icon: '◉', desc: 'Practice with a simulated stakeholder', duration: '10–20 min' },
  { key: 'debrief',          label: 'Debrief',           icon: '◇', desc: 'Process what happened after an event', duration: '5–10 min' },
  { key: 'deep',             label: 'Deep coaching',     icon: '⊡', desc: 'Structured exploration of a leadership theme', duration: '30–45 min' },
]

const GOAL_TYPES = [
  'Leadership presence', 'Communication', 'Decision-making', 'Resilience',
  'Strategic thinking', 'Relationships', 'Wellbeing', 'Academic development', 'Career development',
]

/* ── Main page ───────────────────────────────────────────────── */
export default function CoachingPage() {
  const [view, setView]                 = useState<'hub' | 'session' | 'goals' | 'profile'>('hub')
  const [activeMode, setActiveMode]     = useState<CoachMode | null>(null)
  const [sessionId, setSessionId]       = useState<string | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [sessionDone, setSessionDone]   = useState(false)
  const [rating, setRating]             = useState(0)
  const [goals, setGoals]               = useState<CoachingGoal[]>([])
  const [sessions, setSessions]         = useState<CoachingSession[]>([])
  const [profile, setProfile]           = useState<CoachingProfile | null>(null)
  const [loading, setLoading]           = useState(true)
  const [newGoalType, setNewGoalType]   = useState('')
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [rolePlayContext, setRolePlayContext] = useState('')
  const [situationContext, setSituationContext] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [goalsRes, sessionsRes, profileRes] = await Promise.allSettled([
        fetch('/api/coaching/goals').then(r => r.ok ? r.json() : {goals:[]}),
        fetch('/api/coaching/sessions?limit=10').then(r => r.ok ? r.json() : {sessions:[]}),
        fetch('/api/coaching/profile').then(r => r.ok ? r.json() : {profile:null}),
      ])
      if (goalsRes.status    === 'fulfilled') setGoals(goalsRes.value.goals ?? [])
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value.sessions ?? [])
      if (profileRes.status  === 'fulfilled') setProfile(profileRes.value.profile ?? null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  /* ── Start session ── */
  const startSession = async (mode: CoachMode) => {
    setActiveMode(mode)
    setSending(true)
    setMessages([])
    setSessionDone(false)
    setView('session')
    try {
      const res = await fetch('/api/coaching/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          action: 'start',
          context: mode === 'role_play' ? rolePlayContext : mode === 'situation_prep' ? situationContext : undefined,
        }),
      })
      const data = await res.json()
      setSessionId(data.session_id)
      setMessages([{ role: 'coach', content: data.message, ts: new Date().toISOString() }])
    } finally { setSending(false) }
  }

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!input.trim() || sending || !sessionId) return
    const userMsg: Message = { role: 'user', content: input, ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/coaching/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'message', message: input }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'coach', content: data.message, ts: new Date().toISOString() }])
      if (data.session_complete) setSessionDone(true)
    } finally { setSending(false) }
  }

  /* ── End session ── */
  const endSession = async () => {
    if (!sessionId) return
    await fetch('/api/coaching/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, action: 'end', rating }),
    })
    setView('hub')
    setActiveMode(null)
    setSessionId(null)
    load()
  }

  /* ── Add goal ── */
  const addGoal = async () => {
    if (!newGoalTitle.trim()) return
    await fetch('/api/coaching/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newGoalTitle, goal_type: newGoalType }),
    })
    setNewGoalTitle(''); setNewGoalType('')
    load()
  }

  /* ── Styles ── */
  const card = { background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: 20 }

  /* ══════════════════════ HUB VIEW ══════════════════════════ */
  if (view === 'hub') return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>NemoClaw™ Coaching</h1>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: 0 }}>
            Context-aware coaching drawn from your actual work — OKRs, decisions, stakeholders.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['hub','goals','profile'].map(v => (
            <button key={v} onClick={() => setView(v as typeof view)}
              style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--pios-border)', background: view === v ? 'var(--ai)' : 'transparent', color: view === v ? '#fff' : 'var(--pios-muted)', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
              {v === 'hub' ? 'Sessions' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {MODES.map(m => (
          <div key={m.key}
            style={{ ...card, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => {
              if (m.key === 'role_play') { const c = prompt('Who should NemoClaw™ simulate? (e.g. "sceptical FM director", "DBA supervisor", "AECOM client")'); if (c) { setRolePlayContext(c); startSession(m.key) } }
              else if (m.key === 'situation_prep') { const c = prompt('What situation are you preparing for?'); if (c) { setSituationContext(c); startSession(m.key) } }
              else startSession(m.key)
            }}>
            <div style={{ fontSize: 22, color: 'var(--ai)', marginBottom: 10 }}>{m.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.5, marginBottom: 8 }}>{m.desc}</div>
            <div style={{ fontSize: 10, color: 'var(--pios-dim)', fontWeight: 500 }}>{m.duration}</div>
          </div>
        ))}
      </div>

      {/* Profile summary strip */}
      {profile && profile.session_count && profile.session_count > 0 && (
        <div style={{ ...card, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Sessions</div>
            <div style={{ fontSize: 22, fontWeight: 400, color: 'var(--ai)', letterSpacing: '-0.03em' }}>{profile.session_count}</div>
          </div>
          {profile.strengths && profile.strengths.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Top strength</div>
              <div style={{ fontSize: 13, color: 'var(--fm)' }}>{profile.strengths[0].theme}</div>
            </div>
          )}
          {profile.recurring_themes && profile.recurring_themes.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pios-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Active theme</div>
              <div style={{ fontSize: 13, color: 'var(--pios-text)' }}>{profile.recurring_themes[0].theme}</div>
            </div>
          )}
        </div>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 14 }}>Recent sessions</div>
          {sessions.slice(0, 5).map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--pios-border)' }}>
              <div style={{ fontSize: 16, color: 'var(--ai)', width: 24 }}>
                {MODES.find(m => m.key === s.mode)?.icon ?? '○'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{s.title ?? MODES.find(m=>m.key===s.mode)?.label}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>
                  {new Date(s.session_date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                  {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                  {s.themes?.length ? ` · ${s.themes.slice(0,2).join(', ')}` : ''}
                </div>
              </div>
              {s.user_rating && (
                <div style={{ fontSize: 12, color: 'var(--fm)' }}>{'★'.repeat(s.user_rating)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  /* ══════════════════════ SESSION VIEW ═══════════════════════ */
  if (view === 'session') {
    const modeConfig = MODES.find(m => m.key === activeMode)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>

        {/* Session header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: 'var(--ai)' }}>{modeConfig?.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{modeConfig?.label}</div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>NemoClaw™ · Context-aware coaching</div>
            </div>
          </div>
          <button onClick={() => { setView('hub'); setActiveMode(null); setSessionId(null) }}
            style={{ fontSize: 12, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'var(--ai)' : 'var(--pios-card)',
                border: msg.role === 'coach' ? '1px solid var(--pios-border)' : 'none',
                color: msg.role === 'user' ? '#fff' : 'var(--pios-text)',
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', gap: 4, padding: '12px 0' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)', animation: `pulse 1.2s ${i*0.2}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Rating + end (when session complete) */}
        {sessionDone && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--pios-border)', background: 'var(--pios-card)', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 10 }}>How was this session?</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: rating >= n ? '#f5a623' : 'var(--pios-border)' }}>
                  ★
                </button>
              ))}
            </div>
            <button onClick={endSession}
              style={{ width: '100%', padding: '10px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Save session →
            </button>
          </div>
        )}

        {/* Input */}
        {!sessionDone && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
            <textarea
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, lineHeight: 1.5, resize: 'none', minHeight: 44, maxHeight: 120 }}
              placeholder="Share your thoughts..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              rows={2}
            />
            <button onClick={sendMessage} disabled={sending || !input.trim()}
              style={{ padding: '10px 16px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: sending ? 'wait' : 'pointer', opacity: (sending || !input.trim()) ? 0.5 : 1, alignSelf: 'flex-end' }}>
              →
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ══════════════════════ GOALS VIEW ═════════════════════════ */
  if (view === 'goals') return (
    <div style={{ padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: 0, letterSpacing: '-0.02em' }}>Coaching goals</h1>
        <button onClick={() => setView('hub')} style={{ fontSize: 12, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Personal development goals — separate from your business OKRs. NemoClaw™ tracks evidence of progress across sessions.
      </p>

      {/* Add goal */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 12 }}>New coaching goal</div>
        <select style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, marginBottom: 10 }}
          value={newGoalType} onChange={e => setNewGoalType(e.target.value)}>
          <option value=''>Select goal type...</option>
          {GOAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
          placeholder="e.g. Deliver feedback more directly in board settings"
          value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)} />
        <button onClick={addGoal} style={{ width: '100%', padding: '9px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Add goal
        </button>
      </div>

      {/* Goals list */}
      <div style={card}>
        {goals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--pios-dim)', fontSize: 13 }}>
            No coaching goals yet. NemoClaw™ will also suggest goals based on patterns in your sessions.
          </div>
        ) : goals.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--pios-border)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.status === 'achieved' ? 'var(--fm)' : 'var(--ai)', marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{g.title}</div>
              <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{g.goal_type}</div>
            </div>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: g.status === 'achieved' ? 'rgba(16,217,160,0.1)' : 'rgba(139,124,248,0.1)', color: g.status === 'achieved' ? 'var(--fm)' : 'var(--ai)', fontWeight: 700, textTransform: 'uppercase' }}>
              {g.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  /* ══════════════════════ PROFILE VIEW ══════════════════════ */
  if (view === 'profile') return (
    <div style={{ padding: '28px 32px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: 0, letterSpacing: '-0.02em' }}>Coaching profile</h1>
        <button onClick={() => setView('hub')} style={{ fontSize: 12, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>

      {!profile || !profile.session_count ? (
        <div style={{ ...card, textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 8 }}>Profile builds after 5 sessions</div>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>Complete more coaching sessions and NemoClaw™ will identify your patterns, strengths, and growth edges.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 20 }}>
            Based on {profile.session_count} coaching sessions · Updated after every 5 sessions
          </div>

          {profile.strengths && profile.strengths.length > 0 && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>✓ Identified strengths</div>
              {profile.strengths.map((s, i) => (
                <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--pios-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 3 }}>{s.theme}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{s.evidence}</div>
                </div>
              ))}
            </div>
          )}

          {profile.recurring_themes && profile.recurring_themes.length > 0 && (
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--academic)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>↻ Recurring themes</div>
              {profile.recurring_themes.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--pios-text)' }}>{t.theme}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>×{t.count} sessions</div>
                </div>
              ))}
            </div>
          )}

          {profile.growth_edges && profile.growth_edges.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>→ Growth edges</div>
              {profile.growth_edges.map((g, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 3 }}>{g.area}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>{g.progress}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  return null
}
