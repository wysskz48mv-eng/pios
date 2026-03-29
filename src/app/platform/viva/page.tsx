// @ts-nocheck
'use client'
// PIOS™ v3.2.5 | Viva Preparation Module | VeritasIQ Technologies Ltd
import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode       = 'standard' | 'examiner' | 'stress'
type Stage      = 'idle' | 'question' | 'answering' | 'feedback' | 'followup'
type Category   = 'originality' | 'methodology' | 'literature' | 'findings' | 'limitations' | 'significance' | 'professional_doctorate' | 'technical' | 'all'
type ExaminerKey = 'ozlem_bak' | 'raja_sreedharan' | 'external'

interface SessionEntry {
  question: string
  category: string
  answer:   string
  feedback: string
  score:    number
  mode:     Mode
  ts:       string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MODES: { key: Mode; label: string; desc: string; colour: string }[] = [
  { key: 'standard',  label: 'Standard',  desc: 'Typical UK DBA viva — fair & rigorous',           colour: '#4f8ef7' },
  { key: 'examiner',  label: 'Examiner',  desc: 'Simulates your actual examiners',                  colour: '#9c6ef7' },
  { key: 'stress',    label: 'Stress',    desc: 'Adversarial — probes every weakness',              colour: '#ef4444' },
]

const EXAMINERS: { key: ExaminerKey; label: string; institution: string }[] = [
  { key: 'ozlem_bak',       label: 'Dr Ozlem Bak',       institution: 'Portsmouth CEGD' },
  { key: 'raja_sreedharan', label: 'Dr Raja Sreedharan',  institution: 'Portsmouth CEGD' },
  { key: 'external',        label: 'External examiner',   institution: 'TBC' },
]

const SA_INSTITUTIONS: { key: string; label: string; degree: string; hasViva: boolean }[] = [
  { key: 'uct',          label: 'UCT',          degree: 'PhD',      hasViva: true  },
  { key: 'gibs_up',      label: 'GIBS / UP',    degree: 'DBA/PhD',  hasViva: true  },
  { key: 'unisa',        label: 'UNISA',        degree: 'PhD',      hasViva: true  },
  { key: 'wits',         label: 'Wits',         degree: 'PhD/DBA',  hasViva: true  },
  { key: 'stellenbosch', label: 'Stellenbosch', degree: 'PhD',      hasViva: true  },
  { key: 'milpark',      label: 'Milpark',      degree: 'DBA',      hasViva: true  },
  { key: 'regent_mancosa',label: 'Regent/MANCOSA',degree: 'DBA',    hasViva: true  },
]

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'all',                  label: 'All topics',       icon: '⬛' },
  { key: 'originality',          label: 'Originality',      icon: '◆' },
  { key: 'methodology',          label: 'Methodology',      icon: '◈' },
  { key: 'literature',           label: 'Literature',       icon: '◉' },
  { key: 'findings',             label: 'Findings',         icon: '◎' },
  { key: 'limitations',          label: 'Limitations',      icon: '◇' },
  { key: 'significance',         label: 'So what?',         icon: '◑' },
  { key: 'professional_doctorate',label: 'DBA specific',    icon: '◐' },
  { key: 'technical',            label: 'Technical',        icon: '●' },
]

