'use client'
import { useEffect, useState, useCallback } from 'react'
import { domainColour, domainLabel } from '@/lib/utils'

const DOMAINS  = ['academic','fm_consulting','saas','business','personal'] as const
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_HDR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function Spinner() {
  return <div style={{ display:'flex',alignItems:'center',gap:8,color:'var(--pios-muted)',fontSize:13,padding:'32px 0',justifyContent:'center' }}>
    <div style={{ width:14,height:14,border:'2px solid rgba(34,211,238,0.2)',borderTop:'2px solid #22d3ee',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />Loading…
  </div>
}
function fmt(iso:string){ return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) }
function dur(s:string,e:string){ const m=Math.round((new Date(e).getTime()-new Date(s).getTime())/60000); return m<60?`${m}m`:`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}` }

function EventModal({ event, onClose, onSave, onDelete }:{ event:any;onClose:()=>void;onSave:(id:string,d:any)=>void;onDelete:(id:string)=>void }) {
  const isNew = !event.id
  const [editing,setEditing]=useState(isNew)
  const [brief,setBrief]=useState(event.ai_brief??null)
  const [loadingBrief,setLoadingBrief]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({ title:event.title??'', description:event.description??'', domain:event.domain??'personal', start_time:event.start_time?event.start_time.slice(0,16):'', end_time:event.end_time?event.end_time.slice(0,16):'', location:event.location??'', all_day:event.all_day??false })
  const f=(k:string,v:any)=>setForm(p=>({...p,[k]:v}))

  async function save(){
    if(!form.title.trim())return
    setSaving(true)
    await onSave(event.id,{...form,start_time:new Date(form.start_time).toISOString(),end_time:new Date(form.end_time||form.start_time).toISOString()})
    setSaving(false);onClose()
  }
  async function getAIBrief(){
    setLoadingBrief(true)
    const res=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ai_brief',id:event.id})})
    const d=await res.json()
    if(d.brief)setBrief(d.brief)
    setLoadingBrief(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.6)' }} />
      <div style={{ position:'relative',background:'var(--pios-surface)',borderRadius:16,border:'1px solid var(--pios-border)',padding:28,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto' as const }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
          <div style={{ flex:1,minWidth:0 }}>
            {editing?<input className="pios-input" value={form.title} onChange={e=>f('title',e.target.value)} style={{ fontSize:17,fontWeight:700,marginBottom:6 }} autoFocus placeholder="Event title…" />
              :<h2 style={{ fontSize:17,fontWeight:700,lineHeight:1.3,marginBottom:4 }}>{event.title}</h2>}
            <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const }}>
              <span style={{ fontSize:11,padding:'2px 8px',borderRadius:20,background:domainColour(event.domain||'personal')+'20',color:domainColour(event.domain||'personal'),fontWeight:600 }}>{domainLabel(event.domain||'personal')}</span>
              {event.source==='google'&&<span style={{ fontSize:11,color:'#4285F4' }}>📅 Google</span>}
              {event.google_meet_url&&<a href={event.google_meet_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11,color:'#22c55e' }}>🎥 Join Meet</a>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,marginLeft:12 }}>✕</button>
        </div>

        {editing?(
          <div style={{ display:'flex',flexDirection:'column' as const,gap:10 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Start</div><input type="datetime-local" className="pios-input" value={form.start_time} onChange={e=>f('start_time',e.target.value)} /></div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>End</div><input type="datetime-local" className="pios-input" value={form.end_time} onChange={e=>f('end_time',e.target.value)} /></div>
            </div>
            <select className="pios-input" value={form.domain} onChange={e=>f('domain',e.target.value)}>
              {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <input className="pios-input" placeholder="Location…" value={form.location} onChange={e=>f('location',e.target.value)} />
            <textarea className="pios-input" placeholder="Description…" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} style={{ resize:'vertical' as const,fontFamily:'inherit' }} />
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button className="pios-btn pios-btn-primary" onClick={save} disabled={saving} style={{ flex:1,fontSize:12 }}>{saving?'Saving…':isNew?'Create event':'Save changes'}</button>
              <button className="pios-btn pios-btn-ghost" onClick={()=>isNew?onClose():setEditing(false)} style={{ fontSize:12 }}>Cancel</button>
            </div>
          </div>
        ):(
          <div style={{ display:'flex',flexDirection:'column' as const,gap:12 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Start',value:`${new Date(event.start_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} ${fmt(event.start_time)}` },
                { label:'Duration',value:dur(event.start_time,event.end_time) },
                ...(event.location?[{ label:'Location',value:event.location }]:[]),
                ...(event.attendees?.length?[{ label:'Attendees',value:`${event.attendees.length} people` }]:[]),
              ].map((fi:any)=>(
                <div key={fi.label} style={{ padding:'8px 10px',borderRadius:6,background:'var(--pios-surface2)' }}>
                  <div style={{ fontSize:10,color:'var(--pios-dim)',textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:2 }}>{fi.label}</div>
                  <div style={{ fontSize:12,fontWeight:600 }}>{fi.value}</div>
                </div>
              ))}
            </div>
            {event.description&&<div style={{ padding:'10px 12px',borderRadius:8,background:'var(--pios-surface2)',fontSize:12,color:'var(--pios-muted)',lineHeight:1.65 }}>{event.description}</div>}
            {event.attendees?.length>0&&(
              <div>
                <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:6,textTransform:'uppercase' as const,letterSpacing:'0.06em' }}>Attendees</div>
                <div style={{ display:'flex',flexWrap:'wrap' as const,gap:6 }}>
                  {event.attendees.map((a:any,i:number)=><span key={i} style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:'var(--pios-surface2)',color:'var(--pios-muted)' }}>{a.name??a.email}</span>)}
                </div>
              </div>
            )}
            {event.id&&(
              <div>
                {brief?(
                  <div style={{ padding:'12px 14px',borderRadius:8,background:'rgba(167,139,250,0.08)',borderLeft:'3px solid #a78bfa' }}>
                    <div style={{ fontSize:11,fontWeight:600,color:'#a78bfa',marginBottom:6 }}>✦ AI Pre-meeting Brief</div>
                    <div style={{ fontSize:12,color:'var(--pios-text)',lineHeight:1.65 }}>{brief}</div>
                  </div>
                ):(
                  <button onClick={getAIBrief} disabled={loadingBrief} style={{ width:'100%',padding:'8px',borderRadius:8,border:'1px dashed rgba(167,139,250,0.3)',background:'none',cursor:'pointer',color:'#a78bfa',fontSize:12 }}>
                    {loadingBrief?'⟳ Generating…':'✦ Get AI pre-meeting brief'}
                  </button>
                )}
              </div>
            )}
            {/* Meeting notes deep-link — shown for past events */}
            {event.id && new Date(event.start_time) < new Date() && (
              <a
                href={`/platform/meetings?prefill=${encodeURIComponent(event.title ?? '')}&date=${(event.start_time ?? '').slice(0,10)}`}
                style={{ display:'block',width:'100%',padding:'8px',borderRadius:8,border:'1px dashed rgba(34,197,94,0.3)',background:'none',cursor:'pointer',color:'#22c55e',fontSize:12,textAlign:'center' as const,textDecoration:'none',marginTop:4 }}
              >
                🗒️ Add meeting notes → extract action items
              </a>
            )}
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(true)} style={{ flex:1,fontSize:12 }}>✎ Edit</button>
              {event.source!=='google'&&<button onClick={()=>{onDelete(event.id);onClose()}} style={{ padding:'8px 14px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'none',cursor:'pointer',color:'#ef4444',fontSize:12 }}>Delete</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MonthGrid({ year,month,events,onDayClick,onEventClick }:{ year:number;month:number;events:any[];onDayClick:(d:Date)=>void;onEventClick:(e:any)=>void }) {
  const today=new Date()
  const daysInMonth=new Date(year,month+1,0).getDate()
  const startDow=new Date(year,month,1).getDay()
  const cells=Array.from({length:Math.ceil((startDow+daysInMonth)/7)*7},(_,i)=>{
    const n=i-startDow+1
    return n>=1&&n<=daysInMonth?new Date(year,month,n):null
  })
  function dayEvents(d:Date){ return events.filter(e=>{const x=new Date(e.start_time);return x.getFullYear()===d.getFullYear()&&x.getMonth()===d.getMonth()&&x.getDate()===d.getDate()}) }
  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2 }}>
        {DAYS_HDR.map(d=><div key={d} style={{ textAlign:'center' as const,fontSize:11,fontWeight:600,color:'var(--pios-muted)',padding:'6px 0',textTransform:'uppercase' as const,letterSpacing:'0.05em' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2 }}>
        {cells.map((date,i)=>{
          if(!date)return <div key={i} style={{ minHeight:90,background:'rgba(255,255,255,0.02)',borderRadius:6 }} />
          const isToday=date.toDateString()===today.toDateString()
          const de=dayEvents(date)
          return (
            <div key={i} onClick={()=>onDayClick(date)} style={{ minHeight:90,padding:'6px 8px',borderRadius:6,background:isToday?'rgba(34,211,238,0.08)':'var(--pios-surface)',border:`1px solid ${isToday?'rgba(34,211,238,0.3)':'var(--pios-border)'}`,cursor:'pointer',transition:'border-color 0.1s' }}>
              <div style={{ fontSize:12,fontWeight:isToday?700:400,color:isToday?'#22d3ee':'var(--pios-text)',marginBottom:4,lineHeight:1 }}>{date.getDate()}</div>
              <div style={{ display:'flex',flexDirection:'column' as const,gap:2 }}>
                {de.slice(0,3).map(e=>(
                  <div key={e.id} onClick={ev=>{ev.stopPropagation();onEventClick(e)}} style={{ fontSize:10,padding:'2px 5px',borderRadius:3,lineHeight:1.3,background:domainColour(e.domain||'personal')+'25',color:domainColour(e.domain||'personal'),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,cursor:'pointer' }}>
                    {!e.all_day&&<span style={{ marginRight:3,opacity:0.8 }}>{fmt(e.start_time)}</span>}{e.title}
                  </div>
                ))}
                {de.length>3&&<div style={{ fontSize:9,color:'var(--pios-dim)' }}>+{de.length-3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const today=new Date()
  const [year,setYear]=useState(today.getFullYear())
  const [month,setMonth]=useState(today.getMonth())
  const [events,setEvents]=useState<unknown[]>([])
  const [loading,setLoading]=useState(true)
  const [syncing,setSyncing]=useState(false)
  const [syncMsg,setSyncMsg]=useState<string|null>(null)
  const [googleConnected,setGoogleConnected]=useState(false)
  const [selectedEvent,setSelectedEvent]=useState<unknown>(null)
  const [addingDate,setAddingDate]=useState<Date|null>(null)
  const [view,setView]=useState<'month'|'list'>('month')

  const load=useCallback(async(y=year,m=month)=>{
    setLoading(true)
    const ms=`${y}-${String(m+1).padStart(2,'0')}`
    const res=await fetch(`/api/calendar?month=${ms}`)
    const d=await res.json()
    setEvents(d.events??[]);setGoogleConnected(!!d.google_connected);setLoading(false)
  },[year,month])

  useEffect(()=>{load()},[load])

  function prevMonth(){const d=new Date(year,month-1);setYear(d.getFullYear());setMonth(d.getMonth())}
  function nextMonth(){const d=new Date(year,month+1);setYear(d.getFullYear());setMonth(d.getMonth())}

  async function syncGoogle(){
    setSyncing(true);setSyncMsg(null)
    const res=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync'})})
    const d=await res.json()
    setSyncMsg(d.error?`Error: ${d.error}`:`✓ Synced ${d.synced} events from Google Calendar`)
    setSyncing(false);if(d.synced)load()
    setTimeout(()=>setSyncMsg(null),4000)
  }

  async function saveEvent(id:string,data:any){
    await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{action:'update',id,...data}:{action:'create',event:data})})
    load()
  }
  async function deleteEvent(id:string){
    await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})})
    setEvents(p=>p.filter(e=>e.id!==id))
  }

  const upcoming=events.filter(e=>new Date(e.start_time)>=today).slice(0,20)
  const todayCount=events.filter(e=>new Date(e.start_time).toDateString()===today.toDateString()).length

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap' as const,gap:10 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:700,marginBottom:4 }}>Calendar</h1>
          <p style={{ fontSize:13,color:'var(--pios-muted)' }}>
            {googleConnected?<span style={{ color:'#4285F4' }}>📅 Google Calendar connected</span>:'Connect Google to sync your calendar'}
            {todayCount>0&&<span style={{ marginLeft:12 }}>{todayCount} event{todayCount!==1?'s':''} today</span>}
          </p>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <div style={{ display:'flex',gap:2,padding:2,borderRadius:8,border:'1px solid var(--pios-border)',background:'var(--pios-surface2)' }}>
            {[['month','⊞'],['list','☰']].map(([v,icon])=>(
              <button key={v} onClick={()=>setView(v as Record<string,unknown>)} style={{ padding:'4px 10px',borderRadius:6,border:'none',fontSize:13,cursor:'pointer',background:view===v?'var(--pios-surface)':'transparent',color:view===v?'var(--pios-text)':'var(--pios-dim)' }}>{icon}</button>
            ))}
          </div>
          <button className="pios-btn pios-btn-ghost" onClick={syncGoogle} disabled={syncing} style={{ fontSize:12 }}>{syncing?'⟳ Syncing…':'↻ Sync Google'}</button>
          <button className="pios-btn pios-btn-primary" onClick={()=>{const d=new Date();d.setHours(9,0,0,0);setAddingDate(d)}} style={{ fontSize:12 }}>+ Event</button>
        </div>
      </div>

      {syncMsg&&<div style={{ padding:'8px 14px',borderRadius:8,background:syncMsg.startsWith('Error')?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)',borderLeft:`3px solid ${syncMsg.startsWith('Error')?'#ef4444':'#22c55e'}`,fontSize:12,marginBottom:16 }}>{syncMsg}</div>}

      {view==='month'?(
        <>
          <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:16 }}>
            <button onClick={prevMonth} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,padding:'4px 8px' }}>‹</button>
            <div style={{ fontSize:17,fontWeight:700,minWidth:160,textAlign:'center' as const }}>{MONTHS[month]} {year}</div>
            <button onClick={nextMonth} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,padding:'4px 8px' }}>›</button>
            <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth())}} style={{ fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid var(--pios-border)',background:'none',cursor:'pointer',color:'var(--pios-muted)' }}>Today</button>
          </div>
          {loading?<Spinner />:<MonthGrid year={year} month={month} events={events} onDayClick={d=>setAddingDate(d)} onEventClick={e=>setSelectedEvent(e)} />}
        </>
      ):(
        <div>
          {loading?<Spinner />:upcoming.length===0?(
            <div className="pios-card" style={{ textAlign:'center' as const,padding:'48px' }}>
              <div style={{ fontSize:32,marginBottom:12 }}>📅</div>
              <div style={{ fontSize:14,fontWeight:700,marginBottom:8 }}>No upcoming events</div>
              <p style={{ fontSize:13,color:'var(--pios-muted)' }}>Sync Google Calendar or add an event manually.</p>
            </div>
          ):(
            <div style={{ display:'flex',flexDirection:'column' as const,gap:8 }}>
              {upcoming.map(e=>(
                <div key={e.id} onClick={()=>setSelectedEvent(e)} className="pios-card" style={{ padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'flex-start',gap:14,borderLeft:`3px solid ${domainColour(e.domain||'personal')}` }}>
                  <div style={{ textAlign:'center' as const,minWidth:52,flexShrink:0 }}>
                    <div style={{ fontSize:11,color:'var(--pios-dim)' }}>{new Date(e.start_time).toLocaleDateString('en-GB',{weekday:'short'})}</div>
                    <div style={{ fontSize:15,fontWeight:700 }}>{new Date(e.start_time).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                    <div style={{ fontSize:12,color:'var(--pios-muted)' }}>{e.all_day?'All day':fmt(e.start_time)}</div>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:600,marginBottom:3 }}>{e.title}</div>
                    <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const }}>
                      <span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:domainColour(e.domain||'personal')+'20',color:domainColour(e.domain||'personal') }}>{domainLabel(e.domain||'personal')}</span>
                      {e.location&&<span style={{ fontSize:11,color:'var(--pios-dim)' }}>📍 {e.location}</span>}
                      {!e.all_day&&<span style={{ fontSize:11,color:'var(--pios-dim)' }}>{dur(e.start_time,e.end_time)}</span>}
                      {e.attendees?.length>0&&<span style={{ fontSize:11,color:'var(--pios-dim)' }}>👥 {e.attendees.length}</span>}
                      {e.google_meet_url&&<span style={{ fontSize:11,color:'#22c55e' }}>🎥 Meet</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addingDate&&<EventModal event={{ title:'',domain:'personal',start_time:new Date(addingDate).toISOString().slice(0,16),end_time:new Date(new Date(addingDate).setHours(new Date(addingDate).getHours()+1)).toISOString().slice(0,16) }} onClose={()=>setAddingDate(null)} onSave={async(_,d)=>{await saveEvent('',d);setAddingDate(null)}} onDelete={()=>{}} />}
      {selectedEvent&&<EventModal event={selectedEvent} onClose={()=>setSelectedEvent(null)} onSave={saveEvent} onDelete={deleteEvent} />}
    </div>
  )
}
