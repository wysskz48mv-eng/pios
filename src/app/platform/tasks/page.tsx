'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Tasks — full CRUD, status cycling, inline edit, detail drawer, AI prioritise
// ─────────────────────────────────────────────────────────────────────────────

const DOMAINS   = ['academic','fm_consulting','saas','business','personal'] as const
const STATUSES  = ['todo','in_progress','blocked','done'] as const
const PRIORITIES = ['critical','high','medium','low'] as const

const STATUS_META: Record<string,{ label:string; colour:string; next:string }> = {
  todo:        { label:'To do',      colour:'#64748b', next:'in_progress' },
  in_progress: { label:'In progress',colour:'#6c8eff', next:'blocked'     },
  blocked:     { label:'Blocked',    colour:'#f97316', next:'done'         },
  done:        { label:'Done',       colour:'#22c55e', next:'todo'         },
}

function StatusPill({ status, onClick }: { status: string; onClick?: () => void }) {
  const m = STATUS_META[status] ?? STATUS_META.todo

  return (
    <button onClick={onClick} style={{
      fontSize:10, padding:'2px 10px', borderRadius:20, border:'none', cursor:onClick?'pointer':'default',
      background:m.colour+'20', color:m.colour, fontWeight:600, whiteSpace:'nowrap' as const,
    }}>{m.label}</button>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  return <span style={{ width:8, height:8, borderRadius:'50%', background:priorityColour(priority), display:'inline-block', flexShrink:0 }} />
}

function Spinner() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'40px', color:'var(--pios-muted)', fontSize:13 }}>
    <div style={{ width:14, height:14, border:'2px solid rgba(108,142,255,0.2)', borderTop:'2px solid #6c8eff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    Loading…
  </div>
}

// ── Task drawer (detail/edit panel) ───────────────────────────────────────────
function TaskDrawer({ task, onClose, onSave, onDelete }: { task:any; onClose:()=>void; onSave:(id:string,updates: unknown)=>void; onDelete:(id:string)=>void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title:task.title, description:task.description||'', domain:task.domain, priority:task.priority, due_date:task.due_date?task.due_date.slice(0,10):'', status:task.status, duration_mins:task.duration_mins||30 })
  const [saving, setSaving] = useState(false)
  function f(k:string,v: unknown) { setForm(p=>({...p,[k]:v})) }

  async function save() {
    setSaving(true)
    await onSave(task.id, form)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} />
      <div style={{ position:'relative', width:420, background:'var(--pios-surface)', borderLeft:'1px solid var(--pios-border)', height:'100%', overflowY:'auto' as const, padding:28, display:'flex', flexDirection:'column' as const, gap:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            {editing ? (
              <input className="pios-input" value={form.title} onChange={e=>f('title',e.target.value)} style={{ fontSize:17, fontWeight:700, marginBottom:8 }} autoFocus />
            ) : (
              <h2 style={{ fontSize:17, fontWeight:700, lineHeight:1.3, marginBottom:4, color:task.status==='done'?'var(--pios-dim)':'var(--pios-text)', textDecoration:task.status==='done'?'line-through':'none' }}>{String(task.title ?? "")}</h2>
            )}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' }}>
              <StatusPill status={String(task.status ?? "")} />
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:domainColour(task.domain)+'20', color:domainColour(task.domain), fontWeight:600 }}>{domainLabel(String(task?.domain ?? ''))}</span>
              <PriorityDot priority={String(task.priority ?? "")} />
              <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{String(task.priority ?? "")}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pios-muted)', fontSize:18, marginLeft:8 }}>✕</button>
        </div>

        {editing ? (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
            <textarea className="pios-input" placeholder="Description…" rows={4} value={form.description} onChange={e=>f('description',e.target.value)} style={{ resize:'vertical' as const, fontFamily:'inherit' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div><div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Domain</div>
                <select className="pios-input" value={form.domain} onChange={e=>f('domain',e.target.value)}>
                  {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Priority</div>
                <select className="pios-input" value={form.priority} onChange={e=>f('priority',e.target.value)}>
                  {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Status</div>
                <select className="pios-input" value={form.status} onChange={e=>f('status',e.target.value)}>
                  {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Due date</div>
                <input type="date" className="pios-input" value={form.due_date} onChange={e=>f('due_date',e.target.value)} />
              </div>
              <div><div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:4 }}>Duration (mins)</div>
                <input type="number" className="pios-input" value={form.duration_mins} onChange={e=>f('duration_mins',parseInt(e.target.value)||30)} min={5} step={15} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button className="pios-btn pios-btn-primary" onClick={save} disabled={saving} style={{ flex:1, fontSize:12 }}>{saving?'Saving…':'Save changes'}</button>
              <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(false)} style={{ fontSize:12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {task.description && (
              <div style={{ fontSize:13, color:'var(--pios-muted)', lineHeight:1.65, padding:'12px 14px', borderRadius:8, background:'var(--pios-surface2)' }}>
                {task.description}
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Due', value:task.due_date ? formatRelative(task.due_date) : 'No deadline' },
                { label:'Duration', value:`${task.duration_mins || 30} min` },
                { label:'Source', value:task.source || 'manual' },
                { label:'Created', value:task.created_at ? new Date(task.created_at).toLocaleDateString('en-GB') : '—' },
              ].map(f=>(
                <div key={(f as Record<string,unknown>).label as string} style={{ padding:'10px', borderRadius:8, background:'var(--pios-surface2)' }}>
                  <div style={{ fontSize:10, color:'var(--pios-dim)', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:3 }}>{f.label}</div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:'auto', paddingTop:8 }}>
              <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(true)} style={{ flex:1, fontSize:12 }}>✎ Edit</button>
              <button onClick={()=>{onDelete(task.id);onClose()}} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'none', cursor:'pointer', color:'#ef4444', fontSize:12 }}>Delete</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── AI Prioritise panel ────────────────────────────────────────────────────────
function AIPrioritisePanel({ tasks, onClose }: { tasks:any[]; onClose:()=>void }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult]   = useState<DetectResult|null>(null)

  useEffect(() => {  // eslint-disable-line react-hooks/exhaustive-deps
    const openTasks = tasks.filter((t: Record<string,unknown>) => (t.status ?? '') !== 'done')
    fetch('/api/tasks', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'ai_prioritise', tasks: openTasks }),
    }).then(r=>r.json()).then(d=>{ setResult(d as DetectResult); setLoading(false) }).catch(()=>setLoading(false))
  }, [tasks.length])  // eslint-disable-line react-hooks/exhaustive-deps

  const rankMap = Object.fromEntries((result?.prioritised ?? []).map((p: {id?:string;reasoning?:string;priority?:string;title?:string}) => [String(p.id ?? ""), p]))

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} />
      <div style={{ position:'relative', width:440, background:'var(--pios-surface)', borderLeft:'1px solid var(--pios-border)', height:'100%', overflowY:'auto' as const, padding:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:2 }}>AI Prioritisation</div>
            <div style={{ fontSize:12, color:'var(--pios-muted)' }}>Analysing your open tasks…</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pios-muted)', fontSize:18 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding:'40px 0', display:'flex', alignItems:'center', gap:10, color:'var(--pios-muted)', justifyContent:'center' }}>
            <div style={{ width:16, height:16, border:'2px solid rgba(167,139,250,0.2)', borderTop:'2px solid #a78bfa', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            Analysing {tasks.filter(t=>t.status!=='done').length} open tasks…
          </div>
        ) : result ? (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:16 }}>
            {result.focus_recommendation && (
              <div style={{ padding:'14px 16px', borderRadius:10, background:'rgba(167,139,250,0.08)', borderLeft:'3px solid #a78bfa', fontSize:13, lineHeight:1.65, color:'var(--pios-text)' }}>
                <div style={{ fontWeight:600, color:'#a78bfa', marginBottom:6 }}>Focus recommendation</div>
                {result.focus_recommendation}
              </div>
            )}

            {(result.blocked_risks?.length ?? 0) > 0 && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(249,115,22,0.08)', borderLeft:'3px solid #f97316', fontSize:12, color:'var(--pios-text)' }}>
                <div style={{ fontWeight:600, color:'#f97316', marginBottom:4 }}>⚠ Blocking risks</div>
                {result.blocked_risks?.map((r:string,i:number) => <div key={i} style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5 }}>• {r}</div>)}
              </div>
            )}

            {(result.prioritised?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--pios-muted)', marginBottom:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Priority order for today</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                  {result.prioritised?.slice(0,10).map((p: {id?:string;urgency?:string;rank?:number;reasoning?:string}) => {
                    const task = tasks.find(t => t.id === String(p.id ?? ''))
                    if (!task) return null
                    const urgencyColor = { critical:'#ef4444', high:'#f59e0b', medium:'#6c8eff', low:'#64748b' }[(p.urgency ?? '') as 'critical'|'high'|'medium'|'low'] ?? '#64748b'
                    return (
                      <div key={String(p.id ?? "")} style={{ display:'flex', gap:12, padding:'10px 14px', borderRadius:8, background:'var(--pios-surface2)', alignItems:'flex-start' }}>
                        <span style={{ fontSize:18, fontWeight:800, color:'var(--pios-dim)', minWidth:28, lineHeight:1.2 }}>#{Number(p.rank ?? 0)}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{String(task.title ?? "")}</div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:Boolean(p.reasoning)?4:0 }}>
                            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:urgencyColor+'20', color:urgencyColor, fontWeight:600 }}>{String(p.urgency ?? "")}</span>
                            <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{domainLabel(String(task?.domain ?? ''))}</span>
                          </div>
                          {Boolean(p.reasoning) && <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5 }}>{String(p.reasoning ?? "")}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign:'center' as const, padding:'40px', color:'var(--pios-muted)', fontSize:13 }}>Analysis failed. Try again.</div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Task = {
  id: string; title?: string; status?: string; priority?: string
  deadline?: string; domain?: string; project_id?: string
  project_name?: string; assigned_to?: string
  created_at?: string; updated_at?: string; notes?: string
  tags?: string; estimated_hours?: number; actual_hours?: number
  due_date?: string; completed_at?: string
}

