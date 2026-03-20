'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, priorityColour, domainColour, domainLabel } from '@/lib/utils'

const DOMAINS = ['all','academic','fm_consulting','saas','business','personal']
const STATUSES = ['todo','in_progress','blocked','done']
const PRIORITIES = ['critical','high','medium','low']

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title:'', domain:'personal', priority:'medium', due_date:'' })
  const supabase = createClient()

  useEffect(() => { loadTasks() }, [filter])

  async function loadTasks() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase.from('tasks').select('*').eq('user_id', user.id).neq('status','cancelled').order('due_date',{ascending:true})
    if (filter !== 'all') q = q.eq('domain', filter)
    const { data } = await q
    setTasks(data ?? [])
    setLoading(false)
  }

  async function addTask() {
    if (!newTask.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').insert({ ...newTask, user_id: user.id, status:'todo' })
    setNewTask({ title:'', domain:'personal', priority:'medium', due_date:'' })
    setShowAdd(false)
    loadTasks()
  }

  async function toggleDone(id: string, current: string) {
    await supabase.from('tasks').update({ status: current==='done'?'todo':'done', completed_at: current==='done'?null:new Date().toISOString() }).eq('id',id)
    loadTasks()
  }

  const byStatus = STATUSES.reduce((acc,s) => { acc[s]=tasks.filter(t=>t.status===s); return acc }, {} as Record<string,any[]>)

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontSize:'22px', fontWeight:700 }}>Tasks</h1>
        <button className="pios-btn pios-btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize:'12px' }}>+ Add Task</button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom:'16px', borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:'10px', alignItems:'center' }}>
            <input className="pios-input" placeholder="Task title…" value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addTask()} />
            <select className="pios-input" style={{ width:'auto' }} value={newTask.domain} onChange={e=>setNewTask(p=>({...p,domain:e.target.value}))}>
              {['academic','fm_consulting','saas','business','personal'].map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <select className="pios-input" style={{ width:'auto' }} value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}>
              {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={newTask.due_date} onChange={e=>setNewTask(p=>({...p,due_date:e.target.value}))} />
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
            <button className="pios-btn pios-btn-primary" onClick={addTask} style={{ fontSize:'12px' }}>Add Task</button>
            <button className="pios-btn pios-btn-ghost" onClick={() => setShowAdd(false)} style={{ fontSize:'12px' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Domain filter */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap' }}>
        {DOMAINS.map(d => (
          <button key={d} onClick={() => setFilter(d)} style={{
            padding:'5px 12px', borderRadius:'20px', fontSize:'12px', border:'none', cursor:'pointer',
            background: filter===d ? domainColour(d==='all'?'personal':d) : 'var(--pios-surface2)',
            color: filter===d ? '#0a0b0d' : 'var(--pios-muted)',
            fontWeight: filter===d ? 600 : 400,
          }}>{d==='all'?'All domains':domainLabel(d)}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:'var(--pios-muted)' }}>Loading tasks…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
          {['todo','in_progress','blocked'].map(status => (
            <div key={status}>
              <div style={{ fontSize:'11px', fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:status==='todo'?'#6b7280':status==='in_progress'?'#6c8eff':'#f97316', display:'inline-block' }} />
                {status.replace('_',' ')} <span style={{ background:'var(--pios-surface2)', padding:'1px 6px', borderRadius:'10px' }}>{byStatus[status]?.length||0}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {(byStatus[status]||[]).map(t => (
                  <div key={t.id} style={{ padding:'12px', borderRadius:'8px', background:'var(--pios-surface)', border:'1px solid var(--pios-border)', cursor:'pointer' }}
                    onClick={() => toggleDone(t.id, t.status)}>
                    <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                      <div style={{ width:'14px', height:'14px', borderRadius:'50%', border:`2px solid ${priorityColour(t.priority)}`, flexShrink:0, marginTop:'2px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {t.status==='done'&&<div style={{ width:'6px', height:'6px', borderRadius:'50%', background:priorityColour(t.priority) }} />}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', fontWeight:500, textDecoration:t.status==='done'?'line-through':'none', color:t.status==='done'?'var(--pios-dim)':'var(--pios-text)' }}>{t.title}</div>
                        <div style={{ display:'flex', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'3px', background:`${domainColour(t.domain)}20`, color:domainColour(t.domain) }}>{domainLabel(t.domain)}</span>
                          {t.due_date && <span style={{ fontSize:'10px', color:'var(--pios-dim)' }}>{formatRelative(t.due_date)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
