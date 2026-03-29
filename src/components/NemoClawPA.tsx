'use client'
/**
 * NemoClaw™ Personal Assistant — Floating Chat Widget
 *
 * Persists across all platform pages. Accessible via FAB bottom-right.
 * Three interaction modes:
 *   1. Conversational command ("push deadline", "what's urgent")
 *   2. Quick action chips (most common commands)
 *   3. Status at a glance (today's top items)
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

import { useState, useRef, useEffect, useCallback } from 'react'

interface PAMessage { role: 'user' | 'pa'; content: string; ts: string; actions?: PAAction[] }
interface PAAction  { type: string; label: string; payload: Record<string, unknown> }

const QUICK_ACTIONS = [
  { label: "Plan my day",       cmd: "What should I focus on today?" },
  { label: "What's urgent?",    cmd: "What's most urgent right now across tasks and decisions?" },
  { label: "Week summary",      cmd: "Give me a summary of this week so far." },
  { label: "Open decisions",    cmd: "What decisions are still open and how long have they been open?" },
  { label: "OKR check",         cmd: "How am I tracking against my OKRs?" },
  { label: "Draft a reply",     cmd: "Help me draft a reply to my most recent email." },
]

export function NemoClawPA() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<PAMessage[]>([])
  const [input, setInput]     = useState('')
  const [sending, setSending] = useState(false)
  const [nudge, setNudge]     = useState<string | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load nudge from staleness radar on mount
  useEffect(() => {
    fetch('/api/pa/nudge')
      .then(r => r.ok ? r.json() : {} as any)
      .then(d => { if (d.nudge) setNudge(d.nudge) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending) return
    const userMsg: PAMessage = { role: 'user', content: text, ts: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/pa/command', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, history: messages.slice(-6) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'pa', content: data.response, ts: new Date().toISOString(), actions: data.actions,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'pa', content: 'Something went wrong. Try again.', ts: new Date().toISOString() }])
    } finally {
      setSending(false)
    }
  }, [sending, messages])

  return (
    <>
      {/* Nudge badge (shows when PA has something proactive to say) */}
      {nudge && !open && (
        <div onClick={() => { setOpen(true); setNudge(null) }}
          style={{ position: 'fixed', bottom: 88, right: 24, maxWidth: 260, background: 'var(--pios-card)', border: '1px solid rgba(139,124,248,0.4)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: 'var(--pios-text)', lineHeight: 1.5, cursor: 'pointer', zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai)', display: 'block', marginBottom: 3 }}>✦ NemoClaw™</span>
          {nudge}
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: open ? 'var(--pios-border)' : 'var(--ai)', border: 'none', cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 16px rgba(139,124,248,0.4)', transition: 'background 0.2s' }}>
        {open ? '×' : '✦'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, width: 360, maxHeight: 520, background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', zIndex: 999, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: 'var(--ai)' }}>✦</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', letterSpacing: '-0.01em' }}>NemoClaw™</div>
              <div style={{ fontSize: 10, color: 'var(--pios-dim)' }}>Personal Assistant · Always on</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Empty state with quick actions */}
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                  What would you like to do?
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {QUICK_ACTIONS.map(qa => (
                    <button key={qa.label} onClick={() => send(qa.cmd)}
                      style={{ fontSize: 11, padding: '5px 10px', background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 20, color: 'var(--pios-muted)', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'var(--ai)' : 'var(--pios-bg)',
                  border: msg.role === 'pa' ? '1px solid var(--pios-border)' : 'none',
                  color: msg.role === 'user' ? '#fff' : 'var(--pios-text)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                  {/* Action buttons from PA */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {msg.actions.map((a, ai) => (
                        <button key={ai}
                          onClick={() => send(`Confirm: ${a.label}`)}
                          style={{ fontSize: 10, padding: '4px 8px', background: 'var(--ai)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ai)', opacity: 0.6 }} />
                ))}
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              ref={inputRef}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 12 }}
              placeholder="Ask anything or give a command..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ padding: '8px 12px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: (!input.trim() || sending) ? 0.4 : 1 }}>
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