type DetectResult = {
  detected?: boolean; message?: string; tasks?: Task[]
  confidence?: number; source?: string
  prioritised?: Array<{id:string;title?:string;priority?:string;reason?:string}>
  focus_recommendation?: string
  blocked_risks?: string[]
}

export default function TasksPage() {
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [domainFilter,  setDomainFilter]  = useState('all')
  const [sourceFilter,  setSourceFilter]  = useState('all')
  const [overdueOnly,   setOverdueOnly]   = useState(false)
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedTask, setSelectedTask] = useState<Task|null>(null)
  const [showAI,     setShowAI]     = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [sortBy,     setSortBy]     = useState<'priority'|'due_date'|'domain'|'created_at'>('priority')
  const [saving,     setSaving]     = useState(false)
  const [newTask,    setNewTask]    = useState({ title:'', description:'', domain:'personal', priority:'medium', due_date:'', duration_mins:30 })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (domainFilter !== 'all') params.set('domain', domainFilter)
    if (sourceFilter !== 'all') params.set('source', sourceFilter)
    if (overdueOnly)            params.set('overdue', '1')
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data.tasks ?? [])
    setLoading(false)
  }, [domainFilter, sourceFilter, overdueOnly])

  useEffect(() => { load() }, [load])

  async function createTask() {
    if (!newTask.title.trim()) return
    setSaving(true)
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...newTask, status:'todo' }) })
    setNewTask({ title:'', description:'', domain:'personal', priority:'medium', due_date:'', duration_mins:30 })
    setShowAdd(false); setSaving(false); load()
  }

  async function updateTask(id:string, updates: Partial<Task> | Record<string,unknown> | unknown) {
    await fetch('/api/tasks', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, ...(updates as Record<string,unknown>) }) })
    setTasks(prev => prev.map((t: Task) => t.id===id ? { ...t, ...(updates as Record<string,unknown>) } as Task : t))
  }

  async function cycleStatus(id:string, current:string) {
    const next = STATUS_META[current]?.next ?? 'todo'
    await updateTask(id, { status:next })
  }

  async function deleteTask(id:string) {
    await fetch(`/api/tasks?id=${id}`, { method:'DELETE' })
    setTasks(prev => prev.filter((t: Record<string,unknown>) => t.id !== id))
  }

  // today must be declared BEFORE visibleTasks (was causing ReferenceError -> black screen)
  const today = new Date().toISOString().slice(0,10)

  // Filter displayed tasks
  const visibleTasks = tasks.filter(t => {
    if (statusFilter === 'open')    return ['todo','in_progress','blocked'].includes(String(t.status ?? ''))
    if (statusFilter === 'done')    return (t.status ?? '') === 'done'
    if (statusFilter === 'overdue') return t.due_date != null && t.due_date < today && (t.status ?? '') !== 'done'
    if (statusFilter !== 'all')     return String(t.status ?? '') === statusFilter
    return true
  })

  // Group by status for kanban
  const grouped = STATUSES.reduce((acc,s) => { acc[s] = visibleTasks.filter(t=>t.status===s); return acc }, {} as Record<string,any[]>)
  const openCount    = tasks.filter(t=>['todo','in_progress','blocked'].includes(String(t.status ?? ''))).length
  const criticalCount = tasks.filter(t=>t.priority==='critical' && t.status!=='done').length
  const overdueCount  = tasks.filter(t=>t.due_date && t.due_date < today && t.status!=='done').length

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'priority') {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2)
    }
    if (sortBy === 'due_date' || sortBy === 'created_at') {
      const aDate = a.due_date ? new Date(a.due_date as string).getTime() : Infinity
      const bDate = b.due_date ? new Date(b.due_date as string).getTime() : Infinity
      return aDate - bDate
    }
    return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  })

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap' as const, gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Tasks</h1>
          <p style={{ fontSize:13, color:'var(--pios-muted)' }}>
            {openCount} open
            {criticalCount > 0 && <span style={{ color:'#ef4444', fontWeight:600, marginLeft:8 }}>· {criticalCount} critical</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAI(true)} style={{ fontSize:12 }}>✦ AI Prioritise</button>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:12 }}>+ Add task</button>
        </div>
      </div>

      {/* Add task */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(108,142,255,0.3)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Task title…" value={newTask.title} autoFocus
              onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&createTask()} />
            <select className="pios-input" style={{ width:'auto' }} value={newTask.domain} onChange={e=>setNewTask(p=>({...p,domain:e.target.value}))}>
              {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <select className="pios-input" style={{ width:'auto' }} value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}>
              {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} />
          </div>
          <textarea className="pios-input" placeholder="Description (optional)…" rows={2} value={newTask.description} onChange={e=>setNewTask(p=>({...p,description:e.target.value}))} style={{ marginBottom:8, resize:'vertical' as const, fontFamily:'inherit' }} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={createTask} disabled={saving} style={{ fontSize:12 }}>{saving?'Adding…':'Add task'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' as const, alignItems:'center' }}>
  
        {/* Sort */}
        <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:'auto' }}>
          <span style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.06em' }}>SORT</span>
          {([['due_date','Due date'],['priority','Priority'],['created_at','Recent']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setSortBy(v)} style={{ padding:'3px 8px', borderRadius:6, fontSize:11, border:'1px solid var(--pios-border)', background:sortBy===v?'var(--pios-surface2)':'transparent', color:sortBy===v?'var(--pios-text)':'var(--pios-dim)', cursor:'pointer', fontWeight:sortBy===v?600:400 }}>{l}</button>
          ))}
        </div>

      {/* Domain filter */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const }}>
          {(['all',...DOMAINS] as const).map(d => (
            <button key={d} onClick={()=>setDomainFilter(d)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:11, border:'none', cursor:'pointer',
              background: domainFilter===d ? domainColour(d==='all'?'personal':d) : 'var(--pios-surface2)',
              color: domainFilter===d ? '#0a0b0d' : 'var(--pios-muted)', fontWeight: domainFilter===d?600:400,
            }}>{d==='all'?'All':domainLabel(d)}</button>
          ))}
        </div>
        {/* Source filter */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, marginTop:4 }}>
          {([['all','All sources'],['manual','Manual'],['meeting_notes','Meetings'],['email','Email'],['ai','AI']] as [string,string][]).map(([v,l]) => (
            <button key={v} onClick={() => setSourceFilter(v)} style={{
              fontSize:10, padding:'3px 10px', borderRadius:20, border:'none', cursor:'pointer',
              background: sourceFilter===v ? 'rgba(34,197,94,0.15)' : 'var(--pios-surface2)',
              color: sourceFilter===v ? '#22c55e' : 'var(--pios-muted)', fontWeight: sourceFilter===v?600:400,
            }}>{l}</button>
          ))}
          <button onClick={() => setOverdueOnly(v => !v)} style={{
            fontSize:10, padding:'3px 10px', borderRadius:20, border:'none', cursor:'pointer',
            background: overdueOnly ? 'rgba(239,68,68,0.15)' : 'var(--pios-surface2)',
            color: overdueOnly ? '#ef4444' : 'var(--pios-muted)', fontWeight: overdueOnly?600:400,
          }}>⚠ Overdue</button>
        </div>
        <div style={{ width:'1px', height:20, background:'var(--pios-border)' }} />
        {/* Status filter */}
        <div style={{ display:'flex', gap:4 }}>
          {([['open','Open'],['overdue',`Overdue${overdueCount>0?' ('+overdueCount+')':''}`],['all','All'],['done','Done']] as [string,string][]).map(([v,l])=>(
            <button key={v} onClick={()=>setStatusFilter(v)} style={{
              ...(v==='overdue' && overdueCount>0 ? { color: statusFilter===v ? '#ef4444' : '#f97316', borderColor:'rgba(239,68,68,0.4)' } : {}),
              padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', cursor:'pointer',
              background: statusFilter===v?'var(--pios-surface)':'transparent',
              color: v==='overdue'&&overdueCount>0 ? (statusFilter===v?'#ef4444':'#f97316') : (statusFilter===v?'var(--pios-text)':'var(--pios-muted)'),
              fontWeight:statusFilter===v?600:400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : visibleTasks.length === 0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'48px 24px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No tasks here</div>
          <p style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:16 }}>
            {statusFilter==='done' ? "You haven't completed any tasks yet." : "All clear! Add a task to get started."}
          </p>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(true)} style={{ fontSize:13 }}>+ Add task</button>
        </div>
      ) : statusFilter === 'done' ? (
        // Done list
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          {visibleTasks.map(t => (
            <div key={t.id as string} style={{ padding:'10px 14px', borderRadius:8, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', display:'flex', alignItems:'center', gap:10, opacity:0.65, cursor:'pointer' }} onClick={()=>setSelectedTask(t as Task)}>
              <span style={{ fontSize:14, color:'#22c55e' }}>✓</span>
              <span style={{ fontSize:13, textDecoration:'line-through', color:'var(--pios-dim)', flex:1 }}>{String(t.title ?? "")}</span>
              <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{t.completed_at?new Date(t.completed_at).toLocaleDateString('en-GB'):''}</span>
            </div>
          ))}
        </div>
      ) : (
        // Kanban columns
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {(['todo','in_progress','blocked'] as const).map(status => {
            const col = grouped[status] ?? []
            const m = STATUS_META[status]
            return (
              <div key={status}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:m.colour, display:'inline-block' }} />
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>{m.label}</span>
                  <span style={{ fontSize:11, padding:'1px 7px', borderRadius:10, background:'var(--pios-surface2)', color:'var(--pios-muted)', fontWeight:600 }}>{col.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                  {col.map(t => (
                    <div key={t.id as string} style={{
                      padding:'12px 14px', borderRadius:8, background:'var(--pios-surface)',
                      border:`1px solid ${t.priority==='critical'?'rgba(239,68,68,0.3)':'var(--pios-border)'}`,
                      cursor:'pointer', transition:'border-color 0.15s',
                    }}
                    onClick={()=>setSelectedTask(t as Task)}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                        <PriorityDot priority={String(t.priority ?? "")} />
                        <span style={{ fontSize:13, fontWeight:500, lineHeight:1.3, flex:1 }}>{String(t.title ?? "")}</span>
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const, alignItems:'center' }}>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:domainColour(String(t.domain ?? ''))+'20', color:domainColour(String(t.domain ?? '')) }}>
                          {domainLabel(String(t.domain ?? ''))}
                        </span>
                        {t.due_date && (
                          <span style={{ fontSize:10, color: new Date(t.due_date) < new Date() ? '#ef4444' : 'var(--pios-dim)' }}>
                            {formatRelative(String(t.due_date ?? ''))}
                          </span>
                        )}
                        {t.description && <span style={{ fontSize:10, color:'var(--pios-dim)' }}>📝</span>}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                        <StatusPill status={String(t.status ?? "")} onClick={()=>cycleStatus(t.id,t.status)} />
                        <button onClick={e=>{e.stopPropagation?.();deleteTask(t.id)}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pios-dim)', fontSize:13, padding:'0 2px', lineHeight:1 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && (
                    <div style={{ padding:'24px 0', textAlign:'center' as const, color:'var(--pios-dim)', fontSize:12, border:'1px dashed var(--pios-border)', borderRadius:8 }}>
                      No {m.label.toLowerCase()} tasks
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawers */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={()=>setSelectedTask(null)} onSave={updateTask} onDelete={deleteTask} />
      )}
      {showAI && <AIPrioritisePanel tasks={tasks} onClose={()=>setShowAI(false)} />}
    </div>
  )
}
