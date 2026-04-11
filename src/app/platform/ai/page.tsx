'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// AI Companion — persistent conversations, domain modes, tool shortcuts
// ─────────────────────────────────────────────────────────────────────────────

interface Message { role: 'user' | 'assistant'; content: string; timestamp?: string }

const DOMAIN_MODES = [
  { key:'general',      label:'General',      icon:'◉', colour:'var(--ai)', prompt:'' },
  { key:'academic',     label:'DBA Research', icon:'🎓', colour:'var(--academic)', prompt:'Focus on my DBA research at University of Portsmouth. Topic: AI-enabled forecasting in GCC FM. Theory: STS + sensemaking.' },
  { key:'fm_consulting',label:'FM Consulting', icon:'🏗️', colour:'var(--fm)', prompt:'Focus on FM consulting. Key projects: Qiddiya (QPMO-410-CT-07922), King Salman Park (SAR 229.6M). Reference VeritasEdge™ platform.' },
  { key:'saas',         label:'SaaS / Tech',  icon:'⚡', colour:'var(--saas)', prompt:'Focus on my SaaS platforms: VeritasEdge™ v6.6 (service charge), InvestiScript v3 (AI journalism), PIOS v3.0. Stack: Next.js 14, Supabase, Claude API.' },
  { key:'executive_os', label:'Executive OS',  icon:'⚡', colour:'var(--pro)', prompt:'Focus on my Executive OS — OKRs, open decisions, stakeholder management. Apply EOSA™ thinking. Reference my active OKRs and open decisions.' },
  { key:'business',     label:'Business',     icon:'🏢', colour:'var(--dng)', prompt:'Focus on company management: VeritasIQ Technologies Ltd (UK SaaS), VeritasIQ Technologies Ltd (FM consultancy), VeritasIQ Technologies Ltd (UAE holding). Governance, compliance, financials.' },
] as const

const SHORTCUTS = [
  { label:'Prioritise my tasks today',        prompt:'What should I focus on today? Review my open tasks and give me a clear priority order with reasoning.' },
  { label:'Cross-domain conflicts?',          prompt:'Are there any cross-domain conflicts or risks I should be aware of right now?' },
  { label:'DBA thesis next step',             prompt:'What is the most important next step I should take on my DBA thesis this week?' },
  { label:'Qiddiya RFP status',               prompt:'Summarise where we stand on the Qiddiya QPMO-410-CT-07922 proposal and what actions remain.' },
  { label:'VeritasEdge sprint status',        prompt:'What was completed in the last VeritasEdge sprint and what needs to happen next?' },
  { label:'Draft a client email',             prompt:'Help me draft a professional email to a client. Tell me who the client is and what you need to communicate.' },
  { label:'FM market signal',                 prompt:'What is the most important FM industry development I should be paying attention to right now?' },
  { label:'Executive OS brief',             prompt:'Generate my executive operating brief — OKR pulse, open decisions, stakeholder alerts, and one strategic focus for this week.' },
  { label:'Apply a consulting framework',    prompt:'I have a business challenge I need to think through. Which PIOS consulting framework (POM™, OAE™, SDL™, CVDM™, CPA™, SCE™, AAM™, UMS™, VFO™, CFE™, ADF™, GSM™, SPA™, RTE™, IML™) is most appropriate and why?' },
  { label:'Structure a decision',            prompt:'I have an important decision to make. Help me structure it using the Decision Architecture approach — options map, constraints, and a clear recommendation.' },
  { label:'Time sovereignty audit',          prompt:'Review my current time allocation and flag where busyness might be replacing strategy. What should I protect or cut?' },
  { label:'Summarise this week',              prompt:'Give me a summary of what I have accomplished this week and what is outstanding.' },
  { label:'Wellness + performance link',      prompt:'Based on my recent wellness check-ins and current workload, what patterns do you see between my energy/stress levels and productivity? What should I adjust?' },
  { label:'IP portfolio review',              prompt:'Review my IP vault and give me a strategic assessment: what is well-protected, what gaps exist, and what are my most urgent renewal or filing priorities?' },
  { label:'Contract risk scan',               prompt:'Review my active contracts and flag any upcoming renewals, high-risk terms, or counterparty concerns I should be aware of in the next 90 days.' },
  { label:'Knowledge base insight',           prompt:'Based on my recent knowledge entries, what themes or opportunities am I tracking that deserve more strategic attention?' },
]

