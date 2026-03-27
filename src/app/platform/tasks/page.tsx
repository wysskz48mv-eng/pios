'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Tasks v3.0 — UIX upgrade · all logic preserved
// Kanban · AI Prioritise · Inline add · Detail drawer
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const DOMAINS    = ['academic','fm_consulting','saas','business','personal'] as const
const STATUSES   = ['todo','in_progress','blocked','done'] as const
const PRIORITIES = ['critical','high','medium','low'] as const

const STATUS_META: Record<string,{ label:string; color:string; next:string }> = {
  todo:        { label:'To do',       color:'var(--pios-dim)',  next:'in_progress' },
  in_progress: { label:'In progress', color:'var(--academic)', next:'blocked'      },
  blocked:     { label:'Blocked',     color:'var(--ops)',       next:'done'         },
  done:        { label:'Done',        color:'var(--fm)',        next:'todo'         },
}

const PRIORITY_COLOR: Record<string,string> = {
  critical: 'var(--dng)', high: 'var(--saas)', medium: 'var(--academic)', low: 'var(--pios-dim)',
}

// Shared input style
const inp: React.CSSProperties = {
  display:'block', width:'100%', padding:'9px 12px',
  background:'var(--pios-surface2)', border:'1px solid var(--pios-border2)',
  borderRadius:8, color:'var(--pios-text)', fontSize:13,
  fontFamily:'var(--font-sans)', outline:'none',
  transition:'border-color 0.15s',
}

// ── Micro components ──────────────────────────────────────────────────────────

function StatusPill({ status, onClick }: { status:string; onClick?:()=>void }) {
  const m = STATUS_META[status] ?? STATUS_META.todo
  return (
    <button onClick={onClick} style={{
      fontSize:9.5, padding:'2px 9px', borderRadius:20, border:'none',
      cursor:onClick?'pointer':'default', fontWeight:600, letterSpacing:'0.02em',
      background:`${m.color}14`, color:m.color, whiteSpace:'nowrap' as const,
      fontFamily:'var(--font-sans)',
    }}>{m.label}</button>
  )
}

function PriorityDot({ priority }: { priority:string }) {
  return <span style={{ width:7, height:7, borderRadius:'50%', background:PRIORITY_COLOR[priority]??'var(--pios-dim)', display:'inline-block', flexShrink:0 }} />
}

function FieldLabel({ children }: { children:React.ReactNode }) {
  return <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' as const, color:'var(--pios-dim)', marginBottom:5 }}>{children}</div>
}

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'52px', color:'var(--pios-muted)', fontSize:13 }}>
      <div style={{ width:14, height:14, border:'2px solid var(--pios-border2)', borderTop:`2px solid var(--ai)`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      Loading tasks…
    </div>
  )
}

