'use client'
/**
 * /platform/inbox — Unified Inbox + Draft Review
 *
 * Shows all triaged emails across all connected inboxes.
 * NemoClaw™-generated drafts shown inline for review/edit/send.
 *
 * HUMAN-IN-THE-LOOP UI:
 *   - Draft shown below each email that needs a reply
 *   - User edits inline, clicks Send → API sends from CORRECT inbox
 *   - Or Discard → marks draft as discarded
 *   - Or Open in Gmail → opens Gmail draft in new tab
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

import { useState, useEffect, useCallback } from 'react'

/* ── Types ──────────────────────────────────────────────────── */
interface EmailItem {
  id: string
  inbox_address: string
  from_address: string
  from_name?: string
  subject?: string
  body_preview?: string
  received_at: string
  triage_class?: string
  draft_created?: boolean
  gmail_draft_id?: string
  draft?: EmailDraft
}

interface EmailDraft {
  id: string
  email_item_id: string
  from_address: string
  to_address: string
  subject: string
  body: string
  gmail_draft_id?: string
  status: 'draft' | 'sent' | 'discarded'
  ai_generated: boolean
}

/* ── Class colours + labels ─────────────────────────────────── */
const CLASS_CONFIG: Record<string, { colour: string; label: string; icon: string }> = {
  urgent:      { colour: 'var(--dng)',      label: 'Urgent',      icon: '⚑' },
  opportunity: { colour: 'var(--academic)', label: 'Opportunity', icon: '◎' },
  file_doc:    { colour: 'var(--fm)',        label: 'File',        icon: '◈' },
  fyi:         { colour: 'var(--pios-muted)', label: 'FYI',       icon: '·' },
  personal:    { colour: 'var(--ai)',        label: 'Personal',    icon: '○' },
  junk:        { colour: 'var(--pios-dim)', label: 'Junk',        icon: '×' },
}

