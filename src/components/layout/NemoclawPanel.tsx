'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNemoclawStore, type NemoclawMessage } from '@/stores/useNemoclawStore'

const TITLES: Record<string, string> = {
  dashboard: 'Command Centre',
  tasks: 'Tasks',
  inbox: 'Inbox',
  email: 'Inbox',
  documents: 'Documents',
  files: 'File Intelligence',
  stakeholders: 'Stakeholders',
  decisions: 'Decisions',
  projects: 'Projects',
  ai: 'NemoClaw Workspace',
}

function inferTitle(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'dashboard'
  return TITLES[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function NemoclawPanel() {
  const pathname = usePathname()
  const {
    isOpen,
    isFullscreen,
    sessionId,
    messages,
    loading,
    initialized,
    moduleContext,
    setInitialized,
    setModuleContext,
    setSession,
    setMessages,
    appendMessage,
    setLoading,
    open,
    close,
    setFullscreen,
    resetConversation,
  } = useNemoclawStore()

  const [input, setInput] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; updated_at: string; message_count: number }>>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setModuleContext({ route: pathname, title: inferTitle(pathname) })
  }, [pathname, setModuleContext])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (initialized) return
    let active = true
    ;(async () => {
      const latest = await fetch('/api/ai/sessions/latest').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      if (!active) return
      if (latest?.session?.id) {
        setSession(latest.session.id)
        const msgData = await fetch(`/api/ai/sessions/${latest.session.id}/messages`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (msgData?.messages?.length) {
          setMessages(msgData.messages)
        }
      }
      setInitialized(true)
    })()
    return () => {
      active = false
    }
  }, [initialized, setInitialized, setMessages, setSession])

  useEffect(() => {
    const loadSessions = async () => {
      const data = await fetch('/api/ai/sessions').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      setSessions(data?.sessions ?? [])
    }
    void loadSessions()
  }, [sessionId, messages.length])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase || !sessionId) return

    const channel = supabase
      .channel(`nemoclaw-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as NemoclawMessage
          appendMessage({
            id: String(row.id),
            session_id: String(row.session_id),
            role: row.role,
            content: String(row.content ?? ''),
            created_at: String(row.created_at),
            metadata: (row.metadata ?? null) as Record<string, unknown> | null,
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [appendMessage, sessionId])

  const panelMessages = useMemo(() => messages.slice(-80), [messages])

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId
    const created = await fetch('/api/ai/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', domain_mode: 'general' }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (!created?.id) return null
    setSession(created.id)
    return created.id as string
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    const sid = await ensureSession()
    if (!sid) {
      setLoading(false)
      return
    }

    const optimisticUser: NemoclawMessage = {
      id: `local-user-${Date.now()}`,
      session_id: sid,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    appendMessage(optimisticUser)

    await fetch('/api/ai/messages/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        messages: [{ role: 'user', content: text, metadata: { module: moduleContext } }],
      }),
    }).catch(() => null)

    const ai = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        message: text,
        moduleContext,
      }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    const assistant = String(ai?.reply ?? 'I could not generate a response right now. Please try again.')

    await fetch('/api/ai/messages/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        messages: [{ role: 'assistant', content: assistant, metadata: { tools_used: ai?.tools_used ?? [] } }],
      }),
    }).catch(() => null)

    appendMessage({
      id: `local-assistant-${Date.now()}`,
      session_id: sid,
      role: 'assistant',
      content: assistant,
      created_at: new Date().toISOString(),
      metadata: { tools_used: ai?.tools_used ?? [] },
    })

    setLoading(false)
  }

  const panelStyle: CSSProperties = {
    width: isFullscreen || isMobile ? '100%' : 360,
    minWidth: isFullscreen || isMobile ? '100%' : 320,
    background: 'var(--pios-surface)',
    borderLeft: isFullscreen || isMobile ? 'none' : '1px solid var(--pios-border)',
    borderTop: isMobile ? '1px solid var(--pios-border)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    zIndex: 80,
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '1px solid rgba(99,73,255,0.45)',
          background: 'var(--ai)',
          color: '#fff',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(99,73,255,0.35)',
          zIndex: 95,
        }}
        aria-label="Open NemoClaw"
      >
        ✦
      </button>
    )
  }

  return (
    <div
      id="nemoclaw-panel"
      style={
        isMobile || isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,8,13,0.98)',
              backdropFilter: 'blur(8px)',
              zIndex: 90,
              display: 'flex',
            }
          : {
              display: 'flex',
              height: '100vh',
            }
      }
    >
      <aside style={panelStyle} aria-label="NemoClaw AI assistant">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--pios-border)' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ai3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>NemoClaw™</div>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>Context: {moduleContext.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isMobile && (
              <button className="pios-btn pios-btn-ghost pios-btn-sm" onClick={() => setFullscreen(!isFullscreen)}>
                {isFullscreen ? 'Dock' : 'Expand'}
              </button>
            )}
            <button className="pios-btn pios-btn-ghost pios-btn-sm" onClick={close}>Minimise</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? '280px 1fr' : '1fr', height: '100%' }}>
          {isFullscreen && (
            <div style={{ borderRight: '1px solid var(--pios-border)', overflowY: 'auto', padding: 10 }}>
              <button className="pios-btn pios-btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={resetConversation}>+ New Session</button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={async () => {
                    setSession(s.id)
                    const data = await fetch(`/api/ai/sessions/${s.id}/messages`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
                    setMessages(data?.messages ?? [])
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    marginBottom: 6,
                    borderRadius: 8,
                    border: `1px solid ${sessionId === s.id ? 'rgba(99,73,255,0.45)' : 'var(--pios-border)'}`,
                    background: sessionId === s.id ? 'rgba(99,73,255,0.09)' : 'transparent',
                    color: 'var(--pios-text)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--pios-muted)' }}>{s.message_count ?? 0} messages</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {panelMessages.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
                  Ask NemoClaw anything about your current module. It can pull real data from tasks, inbox, stakeholders,
                  projects, and documents.
                </div>
              )}
              {panelMessages.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '88%',
                      borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      padding: '10px 12px',
                      background: m.role === 'user' ? 'rgba(99,73,255,0.2)' : 'var(--pios-surface2)',
                      border: m.role === 'assistant' ? '1px solid var(--pios-border)' : '1px solid rgba(99,73,255,0.3)',
                      fontSize: 12,
                      color: 'var(--pios-text)',
                      lineHeight: 1.6,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {loading && <div style={{ fontSize: 11, color: 'var(--pios-muted)' }}>NemoClaw is thinking…</div>}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: 12, borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 8 }}>
              <textarea
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask NemoClaw…"
                className="pios-input"
                style={{ resize: 'none' }}
              />
              <button className="pios-btn pios-btn-primary" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