function TimeAgo({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return <>{mins}m ago</>
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return <>{hrs}h ago</>
  return <>{Math.floor(hrs / 24)}d ago</>
}

export default function AiPage() {
  const [sessions,      setSessions]     = useState<unknown[]>([])
  const [activeId,      setActiveId]     = useState<string | null>(null)
  const [messages,      setMessages]     = useState<Message[]>([])
  const [input,         setInput]        = useState('')
  const [loading,       setLoading]      = useState(false)
  const [loadingSess,   setLoadingSess]  = useState(true)
  const [domainMode,    setDomainMode]   = useState<string>('general')
  const [showHistory,   setShowHistory]  = useState(true)
  const [copying,       setCopying]      = useState(false)
  const [nemo,          setNemo]         = useState<Record<string,unknown>|null|undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Fetch NemoClaw calibration status once on mount
  useEffect(() => {
    fetch('/api/cv')
      .then(r => r.ok ? r.json() : null)
      .then(d => setNemo((d?.calibration as Record<string,unknown>) ?? null))
      .catch(() => setNemo(null))
  }, [])

  // Load session list + auto-resume last conversation
  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/ai/sessions')
    const d = await res.json()
    const allSessions = d.sessions ?? []
    setSessions(allSessions)
    setLoadingSess(false)

    // Auto-load the most recent session if none active
    if (!activeId && allSessions.length > 0) {
      const latest = allSessions[0] // sorted by updated_at desc
      const sessionRes = await fetch(`/api/ai/sessions?id=${(latest as any).id}`)
      const sessionData = await sessionRes.json()
      if (sessionData.session?.messages?.length > 0) {
        setActiveId((latest as any).id)
        setDomainMode(sessionData.session.domain ?? 'general')
        setMessages(sessionData.session.messages)
      }
    }
  }, [activeId])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Create new session
  async function newChat(domain = domainMode) {
    const res = await fetch('/api/ai/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', domain }),
    })
    const d = await res.json()
    setActiveId(d.id)
    setDomainMode(domain)
    const mode = DOMAIN_MODES.find(m => m.key === domain)
    const calibNote = nemo === null ? ' (Tip: upload your CV at /platform/onboarding to calibrate me to your background.)' : ''
    const welcome: Message = {
      role: 'assistant',
      content: mode?.prompt
        ? `I'm in **${mode.label}** mode. ${mode.prompt.replace(/\.$/, '')}. What do you need?`
        : `Good morning, Douglas. I'm across all your domains — academic, consulting, SaaS, and business. What do you need?${calibNote}`,
      timestamp: new Date().toISOString(),
    }
    setMessages([welcome])
    loadSessions()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Load existing session
  async function loadSession(id: string) {
    const res = await fetch(`/api/ai/sessions?id=${id}`)
    const d = await res.json()
    if (d.session) {
      setActiveId(id)
      setDomainMode(d.session.domain ?? 'general')
      setMessages(d.session.messages ?? [])
    }
  }

  // Delete session
  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch('/api/ai/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    setSessions(prev => prev.filter(s => (s as any).id !== id))
    if (activeId === id) { setActiveId(null); setMessages([]) }
  }

  // Save messages to session
  async function saveMessages(id: string, msgs: Message[]) {
    await fetch('/api/ai/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', id, messages: msgs }),
    })
    // Auto-generate title after first exchange
    if (msgs.length === 2) {
      fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'title', id, messages: msgs }),
      }).then(r => r.json()).then(d => {
        if (d.title) setSessions(prev => prev.map(s => (s as any).id === id ? { ...(s as object), title: d.title } : s))
      })
    }
  }

  // Send message
  async function send(overrideInput?: string) {
    const text = (overrideInput ?? input).trim()
    if (!text || loading) return

    // Create session if none active
    let sessionId = activeId
    if (!sessionId) {
      const res = await fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', domain: domainMode }),
      })
      const d = await res.json()
      sessionId = d.id
      setActiveId(d.id)
      loadSessions()
    }

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const mode = DOMAIN_MODES.find(m => m.key === domainMode)
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
          domainContext: mode?.prompt ?? '',
        }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.reply ?? 'Sorry — something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      }
      const final = [...updated, reply]
      setMessages(final)
      if (sessionId) saveMessages(sessionId, final)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.', timestamp: new Date().toISOString() }])
    }
    setLoading(false)
  }

  async function copyChat() {
    const text = messages.map(m => `${m.role === 'user' ? 'You' : 'PIOS AI'}:\n${typeof m.content === 'string' ? m.content : String(m.content ?? '')}`).join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  const activeMode = DOMAIN_MODES.find(m => m.key === domainMode) ?? DOMAIN_MODES[0]

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: 16 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .msg-enter { animation: fadeIn 0.2s ease }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
      `}</style>

      {/* ── Session sidebar ─────────────────────────────────────────────── */}
      {showHistory && (
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button className="pios-btn pios-btn-primary" onClick={() => newChat()} style={{ fontSize: 12, width: '100%' }}>
            + New conversation
          </button>

          {/* Domain mode quick-start */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 2px' }}>Domain modes</div>
          {DOMAIN_MODES.slice(1).map(mode => (
            <button key={mode.key} onClick={() => newChat(mode.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 8, border: `1px solid ${mode.colour}30`,
              background: domainMode === mode.key ? mode.colour + '15' : 'transparent',
              cursor: 'pointer', fontSize: 12, color: mode.colour, textAlign: 'left', width: '100%',
            }}>
              <span style={{ fontSize: 14 }}>{mode.icon}</span>
              <span style={{ fontWeight: 500 }}>{mode.label}</span>
            </button>
          ))}

          <div style={{ width: '100%', height: 1, background: 'var(--pios-border)', margin: '4px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pios-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>Recent</div>

          {loadingSess ? (
            <div style={{ fontSize: 12, color: 'var(--pios-dim)', padding: '8px 2px' }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--pios-dim)', padding: '8px 2px' }}>No conversations yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
              {sessions.map(s => (
                <div key={(s as any).id} onClick={() => loadSession((s as any).id)} style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 6,
                  background: activeId === (s as any).id ? 'var(--ai-subtle)' : 'transparent',
                  border: `1px solid ${activeId === (s as any).id ? 'rgba(167,139,250,0.25)' : 'transparent'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{(s as any).title ?? 'Conversation'}</div>
                    <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}><TimeAgo iso={(s as any).updated_at} /></div>
                  </div>
                  <button onClick={e => deleteSession((s as any).id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-dim)', fontSize: 13, padding: '0 2px', flexShrink: 0, opacity: 0.5, lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── NemoClaw™ calibration status ─────────────── */}
          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            {nemo === undefined ? (
              <div style={{ fontSize: 10, color: 'var(--pios-dim)', padding: '6px 2px' }}>Checking calibration…</div>
            ) : nemo ? (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(139,124,248,0.07)',
                border: '1px solid rgba(139,124,248,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>NemoClaw™ Calibrated</span>
                </div>
                {!!(nemo as any).calibration_summary && (
                  <p style={{ fontSize: 11, color: 'var(--pios-muted)', margin: '0 0 6px', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as never}>
                    {String((nemo as any).calibration_summary)}
                  </p>
                )}
                {!!(nemo as any).recommended_frameworks && ((nemo as any).recommended_frameworks as string[]).length ? (
                  <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 4 }}>
                    Frameworks: {((nemo as any).recommended_frameworks as string[]).slice(0, 3).join(', ')}
                    {((nemo as any).recommended_frameworks as string[]).length > 3 ? ` +${((nemo as any).recommended_frameworks as string[]).length - 3}` : ''}
                  </div>
                ) : null}
                {!!(nemo as any).seniority_level && (
                  <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginBottom: 6 }}>
                    {String((nemo as any).seniority_level)} · {String((nemo as any).primary_industry ?? 'professional')} · {(nemo as any).career_years ? `${(nemo as any).career_years}y exp` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <a href="/platform/ai/train" style={{ fontSize: 10, color: 'var(--ai)', textDecoration: 'none', padding: '3px 8px', borderRadius: 6, background: 'rgba(139,124,248,0.12)', border: '1px solid rgba(139,124,248,0.2)' }}>
                    ⚙ Configure
                  </a>
                  <a href="/platform/onboarding" style={{ fontSize: 10, color: 'var(--pios-dim)', textDecoration: 'none', padding: '3px 8px', borderRadius: 6, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)' }}>
                    ↺ Recalibrate CV
                  </a>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Not Calibrated</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--pios-muted)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  Upload your CV so NemoClaw™ personalises every conversation to your background and goals.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href="/platform/ai/train" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai)', textDecoration: 'none', padding: '4px 10px', borderRadius: 7, background: 'rgba(139,124,248,0.12)', border: '1px solid rgba(139,124,248,0.25)' }}>
                    Configure NemoClaw
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main chat area ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--pios-surface)', borderRadius: 12, border: '1px solid rgba(139,124,248,0.2)', overflow: 'hidden', minWidth: 0 }}>

        {/* Chat header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pios-muted)', fontSize: 16, padding: 0 }}>
              {showHistory ? '◂' : '▸'}
            </button>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeMode.colour }} className="ai-pulse" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>PIOS AI</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: activeMode.colour + '20', color: activeMode.colour, fontWeight: 600 }}>
              {activeMode.icon} {activeMode.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {messages.length > 0 && (
              <button onClick={copyChat} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>
                {copying ? '✓ Copied' : '⎘ Copy chat'}
              </button>
            )}
            <button onClick={() => { setActiveId(null); setMessages([]) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pios-border)', background: 'none', cursor: 'pointer', color: 'var(--pios-muted)' }}>
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 ? (
            /* Empty state with shortcuts */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>◉</div>
              <div style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 400, marginBottom: 6 }}>PIOS AI Companion</div>
              <p style={{ fontSize: 13, color: 'var(--pios-muted)', textAlign: 'center', maxWidth: 420, marginBottom: 28, lineHeight: 1.65 }}>
                Your cross-domain intelligence layer. Switch domain modes on the left or start with a quick prompt below.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 560 }}>
                {SHORTCUTS.slice(0, 6).map(s => (
                  <button key={s.label} onClick={() => { setInput(s.prompt); send(s.prompt) }} style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--pios-border)',
                    background: 'var(--pios-surface2)', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, color: 'var(--pios-text)', lineHeight: 1.4,
                    transition: 'border-color 0.15s',
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="msg-enter" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'user' ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, var(--ai), var(--academic))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2,
                }}>
                  {m.role === 'user' ? 'D' : 'P'}
                </div>
                <div style={{
                  maxWidth: '78%', padding: '11px 15px', borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role === 'user' ? 'var(--ai-subtle)' : 'var(--pios-surface2)',
                  fontSize: 13, lineHeight: 1.7, color: 'var(--pios-text)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {typeof m.content === 'string' ? m.content : String(m.content ?? '')}
                  {m.timestamp && <div style={{ fontSize: 10, color: 'var(--pios-dim)', marginTop: 6, textAlign: m.role === 'user' ? 'right' : 'left' }}><TimeAgo iso={m.timestamp} /></div>}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--ai), var(--academic))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>P</div>
              <div style={{ padding: '11px 16px', borderRadius: '12px 12px 12px 4px', background: 'var(--pios-surface2)', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ai)', animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Shortcuts strip (when messages exist) */}
        {messages.length > 0 && !loading && (
          <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
            {SHORTCUTS.slice(0, 4).map(s => (
              <button key={s.label} onClick={() => send(s.prompt)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, background: 'var(--pios-surface2)',
                border: '1px solid var(--pios-border)', color: 'var(--pios-muted)', cursor: 'pointer',
                whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{s.label}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything across your domains… (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{
              flex: 1, background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
              borderRadius: 10, padding: '10px 14px', color: 'var(--pios-text)',
              fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.55, fontFamily: 'inherit',
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: input.trim() && !loading ? 'var(--ai)' : 'var(--pios-surface2)',
            border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
            color: input.trim() && !loading ? '#fff' : 'var(--pios-dim)',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>↑</button>
        </div>
      </div>
    </div>
  )
}
