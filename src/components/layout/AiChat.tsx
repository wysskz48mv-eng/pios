'use client'
import { useState, useRef, useEffect } from 'react'

interface Message { role: 'user' | 'assistant'; content: string }

export function AiChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Good morning, Douglas. I\'m across all your domains — academic, consulting, projects, and business. What do you need?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg].slice(-50))
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] })
      })
      const data = await res.json()
      setMessages(prev => [...prev.slice(-49), { role: 'assistant', content: data.reply || 'Sorry, I encountered an error.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }

  const QUICK = [
    'What\'s my single most important task today?',
    'Any cross-domain conflicts I should know about?',
    'Summarise my DBA thesis progress',
    'What has changed in VeritasEdge™ this sprint?',
  ]

  if (!isOpen) return null

  return (
    <div style={{
      width: '360px', height: '100vh', background: 'var(--pios-surface)',
      borderLeft: '1px solid var(--pios-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px', borderBottom: '1px solid var(--pios-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--ai)', boxShadow: '0 0 8px var(--ai)',
          }} className="ai-pulse" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>PIOS AI Companion</div>
            <div style={{ fontSize: '10px', color: 'var(--pios-dim)' }}>Cross-Domain Orchestrator · claude-sonnet-4</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--pios-muted)',
          cursor: 'pointer', fontSize: '18px', lineHeight: 1,
        }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: '8px',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}>
            {m.role === 'assistant' && (
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #a78bfa, #6c8eff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '2px',
              }}>P</div>
            )}
            <div style={{
              maxWidth: '85%', padding: '10px 12px', borderRadius: '10px',
              background: m.role === 'user' ? 'rgba(167,139,250,0.15)' : 'var(--pios-surface2)',
              fontSize: '13px', lineHeight: 1.6, color: 'var(--pios-text)',
              whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #6c8eff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>P</div>
            <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--pios-surface2)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ai)', opacity: 0.6, animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => { setInput(q); }} style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
            background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
            color: 'var(--pios-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{q.length > 30 ? q.slice(0,28)+'…' : q}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything across your domains…"
          rows={2}
          style={{
            flex: 1, background: 'var(--pios-surface2)', border: '1px solid var(--pios-border)',
            borderRadius: '8px', padding: '8px 12px', color: 'var(--pios-text)',
            fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: input.trim() ? 'var(--ai)' : 'var(--pios-surface2)',
          border: 'none', cursor: input.trim() ? 'pointer' : 'default',
          color: input.trim() ? '#0a0b0d' : 'var(--pios-dim)',
          fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          alignSelf: 'flex-end', transition: 'all 0.15s',
        }}>↑</button>
      </div>
    </div>
  )
}
