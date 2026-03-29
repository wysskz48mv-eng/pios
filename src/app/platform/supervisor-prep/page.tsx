// @ts-nocheck
'use client'
// PIOS™ v3.6.1 | Sprint N — Supervisor Meeting Prep | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, Sparkles, BookOpen, User, FileText } from 'lucide-react'

const SUPERVISOR_NAMES = { bak: 'Dr Ozlem Bak', sreedharan: 'Dr Raja Sreedharan' }
const SUPERVISOR_COLS  = { bak: '#4f8ef7',       sreedharan: '#22c55e' }

export default function SupervisorPrepPage() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('agenda')
  const [aiLoad,    setAiLoad]    = useState(false)
  const [aiResult,  setAiResult]  = useState(null)
  const [aiType,    setAiType]    = useState(null)
  // Agenda form
  const [agForm, setAgForm] = useState({ supervisor_id:'bak', meeting_type:'Progress review', recent_work:'', open_questions:'' })
  // Debrief form
  const [rawNotes, setRawNotes] = useState('')
  const [debSup,   setDebSup]   = useState('bak')

  useEffect(() => {
    fetch('/api/supervisor-prep').then(r=>r.json()).then(d => {
      setData(d.ok?d:null); setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

  async function genAgenda() {
    setAiLoad(true); setAiResult(null); setAiType('agenda')
    try {
      const r = await fetch('/api/supervisor-prep?action=ai-agenda', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...agForm, chapters: data?.chapters ?? [] }),
      })
      const d = await r.json()
      setAiResult(d.agenda)
    } catch {}
    setAiLoad(false)
  }

  async function genDebrief() {
    if (!rawNotes.trim()) return
    setAiLoad(true); setAiResult(null); setAiType('debrief')
    try {
      const r = await fetch('/api/supervisor-prep?action=ai-debrief', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ raw_notes:rawNotes, supervisor_id:debSup }),
      })
      const d = await r.json()
      setAiResult(d.debrief)
    } catch {}
    setAiLoad(false)
  }

  const C = { navy:'#0D2B52', gold:'#C9A84C', teal:'#0A7A7A' }
  const card = { background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px', marginBottom:10 }
  const inp  = { width:'100%', padding:'8px 12px', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-primary)', fontSize:13, fontFamily:'inherit' }

  const totalWords  = (data?.chapters ?? []).reduce((s,c) => s + (c.word_count ?? 0), 0)
  const targetWords = (data?.chapters ?? []).reduce((s,c) => s + (c.target_words ?? 8000), 0)
  const dbaProgress = targetWords > 0 ? Math.round(totalWords / targetWords * 100) : 0

  return (
    <div style={{ fontFamily:'var(--font-sans,system-ui)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <BookOpen size={18} color={C.navy}/> Supervisor Meeting Prep
          </h1>
          <p style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>
            Portsmouth DBA · Dr Ozlem Bak · Dr Raja Sreedharan · AI agenda + debrief
          </p>
        </div>
      </div>

      {/* Thesis progress */}
      {data?.chapters?.length > 0 && (
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <p style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>DBA thesis progress</p>
            <span style={{ fontSize:16, fontWeight:700, color:dbaProgress>=60?'#22c55e':dbaProgress>=30?'#f59e0b':'#ef4444' }}>{dbaProgress}%</span>
          </div>
          <div style={{ height:6, background:'var(--color-border-tertiary)', borderRadius:3, overflow:'hidden', marginBottom:12 }}>
            <div style={{ height:'100%', width:`${dbaProgress}%`, background:dbaProgress>=60?'#22c55e':dbaProgress>=30?'#f59e0b':'#ef4444', borderRadius:3 }}/>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {data.chapters.map(ch => (
              <div key={ch.chapter_num} style={{ padding:'6px 12px', borderRadius:8, background:'var(--color-background-secondary)', fontSize:11 }}>
                <span style={{ color:'var(--color-text-tertiary)' }}>Ch{ch.chapter_num}: </span>
                <span style={{ color:'var(--color-text-primary)', fontWeight:500 }}>{ch.title?.slice(0,20)}</span>
                <span style={{ color:'var(--color-text-tertiary)', marginLeft:6 }}>{ch.word_count ?? 0}w</span>
                <span style={{ marginLeft:6, fontSize:10, padding:'1px 5px', borderRadius:6, background:ch.status==='complete'?'#f0fdf4':ch.status==='in_progress'?'#eff6ff':'var(--color-border-tertiary)', color:ch.status==='complete'?'#15803d':ch.status==='in_progress'?'#1d4ed8':'#64748b' }}>{ch.status}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:8 }}>{totalWords.toLocaleString()} / {targetWords.toLocaleString()} words across {data.chapters.length} chapters</p>
        </div>
      )}

      {/* Supervisors */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {Object.entries(SUPERVISOR_NAMES).map(([id,name]) => (
          <div key={id} style={{ ...card, marginBottom:0, borderLeft:`3px solid ${SUPERVISOR_COLS[id]}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <User size={14} color={SUPERVISOR_COLS[id]}/>
              <span style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>{name}</span>
            </div>
            <p style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>
              {id==='bak' ? 'Organisational learning · Knowledge management · HR development' : 'Operations management · Quality · Process improvement · Lean'}
            </p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {[
          { l:'Meetings logged',  v:data?.meetings?.length ?? 0 },
          { l:'Upcoming',         v:data?.upcoming_count ?? 0 },
          { l:'Overdue actions',  v:data?.overdue_actions ?? 0, col:data?.overdue_actions>0?'#ef4444':undefined },
        ].map(k => (
          <div key={k.l} style={{ padding:'10px 14px', borderRadius:8, background:'var(--color-background-secondary)', fontSize:12 }}>
            <span style={{ color:'var(--color-text-tertiary)' }}>{k.l}: </span>
            <span style={{ fontWeight:600, color:k.col??'var(--color-text-primary)' }}>{k.v}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:'0.5px solid var(--color-border-tertiary)', marginBottom:16 }}>
        {[['agenda','AI Agenda'],['debrief','Post-meeting'],['history','History']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ borderRadius:'6px 6px 0 0', border:'none', background:'transparent', color:tab===k?C.navy:'var(--color-text-secondary)', padding:'8px 14px 10px', cursor:'pointer', fontSize:13, fontWeight:tab===k?500:400, borderBottom:tab===k?`2px solid ${C.navy}`:'2px solid transparent' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Agenda tab */}
      {tab==='agenda' && (
        <div>
          <div style={card}>
            <p style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Generate AI meeting agenda</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Supervisor</p>
                <select value={agForm.supervisor_id} onChange={e => setAgForm(f => ({...f, supervisor_id:e.target.value}))} style={inp}>
                  {Object.entries(SUPERVISOR_NAMES).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Meeting type</p>
                <select value={agForm.meeting_type} onChange={e => setAgForm(f => ({...f, meeting_type:e.target.value}))} style={inp}>
                  {['Progress review','Chapter feedback','Methodology discussion','Literature review','Viva preparation','Annual review'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Recent work completed</p>
              <textarea value={agForm.recent_work} onChange={e => setAgForm(f => ({...f, recent_work:e.target.value}))}
                placeholder="What have you completed since the last meeting?" rows={2} style={{ ...inp, resize:'vertical' }}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Open questions for supervisor</p>
              <textarea value={agForm.open_questions} onChange={e => setAgForm(f => ({...f, open_questions:e.target.value}))}
                placeholder="Key questions you need input on" rows={2} style={{ ...inp, resize:'vertical' }}/>
            </div>
            <button onClick={genAgenda} disabled={aiLoad}
              style={{ borderRadius:8, border:'none', background:C.navy, color:'#fff', padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6, opacity:aiLoad?0.5:1 }}>
              {aiLoad&&aiType==='agenda'?<><Loader2 size={12}/>Generating…</>:<><Sparkles size={12}/>Generate agenda →</>}
            </button>
          </div>
          {aiResult && aiType==='agenda' && (
            <div style={{ ...card, borderLeft:`3px solid ${C.navy}`, background:'var(--color-background-secondary)' }}>
              <p style={{ fontSize:11, fontWeight:500, color:C.navy, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Sparkles size={11}/> AI MEETING AGENDA</p>
              <pre style={{ whiteSpace:'pre-wrap', fontSize:13, lineHeight:1.75, fontFamily:'inherit', margin:0, color:'var(--color-text-primary)' }}>{aiResult}</pre>
            </div>
          )}
        </div>
      )}

      {/* Debrief tab */}
      {tab==='debrief' && (
        <div>
          <div style={card}>
            <p style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Post-meeting debrief + action extraction</p>
            <div style={{ marginBottom:10 }}>
              <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Supervisor</p>
              <select value={debSup} onChange={e => setDebSup(e.target.value)} style={{ ...inp, width:'auto' }}>
                {Object.entries(SUPERVISOR_NAMES).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>Raw meeting notes</p>
              <textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)}
                placeholder="Paste your raw notes from the meeting — voice memo transcript, rough notes, WhatsApp messages, etc."
                rows={8} style={{ ...inp, resize:'vertical' }}/>
            </div>
            <button onClick={genDebrief} disabled={aiLoad||!rawNotes.trim()}
              style={{ borderRadius:8, border:'none', background:C.gold, color:'#0B0F1A', padding:'8px 16px', cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6, opacity:aiLoad||!rawNotes.trim()?0.5:1 }}>
              {aiLoad&&aiType==='debrief'?<><Loader2 size={12}/>Processing…</>:<><FileText size={12}/>Extract actions + debrief →</>}
            </button>
          </div>
          {aiResult && aiType==='debrief' && (
            <div style={card}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--color-text-primary)', marginBottom:4 }}>{aiResult.meeting_summary}</p>
              {aiResult.agreed_actions?.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <p style={{ fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Agreed actions</p>
                  {aiResult.agreed_actions.map((a, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'6px 0', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                      <span style={{ fontSize:12, padding:'1px 6px', borderRadius:6, fontWeight:600, background:a.priority==='high'?'#fef2f2':a.priority==='medium'?'#fffbeb':'#f8fafc', color:a.priority==='high'?'#b91c1c':a.priority==='medium'?'#b45309':'#64748b', flexShrink:0 }}>{a.priority}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:13, color:'var(--color-text-primary)' }}>{a.action}</p>
                        {a.due_date && <p style={{ fontSize:10, color:'var(--color-text-tertiary)', marginTop:2 }}>Due: {a.due_date}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {aiResult.supervisor_feedback?.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <p style={{ fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Supervisor feedback</p>
                  {aiResult.supervisor_feedback.map((f, i) => (
                    <div key={i} style={{ fontSize:12, color:'var(--color-text-secondary)', padding:'3px 0' }}>→ {f}</div>
                  ))}
                </div>
              )}
              {aiResult.next_meeting_focus && (
                <div style={{ marginTop:12, padding:'10px 12px', borderRadius:8, background:`${C.gold}10`, borderLeft:`3px solid ${C.gold}` }}>
                  <p style={{ fontSize:12, color:'var(--color-text-primary)' }}><strong>Next focus:</strong> {aiResult.next_meeting_focus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab==='history' && (
        <div>
          {(data?.meetings ?? []).length === 0 ? (
            <div style={{ ...card, textAlign:'center', padding:'3rem' }}>
              <p style={{ fontSize:30, marginBottom:12 }}>📅</p>
              <p style={{ fontSize:14, fontWeight:500, color:'var(--color-text-secondary)', marginBottom:6 }}>No meetings logged yet</p>
              <p style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>Use the debrief tab after each supervisor meeting to build your progress history.</p>
            </div>
          ) : (data.meetings).map(m => {
            const supCol = SUPERVISOR_COLS[m.supervisor_id] ?? C.navy
            return (
              <div key={m.id} style={{ ...card, borderLeft:`3px solid ${supCol}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:500 }}>{SUPERVISOR_NAMES[m.supervisor_id] ?? m.supervisor_id}</span>
                      <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{m.meeting_type}</span>
                    </div>
                    <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:3 }}>{m.meeting_date}</p>
                  </div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:m.status==='completed'?'#f0fdf4':'#eff6ff', color:m.status==='completed'?'#15803d':'#1d4ed8', fontWeight:500 }}>{m.status}</span>
                </div>
                {m.agreed_actions?.length > 0 && (
                  <p style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{m.agreed_actions.length} agreed action{m.agreed_actions.length!==1?'s':''}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
