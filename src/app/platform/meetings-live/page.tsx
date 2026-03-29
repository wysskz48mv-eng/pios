'use client'
// PIOS™ v3.3.0 | Sprint F — Agentic Meeting Intelligence | VeritasIQ Technologies Ltd
import { useState, useRef, useEffect } from 'react'

interface ActionItem { task: string; owner: string|null; deadline: string|null; priority: string; category: string }
interface Decision   { decision: string; owner: string|null; deadline: string|null; confidence: string }
interface Risk       { risk: string; severity: string; mitigation: string|null }
interface Intelligence {
  decisions: Decision[]; action_items: ActionItem[]; commitments: any[]
  risks_flagged: Risk[]; follow_ups_required: any[]; key_insights: string[]
  topics_covered: string[]; meeting_health: string
}

const PRIORITY_COL: Record<string,string> = {urgent:'#ef4444',high:'#f59e0b',normal:'#22c55e'}
const HEALTH_COL: Record<string,string>   = {excellent:'#22c55e',productive:'#4dabf7',inconclusive:'#f59e0b','off-track':'#ef4444'}
const SEV_COL: Record<string,string>      = {critical:'#ef4444',high:'#f59e0b',medium:'#4dabf7'}

export default function MeetingsLivePage() {
  const [title,       setTitle]       = useState('')
  const [attendees,   setAttendees]   = useState('')
  const [transcript,  setTranscript]  = useState('')
  const [context,     setContext]     = useState('')
  const [processing,  setProcessing]  = useState(false)
  const [completing,  setCompleting]  = useState(false)
  const [intelligence,setIntelligence]= useState<Intelligence|null>(null)
  const [cosBriefing, setCosBriefing] = useState<string|null>(null)
  const [summary,     setSummary]     = useState<string|null>(null)
  const [tasksCreated,setTasksCreated]= useState<number>(0)
  const [error,       setError]       = useState<string|null>(null)
  const [stage,       setStage]       = useState<'input'|'active'|'complete'>('input')
  const [checkedTasks,setCheckedTasks]= useState<Set<number>>(new Set())
  const transcriptRef = useRef<HTMLTextAreaElement>(null)

  async function processTranscript() {
    if (!transcript.trim()) return
    setProcessing(true); setError(null)
    try {
      const r = await fetch('/api/meetings/live', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({action:'process', transcript, meetingTitle:title, attendees, context}),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Processing failed')
      setIntelligence(d.intelligence)
      setStage('active')
    } catch(e:any) { setError(e?.message ?? 'Network error') }
    setProcessing(false)
  }

  async function completeMeeting() {
    if (!intelligence) return
    setCompleting(true)
    try {
      const r = await fetch('/api/meetings/live', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({action:'complete', intelligence, meetingTitle:title}),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed')
      setCosBriefing(d.cos_briefing)
      setTasksCreated(d.tasks_created ?? 0)
      setStage('complete')
    } catch(e:any) { setError(e?.message ?? 'Network error') }
    setCompleting(false)
  }

  async function getSummary() {
    if (!intelligence) return
    const r = await fetch('/api/meetings/live', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action:'summary', intelligence, meetingTitle:title}),
    })
    const d = await r.json()
    setSummary(d.summary ?? null)
  }

  const S = {
    card: {background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px', marginBottom:12} as const,
    label: {fontSize:11, fontWeight:500 as const, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:'var(--color-text-tertiary)', display:'block', marginBottom:8},
    inp: {width:'100%', padding:'9px 12px', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-primary)', fontSize:13, fontFamily:'inherit'},
    btn: (col:string,text:string='#fff') => ({borderRadius:8, border:'none', background:col, color:text, padding:'9px 18px', cursor:'pointer', fontSize:13, fontWeight:500 as const}),
  }

  const intel = intelligence
  const C = {navy:'#0D2B52', teal:'#0A7A7A', gold:'#C9A84C'}

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:18, fontWeight:500, color:'var(--color-text-primary)', margin:0}}>Agentic Meeting Intelligence</h1>
        <p style={{fontSize:12, color:'var(--color-text-tertiary)', marginTop:4}}>
          Tana-style: work gets done during the meeting. Paste transcript → AI extracts decisions, actions, risks → auto-creates tasks → CoS briefing.
        </p>
      </div>

      {/* Stage: Input */}
      {stage === 'input' && (
        <div>
          <div style={S.card}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
              <div>
                <span style={S.label}>Meeting title</span>
                <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Q2 Strategy Review"
                  style={S.inp}/>
              </div>
              <div>
                <span style={S.label}>Attendees</span>
                <input value={attendees} onChange={e=>setAttendees(e.target.value)} placeholder="e.g. Dimitry, Ozlem Bak, Raja Sreedharan"
                  style={S.inp}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <span style={S.label}>Context (optional — active projects, pending decisions)</span>
              <textarea value={context} onChange={e=>setContext(e.target.value)} rows={2}
                placeholder="e.g. Qiddiya RFP deadline 14 Apr, PIOS pending Stripe live keys, DBA viva preparation underway…"
                style={{...S.inp, resize:'vertical'}}/>
            </div>
            <div style={{marginBottom:12}}>
              <span style={S.label}>Meeting transcript or notes</span>
              <textarea ref={transcriptRef} value={transcript} onChange={e=>setTranscript(e.target.value)} rows={12}
                placeholder="Paste transcript, meeting notes, or key points discussed...&#10;&#10;Can be raw transcript, bullet points, or any format — AI will extract the structure."
                style={{...S.inp, resize:'vertical'}}/>
            </div>
            {error && <p style={{fontSize:12, color:'#ef4444', marginBottom:10}}>{error}</p>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:11, color:'var(--color-text-tertiary)'}}>{transcript.split(/\s+/).filter(Boolean).length} words</span>
              <button onClick={processTranscript} disabled={processing || !transcript.trim()}
                style={{...S.btn(C.navy), opacity:processing||!transcript.trim()?0.5:1}}>
                {processing ? 'Processing…' : 'Extract intelligence →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage: Active — show intelligence */}
      {(stage === 'active' || stage === 'complete') && intel && (
        <div>
          {/* Header bar */}
          <div style={{...S.card, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:16}}>
            <div>
              <div style={{fontSize:15, fontWeight:500, color:'var(--color-text-primary)'}}>{title || 'Meeting'}</div>
              <div style={{fontSize:12, color:'var(--color-text-tertiary)'}}>
                {attendees && <span style={{marginRight:12}}>👥 {attendees}</span>}
                <span style={{padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500,
                  background:`${HEALTH_COL[intel.meeting_health]??'#999'}20`, color:HEALTH_COL[intel.meeting_health]??'#999'}}>
                  {intel.meeting_health}
                </span>
              </div>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {stage !== 'complete' && <>
                <button onClick={getSummary} style={{...S.btn('transparent', C.navy), border:`0.5px solid ${C.navy}44`}}>Quick summary</button>
                <button onClick={completeMeeting} disabled={completing}
                  style={{...S.btn(C.teal), opacity:completing?0.5:1}}>
                  {completing ? 'Completing…' : '⚡ Complete & create tasks'}
                </button>
              </>}
              <button onClick={()=>{setStage('input');setIntelligence(null);setCosBriefing(null);setSummary(null)}}
                style={{...S.btn('transparent','var(--color-text-secondary)'), border:'0.5px solid var(--color-border-tertiary)'}}>
                New meeting
              </button>
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div style={{...S.card, borderLeft:`3px solid ${C.gold}`, background:`${C.gold}08`, marginBottom:16}}>
              <p style={{fontSize:11, fontWeight:500, color:C.gold, marginBottom:8}}>EXECUTIVE SUMMARY</p>
              <pre style={{whiteSpace:'pre-wrap', fontSize:13, lineHeight:1.75, fontFamily:'inherit', margin:0, color:'var(--color-text-primary)'}}>{summary}</pre>
            </div>
          )}

          {/* CoS Briefing */}
          {cosBriefing && (
            <div style={{...S.card, borderLeft:`3px solid ${C.teal}`, background:`${C.teal}08`, marginBottom:16}}>
              <p style={{fontSize:11, fontWeight:500, color:C.teal, marginBottom:8, display:'flex', alignItems:'center', gap:6}}>
                ◈ CHIEF OF STAFF BRIEFING
                {tasksCreated > 0 && <span style={{fontSize:11, padding:'2px 8px', borderRadius:20, background:'#22c55e20', color:'#15803d', fontWeight:500}}>{tasksCreated} tasks auto-created</span>}
              </p>
              <pre style={{whiteSpace:'pre-wrap', fontSize:13, lineHeight:1.75, fontFamily:'inherit', margin:0, color:'var(--color-text-primary)'}}>{cosBriefing}</pre>
            </div>
          )}

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
            {/* Decisions */}
            <div style={S.card}>
              <p style={{fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>
                Decisions ({intel.decisions?.length ?? 0})
              </p>
              {intel.decisions?.length ? intel.decisions.map((d,i)=>(
                <div key={i} style={{padding:'8px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <div style={{fontSize:13, color:'var(--color-text-primary)', lineHeight:1.5, marginBottom:4}}>{d.decision}</div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    {d.owner && <span style={{fontSize:10, color:'var(--color-text-tertiary)'}}>Owner: {d.owner}</span>}
                    {d.deadline && <span style={{fontSize:10, color:'var(--color-text-tertiary)'}}>By: {d.deadline}</span>}
                    <span style={{fontSize:10, padding:'1px 6px', borderRadius:10, background:d.confidence==='firm'?'#f0fdf4':d.confidence==='deferred'?'#fef2f2':'#fffbeb', color:d.confidence==='firm'?'#15803d':d.confidence==='deferred'?'#b91c1c':'#b45309', fontWeight:500}}>{d.confidence}</span>
                  </div>
                </div>
              )) : <p style={{fontSize:12, color:'var(--color-text-tertiary)'}}>No decisions extracted</p>}
            </div>

            {/* Risks */}
            <div style={S.card}>
              <p style={{fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>
                Risks flagged ({intel.risks_flagged?.length ?? 0})
              </p>
              {intel.risks_flagged?.length ? intel.risks_flagged.map((r,i)=>(
                <div key={i} style={{padding:'8px 0', borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
                  <div style={{display:'flex', gap:6, alignItems:'flex-start', marginBottom:4}}>
                    <span style={{fontSize:10, padding:'1px 6px', borderRadius:10, background:`${SEV_COL[r.severity]??'#999'}20`, color:SEV_COL[r.severity]??'#999', fontWeight:500, flexShrink:0}}>{r.severity}</span>
                    <span style={{fontSize:13, color:'var(--color-text-primary)', lineHeight:1.5}}>{r.risk}</span>
                  </div>
                  {r.mitigation && <div style={{fontSize:11, color:'var(--color-text-tertiary)', marginLeft:44}}>→ {r.mitigation}</div>}
                </div>
              )) : <p style={{fontSize:12, color:'var(--color-text-tertiary)'}}>No risks flagged</p>}
            </div>
          </div>

          {/* Action items */}
          <div style={S.card}>
            <p style={{fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10}}>
              Action items ({intel.action_items?.length ?? 0}) {stage === 'complete' && tasksCreated > 0 && <span style={{fontSize:11, color:'#15803d'}}>— {tasksCreated} created in Tasks</span>}
            </p>
            {intel.action_items?.length ? intel.action_items.map((item,i)=>(
              <div key={i} style={{padding:'8px 0', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', gap:10, alignItems:'flex-start'}}>
                <input type="checkbox" checked={checkedTasks.has(i)}
                  onChange={()=>setCheckedTasks(p=>{const n=new Set(p);n.has(i)?n.delete(i):n.add(i);return n})}
                  style={{marginTop:3, flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, color:checkedTasks.has(i)?'var(--color-text-tertiary)':'var(--color-text-primary)', textDecoration:checkedTasks.has(i)?'line-through':'none', lineHeight:1.5, marginBottom:4}}>
                    {item.task}
                  </div>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <span style={{fontSize:10, padding:'1px 6px', borderRadius:10, background:`${PRIORITY_COL[item.priority]??'#999'}20`, color:PRIORITY_COL[item.priority]??'#999', fontWeight:500}}>{item.priority}</span>
                    {item.owner && <span style={{fontSize:10, color:'var(--color-text-tertiary)'}}>→ {item.owner}</span>}
                    {item.deadline && <span style={{fontSize:10, color:'var(--color-text-tertiary)'}}>by {item.deadline}</span>}
                    {item.category && <span style={{fontSize:10, color:'var(--color-text-tertiary)'}}>{item.category}</span>}
                  </div>
                </div>
              </div>
            )) : <p style={{fontSize:12, color:'var(--color-text-tertiary)'}}>No action items extracted</p>}
          </div>

          {/* Key insights */}
          {intel.key_insights?.length > 0 && (
            <div style={{...S.card, background:'var(--color-background-secondary)'}}>
              <p style={{fontSize:11, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>Key insights</p>
              {intel.key_insights.map((ins,i)=>(
                <div key={i} style={{fontSize:13, color:'var(--color-text-primary)', padding:'6px 0', borderBottom:'0.5px solid var(--color-border-tertiary)', lineHeight:1.5}}>
                  <span style={{color:C.gold, marginRight:8}}>◆</span>{ins}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
