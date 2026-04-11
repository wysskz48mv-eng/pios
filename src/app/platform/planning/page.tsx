'use client'
import { useState, useEffect, useCallback } from 'react'

/**
 * /platform/planning — Personal Strategic Planning
 * Vision cascade, life domains, goals, habits, experiments, reflections
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */

interface Vision { horizon: string; title: string; description: string }
interface Domain { id: string; domain_name: string; current_rating: number; target_rating: number; color_hex: string; sort_order: number }
interface Goal { id: string; goal_text: string; horizon: string; status: string; progress_percent: number; domain_id?: string }
interface Habit { id: string; habit_name: string; action_type: string; frequency: string; is_keystone: boolean; current_streak: number; best_streak: number; habit_logs?: { log_date: string; completed: boolean }[] }
interface Sprint { id: string; hypothesis: string; small_action: string; start_date: string; end_date: string; status: string; results?: string }

const HORIZONS = [
  { key: '10-year', label: '10-Year Vision', desc: 'Direction of travel: Who will you become?', color: '#6349FF' },
  { key: '5-year', label: '5-Year Milestones', desc: 'Major waypoints: What must be true?', color: '#4f8ef7' },
  { key: '1-year', label: '1-Year Focus', desc: 'Priorities this season: What matters most?', color: '#10b981' },
  { key: '90-day', label: '90-Day Plan', desc: "What you'll actually do: Next quarter actions", color: '#22c55e' },
]

const DEFAULT_DOMAINS = [
  { domain_name: 'Health & Energy', color_hex: '#ef4444' },
  { domain_name: 'Work & Career', color_hex: '#3b82f6' },
  { domain_name: 'Relationships', color_hex: '#ec4899' },
  { domain_name: 'Financial Health', color_hex: '#eab308' },
  { domain_name: 'Personal Growth', color_hex: '#8b5cf6' },
  { domain_name: 'Joy & Recreation', color_hex: '#f97316' },
]