/* ── Main page ───────────────────────────────────────────────── */
export default function InboxPage() {
  const [emails, setEmails]         = useState<EmailItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [triaging, setTriaging]     = useState(false)
  const [filter, setFilter]         = useState<string>('all')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<Record<string, string>>({})
  const [sending, setSending]       = useState<string | null>(null)
  const [compose, setCompose]       = useState<{ to: string; subject: string; body: string; threadId?: string; replyTo?: string; mode: 'compose' | 'reply' | 'forward' } | null>(null)
  const [composeSending, setComposeSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/inbox')
      if (res.ok) {
        const data = await res.json()
        setEmails(data.emails ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const syncInboxes = async () => {
    setSyncing(true)
    try {
      await fetch('/api/email/sync', { method: 'POST' })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const runTriage = async () => {
    setTriaging(true)
    try {
      await fetch('/api/email/triage', { method: 'POST' })
      await load()
    } finally {
      setTriaging(false)
    }
  }

  const sendDraft = async (emailId: string, draft: EmailDraft) => {
    setSending(emailId)
    try {
      const body = editingDraft[emailId] ?? draft.body
      const res = await fetch('/api/email/send-draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ draft_id: draft.id, body }),
      })
      if (res.ok) {
        setEmails(prev => prev.map(e =>
          e.id === emailId
            ? { ...e, draft: { ...draft, status: 'sent' } }
            : e
        ))
      }
    } finally {
      setSending(null)
    }
  }

  const discardDraft = async (emailId: string, draft: EmailDraft) => {
    await fetch('/api/email/send-draft', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ draft_id: draft.id, action: 'discard' }),
    })
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, draft: { ...draft, status: 'discarded' } } : e
    ))
  }

  /* ── Computed ── */
  const filtered = emails.filter(e => {
    if (filter === 'all')      return e.triage_class !== 'junk'
    if (filter === 'drafts')   return e.draft?.status === 'draft'
    if (filter === 'urgent')   return e.triage_class === 'urgent'
    if (filter === 'untriaged') return !e.triage_class
    return e.triage_class === filter
  })

  const draftCount    = emails.filter(e => e.draft?.status === 'draft').length
  const urgentCount   = emails.filter(e => e.triage_class === 'urgent').length
  const untriagedCount= emails.filter(e => !e.triage_class).length

  /* ── Inbox grouping by address ── */
  const inboxes = Array.from(new Set((emails ?? []).map(e => e.inbox_address))).sort()

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Inbox</h1>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            {inboxes.length} connected inbox{inboxes.length !== 1 ? 'es' : ''} · NemoClaw™ triage active
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCompose({ to: '', subject: '', body: '', mode: 'compose' })}
            style={{ padding: '8px 16px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Compose
          </button>
          {untriagedCount > 0 && (
            <button onClick={runTriage} disabled={triaging}
              style={{ padding: '8px 16px', background: 'var(--pios-surface3)', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--ai)', fontSize: 13, fontWeight: 500, cursor: triaging ? 'wait' : 'pointer', opacity: triaging ? 0.7 : 1 }}>
              {triaging ? 'Triaging...' : `Triage ${untriagedCount} new`}
            </button>
          )}
          <button onClick={syncInboxes} disabled={syncing}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: syncing ? 'var(--ai)' : 'var(--pios-muted)', fontSize: 13, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? 'Syncing...' : 'Sync inboxes'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Drafts awaiting review', value: draftCount,     colour: 'var(--ai)',      key: 'drafts' },
          { label: 'Urgent',                 value: urgentCount,    colour: 'var(--dng)',     key: 'urgent' },
          { label: 'Opportunities',          value: emails.filter(e=>e.triage_class==='opportunity').length, colour: 'var(--academic)', key: 'opportunity' },
          { label: 'Untriaged',              value: untriagedCount, colour: 'var(--warn)',    key: 'untriaged' },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(prev => prev === s.key ? 'all' : s.key)}
            style={{ background: 'var(--pios-card)', border: `1px solid ${filter === s.key ? s.colour : 'var(--pios-border)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
            <div style={{ fontSize: 20, fontWeight: 400, color: s.colour, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--pios-border)', marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'drafts', label: `Drafts (${draftCount})` },
          { key: 'urgent', label: 'Urgent' },
          { key: 'opportunity', label: 'Opportunities' },
          { key: 'fyi', label: 'FYI' },
          { key: 'untriaged', label: 'Untriaged' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            style={{ padding: '8px 14px', background: 'transparent', border: 'none', borderBottom: filter === t.key ? '2px solid var(--ai)' : '2px solid transparent', color: filter === t.key ? 'var(--ai)' : 'var(--pios-muted)', fontSize: 13, fontWeight: filter === t.key ? 500 : 400, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Email list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--pios-muted)', fontSize: 14 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--pios-dim)', fontSize: 14 }}>
          {filter === 'drafts' ? 'No drafts awaiting review' : 'No emails in this category'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(email => {
            const cls = CLASS_CONFIG[email.triage_class ?? ''] ?? { colour: 'var(--pios-muted)', label: 'New', icon: '·' }
            const isOpen  = expanded === email.id
            const draft   = email.draft
            const hasDraft = draft?.status === 'draft'

            return (
              <div key={email.id} style={{ background: 'var(--pios-card)', border: `1px solid ${hasDraft ? 'rgba(139,124,248,0.3)' : 'var(--pios-border)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>

                {/* Email row */}
                <div onClick={() => setExpanded(isOpen ? null : email.id)}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 12, alignItems: 'center' }}>

                  {/* Inbox badge */}
                  <div style={{ fontSize: 10, color: 'var(--pios-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.inbox_address.split('@')[0]}@...
                  </div>

                  {/* Email info */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.from_name ?? email.from_address}
                      </span>
                      {email.triage_class && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: `${cls.colour}22`, color: cls.colour, textTransform: 'uppercase', flexShrink: 0 }}>
                          {cls.icon} {cls.label}
                        </span>
                      )}
                      {hasDraft && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'rgba(139,124,248,0.12)', color: 'var(--ai)', flexShrink: 0 }}>
                          ✦ Draft ready
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--pios-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject ?? '(no subject)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.body_preview ?? ''}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0 }}>
                    {formatTime(email.received_at)}
                  </div>
                </div>

                {/* Expanded: actions bar + email body + draft review */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--pios-border)' }}>

                    {/* Quick actions bar */}
                    <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--pios-border)', background: 'var(--pios-surface2)' }}>
                      {/* Reply / Forward */}
                      <button onClick={(e) => { e.stopPropagation(); setCompose({ to: email.from_address, subject: `Re: ${email.subject ?? ''}`, body: `\n\n--- Original ---\n${email.body_preview ?? ''}`, threadId: (email as any).gmail_thread_id, replyTo: email.id, mode: 'reply' }) }}
                        style={{ padding: '4px 10px', fontSize: 11, background: 'var(--ai)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>
                        Reply
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setCompose({ to: '', subject: `Fwd: ${email.subject ?? ''}`, body: `\n\n--- Forwarded ---\nFrom: ${email.from_address}\nSubject: ${email.subject}\n\n${email.body_preview ?? ''}`, mode: 'forward' }) }}
                        style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 5, color: 'var(--pios-muted)', cursor: 'pointer' }}>
                        Forward
                      </button>
                      <div style={{ width: 1, height: 20, background: 'var(--pios-border)', margin: '0 2px' }} />
                      {/* Actions */}
                      {[
                        { label: 'Archive', action: 'archive', icon: '📥' },
                        { label: 'Delete', action: 'delete', icon: '🗑' },
                        { label: 'Spam', action: 'spam', icon: '⛔' },
                        { label: 'Block sender', action: 'block', icon: '🚫' },
                        { label: (email as any).is_flagged ? 'Unflag' : 'Flag', action: (email as any).is_flagged ? 'unflag' : 'flag', icon: '⚑' },
                        { label: 'Snooze', action: 'snooze', icon: '⏰' },
                        { label: (email as any).unsubscribe_url ? 'Unsubscribe' : 'Unsubscribe', action: 'unsubscribe', icon: '✉' },
                      ].filter(a => a.label).map(a => (
                        <button key={a.action} onClick={async (e) => {
                          e.stopPropagation()
                          await fetch('/api/email/actions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email_id: email.id, action: a.action }),
                          })
                          await load()
                        }} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 5, color: 'var(--pios-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{a.icon}</span> {a.label}
                        </button>
                      ))}
                    </div>

                    {/* Email header + body */}
                    <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 8 }}>
                        From: {email.from_address} · To: {email.inbox_address} · {formatTime(email.received_at)}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--pios-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                        {email.body_preview ?? '(no preview available)'}
                      </div>
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const res = await fetch(`/api/email/view?id=${email.id}`)
                        if (res.ok) {
                          const data = await res.json()
                          if (data.email?.body_text) {
                            setEmails(prev => prev.map(em => em.id === email.id ? { ...em, body_preview: data.email.body_text } : em))
                          }
                        }
                      }} style={{ marginTop: 8, fontSize: 11, color: 'var(--ai)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        View full email →
                      </button>
                    </div>

                    {/* NemoClaw™ draft review */}
                    {hasDraft && (
                      <div style={{ padding: '16px', borderTop: '1px solid var(--pios-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ai)' }}>✦ NemoClaw™ draft</span>
                          <span style={{ fontSize: 10, color: 'var(--pios-dim)' }}>
                            from {draft!.from_address} → {draft!.to_address}
                          </span>
                          {draft!.gmail_draft_id && (
                            <a href={`https://mail.google.com/mail/#drafts/${draft!.gmail_draft_id}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 10, color: 'var(--ai)', textDecoration: 'none', marginLeft: 'auto' }}>
                              Open in Gmail →
                            </a>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginBottom: 8 }}>
                          Subject: {draft!.subject}
                        </div>

                        {/* Editable draft body */}
                        <textarea
                          style={{ width: '100%', minHeight: 140, padding: '10px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }}
                          value={editingDraft[email.id] ?? draft!.body}
                          onChange={e => setEditingDraft(prev => ({ ...prev, [email.id]: e.target.value }))}
                        />

                        <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 6, marginBottom: 10 }}>
                          Edit the draft above, then send or discard. This will be sent from {draft!.from_address}.
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => sendDraft(email.id, draft!)}
                            disabled={sending === email.id}
                            style={{ flex: 1, padding: '10px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 500, cursor: sending === email.id ? 'wait' : 'pointer', opacity: sending === email.id ? 0.7 : 1 }}>
                            {sending === email.id ? 'Sending...' : `Send from ${draft!.from_address.split('@')[0]}@...`}
                          </button>
                          <button
                            onClick={() => discardDraft(email.id, draft!)}
                            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
                            Discard
                          </button>
                        </div>
                      </div>
                    )}

                    {/* No draft — trigger one */}
                    {!hasDraft && email.triage_class && email.triage_class !== 'junk' && email.triage_class !== 'fyi' && (
                      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--pios-muted)' }}>No draft yet</span>
                        <button
                          onClick={async () => {
                            await fetch('/api/email/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_ids: [email.id] }) })
                            await load()
                          }}
                          style={{ fontSize: 12, color: 'var(--ai)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          Draft with NemoClaw™ →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Compose / Reply / Forward modal ────────────────────────── */}
      {compose && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, width: 480, background: 'var(--pios-surface)', border: '1px solid var(--pios-border2)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', background: 'var(--pios-surface2)', borderBottom: '1px solid var(--pios-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>
              {compose.mode === 'reply' ? 'Reply' : compose.mode === 'forward' ? 'Forward' : 'New email'}
            </span>
            <button onClick={() => setCompose(null)} style={{ background: 'none', border: 'none', color: 'var(--pios-muted)', cursor: 'pointer', fontSize: 16 }}>x</button>
          </div>
          {/* Form */}
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="email" placeholder="To" value={compose.to}
              onChange={e => setCompose({ ...compose, to: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 6, color: 'var(--pios-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <input
              type="text" placeholder="Subject" value={compose.subject}
              onChange={e => setCompose({ ...compose, subject: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 6, color: 'var(--pios-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <textarea
              placeholder="Write your message..."
              value={compose.body}
              onChange={e => setCompose({ ...compose, body: e.target.value })}
              style={{ width: '100%', minHeight: 180, padding: '10px', background: 'var(--pios-bg)', border: '1px solid var(--pios-border)', borderRadius: 6, color: 'var(--pios-text)', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          {/* Actions */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--pios-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setCompose(null)}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 7, color: 'var(--pios-muted)', fontSize: 12, cursor: 'pointer' }}>
              Discard
            </button>
            <button
              disabled={composeSending || !compose.to.trim() || !compose.subject.trim()}
              onClick={async () => {
                setComposeSending(true)
                try {
                  await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: compose.to,
                      subject: compose.subject,
                      body: compose.body,
                      threadId: compose.threadId,
                      email_item_id: compose.replyTo,
                    }),
                  })
                  setCompose(null)
                  await load()
                } catch (err) { console.error('[PIOS compose]', err) }
                setComposeSending(false)
              }}
              style={{ padding: '8px 20px', background: 'var(--ai)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 500, cursor: composeSending ? 'wait' : 'pointer', opacity: composeSending || !compose.to.trim() ? 0.5 : 1 }}>
              {composeSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */
function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
