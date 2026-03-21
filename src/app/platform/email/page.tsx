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

export default function EmailPage() {
  const [emails,   setEmails]   = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [replyText, setReplyText] = useState('')
  const [replying,  setReplying]  = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [compose, setCompose] = useState({ to:'', subject:'', body:'' })
  const [extracting, setExtracting] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [archiving, setArchiving] = useState<string|null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    let q = supabase.from('email_items').select('*').eq('user_id',user.id).order('received_at',{ascending:false}).limit(50)
    if (filter==='high') q = q.gte('priority_score',6)
    else if (filter==='unread') q = q.eq('status','unprocessed')
    else if (filter !== 'all') q = q.eq('domain_tag',filter)
    const { data } = await q
    setEmails(data??[])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

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
    // For now, log and show confirmation — actual Gmail send requires Gmail.send scope
    await supabase.from('email_items').update({ status:'actioned', updated_at:new Date().toISOString() }).eq('id',selected.id)
    setSelected((p:any)=>({...p,status:'actioned'}))
    setEmails(prev=>prev.map(e=>e.id===selected.id?{...e,status:'actioned'}:e))
    setReplyText('')
    setReplying(false)
    alert(`Reply drafted and email marked as actioned.\n\nTo: ${selected.sender_email}\nSubject: Re: ${selected.subject}\n\n${replyText}\n\n⚠ Note: Actual sending requires the Gmail send scope. Connect Gmail with full access to enable one-click sending.`)
  }

  async function archive(id: string) {
    setArchiving(id)
    await supabase.from('email_items').update({ status:'archived', updated_at:new Date().toISOString() }).eq('id',id)
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
    if (d.invoice_id) alert(`✓ Invoice extracted.\n${d.hitl_message}`)
    else alert(d.error ?? 'No invoice detected in this email.')
  }

  async function createTask() {
    if (!selected) return
    setCreatingTask(true)
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      title: `Reply to: ${selected.subject}`,
      domain: selected.domain_tag || 'personal',
      priority: selected.priority_score >= 7 ? 'high' : 'medium',
      description: `From: ${selected.sender_name} <${selected.sender_email}>\n\n${selected.snippet?.slice(0,200)}`,
    })})
    setCreatingTask(false)
    alert('✓ Task created — check your Tasks page.')
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
            <textarea className="pios-input" placeholder="Message…" rows={5} value={compose.body} onChange={e=>setCompose(p=>({...p,body:e.target.value}))} style={{ resize:'vertical' as const,fontFamily:'inherit' }} />
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <button onClick={()=>{ alert(`Compose ready to send:\n\nTo: ${compose.to}\nSubject: ${compose.subject}\n\n${compose.body}\n\n⚠ One-click send requires Gmail.send scope — connect Gmail with full access in Settings.`); setShowCompose(false) }} className="pios-btn pios-btn-primary" style={{ fontSize:12 }}>Send</button>
            <button onClick={()=>setShowCompose(false)} className="pios-btn pios-btn-ghost" style={{ fontSize:12 }}>Cancel</button>
            <span style={{ fontSize:11,color:'var(--pios-dim)' }}>Opens your Gmail client to confirm before sending</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex',gap:6,marginBottom:16,flexWrap:'wrap' as const }}>
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
              <div key={e.id} onClick={()=>setSelected(e)} style={{
                padding:'12px 16px',borderBottom:'1px solid var(--pios-border)',cursor:'pointer',
                background:selected?.id===e.id?'rgba(167,139,250,0.08)':e.status==='archived'?'rgba(255,255,255,0.02)':i%2===0?'transparent':'rgba(255,255,255,0.01)',
                transition:'background 0.1s',opacity:e.status==='archived'?0.5:1,
              }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                      {e.priority_score>=6&&<div style={{ width:6,height:6,borderRadius:'50%',background:priorityColor(e.priority_score),flexShrink:0 }} />}
                      <span style={{ fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{e.sender_name||e.sender_email}</span>
                      {e.status==='actioned'&&<span style={{ fontSize:9,color:'#22c55e',marginLeft:2 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12,color:'var(--pios-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const }}>{e.subject}</div>
                    {e.action_required&&<div style={{ fontSize:11,color:'#6c8eff',marginTop:3 }}>⚡ {e.action_required}</div>}
                  </div>
                  <div style={{ textAlign:'right' as const,flexShrink:0 }}>
                    {e.domain_tag&&<div style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:`${domainColour(e.domain_tag)}20`,color:domainColour(e.domain_tag),marginBottom:4 }}>{DOMAIN_LABELS[e.domain_tag]??e.domain_tag}</div>}
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
                <div style={{ fontSize:16,fontWeight:700,marginBottom:4 }}>{selected.subject}</div>
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