const TIPS = [
  'Aim to answer the core question in the first 60 seconds — then support with evidence.',
  'Acknowledge limitations proactively before examiners raise them.',
  'Use the structure: Claim → Evidence → Implication.',
  '"That is a good question" is a filler phrase. Pause instead — it signals confidence.',
  'For "so what?" questions: practitioner impact first, then theoretical contribution.',
  'Prepare a 90-second "original contribution" statement and rehearse it daily.',
  'Know your examiners\' published work — it tells you where they will probe.',
  'Portsmouth DBA viva follows the presentation — use it to pre-empt obvious questions.',
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function VivaPage() {
  const [mode,        setMode]        = useState<Mode>('standard')
  const [examiner,    setExaminer]    = useState<ExaminerKey>('ozlem_bak')
  const [category,    setCategory]    = useState<Category>('all')
  const [stage,       setStage]       = useState<Stage>('idle')
  const [question,    setQuestion]    = useState('')
  const [qCategory,   setQCategory]   = useState('')
  const [aiResponse,  setAiResponse]  = useState('')
  const [feedback,    setFeedback]    = useState('')
  const [followup,    setFollowup]    = useState('')
  const [answer,      setAnswer]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string|null>(null)
  const [session,     setSession]     = useState<SessionEntry[]>([])
  const [tipIdx,      setTipIdx]      = useState(0)
  const [examinerProfile, setExaminerProfile] = useState<string|null>(null)
  const [saInstitution,   setSaInstitution]   = useState<string>('uct')
  const [saProfile,       setSaProfile]       = useState<string|null>(null)
  const [saLoading,       setSaLoading]       = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [activeTab,   setActiveTab]   = useState<'session'|'profile'|'tips'>('session')

  const answerRef = useRef<HTMLTextAreaElement>(null)

  // Rotate tips
  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 8000)
    return () => clearInterval(t)
  }, [])

  // Load examiner profile
  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'profile', examiner }),
      })
      const d = await r.json()
      setExaminerProfile(d.profile ?? null)
    } catch { /* silent */ }
    setLoading(false)
  }, [examiner])

  const loadSAProfile = async (institutionKey: string) => {
    setSaLoading(true); setSaProfile(null)
    try {
      const r = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'profile', institutionKey }),
      })
      const d = await r.json()
      setSaProfile(d.profile ?? null)
    } catch { /* silent */ }
    setSaLoading(false)
  }

  useEffect(() => {
    if (mode === 'examiner') loadProfile()
  }, [mode, examiner, loadProfile])

  // Start a session — get first question
  async function startSession() {
    setLoading(true); setError(null); setAnswer('')
    setFeedback(''); setFollowup(''); setAiResponse('')
    try {
      const r = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          examiner: mode === 'examiner' ? examiner : undefined,
          category: category === 'all' ? undefined : category,
          thesisContext: 'DBA on AI-enabled FM cost forecasting and governance in GCC master communities. VeritasEdge™ platform as practitioner case study. Socio-technical systems theory + sensemaking. Portsmouth CEGD.',
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Failed'); setLoading(false); return }
      setQuestion(d.question)
      setQCategory(d.category)
      setAiResponse(d.response)
      setStage('answering')
      setTimeout(() => answerRef.current?.focus(), 100)
    } catch (e: any) { setError(e?.message ?? 'Network error') }
    setLoading(false)
  }

  // Submit answer — get feedback
  async function submitAnswer() {
    if (!answer.trim()) return
    setLoading(true); setFeedback(''); setFollowup('')
    try {
      const r = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'feedback',
          question, answer,
          examiner: mode === 'examiner' ? examiner : undefined,
          thesisContext: 'DBA on AI-enabled FM cost forecasting and governance in GCC master communities.',
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Failed'); setLoading(false); return }
      setFeedback(d.feedback)
      // Extract score
      const scoreMatch = d.feedback.match(/(\d)\s*(?:\/\s*5|\s*star)/i)
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 3
      // Get follow-up question
      const fu = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, examiner: mode === 'examiner' ? examiner : undefined, question, answer }),
      })
      const fud = await fu.json()
      setFollowup(fud.response ?? '')
      setStage('feedback')
      // Log to session
      setSession(prev => [...prev, {
        question, category: qCategory, answer,
        feedback: d.feedback, score, mode,
        ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }])
    } catch (e: any) { setError(e?.message ?? 'Network error') }
    setLoading(false)
  }

  // Next question
  function nextQuestion() {
    setAnswer(''); setFeedback(''); setFollowup(''); setAiResponse(''); setStage('idle')
  }

  const avgScore = session.length
    ? Math.round(session.reduce((s, e) => s + e.score, 0) / session.length * 10) / 10
    : null

  const modeColour = MODES.find(m => m.key === mode)?.colour ?? '#4f8ef7'

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    wrap:    { minHeight: '100%', fontFamily: 'var(--font-sans, system-ui)' } as const,
    header:  { marginBottom: 20 } as const,
    h1:      { fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 } as const,
    sub:     { fontSize: 12, color: 'var(--color-text-tertiary)' } as const,
    card:    { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 } as const,
    label:   { fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--color-text-tertiary)', marginBottom: 8, display: 'block' } as const,
    btn:     { borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: 'pointer', border: 'none', padding: '9px 18px', transition: 'opacity 0.15s' } as const,
    grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } as const,
  }

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}>Viva Preparation</h1>
        <p style={S.sub}>Portsmouth DBA · {session.length} questions practised{avgScore ? ` · Avg score ${avgScore}/5` : ''}</p>
      </div>

      {/* Tip bar */}
      <div style={{ ...S.card, background: 'var(--color-background-secondary)', borderLeft: `3px solid ${modeColour}`, padding: '10px 14px', marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginRight: 8 }}>TIP</span>
          {TIPS[tipIdx]}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left panel ── */}
        <div>
          {/* Mode selector */}
          <div style={{ ...S.card, padding: '14px 16px' }}>
            <span style={S.label}>Mode</span>
            {MODES.map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); setStage('idle') }}
                style={{ ...S.btn, width: '100%', marginBottom: 6, textAlign: 'left',
                  background: mode === m.key ? `${m.colour}18` : 'transparent',
                  border: mode === m.key ? `1px solid ${m.colour}55` : '1px solid var(--color-border-tertiary)',
                  color: mode === m.key ? m.colour : 'var(--color-text-secondary)',
                  padding: '8px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: mode === m.key ? 500 : 400 }}>{m.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {/* Examiner selector (only in examiner mode) */}
          {mode === 'examiner' && (
            <div style={{ ...S.card, padding: '14px 16px' }}>
              <span style={S.label}>Examiner</span>
              {EXAMINERS.map(e => (
                <button key={e.key} onClick={() => setExaminer(e.key)}
                  style={{ ...S.btn, width: '100%', marginBottom: 6, textAlign: 'left',
                    background: examiner === e.key ? '#9c6ef718' : 'transparent',
                    border: examiner === e.key ? '1px solid #9c6ef755' : '1px solid var(--color-border-tertiary)',
                    color: examiner === e.key ? '#7f57cc' : 'var(--color-text-secondary)',
                    padding: '8px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: examiner === e.key ? 500 : 400 }}>{e.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{e.institution}</div>
                </button>
              ))}
            </div>
          )}

          {/* Category selector */}
          <div style={{ ...S.card, padding: '14px 16px' }}>
            <span style={S.label}>Focus area</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                  style={{ ...S.btn, width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12,
                    background: category === cat.key ? 'var(--color-background-info)' : 'transparent',
                    color: category === cat.key ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                    border: 'none', borderRadius: 6 }}>
                  <span style={{ marginRight: 6, fontSize: 10 }}>{cat.icon}</span>{cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Session stats */}
          {session.length > 0 && (
            <div style={{ ...S.card, padding: '14px 16px' }}>
              <span style={S.label}>Session stats</span>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                {avgScore}/5
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                avg score · {session.length} answered
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {session.map((e, i) => (
                  <div key={i} title={`Q${i+1}: ${e.question.slice(0,40)}…`}
                    style={{ width: 20, height: 20, borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500,
                      background: e.score >= 4 ? '#22c55e22' : e.score === 3 ? '#f59e0b22' : '#ef444422',
                      color: e.score >= 4 ? '#15803d' : e.score === 3 ? '#b45309' : '#b91c1c' }}>
                    {e.score}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel — main session area ── */}
        <div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: 16 }}>
            {([['session','Mock session'],['profile','Examiner profile'],['tips','Prep tips']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                style={{ ...S.btn, borderRadius: '6px 6px 0 0', padding: '8px 14px', background: 'none', border: 'none',
                  borderBottom: activeTab === key ? `2px solid ${modeColour}` : '2px solid transparent',
                  color: activeTab === key ? modeColour : 'var(--color-text-secondary)',
                  fontWeight: activeTab === key ? 500 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Session ── */}
          {activeTab === 'session' && (
            <>
              {/* Idle — start prompt */}
              {stage === 'idle' && (
                <div style={{ ...S.card, textAlign: 'center', padding: '40px 24px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                    Ready for your mock viva?
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
                    {mode === 'standard' && 'A UKCGE-aligned question will be asked. Answer as you would in the real viva, then receive examiner feedback.'}
                    {mode === 'examiner' && `Simulating ${EXAMINERS.find(e => e.key === examiner)?.label}. Questions reflect their known research interests and likely probing style.`}
                    {mode === 'stress' && 'An adversarial examiner will challenge every answer. Probing follow-ups will expose weak reasoning. This is your hardest practice session.'}
                  </p>
                  {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 12 }}>{error}</p>}
                  <button onClick={startSession} disabled={loading}
                    style={{ ...S.btn, background: modeColour, color: '#fff', padding: '11px 28px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Starting…' : 'Begin session →'}
                  </button>
                </div>
              )}

              {/* Answering */}
              {stage === 'answering' && (
                <>
                  <div style={S.card}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20,
                        background: `${modeColour}18`, color: modeColour }}>
                        {qCategory.replace(/_/g,' ')}
                      </span>
                      {mode === 'examiner' && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          — {EXAMINERS.find(e => e.key === examiner)?.label}
                        </span>
                      )}
                      {mode === 'stress' && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#ef4444' }}>STRESS MODE</span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7, marginBottom: 12, fontStyle: 'italic' }}>
                      "{aiResponse}"
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      Core question: {question}
                    </p>
                  </div>

                  <div style={S.card}>
                    <span style={S.label}>Your answer</span>
                    <textarea ref={answerRef} value={answer} onChange={e => setAnswer(e.target.value)}
                      placeholder="Respond as you would in the actual viva. Aim for 2-4 minutes of speech equivalent (200-400 words)…"
                      rows={8} style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
                        border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)',
                        color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit' }}/>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {answer.split(/\s+/).filter(Boolean).length} words
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={nextQuestion} style={{ ...S.btn, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-secondary)' }}>
                          Skip
                        </button>
                        <button onClick={submitAnswer} disabled={loading || !answer.trim()}
                          style={{ ...S.btn, background: modeColour, color: '#fff', opacity: loading || !answer.trim() ? 0.5 : 1 }}>
                          {loading ? 'Evaluating…' : 'Submit answer →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Feedback */}
              {stage === 'feedback' && (
                <>
                  {/* The question */}
                  <div style={{ ...S.card, borderLeft: `3px solid ${modeColour}` }}>
                    <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{qCategory.replace(/_/g,' ')}</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>"{question}"</p>
                  </div>

                  {/* Feedback block */}
                  <div style={S.card}>
                    <span style={{ ...S.label, marginBottom: 12 }}>Examiner feedback</span>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.75, color: 'var(--color-text-primary)',
                      fontFamily: 'inherit', margin: 0 }}>{feedback}</pre>
                  </div>

                  {/* Follow-up */}
                  {followup && (
                    <div style={{ ...S.card, background: mode === 'stress' ? '#ef444408' : 'var(--color-background-secondary)',
                      borderLeft: `3px solid ${mode === 'stress' ? '#ef4444' : modeColour}` }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: mode === 'stress' ? '#ef4444' : modeColour, marginBottom: 8 }}>
                        FOLLOW-UP QUESTION
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-primary)', fontStyle: 'italic', lineHeight: 1.7 }}>
                        "{followup}"
                      </p>
                    </div>
                  )}

                  {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 12 }}>{error}</p>}
                  <button onClick={nextQuestion} style={{ ...S.btn, background: modeColour, color: '#fff', width: '100%', padding: '11px 0' }}>
                    Next question →
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Tab: Examiner profile ── */}
          {activeTab === 'profile' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {EXAMINERS.map(e => (
                  <button key={e.key} onClick={() => { setExaminer(e.key); loadProfile() }}
                    style={{ ...S.btn, border: examiner === e.key ? '1px solid #9c6ef7' : '0.5px solid var(--color-border-tertiary)',
                      background: examiner === e.key ? '#9c6ef712' : 'transparent',
                      color: examiner === e.key ? '#7f57cc' : 'var(--color-text-secondary)', padding: '7px 14px' }}>
                    {e.label}
                  </button>
                ))}
              </div>
              <div style={S.card}>
                {loading ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Loading profile…</p>
                ) : examinerProfile ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.75, fontFamily: 'inherit', margin: 0, color: 'var(--color-text-primary)' }}>
                    {examinerProfile}
                  </pre>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Select an examiner to view their profile.</p>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8, marginBottom: 24 }}>
                Profiles are generated from known publication records. Review and refine based on any direct knowledge of your examiners.
              </p>

              {/* South African Universities */}
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>South African institutions</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--color-background-success)', color: 'var(--color-text-success)', fontWeight: 500 }}>VIVA REQUIRED</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 14, lineHeight: 1.6 }}>
                  South Africa is standardising viva voce adoption across all doctoral programmes. UCT made it compulsory from 2026; UNISA from 2022. DBA programmes (GIBS, Milpark, Regent) have required viva for years. Select an institution to see the examination culture, typical examiner angles, and challenge questions.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {SA_INSTITUTIONS.map(inst => (
                    <button key={inst.key}
                      onClick={() => { setSaInstitution(inst.key); loadSAProfile(inst.key) }}
                      style={{ ...S.btn, padding: '7px 14px',
                        background: saInstitution === inst.key ? '#22c55e18' : 'transparent',
                        border: saInstitution === inst.key ? '1px solid #22c55e55' : '0.5px solid var(--color-border-tertiary)',
                        color: saInstitution === inst.key ? '#15803d' : 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: 13 }}>{inst.label}</span>
                      <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>{inst.degree}</span>
                    </button>
                  ))}
                </div>
                <div style={S.card}>
                  {saLoading ? (
                    <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Loading institution profile…</p>
                  ) : saProfile ? (
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.75, fontFamily: 'inherit', margin: 0, color: 'var(--color-text-primary)' }}>
                      {saProfile}
                    </pre>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                      Select a South African institution to view its doctoral examination culture, viva format, and typical examiner challenge angles.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Prep tips ── */}
          {activeTab === 'tips' && (
            <div>
              <div style={{ ...S.card, marginBottom: 12 }}>
                <span style={{ ...S.label, marginBottom: 12 }}>Portsmouth DBA viva — what to expect</span>
                {[
                  ['Format',         'Presentation first (panel or open), then closed-door oral examination with 2+ examiners.'],
                  ['Duration',       'Typically 1–3 hours. Portsmouth DBA sessions often run ~2 hours including deliberation.'],
                  ['Examiners',      'Internal + external examiner. External chairs unless independent chair appointed.'],
                  ['Outcomes',       'Pass / Minor corrections (3mo) / Major corrections (6mo) / Resubmission (1yr) / MPhil.'],
                  ['Most common',    '96% UK pass rate. ~80% require minor corrections. Prepare corrections response plan.'],
                  ['Supervisor',     'May attend with your agreement but cannot participate in examiner deliberations.'],
                  ['QAA Level 8',    'Examiners assess against QAA doctoral descriptors — originality, rigour, independence.'],
                ].map(([label, text]) => (
                  <div key={label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', minWidth: 120, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <span style={{ ...S.label, marginBottom: 12 }}>Best practice checklist</span>
                {[
                  'Write a one-page summary for each chapter (UKCGE best practice)',
                  'Prepare a 90-second "original contribution" statement',
                  'Know your examiners\' 3 most recent publications',
                  'Identify 3 genuine limitations — state them before they ask',
                  'Rehearse the "so what?" answer for practitioner AND academic audiences',
                  'Complete at least 2 full mock sessions under timed conditions',
                  'Record a mock session and review your pacing and filler words',
                  'Prepare a post-viva corrections action plan (even before the viva)',
                  'Rehearse the presentation that precedes your Portsmouth DBA viva',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'flex-start' }}>
                    <span style={{ color: '#22c55e', fontSize: 14, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...S.card, background: 'var(--color-background-secondary)' }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Key question categories to master</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Originality',    'What is your contribution? What would we not know without this research?'],
                    ['Methodology',    'Why socio-technical? Why sensemaking? Why interpretivism?'],
                    ['Literature',     'How has the field changed? Why not [X] theory?'],
                    ['Significance',   '"So what?" — practitioner impact and theoretical contribution.'],
                    ['Limitations',    'Access constraints, GCC specificity, dual practitioner-researcher role.'],
                    ['DBA specific',   'How does this bridge theory and practice? What changed in your work?'],
                  ].map(([cat, tip]) => (
                    <div key={cat} style={{ background: 'var(--color-background-primary)', borderRadius: 8, padding: 12, border: '0.5px solid var(--color-border-tertiary)' }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#4f8ef7', marginBottom: 4 }}>{cat}</p>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
