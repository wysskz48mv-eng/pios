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
function TaskDrawer({ task, onClose, onSave, onDelete }: { task:any; onClose:()=>void; onSave:(id:string,updates:any)=>void; onDelete:(id:string)=>void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title:task.title, description:task.description||'', domain:task.domain, priority:task.priority, due_date:task.due_date?task.due_date.slice(0,10):'', status:task.status, duration_mins:task.duration_mins||30 })
  const [saving, setSaving] = useState(false)
  function f(k:string,v:any) { setForm(p=>({...p,[k]:v})) }

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
              <h2 style={{ fontSize:17, fontWeight:700, lineHeight:1.3, marginBottom:4, color:task.status==='done'?'var(--pios-dim)':'var(--pios-text)', textDecoration:task.status==='done'?'line-through':'none' }}>{task.title}</h2>
            )}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' }}>
              <StatusPill status={task.status} />
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:domainColour(task.domain)+'20', color:domainColour(task.domain), fontWeight:600 }}>{domainLabel(task.domain)}</span>
              <PriorityDot priority={task.priority} />
              <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{task.priority}</span>
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
                <div key={f.label} style={{ padding:'10px', borderRadius:8, background:'var(--pios-surface2)' }}>
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
  const [result, setResult]   = useState<any>(null)

  useEffect(() => {
    const openTasks = tasks.filter(t => t.status !== 'done')
    fetch('/api/tasks', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'ai_prioritise', tasks: openTasks }),
    }).then(r=>r.json()).then(d=>{ setResult(d); setLoading(false) }).catch(()=>setLoading(false))
  }, [])

  const rankMap = Object.fromEntries((result?.prioritised ?? []).map((p:any) => [p.id, p]))

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

            {result.blocked_risks?.length > 0 && (
              <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(249,115,22,0.08)', borderLeft:'3px solid #f97316', fontSize:12, color:'var(--pios-text)' }}>
                <div style={{ fontWeight:600, color:'#f97316', marginBottom:4 }}>⚠ Blocking risks</div>
                {result.blocked_risks.map((r:string,i:number) => <div key={i} style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5 }}>• {r}</div>)}
              </div>
            )}

            {result.prioritised?.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--pios-muted)', marginBottom:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Priority order for today</div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                  {result.prioritised.slice(0,10).map((p:any) => {
                    const task = tasks.find(t=>t.id===p.id)
                    if (!task) return null
                    const urgencyColor = { critical:'#ef4444', high:'#f59e0b', medium:'#6c8eff', low:'#64748b' }[p.urgency as string] ?? '#64748b'
                    return (
                      <div key={p.id} style={{ display:'flex', gap:12, padding:'10px 14px', borderRadius:8, background:'var(--pios-surface2)', alignItems:'flex-start' }}>
                        <span style={{ fontSize:18, fontWeight:800, color:'var(--pios-dim)', minWidth:28, lineHeight:1.2 }}>#{p.rank}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{task.title}</div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:p.reasoning?4:0 }}>
                            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:urgencyColor+'20', color:urgencyColor, fontWeight:600 }}>{p.urgency}</span>
                            <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{domainLabel(task.domain)}</span>
                          </div>
                          {p.reasoning && <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5 }}>{p.reasoning}</div>}
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
export default function TasksPage() {
  const [tasks,      setTasks]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [domainFilter, setDomainFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showAI,     setShowAI]     = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [newTask,    setNewTask]    = useState({ title:'', description:'', domain:'personal', priority:'medium', due_date:'', duration_mins:30 })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (domainFilter !== 'all') params.set('domain', domainFilter)
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(data.tasks ?? [])
    setLoading(false)
  }, [domainFilter])

  useEffect(() => { load() }, [load])

  async function createTask() {
    if (!newTask.title.trim()) return
    setSaving(true)
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...newTask, status:'todo' }) })
    setNewTask({ title:'', description:'', domain:'personal', priority:'medium', due_date:'', duration_mins:30 })
    setShowAdd(false); setSaving(false); load()
  }

  async function updateTask(id:string, updates:any) {
    await fetch('/api/tasks', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, ...updates }) })
    setTasks(prev => prev.map(t => t.id===id ? { ...t, ...updates } : t))
  }

  async function cycleStatus(id:string, current:string) {
    const next = STATUS_META[current]?.next ?? 'todo'
    await updateTask(id, { status:next })
  }

  async function deleteTask(id:string) {
    await fetch(`/api/tasks?id=${id}`, { method:'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  // Filter displayed tasks
  const visibleTasks = tasks.filter(t => {
    if (statusFilter === 'open')   return ['todo','in_progress','blocked'].includes(t.status)
    if (statusFilter === 'done')   return t.status === 'done'
    if (statusFilter !== 'all')    return t.status === statusFilter
    return true
  })

  // Group by status for kanban
  const grouped = STATUSES.reduce((acc,s) => { acc[s] = visibleTasks.filter(t=>t.status===s); return acc }, {} as Record<string,any[]>)
  const openCount = tasks.filter(t=>['todo','in_progress','blocked'].includes(t.status)).length
  const criticalCount = tasks.filter(t=>t.priority==='critical' && t.status!=='done').length

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
        <div style={{ width:'1px', height:20, background:'var(--pios-border)' }} />
        {/* Status filter */}
        <div style={{ display:'flex', gap:4 }}>
          {[['open','Open'],['all','All'],['done','Done']].map(([v,l])=>(
            <button key={v} onClick={()=>setStatusFilter(v)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', cursor:'pointer',
              background: statusFilter===v?'var(--pios-surface)':'transparent', color:statusFilter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight:statusFilter===v?600:400,
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
            <div key={t.id} style={{ padding:'10px 14px', borderRadius:8, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', display:'flex', alignItems:'center', gap:10, opacity:0.65, cursor:'pointer' }} onClick={()=>setSelectedTask(t)}>
              <span style={{ fontSize:14, color:'#22c55e' }}>✓</span>
              <span style={{ fontSize:13, textDecoration:'line-through', color:'var(--pios-dim)', flex:1 }}>{t.title}</span>
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
                    <div key={t.id} style={{
                      padding:'12px 14px', borderRadius:8, background:'var(--pios-surface)',
                      border:`1px solid ${t.priority==='critical'?'rgba(239,68,68,0.3)':'var(--pios-border)'}`,
                      cursor:'pointer', transition:'border-color 0.15s',
                    }}
                    onClick={()=>setSelectedTask(t)}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                        <PriorityDot priority={t.priority} />
                        <span style={{ fontSize:13, fontWeight:500, lineHeight:1.3, flex:1 }}>{t.title}</span>
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const, alignItems:'center' }}>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:domainColour(t.domain)+'20', color:domainColour(t.domain) }}>
                          {domainLabel(t.domain)}
                        </span>
                        {t.due_date && (
                          <span style={{ fontSize:10, color: new Date(t.due_date) < new Date() ? '#ef4444' : 'var(--pios-dim)' }}>
                            {formatRelative(t.due_date)}
                          </span>
                        )}
                        {t.description && <span style={{ fontSize:10, color:'var(--pios-dim)' }}>📝</span>}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                        <StatusPill status={t.status} onClick={e=>{(e as any).stopPropagation?.();cycleStatus(t.id,t.status)}} />
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
