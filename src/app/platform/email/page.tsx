'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { domainColour, formatRelative } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Inbox Intelligence — Gmail sync, triage, compose, reply, archive, filing
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string,string> = {
  academic:'Academic', fm_consulting:'FM Consulting', saas:'SaaS', business:'Business', personal:'Personal'
}

function priorityColor(score: number) {
  return score >= 8 ? 'var(--dng)' : score >= 6 ? 'var(--ops)' : score >= 4 ? '#eab308' : 'var(--fm)'
}


type EmailItem = {
  id: string; subject?: string; from?: string; to?: string
  date?: string; body?: string; snippet?: string; summary?: string
  category?: string; priority_label?: string; priority_score?: number
  received_at?: string; provider?: string; is_read?: boolean
  thread_id?: string; labels?: string[]; ai_category?: string
  sentiment?: string; action_items?: string
  [key: string]: unknown
}

type EmailAccount = {
  id: string; email: string; provider?: string; name?: string
  connected?: boolean; last_synced?: string
}

export default function EmailPage() {
  const [emails,   setEmails]   = useState<Record<string,unknown>[]>([])
  const [selected, setSelected] = useState<EmailItem|null>(null)
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [inboxFilter, setInboxFilter] = useState('all')
  const [accounts,    setAccounts]    = useState<EmailAccount[]>([])
  const [replyText, setReplyText] = useState('')
  const [replying,  setReplying]  = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [compose, setCompose] = useState({ to:'', subject:'', body:'' })
  const [extracting, setExtracting] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [archiving, setArchiving] = useState<string|null>(null)
  const [banner, setBanner] = useState<{msg:string;ok:boolean}|null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {  // eslint-disable-line react-hooks/exhaustive-deps
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const params = new URLSearchParams({ limit: '50' })
    if (filter==='high')   params.set('min_priority','6')
    else if (filter==='unread') params.set('status','unprocessed')
    else if (filter !== 'all')  params.set('domain', filter)
    if (inboxFilter !== 'all')  params.set('inbox_context', inboxFilter)
    const res = await fetch(`/api/email/items?${params}`)
    const d   = res.ok ? await res.json() : {}
    setEmails(d.emails ?? d.items ?? [])
    setLoading(false)
  }, [filter, inboxFilter])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/email/accounts').then(r=>r.ok?r.json():null).then(d=>{ if(d) setAccounts(d.accounts??[]) }).catch(()=>{})
  }, [])

  async function syncGmail() {
    setSyncing(true)
    const res = await fetch('/api/email/sync', { method:'POST' })
    const d = await res.json()
    if (d.synced) load()
    setSyncing(false)
  }

  // Use Gmail API to send reply via user's token
  async function sendReply() {
    if (!replyText.trim() || !selected) return
    setReplying(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.sender_email,
          subject: `Re: ${String(selected.subject ?? "")}`,
          body: replyText,
          email_item_id: selected.id,
        }),
      })
      const d = await res.json()
      if (d.sent) {
        setSelected(p => p ? ({ ...p, status: 'actioned' } as EmailItem) : null)
        setEmails(prev => prev.map((e: Record<string,unknown>) => e.id === selected.id ? { ...(e as Record<string,unknown>), status: 'actioned' } : e))
        setReplyText('')
      } else if (d.code === 'GOOGLE_NOT_CONNECTED' || d.code === 'INSUFFICIENT_SCOPE') {
        setBanner({msg:`⚠ ${d.error}\n\nGo to Settings → Connect Google Account to grant Gmail access.`, ok:false})
      } else {
        setBanner({msg:`Send failed: ${d.error ?? 'Unknown error'}`, ok:false})
      }
    } catch (err: unknown) {
      setBanner({msg:`Send failed: ${(err as Error).message}`, ok:false})
    }
    setReplying(false)
  }

  async function archive(id: string) {
    setArchiving(id)
    await fetch('/api/email/items', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, status:'archived' }) })
    setEmails(prev=>prev.filter(e=>e.id!==id))
    if (selected?.id===id) setSelected(null)
    setArchiving(null)
  }

  async function extractInvoice() {
    if (!selected) return
    setExtracting(true)
    const res = await fetch('/api/files/invoice', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ source:'email', source_id:selected.id }) })
    const d = await res.json()
    setExtracting(false)
    if (d.invoice_id) setBanner({msg:`✓ Invoice extracted.\n${d.hitl_message}`, ok:true})
    else setBanner({msg:d.error ?? 'No invoice detected in this email.', ok:false})
  }

  async function createTask() {
    if (!selected) return
    setCreatingTask(true)
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      title: `Reply to: ${String(selected.subject ?? "")}`,
      domain: selected.domain_tag || 'personal',
      priority: (Number(Number(selected.priority_score ?? 0) ?? 0)) >= 7 ? 'high' : 'medium',
      description: `From: ${String(selected.sender_name ?? "")} <${String(selected.sender_email ?? "")}>\n\n${selected.snippet?.slice(0,200)}`,
    })})
    setCreatingTask(false)
    setBanner({msg:'✓ Task created — check your Tasks page.', ok:true})
  }

  const unreadCount = emails.filter(e=>e.status==='unprocessed'||e.status==='triaged').length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:700,marginBottom:4 }}>Inbox Intelligence</h1>
          <p style={{ fontSize:13,color:'var(--pios-muted)' }}>
            {accounts.length > 0 ? 'AI-triaged · Gmail connected' : 'Connect Gmail to start triaging your inbox'}
            {unreadCount>0 && <span style={{ marginLeft:10,padding:'2px 8px',borderRadius:10,background:'rgba(239,68,68,0.1)',color:'var(--dng)',fontSize:11,fontWeight:600 }}>{unreadCount} unread</span>}
          </p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          {accounts.length === 0 ? (
            <a href="/api/auth/connect-gmail" style={{ fontSize:12, padding:'8px 16px', borderRadius:9, background:'var(--ai)', color:'#fff', textDecoration:'none', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="rgba(255,255,255,0.8)" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="rgba(255,255,255,0.6)" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/><path fill="rgba(255,255,255,0.9)" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/></svg>
              Connect Gmail →
            </a>
          ) : (
            <>
              <button className="pios-btn pios-btn-ghost" onClick={()=>setShowCompose(!showCompose)} style={{ fontSize:12 }}>✉ Compose</button>
              <button className="pios-btn pios-btn-primary" onClick={syncGmail} disabled={syncing} style={{ fontSize:12 }}>
                {syncing?'⟳ Syncing…':'↻ Sync Gmail'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Compose panel */}
      {showCompose && (
        <div className="pios-card" style={{ marginBottom:16,borderColor:'rgba(34,209,194,0.3)' }}>
          <div style={{ fontSize:13,fontWeight:600,marginBottom:12,color:'var(--pro)' }}>New message</div>
          <div style={{ display:'flex',flexDirection:'column' as const,gap:8,marginBottom:10 }}>
            <input className="pios-input" placeholder="To: email@example.com" value={compose.to} onChange={e=>setCompose(p=>({...p,to:e.target.value}))} />
            <input className="pios-input" placeholder="Subject" value={compose.subject} onChange={e=>setCompose(p=>({...p,subject:e.target.value}))} />
            <textarea className="pios-input" placeholder="Message…" rows={5} value={typeof compose.body === 'string' ? compose.body : String(compose.body ?? '')} onChange={e=>setCompose(p=>({...p,body:e.target.value}))} style={{ resize:'vertical' as const,fontFamily:'inherit' }} />
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <button onClick={async()=>{
              if (!compose.to.trim() || !compose.subject.trim() || !compose.body.trim()) return
              const res = await fetch('/api/email/send', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ to: compose.to, subject: compose.subject, body: compose.body }),
              })
              const d = await res.json()
              if (d.sent) {
                setCompose({to:'',subject:'',body:''})
                setShowCompose(false)
                setBanner({msg:'✓ Email sent.', ok:true})
              } else if (d.code === 'GOOGLE_NOT_CONNECTED' || d.code === 'INSUFFICIENT_SCOPE') {
                setBanner({msg:`⚠ ${d.error}`, ok:false})
              } else {
                setBanner({msg:`Send failed: ${d.error ?? 'Unknown error'}`, ok:false})
              }
            }} className="pios-btn pios-btn-primary" style={{ fontSize:12 }}>Send</button>
            <button onClick={()=>setShowCompose(false)} className="pios-btn pios-btn-ghost" style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex',gap:6,marginBottom:16,flexWrap:'wrap' as const }}>
        {accounts.length > 1 && (
          <div style={{ display:'flex',gap:4,flexWrap:'wrap' as const,marginBottom:6 }}>
            {[['all','All inboxes'],...accounts.map((a: EmailAccount)=>[a.id, String(a.email ?? a.name ?? '')])].map(([v,l])=>(
              <button key={v} onClick={()=>setInboxFilter(v)} style={{ padding:'3px 10px',borderRadius:20,fontSize:10,border:'none',cursor:'pointer',background:inboxFilter===v?'var(--academic)':'var(--pios-surface2)',color:inboxFilter===v?'#fff':'var(--pios-muted)',fontWeight:inboxFilter===v?600:400 }}>{l}</button>
            ))}
          </div>
        )}
        {[['all','All'],['high','High priority'],['unread','Unread'],['academic','Academic'],['fm_consulting','FM'],['saas','SaaS'],['business','Business'],['personal','Personal']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'4px 12px',borderRadius:20,fontSize:11,border:'none',cursor:'pointer',background:filter===v?domainColour(v==='all'||v==='high'||v==='unread'?'personal':v):'var(--pios-surface2)',color:filter===v?'#fff':'var(--pios-muted)',fontWeight:filter===v?600:400 }}>{l}</button>
        ))}
      </div>

      {!loading && emails.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const,padding:'48px' }}>
          <div style={{ fontSize:32,marginBottom:12 }}>✉</div>
          <h2 style={{ fontSize:16,fontWeight:600,marginBottom:8 }}>Connect Gmail</h2>
          <p style={{ color:'var(--pios-muted)',fontSize:13,marginBottom:20,maxWidth:400,margin:'0 auto 20px' }}>
            PIOS will triage your inbox, prioritise emails by domain, extract action items, and draft replies.
          </p>
          <button className="pios-btn pios-btn-primary" onClick={syncGmail} style={{ fontSize:13,padding:'10px 24px' }}>Connect Gmail & Start Triaging</button>
        </div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:selected?'1fr 1fr':'1fr',gap:16 }}>
          {/* No accounts connected */}
      {accounts.length === 0 && !loading && (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'48px 24px', marginBottom:16 }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📧</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Connect your Gmail</div>
          <p style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:24, maxWidth:400, margin:'0 auto 24px' }}>
            PIOS will triage your inbox, extract action items from emails, auto-capture receipts, and include email context in your daily brief.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' as const }}>
            <a href="/api/auth/connect-gmail" className="pios-btn pios-btn-primary" style={{ textDecoration:'none', fontSize:13 }}>
              🔗 Connect Gmail
            </a>
            <a href="/platform/settings" className="pios-btn pios-btn-ghost" style={{ textDecoration:'none', fontSize:13 }}>
              ⚙ Settings
            </a>
          </div>
        </div>
      )}

      {/* Email list */}
          <div className="pios-card" style={{ padding:0,overflow:'hidden' }}>
            {loading ? <p style={{ textAlign:'center' as const,padding:'40px',color:'var(--pios-muted)' }}>Loading…</p>
            : emails.map((e,i)=>(
              <div key={e.id as string} onClick={()=>setSelected(e as EmailItem)} style={{
                padding:'12px 16px',borderBottom:'1px solid var(--pios-border)',cursor:'pointer',
                background:selected?.id===e.id?'var(--ai-subtle)':e.status==='archived'?'rgba(255,255,255,0.02)':i%2===0?'transparent':'rgba(255,255,255,0.01)',
                transition:'background 0.1s',opacity:e.status==='archived'?0.5:1,
              }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                      {(Number(Number(e.priority_score ?? 0) ?? 0))>=6&&<div style={{ width:6,height:6,borderRadius:'50%',background:priorityColor((Number(Number(e.priority_score ?? 0) ?? 0))),flexShrink:0 }} />}
                      <span style={{ fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{String(e.sender_name ?? e.sender_email ?? "")}</span>
                      {e.status==='actioned'&&<span style={{ fontSize:9,color:'var(--fm)',marginLeft:2 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12,color:'var(--pios-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{String(e.subject ?? "")}</div>
                    {Boolean(e.action_required)&&<div style={{ fontSize:11,color:'var(--academic)',marginTop:3 }}>⚡ {String(e.action_required ?? "")}</div>}
                  </div>
                  <div style={{ textAlign:'right' as const,flexShrink:0 }}>
                    {Boolean(e.inbox_label)&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(108,142,255,0.12)',color:'var(--academic)',marginRight:4 }}>{String(e.inbox_label ?? "")}</span>}{Boolean(e.domain_tag)&&<div style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:`${domainColour(String(e.domain_tag ?? ''))}20`,color:domainColour(String(e.domain_tag ?? '')),marginBottom:4,display:'inline-block' }}>{(DOMAIN_LABELS as Record<string,string>)[String(e.domain_tag ?? "")] ?? String(e.domain_tag ?? "")}</div>}
                    <div style={{ fontSize:10,color:'var(--pios-dim)' }}>{e.received_at?formatRelative(String(e.received_at ?? '')):''}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Email detail */}
          {selected && (
            <div className="pios-card" style={{ padding:20,overflowY:'auto' as const,maxHeight:'80vh' }}>
              <div style={{ marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--pios-border)' }}>
                <div style={{ fontSize:16,fontWeight:700,marginBottom:4 }}>{String(selected.subject ?? "")}</div>
                <div style={{ fontSize:12,color:'var(--pios-muted)',marginBottom:8 }}>From: {String(selected.sender_name ?? "")} &lt;{String(selected.sender_email ?? "")}&gt;</div>
                {/* Action buttons */}
                <div style={{ display:'flex',gap:8,flexWrap:'wrap' as const }}>
                  <button onClick={extractInvoice} disabled={extracting} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--saas)40',background:'none',cursor:'pointer',color:'var(--saas)' }}>
                    {extracting?'⟳':'🧾'} Extract invoice
                  </button>
                  <button onClick={createTask} disabled={creatingTask} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--academic)40',background:'none',cursor:'pointer',color:'var(--academic)' }}>
                    {creatingTask?'⟳':'✓'} Create task
                  </button>
                  <button onClick={()=>archive(selected.id)} disabled={archiving===selected.id} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--pios-border)',background:'none',cursor:'pointer',color:'var(--pios-muted)' }}>
                    {archiving===selected.id?'⟳':'📦'} Archive
                  </button>
                </div>
              </div>

              {Boolean(selected.action_required)&&(
                <div style={{ padding:'10px 12px',borderRadius:8,background:'rgba(108,142,255,0.08)',marginBottom:12 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:'var(--academic)',marginBottom:4 }}>⚡ AI Action Required</div>
                  <div style={{ fontSize:12 }}>{String(selected.action_required ?? "")}</div>
                </div>
              )}

              {Boolean(selected.ai_draft_reply)&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:6,display:'flex',alignItems:'center',gap:4 }}>
                    <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--ai)',display:'inline-block' }} />
                    AI Draft Reply
                  </div>
                  <div style={{ padding:'10px 12px',borderRadius:8,background:'var(--pios-surface2)',fontSize:12,lineHeight:1.65,whiteSpace:'pre-wrap' as const,cursor:'pointer' }}
                    onClick={()=>setReplyText(String(selected.ai_draft_reply ?? ""))}>
                    {String(selected.ai_draft_reply ?? "")}
                    <div style={{ fontSize:10,color:'var(--academic)',marginTop:6 }}>Click to use as reply →</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize:13,lineHeight:1.75,color:'var(--pios-muted)',marginBottom:16,whiteSpace:'pre-wrap' as const }}>
                {String(selected.body_text ?? selected.snippet ?? "")}
              </div>

              {/* Reply box */}
              <div style={{ borderTop:'1px solid var(--pios-border)',paddingTop:14 }}>
                <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:8 }}>Reply</div>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} className="pios-input"
                  placeholder={`Reply to ${String(selected.sender_name ?? "")}…`} rows={4}
                  style={{ width:'100%',resize:'vertical' as const,fontFamily:'inherit',marginBottom:8 }} />
                <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                  <button className="pios-btn pios-btn-primary" onClick={sendReply} disabled={replying||!replyText.trim()} style={{ fontSize:12 }}>
                    {replying?'⟳ Sending…':'Send reply'}
                  </button>
                  <button className="pios-btn pios-btn-ghost" onClick={()=>setReplyText('')} style={{ fontSize:12 }}>Clear</button>
                  <span style={{ fontSize:10,color:'var(--pios-dim)' }}>Requires Gmail send scope</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
