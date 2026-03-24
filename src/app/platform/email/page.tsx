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
  return score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 4 ? '#eab308' : '#22c55e'
}


type EmailItem = {
  id: string; subject?: string; from?: string; to?: string
  date?: string; body?: string; summary?: string; category?: string
  priority_label?: string; priority_score?: number
  received_at?: string; provider?: string; is_read?: boolean
  [key: string]: unknown
}

type EmailAccount = {
  id: string; email: string; provider?: string; name?: string
  connected?: boolean; last_synced?: string
}

export default function EmailPage() {
  const [emails,   setEmails]   = useState<Record<string,unknown>[]>([])
  const [selected, setSelected] = useState<Record<string,unknown>|null>(null)
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [inboxFilter, setInboxFilter] = useState('all')
  const [accounts,    setAccounts]    = useState<Record<string,unknown>[]>([])
  const [replyText, setReplyText] = useState('')
  const [replying,  setReplying]  = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [compose, setCompose] = useState({ to:'', subject:'', body:'' })
  const [extracting, setExtracting] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [archiving, setArchiving] = useState<string|null>(null)
  const [banner, setBanner] = useState<{msg:string;ok:boolean}|null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
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
  }, [filter])

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
        setSelected((p: unknown) => ({ ...p, status: 'actioned' }))
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
      description: `From: ${selected.sender_name} <${selected.sender_email}>\n\n${selected.snippet?.slice(0,200)}`,
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
            AI-triaged · Gmail connected
            {unreadCount>0 && <span style={{ marginLeft:10,padding:'2px 8px',borderRadius:10,background:'rgba(239,68,68,0.1)',color:'#ef4444',fontSize:11,fontWeight:600 }}>{unreadCount} unread</span>}
          </p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowCompose(!showCompose)} style={{ fontSize:12 }}>✉ Compose</button>
          <button className="pios-btn pios-btn-primary" onClick={syncGmail} disabled={syncing} style={{ fontSize:12 }}>
            {syncing?'⟳ Syncing…':'↻ Sync Gmail'}
          </button>
        </div>
      </div>

      {/* Compose panel */}
      {showCompose && (
        <div className="pios-card" style={{ marginBottom:16,borderColor:'rgba(34,209,194,0.3)' }}>
          <div style={{ fontSize:13,fontWeight:600,marginBottom:12,color:'#22d3ee' }}>New message</div>
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
            {[['all','All inboxes'],...accounts.map((a: unknown)=>[a.context,a.label||a.display_name||a.email_address])].map(([v,l])=>(
              <button key={v} onClick={()=>setInboxFilter(v)} style={{ padding:'3px 10px',borderRadius:20,fontSize:10,border:'none',cursor:'pointer',background:inboxFilter===v?'#6c8eff':'var(--pios-surface2)',color:inboxFilter===v?'#fff':'var(--pios-muted)',fontWeight:inboxFilter===v?600:400 }}>{l}</button>
            ))}
          </div>
        )}
        {[['all','All'],['high','High priority'],['unread','Unread'],['academic','Academic'],['fm_consulting','FM'],['saas','SaaS'],['business','Business'],['personal','Personal']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'4px 12px',borderRadius:20,fontSize:11,border:'none',cursor:'pointer',background:filter===v?domainColour(v==='all'||v==='high'||v==='unread'?'personal':v):'var(--pios-surface2)',color:filter===v?'#0a0b0d':'var(--pios-muted)',fontWeight:filter===v?600:400 }}>{l}</button>
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
          {/* Email list */}
          <div className="pios-card" style={{ padding:0,overflow:'hidden' }}>
            {loading ? <p style={{ textAlign:'center' as const,padding:'40px',color:'var(--pios-muted)' }}>Loading…</p>
            : emails.map((e,i)=>(
              <div key={e.id as string} onClick={()=>setSelected(e)} style={{
                padding:'12px 16px',borderBottom:'1px solid var(--pios-border)',cursor:'pointer',
                background:selected?.id===e.id?'rgba(167,139,250,0.08)':e.status==='archived'?'rgba(255,255,255,0.02)':i%2===0?'transparent':'rgba(255,255,255,0.01)',
                transition:'background 0.1s',opacity:e.status==='archived'?0.5:1,
              }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                      {(Number(Number(e.priority_score ?? 0) ?? 0))>=6&&<div style={{ width:6,height:6,borderRadius:'50%',background:priorityColor((Number(Number(e.priority_score ?? 0) ?? 0))),flexShrink:0 }} />}
                      <span style={{ fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{e.sender_name||e.sender_email}</span>
                      {e.status==='actioned'&&<span style={{ fontSize:9,color:'#22c55e',marginLeft:2 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12,color:'var(--pios-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{String(e.subject ?? "")}</div>
                    {e.action_required&&<div style={{ fontSize:11,color:'#6c8eff',marginTop:3 }}>⚡ {e.action_required}</div>}
                  </div>
                  <div style={{ textAlign:'right' as const,flexShrink:0 }}>
                    {e.inbox_label&&<span style={{ fontSize:9,padding:'1px 5px',borderRadius:3,background:'rgba(108,142,255,0.12)',color:'#6c8eff',marginRight:4 }}>{e.inbox_label}</span>}{e.domain_tag&&<div style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:`${domainColour(e.domain_tag)}20`,color:domainColour(e.domain_tag),marginBottom:4,display:'inline-block' }}>{DOMAIN_LABELS[e.domain_tag]??e.domain_tag}</div>}
                    <div style={{ fontSize:10,color:'var(--pios-dim)' }}>{e.received_at?formatRelative(e.received_at):''}</div>
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
                <div style={{ fontSize:12,color:'var(--pios-muted)',marginBottom:8 }}>From: {selected.sender_name} &lt;{selected.sender_email}&gt;</div>
                {/* Action buttons */}
                <div style={{ display:'flex',gap:8,flexWrap:'wrap' as const }}>
                  <button onClick={extractInvoice} disabled={extracting} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #f59e0b40',background:'none',cursor:'pointer',color:'#f59e0b' }}>
                    {extracting?'⟳':'🧾'} Extract invoice
                  </button>
                  <button onClick={createTask} disabled={creatingTask} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #6c8eff40',background:'none',cursor:'pointer',color:'#6c8eff' }}>
                    {creatingTask?'⟳':'✓'} Create task
                  </button>
                  <button onClick={()=>archive(selected.id)} disabled={archiving===selected.id} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--pios-border)',background:'none',cursor:'pointer',color:'var(--pios-muted)' }}>
                    {archiving===selected.id?'⟳':'📦'} Archive
                  </button>
                </div>
              </div>

              {selected.action_required&&(
                <div style={{ padding:'10px 12px',borderRadius:8,background:'rgba(108,142,255,0.08)',marginBottom:12 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:'#6c8eff',marginBottom:4 }}>⚡ AI Action Required</div>
                  <div style={{ fontSize:12 }}>{selected.action_required}</div>
                </div>
              )}

              {selected.ai_draft_reply&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:6,display:'flex',alignItems:'center',gap:4 }}>
                    <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--ai)',display:'inline-block' }} />
                    AI Draft Reply
                  </div>
                  <div style={{ padding:'10px 12px',borderRadius:8,background:'var(--pios-surface2)',fontSize:12,lineHeight:1.65,whiteSpace:'pre-wrap' as const,cursor:'pointer' }}
                    onClick={()=>setReplyText(selected.ai_draft_reply)}>
                    {selected.ai_draft_reply}
                    <div style={{ fontSize:10,color:'#6c8eff',marginTop:6 }}>Click to use as reply →</div>
                  </div>
                </div>
              )}

              <div style={{ fontSize:13,lineHeight:1.75,color:'var(--pios-muted)',marginBottom:16,whiteSpace:'pre-wrap' as const }}>
                {selected.body_text||selected.snippet}
              </div>

              {/* Reply box */}
              <div style={{ borderTop:'1px solid var(--pios-border)',paddingTop:14 }}>
                <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:8 }}>Reply</div>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} className="pios-input"
                  placeholder={`Reply to ${selected.sender_name}…`} rows={4}
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