// ── Task drawer ───────────────────────────────────────────────────────────────
function TaskDrawer({ task, onClose, onSave, onDelete }: {
  task:any; onClose:()=>void; onSave:(id:string,u:unknown)=>void; onDelete:(id:string)=>void
}) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    title:task.title, description:task.description||'', domain:task.domain,
    priority:task.priority, due_date:task.due_date?task.due_date.slice(0,10):'',
    status:task.status, duration_mins:task.duration_mins||30,
  })
  function f(k:string,v:unknown) { setForm(p=>({...p,[k]:v})) }

  async function save() {
    setSaving(true); await onSave(task.id, form); setSaving(false); setEditing(false)
  }

  const domColor = domainColour(task.domain)

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.55)' }} />
      <div style={{ position:'relative',width:440,background:'var(--pios-surface)',borderLeft:'1px solid var(--pios-border)',height:'100%',overflowY:'auto',padding:28,display:'flex',flexDirection:'column',gap:16 }}>
        {/* Top rule */}
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, ${PRIORITY_COLOR[task.priority]??'var(--ai)'}, var(--ai))` }} />

        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
          <div style={{ flex:1,minWidth:0 }}>
            {editing
              ? <input style={{ ...inp,fontSize:16,fontWeight:700,marginBottom:8 }} value={form.title} onChange={e=>f('title',e.target.value)} autoFocus />
              : <h2 style={{ fontFamily:'var(--font-display)',fontSize:16,fontWeight:400,letterSpacing:'-0.02em',lineHeight:1.3,marginBottom:6,textDecoration:task.status==='done'?'line-through':'none',color:task.status==='done'?'var(--pios-dim)':'var(--pios-text)' }}>{task.title}</h2>
            }
            <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
              <StatusPill status={task.status} />
              <span style={{ fontSize:9.5,padding:'2px 7px',borderRadius:5,background:`${domColor}12`,color:domColor,fontWeight:600 }}>{domainLabel(task.domain)}</span>
              <PriorityDot priority={task.priority} />
              <span style={{ fontSize:11,color:'var(--pios-muted)',textTransform:'capitalize' as const }}>{task.priority}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,marginLeft:10 }}>✕</button>
        </div>

        {editing ? (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            <textarea style={{ ...inp,resize:'vertical',fontFamily:'inherit',minHeight:72 }} placeholder="Description…" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} />
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Domain',   key:'domain',   type:'select', opts:DOMAINS.map(d=>({v:d,l:domainLabel(d)})) },
                { label:'Priority', key:'priority', type:'select', opts:PRIORITIES.map(p=>({v:p,l:p})) },
                { label:'Status',   key:'status',   type:'select', opts:STATUSES.map(s=>({v:s,l:s.replace('_',' ')})) },
                { label:'Due date', key:'due_date', type:'date' },
                { label:'Duration (mins)', key:'duration_mins', type:'number' },
              ].map((field:any) => (
                <div key={field.key}>
                  <FieldLabel>{field.label}</FieldLabel>
                  {field.type==='select'
                    ? <select style={inp} value={(form as any)[field.key]} onChange={e=>f(field.key,e.target.value)}>
                        {field.opts.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    : <input type={field.type} style={inp} min={field.type==='number'?5:undefined} step={field.type==='number'?15:undefined} value={(form as any)[field.key]} onChange={e=>f(field.key,field.type==='number'?parseInt(e.target.value)||30:e.target.value)} />
                  }
                </div>
              ))}
            </div>
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button onClick={save} disabled={saving} style={{ flex:1,padding:'10px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:500,cursor:'pointer' }}>
                {saving?'Saving…':'Save changes'}
              </button>
              <button onClick={()=>setEditing(false)} style={{ padding:'10px 16px',borderRadius:9,border:'1px solid var(--pios-border2)',background:'transparent',color:'var(--pios-muted)',fontSize:13,cursor:'pointer',fontFamily:'var(--font-sans)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {task.description && (
              <div style={{ fontSize:13,color:'var(--pios-muted)',lineHeight:1.65,padding:'12px 14px',borderRadius:9,background:'var(--pios-surface2)' }}>
                {task.description}
              </div>
            )}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Due',      value:task.due_date?formatRelative(task.due_date):'No deadline' },
                { label:'Duration', value:`${task.duration_mins||30} min` },
                { label:'Source',   value:task.source||'manual' },
                { label:'Created',  value:task.created_at?new Date(task.created_at).toLocaleDateString('en-GB'):'—' },
              ].map(fi=>(
                <div key={fi.label} style={{ padding:'9px 11px',borderRadius:8,background:'var(--pios-surface2)' }}>
                  <div style={{ fontSize:9.5,color:'var(--pios-dim)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:3 }}>{fi.label}</div>
                  <div style={{ fontSize:12.5,fontWeight:600 }}>{fi.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex',gap:8,marginTop:'auto',paddingTop:8 }}>
              <button onClick={()=>setEditing(true)} style={{ flex:1,padding:'9px',borderRadius:9,border:'1px solid var(--pios-border2)',background:'transparent',color:'var(--pios-text)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-sans)' }}>✎ Edit</button>
              <button onClick={()=>{onDelete(task.id);onClose()}} style={{ padding:'9px 14px',borderRadius:9,border:'1px solid rgba(224,82,114,0.3)',background:'none',cursor:'pointer',color:'var(--dng)',fontSize:12,fontFamily:'var(--font-sans)' }}>Delete</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── AI Prioritise panel ───────────────────────────────────────────────────────
type DetectResult = {
  prioritised?: Array<{id:string;title?:string;priority?:string;urgency?:string;rank?:number;reasoning?:string}>
  focus_recommendation?: string; blocked_risks?: string[]
}

function AIPrioritisePanel({ tasks, onClose }: { tasks:any[]; onClose:()=>void }) {
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState<DetectResult|null>(null)

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    const open = tasks.filter(t=>t.status!=='done')
    fetch('/api/tasks',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ai_prioritise',tasks:open}) })
      .then(r=>r.json()).then(d=>{setResult(d);setLoading(false)}).catch(()=>setLoading(false))
  }, [tasks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.55)' }} />
      <div style={{ position:'relative',width:460,background:'var(--pios-surface)',borderLeft:'1px solid var(--pios-border)',height:'100%',overflowY:'auto',padding:28 }}>
        {/* Top rule */}
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg, var(--ai), var(--academic))' }} />

        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:16,fontWeight:400,letterSpacing:'-0.02em',marginBottom:3 }}>AI Prioritisation</div>
            <div style={{ fontSize:12,color:'var(--pios-muted)' }}>NemoClaw™ analysing your open tasks…</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding:'48px 0',display:'flex',alignItems:'center',gap:12,color:'var(--pios-muted)',justifyContent:'center' }}>
            <div style={{ width:16,height:16,border:'2px solid var(--ai-subtle)',borderTop:`2px solid var(--ai)`,borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
            Analysing {tasks.filter(t=>t.status!=='done').length} open tasks…
          </div>
        ) : result ? (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {result.focus_recommendation && (
              <div style={{ padding:'14px 16px',borderRadius:10,background:'var(--ai-subtle)',border:'1px solid rgba(139,124,248,0.2)',borderLeft:'3px solid var(--ai)',fontSize:13,lineHeight:1.65,color:'var(--pios-text)' }}>
                <div style={{ fontFamily:'var(--font-display)',fontWeight:400,color:'var(--ai)',marginBottom:6,fontSize:12 }}>◉ Focus recommendation</div>
                {result.focus_recommendation}
              </div>
            )}
            {(result.blocked_risks?.length??0)>0 && (
              <div style={{ padding:'12px 14px',borderRadius:9,background:'rgba(244,132,95,0.07)',border:'1px solid rgba(244,132,95,0.2)',borderLeft:'3px solid var(--ops)',fontSize:12 }}>
                <div style={{ fontWeight:700,color:'var(--ops)',marginBottom:5 }}>⚠ Blocking risks</div>
                {result.blocked_risks?.map((r,i)=><div key={i} style={{ color:'var(--pios-muted)',lineHeight:1.55,marginBottom:2 }}>· {r}</div>)}
              </div>
            )}
            {(result.prioritised?.length??0)>0 && (
              <div>
                <div style={{ fontSize:9.5,fontWeight:700,color:'var(--pios-dim)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.07em' }}>Priority order for today</div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {result.prioritised?.slice(0,10).map(p=>{
                    const task = tasks.find(t=>t.id===p.id)
                    if (!task) return null
                    const uc = PRIORITY_COLOR[p.urgency??'']??'var(--pios-dim)'
                    return (
                      <div key={p.id} style={{ display:'flex',gap:12,padding:'10px 14px',borderRadius:9,background:'var(--pios-surface2)',alignItems:'flex-start' }}>
                        <span style={{ fontFamily:'var(--font-display)',fontSize:18,fontWeight:400,color:'var(--pios-dim)',minWidth:28,lineHeight:1.2 }}>#{p.rank}</span>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:600,marginBottom:4 }}>{task.title}</div>
                          <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:p.reasoning?4:0 }}>
                            <span style={{ fontSize:9.5,padding:'2px 7px',borderRadius:5,background:`${uc}12`,color:uc,fontWeight:600 }}>{p.urgency}</span>
                            <span style={{ fontSize:10.5,color:'var(--pios-dim)' }}>{domainLabel(task.domain)}</span>
                          </div>
                          {p.reasoning&&<div style={{ fontSize:12,color:'var(--pios-muted)',lineHeight:1.55 }}>{p.reasoning}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign:'center',padding:'40px',color:'var(--pios-muted)',fontSize:13 }}>Analysis failed. Please try again.</div>
        )}
      </div>
    </div>
  )
}

// ── Types & page ──────────────────────────────────────────────────────────────
type Task = {
  id:string; title?:string; status?:string; priority?:string; domain?:string
  due_date?:string; created_at?:string; completed_at?:string; description?:string
  source?:string; duration_mins?:number; project_id?:string
}

export default function TasksPage() {
  const [tasks,        setTasks]        = useState<Task[]>([])
  const [loading,      setLoading]      = useState(true)
  const [domainFilter, setDomainFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [overdueOnly,  setOverdueOnly]  = useState(false)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedTask, setSelectedTask] = useState<Task|null>(null)
  const [showAI,       setShowAI]       = useState(false)
  const [showAdd,      setShowAdd]      = useState(false)
  const [sortBy,       setSortBy]       = useState<'priority'|'due_date'|'created_at'>('priority')
  const [saving,       setSaving]       = useState(false)
  const [newTask,      setNewTask]      = useState({ title:'',description:'',domain:'personal',priority:'medium',due_date:'',duration_mins:30 })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (domainFilter!=='all') params.set('domain',domainFilter)
    if (sourceFilter!=='all') params.set('source',sourceFilter)
    if (overdueOnly)          params.set('overdue','1')
    const res  = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data.tasks??[])
    setLoading(false)
  }, [domainFilter,sourceFilter,overdueOnly])

  useEffect(()=>{load()},[load])

  async function createTask() {
    if (!newTask.title.trim()) return
    setSaving(true)
    await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...newTask,status:'todo'})})
    setNewTask({title:'',description:'',domain:'personal',priority:'medium',due_date:'',duration_mins:30})
    setShowAdd(false); setSaving(false); load()
  }

  async function updateTask(id:string, updates:unknown) {
    await fetch('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...(updates as Record<string,unknown>)})})
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...(updates as Record<string,unknown>)}as Task:t))
  }

  async function cycleStatus(id:string, current:string) {
    const next = STATUS_META[current]?.next??'todo'
    await updateTask(id,{status:next})
  }

  async function deleteTask(id:string) {
    await fetch(`/api/tasks?id=${id}`,{method:'DELETE'})
    setTasks(prev=>prev.filter(t=>t.id!==id))
  }

  const today = new Date().toISOString().slice(0,10)

  const visible = tasks.filter(t=>{
    if (statusFilter==='open')    return ['todo','in_progress','blocked'].includes(String(t.status??''))
    if (statusFilter==='done')    return t.status==='done'
    if (statusFilter==='overdue') return t.due_date!=null&&t.due_date<today&&t.status!=='done'
    if (statusFilter!=='all')     return t.status===statusFilter
    return true
  })

  const grouped = STATUSES.reduce((acc,s)=>{ acc[s]=visible.filter(t=>t.status===s); return acc },{} as Record<string,Task[]>)
  const openCount     = tasks.filter(t=>['todo','in_progress','blocked'].includes(String(t.status??''))).length
  const criticalCount = tasks.filter(t=>t.priority==='critical'&&t.status!=='done').length
  const overdueCount  = tasks.filter(t=>t.due_date&&t.due_date<today&&t.status!=='done').length

  return (
    <div className="fade-up">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:10 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)',fontSize:22,fontWeight:400,color:'var(--pios-text)',letterSpacing:'-0.03em',marginBottom:4 }}>Tasks</h1>
          <p style={{ fontSize:12,color:'var(--pios-muted)' }}>
            {openCount} open
            {criticalCount>0&&<span style={{ color:'var(--dng)',fontWeight:600,marginLeft:8 }}>· {criticalCount} critical</span>}
            {overdueCount>0&&<span style={{ color:'var(--ops)',fontWeight:600,marginLeft:8 }}>· {overdueCount} overdue</span>}
          </p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={()=>setShowAI(true)} style={{ padding:'7px 14px',borderRadius:8,border:'1px solid rgba(99,73,255,0.25)',background:'rgba(99,73,255,0.07)',color:'var(--ai)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-sans)',fontWeight:500,letterSpacing:'-0.01em' }}>NemoClaw™ Prioritise</button>
          <button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'7px 16px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ Add task</button>
        </div>
      </div>

      {/* Quick-add form */}
      {showAdd && (
        <div style={{ background:'var(--pios-surface)',border:'1px solid rgba(139,124,248,0.2)',borderRadius:12,padding:18,marginBottom:18,position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,var(--ai),var(--academic))',opacity:0.5 }} />
          <div style={{ display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:8,marginBottom:10 }}>
            <input style={inp} placeholder="Task title…" value={newTask.title} autoFocus
              onChange={e=>setNewTask(p=>({...p,title:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&createTask()}
              onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='var(--ai)'}}
              onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='var(--pios-border2)'}} />
            <select style={{ ...inp,width:'auto' }} value={newTask.domain} onChange={e=>setNewTask(p=>({...p,domain:e.target.value}))}>
              {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <select style={{ ...inp,width:'auto' }} value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}>
              {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" style={{ ...inp,width:'auto' }} value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} />
          </div>
          <textarea style={{ ...inp,resize:'vertical',fontFamily:'inherit',marginBottom:10,minHeight:60 }} placeholder="Description (optional)…" rows={2} value={newTask.description} onChange={e=>setNewTask(p=>({...p,description:e.target.value}))} />
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={createTask} disabled={saving} style={{ padding:'8px 18px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:500,cursor:'pointer' }}>
              {saving?'Adding…':'Add task'}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{ padding:'8px 14px',borderRadius:9,border:'1px solid var(--pios-border2)',background:'transparent',color:'var(--pios-muted)',fontSize:13,cursor:'pointer',fontFamily:'var(--font-sans)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display:'flex',gap:8,marginBottom:18,flexWrap:'wrap',alignItems:'center' }}>

        {/* Status filter */}
        <div style={{ display:'flex',gap:3,padding:3,borderRadius:9,background:'var(--pios-surface2)' }}>
          {([['open','Open'],['overdue',`Overdue${overdueCount>0?` (${overdueCount})`:''}` ],['all','All'],['done','Done']] as [string,string][]).map(([v,l])=>(
            <button key={v} onClick={()=>setStatusFilter(v)} style={{
              padding:'4px 11px',borderRadius:7,fontSize:11.5,border:'none',cursor:'pointer',
              background:statusFilter===v?v==='overdue'?'rgba(244,132,95,0.15)':'var(--ai-subtle)':'transparent',
              color:statusFilter===v?v==='overdue'?'var(--ops)':'var(--ai)':'var(--pios-muted)',
              fontWeight:statusFilter===v?600:400,fontFamily:'var(--font-sans)',
            }}>{l}</button>
          ))}
        </div>

        {/* Domain filter */}
        <div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>
          {(['all',...DOMAINS] as const).map(d=>(
            <button key={d} onClick={()=>setDomainFilter(d)} style={{
              padding:'4px 10px',borderRadius:20,fontSize:11,cursor:'pointer',fontFamily:'var(--font-sans)',
              border:`1px solid ${domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-border)'}`,
              background:domainFilter===d?`${domainColour(d==='all'?'personal':d)}12`:'transparent',
              color:domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-muted)',
              fontWeight:domainFilter===d?600:400,transition:'all 0.12s',
            }}>{d==='all'?'All':domainLabel(d)}</button>
          ))}
        </div>

        {/* Source filter */}
        <div style={{ display:'flex',gap:3,flexWrap:'wrap' }}>
          {([['all','All sources'],['manual','Manual'],['email','Email'],['ai','AI'],['calendar','Calendar']] as [string,string][]).map(([v,l])=>(
            <button key={v} onClick={()=>setSourceFilter(v)} style={{
              fontSize:10.5,padding:'3px 9px',borderRadius:20,border:'1px solid var(--pios-border)',cursor:'pointer',fontFamily:'var(--font-sans)',
              background:sourceFilter===v?'var(--ai-subtle)':'transparent',
              color:sourceFilter===v?'var(--ai)':'var(--pios-muted)',fontWeight:sourceFilter===v?600:400,
            }}>{l}</button>
          ))}
          <button onClick={()=>setOverdueOnly(v=>!v)} style={{
            fontSize:10.5,padding:'3px 9px',borderRadius:20,cursor:'pointer',fontFamily:'var(--font-sans)',
            border:`1px solid ${overdueOnly?'rgba(224,82,114,0.3)':'var(--pios-border)'}`,
            background:overdueOnly?'rgba(224,82,114,0.08)':'transparent',
            color:overdueOnly?'var(--dng)':'var(--pios-muted)',fontWeight:overdueOnly?600:400,
          }}>⚠ Overdue only</button>
        </div>

        {/* Sort */}
        <div style={{ display:'flex',gap:4,alignItems:'center',marginLeft:'auto' }}>
          <span style={{ fontSize:9.5,color:'var(--pios-dim)',fontWeight:700,letterSpacing:'0.07em' }}>SORT</span>
          {([['priority','Priority'],['due_date','Due date'],['created_at','Recent']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)} style={{
              padding:'3px 9px',borderRadius:6,fontSize:11,border:'1px solid var(--pios-border)',cursor:'pointer',fontFamily:'var(--font-sans)',
              background:sortBy===v?'var(--pios-surface2)':'transparent',
              color:sortBy===v?'var(--pios-text)':'var(--pios-dim)',fontWeight:sortBy===v?600:400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? <Spinner /> : visible.length===0 ? (
        <div style={{ background:'var(--pios-surface)',border:'1px solid var(--pios-border)',borderRadius:14,padding:'52px 24px',textAlign:'center' }}>
          <div style={{ fontSize:32,marginBottom:12,opacity:0.25 }}>✓</div>
          <div style={{ fontFamily:'var(--font-display)',fontSize:15,fontWeight:400,marginBottom:8 }}>No tasks here</div>
          <p style={{ fontSize:13,color:'var(--pios-muted)',marginBottom:18 }}>
            {statusFilter==='done'?'No completed tasks yet.':'All clear! Add a task to get started.'}
          </p>
          <button onClick={()=>setShowAdd(true)} style={{ padding:'8px 18px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ Add task</button>
        </div>
      ) : statusFilter==='done' ? (
        // Done list
        <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
          {visible.map(t=>(
            <div key={t.id} onClick={()=>setSelectedTask(t)} style={{ padding:'10px 14px',borderRadius:9,background:'var(--pios-surface)',border:'1px solid var(--pios-border)',display:'flex',alignItems:'center',gap:10,opacity:0.6,cursor:'pointer' }}>
              <span style={{ fontSize:13,color:'var(--fm)' }}>✓</span>
              <span style={{ fontSize:13,textDecoration:'line-through',color:'var(--pios-dim)',flex:1 }}>{t.title}</span>
              <span style={{ fontSize:10,color:'var(--pios-dim)' }}>{t.completed_at?new Date(t.completed_at).toLocaleDateString('en-GB'):''}</span>
            </div>
          ))}
        </div>
      ) : (
        // Kanban
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {(['todo','in_progress','blocked'] as const).map(status=>{
            const col = grouped[status]??[]
            const m   = STATUS_META[status]
            return (
              <div key={status}>
                {/* Column header */}
                <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:10 }}>
                  <div style={{ width:7,height:7,borderRadius:'50%',background:m.color }} />
                  <span style={{ fontSize:10.5,fontWeight:700,color:'var(--pios-muted)',textTransform:'uppercase',letterSpacing:'0.08em' }}>{m.label}</span>
                  <span style={{ fontSize:10.5,padding:'1px 7px',borderRadius:99,background:'var(--pios-surface2)',border:'1px solid var(--pios-border)',color:'var(--pios-muted)',fontWeight:600 }}>{col.length}</span>
                </div>

                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {col.map(t=>{
                    const isOverdue = t.due_date&&t.due_date<today
                    return (
                      <div key={t.id} onClick={()=>setSelectedTask(t)}
                        style={{ padding:'12px 14px',borderRadius:10,background:'var(--pios-surface)',cursor:'pointer',transition:'border-color 0.15s',
                          border:`1px solid ${t.priority==='critical'?'rgba(224,82,114,0.3)':isOverdue?'rgba(244,132,95,0.25)':'var(--pios-border)'}`,
                        }}
                        onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor='var(--pios-border2)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=t.priority==='critical'?'rgba(224,82,114,0.3)':isOverdue?'rgba(244,132,95,0.25)':'var(--pios-border)'}>
                        <div style={{ display:'flex',alignItems:'flex-start',gap:8,marginBottom:7 }}>
                          <PriorityDot priority={String(t.priority??'')} />
                          <span style={{ fontSize:12.5,fontWeight:500,lineHeight:1.35,flex:1,color:isOverdue?'var(--pios-text)':'var(--pios-text)' }}>{t.title}</span>
                        </div>
                        <div style={{ display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:8 }}>
                          <span style={{ fontSize:9.5,padding:'1px 6px',borderRadius:4,background:`${domainColour(String(t.domain??''))}12`,color:domainColour(String(t.domain??'')),fontWeight:600 }}>{domainLabel(String(t.domain??''))}</span>
                          {t.due_date&&(
                            <span style={{ fontSize:10,color:isOverdue?'var(--dng)':'var(--pios-dim)',fontWeight:isOverdue?600:400 }}>
                              {isOverdue?'⚠ ':''}{formatRelative(String(t.due_date))}
                            </span>
                          )}
                          {t.description&&<span style={{ width:5,height:5,borderRadius:'50%',background:'var(--pios-dim)',display:'inline-block',flexShrink:0,marginTop:1 }} />}
                        </div>
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                          <StatusPill status={String(t.status??'')} onClick={()=>cycleStatus(t.id,String(t.status??''))} />
                          <button onClick={e=>{e.stopPropagation?.();if(window.confirm(`Delete "${t.title}"?`))deleteTask(t.id)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-dim)',fontSize:12,padding:'0 2px',lineHeight:1,opacity:0.5 }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                  {col.length===0&&(
                    <div style={{ padding:'24px 0',textAlign:'center',color:'var(--pios-dim)',fontSize:11.5,border:'1px dashed var(--pios-border)',borderRadius:9 }}>
                      No {m.label.toLowerCase()} tasks
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedTask&&<TaskDrawer task={selectedTask} onClose={()=>setSelectedTask(null)} onSave={updateTask} onDelete={deleteTask} />}
      {showAI&&<AIPrioritisePanel tasks={tasks} onClose={()=>setShowAI(false)} />}
    </div>
  )
}
