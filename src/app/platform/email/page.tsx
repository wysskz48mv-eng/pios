'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { domainColour, formatRelative } from '@/lib/utils'

export default function EmailPage() {
  const [emails, setEmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('email_items').select('*').eq('user_id',user.id).order('received_at',{ascending:false}).limit(50)
    setEmails(data ?? [])
    setLoading(false)
  }
  async function syncGmail() {
    setSyncing(true)
    try {
      const res = await fetch('/api/email/sync', { method:'POST' })
      const d = await res.json()
      if (d.synced) load()
    } catch {}
    setSyncing(false)
  }

  const priorityColor = (score: number) => score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 4 ? '#eab308' : '#22c55e'

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>Inbox Intelligence</h1>
          <p style={{ fontSize:'13px', color:'var(--pios-muted)' }}>AI-triaged · Gmail connected</p>
        </div>
        <button className="pios-btn pios-btn-primary" onClick={syncGmail} disabled={syncing} style={{ fontSize:'12px' }}>
          {syncing ? 'Syncing…' : '↻ Sync Gmail'}
        </button>
      </div>

      {/* Gmail connect prompt if no emails */}
      {!loading && emails.length === 0 && (
        <div className="pios-card" style={{ textAlign:'center', padding:'48px', borderColor:'rgba(108,142,255,0.2)' }}>
          <div style={{ fontSize:'32px', marginBottom:'12px' }}>✉</div>
          <h2 style={{ fontSize:'16px', fontWeight:600, marginBottom:'8px' }}>Connect Gmail</h2>
          <p style={{ color:'var(--pios-muted)', fontSize:'13px', marginBottom:'20px', maxWidth:'400px', margin:'0 auto 20px' }}>
            PIOS will triage your inbox, prioritise emails by domain, extract action items, and draft replies — all without you asking.
          </p>
          <button className="pios-btn pios-btn-primary" onClick={syncGmail} style={{ fontSize:'13px', padding:'10px 24px' }}>
            Connect Gmail & Start Triaging
          </button>
          <p style={{ fontSize:'11px', color:'var(--pios-dim)', marginTop:'12px' }}>
            Requires Google OAuth with Gmail scope — granted at login
          </p>
        </div>
      )}

      {loading && <p style={{ textAlign:'center', padding:'40px', color:'var(--pios-muted)' }}>Loading inbox…</p>}

      {emails.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
          {/* Email list */}
          <div className="pios-card" style={{ padding:0, overflow:'hidden' }}>
            {emails.map((e,i) => (
              <div key={e.id} onClick={()=>setSelected(e)} style={{
                padding:'12px 16px', borderBottom:'1px solid var(--pios-border)', cursor:'pointer',
                background: selected?.id===e.id ? 'rgba(167,139,250,0.08)' : i%2===0?'transparent':'rgba(255,255,255,0.01)',
                transition:'background 0.1s',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                      {e.priority_score >= 6 && <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:priorityColor(e.priority_score), flexShrink:0 }} />}
                      <span style={{ fontSize:'12px', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.sender_name||e.sender_email}</span>
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--pios-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.subject}</div>
                    {e.action_required && <div style={{ fontSize:'11px', color:'#6c8eff', marginTop:'3px' }}>⚡ {e.action_required}</div>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    {e.domain_tag && <div style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'3px', background:`${domainColour(e.domain_tag)}20`, color:domainColour(e.domain_tag), marginBottom:'4px' }}>{e.domain_tag}</div>}
                    <div style={{ fontSize:'10px', color:'var(--pios-dim)' }}>{e.received_at?formatRelative(e.received_at):''}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Email detail */}
          <div className="pios-card">
            {selected ? (
              <>
                <div style={{ marginBottom:'16px', paddingBottom:'16px', borderBottom:'1px solid var(--pios-border)' }}>
                  <div style={{ fontSize:'16px', fontWeight:600, marginBottom:'4px' }}>{selected.subject}</div>
                  <div style={{ fontSize:'12px', color:'var(--pios-muted)' }}>From: {selected.sender_name} &lt;{selected.sender_email}&gt;</div>
                </div>
                {selected.action_required && (
                  <div style={{ padding:'10px', borderRadius:'8px', background:'rgba(108,142,255,0.08)', marginBottom:'12px' }}>
                    <div style={{ fontSize:'11px', fontWeight:600, color:'#6c8eff', marginBottom:'4px' }}>⚡ AI Action Required</div>
                    <div style={{ fontSize:'12px' }}>{selected.action_required}</div>
                  </div>
                )}
                {selected.ai_draft_reply && (
                  <div style={{ marginBottom:'12px' }}>
                    <div style={{ fontSize:'11px', fontWeight:600, color:'var(--pios-muted)', marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px' }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--ai)', display:'inline-block' }} />
                      AI Draft Reply
                    </div>
                    <div style={{ padding:'10px', borderRadius:'8px', background:'var(--pios-surface2)', fontSize:'12px', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{selected.ai_draft_reply}</div>
                    <button className="pios-btn pios-btn-primary" style={{ fontSize:'12px', marginTop:'8px' }}>Send Reply</button>
                  </div>
                )}
                <div style={{ fontSize:'13px', lineHeight:1.7, color:'var(--pios-muted)' }}>{selected.snippet}</div>
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--pios-dim)' }}>Select an email to view</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