export default function PlanningPage() {
  const [tab, setTab] = useState<'vision' | 'domains' | 'goals' | 'habits' | 'sprints' | 'review'>('vision')
  const [visions, setVisions] = useState<Record<string, Vision>>({})
  const [domains, setDomains] = useState<Domain[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard' }) })
      const d = await res.json()
      const vMap: Record<string, Vision> = {}
      ;(d.visions ?? []).forEach((v: Vision) => { vMap[v.horizon] = v })
      setVisions(vMap)
      setDomains(d.domains ?? [])
      setGoals(d.goals ?? [])
      setHabits(d.habits ?? [])
      setSprints(d.sprints ?? [])
    } catch (err) { console.error('[PIOS planning]', err) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveVision = async (horizon: string, description: string) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', type: 'visions', horizon, description, title: horizon }) })
    setVisions(prev => ({ ...prev, [horizon]: { horizon, title: horizon, description } }))
  }

  const saveDomain = async (domain: Partial<Domain> & { domain_name: string }) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', type: 'domains', ...domain, current_rating: domain.current_rating ?? 5, target_rating: domain.target_rating ?? 8 }) })
    await load()
  }

  const updateDomainRating = async (id: string, field: string, value: number) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', type: 'domains', id, [field]: value }) })
    setDomains(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  const createGoal = async (goal_text: string, horizon: string) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', type: 'goals', goal_text, horizon }) })
    await load()
  }

  const createHabit = async (habit_name: string, action_type: string, frequency: string) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', type: 'habits', habit_name, action_type, frequency }) })
    await load()
  }

  const logHabit = async (habitId: string) => {
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_habit', type: 'habits', id: habitId, completed: true }) })
    await load()
  }

  const createSprint = async (hypothesis: string, small_action: string, days: number, learning_question: string) => {
    const start = new Date().toISOString().slice(0, 10)
    const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', type: 'sprints', hypothesis, small_action, start_date: start, end_date: end, learning_question, status: 'running' }) })
    await load()
  }

  const TABS = [
    { key: 'vision', label: 'Vision', icon: '📌' },
    { key: 'domains', label: 'Life Assessment', icon: '📊' },
    { key: 'goals', label: 'Goals', icon: '🎯' },
    { key: 'habits', label: 'Habits', icon: '✅' },
    { key: 'sprints', label: 'Quick Tests', icon: '🧪' },
    { key: 'review', label: 'Review', icon: '🔍' },
  ] as const

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 4px' }}>Strategic Planning</h1>
      <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 20 }}>Plan your life in phases: Vision → Assessment → Goals → Execution → Review</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--ai)' : 'var(--pios-surface2)', color: tab === t.key ? '#fff' : 'var(--pios-muted)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--pios-muted)' }}>Loading...</div>}

      {/* ── VISION CASCADE ── */}
      {!loading && tab === 'vision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {HORIZONS.map((h, i) => (
            <div key={h.key}>
              <div style={{ padding: '20px', background: 'var(--pios-surface)', border: `1px solid ${visions[h.key]?.description ? h.color + '40' : 'var(--pios-border)'}`, borderRadius: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: h.color, marginBottom: 4 }}>{h.label}</div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 12 }}>{h.desc}</div>
                <textarea
                  defaultValue={visions[h.key]?.description ?? ''}
                  onBlur={e => { if (e.target.value !== (visions[h.key]?.description ?? '')) saveVision(h.key, e.target.value) }}
                  placeholder={`Write your ${h.label.toLowerCase()}...`}
                  style={{ width: '100%', minHeight: 80, padding: 12, background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {i < HORIZONS.length - 1 && <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--pios-dim)' }}>↓</div>}
            </div>
          ))}
          <div style={{ padding: 12, background: 'rgba(99,73,255,0.04)', borderRadius: 8, border: '1px solid rgba(99,73,255,0.1)', fontSize: 12, color: 'var(--pios-muted)' }}>
            Each horizon informs the next. Your 10-year vision shapes your 5-year milestones, which define your 1-year focus, which breaks into 90-day actions.
          </div>
        </div>
      )}

      {/* ── LIFE DOMAINS ── */}
      {!loading && tab === 'domains' && (
        <div>
          {domains.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--pios-dim)' }}>
              <div style={{ marginBottom: 12, fontSize: 13 }}>No domains yet. Add your life areas or use defaults:</div>
              <button onClick={() => DEFAULT_DOMAINS.forEach(d => saveDomain(d))}
                style={{ padding: '8px 20px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Add Default Domains
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {domains.map(d => (
              <div key={d.id} style={{ padding: '16px 20px', background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{d.domain_name}</span>
                  <span style={{ fontSize: 11, color: (d.target_rating - d.current_rating) > 2 ? '#ef4444' : 'var(--pios-muted)' }}>
                    Gap: {d.target_rating - d.current_rating} points
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Current: {d.current_rating}/10</div>
                    <input type="range" min={1} max={10} value={d.current_rating}
                      onChange={e => updateDomainRating(d.id, 'current_rating', parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: d.color_hex || 'var(--ai)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Target: {d.target_rating}/10</div>
                    <input type="range" min={1} max={10} value={d.target_rating}
                      onChange={e => updateDomainRating(d.id, 'target_rating', parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#22c55e' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GOALS ── */}
      {!loading && tab === 'goals' && (
        <div>
          <GoalForm onSubmit={createGoal} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {goals.map(g => (
              <div key={g.id} style={{ padding: '12px 16px', background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{g.goal_text}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>{g.horizon} · {g.status}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ai)' }}>{g.progress_percent}%</div>
              </div>
            ))}
            {goals.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--pios-dim)', fontSize: 13 }}>No goals yet. Add one above.</div>}
          </div>
        </div>
      )}

      {/* ── HABITS ── */}
      {!loading && tab === 'habits' && (
        <div>
          <HabitForm onSubmit={createHabit} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {habits.map(h => {
              const todayLogged = h.habit_logs?.some((l: any) => l.log_date === new Date().toISOString().slice(0, 10) && l.completed)
              return (
                <div key={h.id} style={{ padding: '14px 16px', background: todayLogged ? 'rgba(34,197,94,0.04)' : 'var(--pios-surface)', border: `1px solid ${todayLogged ? 'rgba(34,197,94,0.2)' : 'var(--pios-border)'}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>
                      {h.is_keystone && '⭐ '}{h.habit_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                      {h.frequency} · Streak: {h.current_streak} days {h.current_streak >= 7 ? '🔥' : ''}
                    </div>
                  </div>
                  <button onClick={() => logHabit(h.id)} disabled={todayLogged}
                    style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: 'none', cursor: todayLogged ? 'default' : 'pointer',
                      background: todayLogged ? '#22c55e' : 'var(--ai)', color: '#fff', opacity: todayLogged ? 0.7 : 1 }}>
                    {todayLogged ? '✓ Done' : 'Log'}
                  </button>
                </div>
              )
            })}
            {habits.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--pios-dim)', fontSize: 13 }}>No habits yet. Add one above.</div>}
          </div>
        </div>
      )}

      {/* ── QUICK TESTS ── */}
      {!loading && tab === 'sprints' && (
        <div>
          <SprintForm onSubmit={createSprint} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {sprints.map(s => {
              const daysLeft = Math.max(0, Math.ceil((new Date(s.end_date).getTime() - Date.now()) / 86400000))
              return (
                <div key={s.id} style={{ padding: '14px 16px', background: 'var(--pios-surface)', border: '1px solid var(--pios-border)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>{s.hypothesis}</div>
                  <div style={{ fontSize: 12, color: 'var(--pios-sub)', marginBottom: 4 }}>Action: {s.small_action}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>
                    {s.status} · {daysLeft > 0 ? `${daysLeft} days left` : 'Completed'} · {s.start_date} → {s.end_date}
                  </div>
                </div>
              )
            })}
            {sprints.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--pios-dim)', fontSize: 13 }}>No experiments yet. Design one above.</div>}
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {!loading && tab === 'review' && (
        <div style={{ padding: 20, background: 'var(--pios-surface)', borderRadius: 10, border: '1px solid var(--pios-border)' }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 12 }}>Quarterly Review Summary</div>
          <div style={{ fontSize: 13, color: 'var(--pios-sub)', lineHeight: 1.6 }}>
            <p><strong>Visions set:</strong> {Object.keys(visions).length}/4</p>
            <p><strong>Domains tracked:</strong> {domains.length} (avg rating: {domains.length ? (domains.reduce((s, d) => s + d.current_rating, 0) / domains.length).toFixed(1) : '—'}/10)</p>
            <p><strong>Active goals:</strong> {goals.filter(g => g.status === 'active').length}</p>
            <p><strong>Habits:</strong> {habits.length} ({habits.filter(h => h.is_keystone).length} keystone)</p>
            <p><strong>Active experiments:</strong> {sprints.filter(s => s.status === 'running').length}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function GoalForm({ onSubmit }: { onSubmit: (text: string, horizon: string) => void }) {
  const [text, setText] = useState('')
  const [horizon, setHorizon] = useState('90-day')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Enter a goal..."
        style={{ flex: 1, padding: '8px 12px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, outline: 'none' }} />
      <select value={horizon} onChange={e => setHorizon(e.target.value)}
        style={{ padding: '8px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 12 }}>
        {HORIZONS.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
      </select>
      <button onClick={() => { if (text.trim()) { onSubmit(text, horizon); setText('') } }}
        style={{ padding: '8px 16px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: 'pointer' }}>Add</button>
    </div>
  )
}

function HabitForm({ onSubmit }: { onSubmit: (name: string, type: string, freq: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('start')
  const [freq, setFreq] = useState('daily')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Habit name..."
        style={{ flex: 1, padding: '8px 12px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, outline: 'none' }} />
      <select value={type} onChange={e => setType(e.target.value)}
        style={{ padding: '8px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 12 }}>
        <option value="start">Start</option><option value="stop">Stop</option><option value="shape">Shape</option>
      </select>
      <select value={freq} onChange={e => setFreq(e.target.value)}
        style={{ padding: '8px', background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 12 }}>
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="3x/week">3x/week</option>
      </select>
      <button onClick={() => { if (name.trim()) { onSubmit(name, type, freq); setName('') } }}
        style={{ padding: '8px 16px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: 'pointer' }}>Add</button>
    </div>
  )
}

function SprintForm({ onSubmit }: { onSubmit: (hyp: string, action: string, days: number, question: string) => void }) {
  const [hyp, setHyp] = useState('')
  const [action, setAction] = useState('')
  const [days, setDays] = useState(14)
  const [question, setQuestion] = useState('')
  const [open, setOpen] = useState(false)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ padding: '10px 20px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, cursor: 'pointer', width: '100%' }}>
      Design a Quick Test
    </button>
  )

  return (
    <div style={{ padding: 20, background: 'var(--pios-surface)', border: '1px solid rgba(99,73,255,0.2)', borderRadius: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 16 }}>Design a Quick Test</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Hypothesis: "If I ___, then ___"</div>
          <textarea value={hyp} onChange={e => setHyp(e.target.value)} placeholder="If I exercise 30min daily, then I will have more energy..."
            style={{ width: '100%', minHeight: 60, padding: 10, background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Small action (be specific)</div>
          <textarea value={action} onChange={e => setAction(e.target.value)} placeholder="Every weekday at 6:30am, 15 min yoga..."
            style={{ width: '100%', minHeight: 60, padding: 10, background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>Duration: {days} days</div>
          <input type="range" min={7} max={90} value={days} onChange={e => setDays(parseInt(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 4 }}>What will you measure?</div>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Rate 1-10 energy at 3pm each day..."
            style={{ width: '100%', minHeight: 60, padding: 10, background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-text)', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { if (hyp && action) { onSubmit(hyp, action, days, question); setOpen(false); setHyp(''); setAction(''); setQuestion('') } }}
            disabled={!hyp.trim() || !action.trim()}
            style={{ flex: 1, padding: '10px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !hyp.trim() || !action.trim() ? 0.5 : 1 }}>
            Launch Test
          </button>
          <button onClick={() => setOpen(false)}
            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
