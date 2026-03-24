'use client'
import { useEffect, useState, useCallback } from 'react'
import { domainColour, domainLabel, formatRelative } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Projects — CRUD with progress editing, task counts, domain filtering, status
// ─────────────────────────────────────────────────────────────────────────────

const DOMAINS   = ['academic','fm_consulting','saas','business','personal'] as const
const STATUSES  = ['active','on_hold','completed','cancelled'] as const
const PRIORITIES = ['critical','high','medium','low'] as const

const STATUS_COLOUR: Record<string,string> = {
  active:'#22c55e', on_hold:'#f59e0b', completed:'#6c8eff', cancelled:'#64748b'
}

function ProgressBar({ value, colour }: { value:number; colour:string }) {
  return <div style={{ height:6,background:'var(--pios-surface2)',borderRadius:3,overflow:'hidden' }}>
    <div style={{ height:'100%',width:`${Math.min(100,value)}%`,background:colour,borderRadius:3,transition:'width 0.4s' }} />
  </div>
}

// Project detail drawer
function ProjectDrawer({ project, tasks, onClose, onSave, onDelete }: { project:any; tasks:any[]; onClose:()=>void; onSave:(id:string,d: unknown)=>void; onDelete:(id:string)=>void }) {
  const [editing, setEditing] = useState(!project.id)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    title:      project.title??'',
    description:project.description??'',
    domain:     project.domain??'personal',
    status:     project.status??'active',
    priority:   project.priority??'medium',
    progress:   project.progress??0,
    start_date: project.start_date??'',
    due_date:   project.due_date??'',
    colour:     project.colour??domainColour(project.domain??'personal'),
  })
  function f(k:string,v: unknown) { setForm(p=>({...p,[k]:v})) }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave(project.id, form)
    setSaving(false)
    if (project.id) setEditing(false); else onClose()
  }

  const projTasks = tasks.filter((t: Record<string,unknown>) => (t as Record<string,unknown>).project_id === project.id)
  const doneTasks = projTasks.filter((t: Record<string,unknown>) => (t as Record<string,unknown>).status === 'done').length

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.5)' }} />
      <div style={{ position:'relative',width:440,background:'var(--pios-surface)',borderLeft:'1px solid var(--pios-border)',height:'100%',overflowY:'auto' as const,padding:28,display:'flex',flexDirection:'column' as const,gap:16 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
          <div style={{ flex:1,minWidth:0 }}>
            {editing ? <input className="pios-input" value={form.title} onChange={e=>f('title',e.target.value)} style={{ fontSize:17,fontWeight:700,marginBottom:6 }} autoFocus placeholder="Project title…" />
              : <h2 style={{ fontSize:17,fontWeight:700,lineHeight:1.3,marginBottom:4 }}>{project.title}</h2>}
            {!editing && (
              <div style={{ display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const }}>
                <span style={{ fontSize:11,padding:'2px 8px',borderRadius:20,background:(STATUS_COLOUR[project.status]??'#64748b')+'20',color:STATUS_COLOUR[project.status]??'#64748b',fontWeight:600 }}>{project.status?.replace('_',' ')}</span>
                <span style={{ fontSize:11,padding:'2px 8px',borderRadius:20,background:domainColour(project.domain)+'20',color:domainColour(project.domain),fontWeight:600 }}>{domainLabel(project.domain)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,marginLeft:8 }}>✕</button>
        </div>

        {editing ? (
          <div style={{ display:'flex',flexDirection:'column' as const,gap:10 }}>
            <textarea className="pios-input" placeholder="Description…" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} style={{ resize:'vertical' as const,fontFamily:'inherit' }} />
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Domain</div>
                <select className="pios-input" value={form.domain} onChange={e=>f('domain',e.target.value)}>
                  {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Status</div>
                <select className="pios-input" value={form.status} onChange={e=>f('status',e.target.value)}>
                  {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Priority</div>
                <select className="pios-input" value={form.priority} onChange={e=>f('priority',e.target.value)}>
                  {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Progress %</div>
                <input type="number" className="pios-input" min={0} max={100} value={form.progress} onChange={e=>f('progress',parseInt(e.target.value)||0)} />
              </div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Start date</div>
                <input type="date" className="pios-input" value={form.start_date} onChange={e=>f('start_date',e.target.value)} />
              </div>
              <div><div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>Due date</div>
                <input type="date" className="pios-input" value={form.due_date} onChange={e=>f('due_date',e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button className="pios-btn pios-btn-primary" onClick={save} disabled={saving} style={{ flex:1,fontSize:12 }}>{saving?'Saving…':project.id?'Save':'Create project'}</button>
              <button className="pios-btn pios-btn-ghost" onClick={()=>project.id?setEditing(false):onClose()} style={{ fontSize:12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {project.description && <div style={{ fontSize:13,color:'var(--pios-muted)',lineHeight:1.65,padding:'12px 14px',borderRadius:8,background:'var(--pios-surface2)' }}>{project.description}</div>}
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12 }}>
                <span style={{ color:'var(--pios-muted)' }}>Progress</span>
                <span style={{ fontWeight:700,color:domainColour(project.domain) }}>{project.progress}%</span>
              </div>
              <ProgressBar value={project.progress} colour={domainColour(project.domain)} />
              <input type="range" min={0} max={100} value={form.progress}
                onChange={e=>f('progress',parseInt(e.target.value))}
                onMouseUp={()=>onSave(project.id,{ progress:form.progress })}
                style={{ width:'100%',marginTop:8,cursor:'pointer',accentColor:domainColour(project.domain) }} />
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Due',      value:project.due_date?formatRelative(project.due_date):'No deadline' },
                { label:'Priority', value:project.priority },
                { label:'Tasks',    value:projTasks.length>0?`${doneTasks}/${projTasks.length} done`:'No tasks linked' },
                { label:'Domain',   value:domainLabel(project.domain) },
              ].map(fi=>(
                <div key={(fi as Record<string,unknown>).label as string} style={{ padding:'8px 10px',borderRadius:6,background:'var(--pios-surface2)' }}>
                  <div style={{ fontSize:10,color:'var(--pios-dim)',textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:2 }}>{fi.label}</div>
                  <div style={{ fontSize:12,fontWeight:600 }}>{fi.value}</div>
                </div>
              ))}
            </div>
            {/* Linked tasks */}
            {projTasks.length > 0 && (
              <div>
                <div style={{ fontSize:11,fontWeight:600,color:'var(--pios-muted)',marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.06em' }}>Linked tasks ({projTasks.length})</div>
                <div style={{ display:'flex',flexDirection:'column' as const,gap:5 }}>
                  {projTasks.slice(0,6).map(t=>(
                    <div key={(t as Record<string,unknown>).id as string} style={{ display:'flex',gap:8,alignItems:'center',padding:'6px 10px',borderRadius:6,background:'var(--pios-surface2)' }}>
                      <span style={{ width:8,height:8,borderRadius:'50%',background:t.status==='done'?'#22c55e':t.status==='in_progress'?'#6c8eff':'#64748b',flexShrink:0,display:'inline-block' }} />
                      <span style={{ fontSize:12,flex:1,textDecoration:t.status==='done'?'line-through':'none',color:t.status==='done'?'var(--pios-dim)':'var(--pios-text)' }}>{t.title}</span>
                      {t.due_date&&<span style={{ fontSize:10,color:'var(--pios-dim)' }}>{formatRelative(t.due_date)}</span>}
                    </div>
                  ))}
                  {projTasks.length>6&&<div style={{ fontSize:11,color:'var(--pios-dim)',textAlign:'center' as const }}>+{projTasks.length-6} more tasks</div>}
                </div>
              </div>
            )}
            <div style={{ display:'flex',gap:8,marginTop:'auto',paddingTop:8 }}>
              <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(true)} style={{ flex:1,fontSize:12 }}>✎ Edit</button>
              <button onClick={()=>{onDelete(project.id);onClose()}} style={{ padding:'8px 14px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'none',cursor:'pointer',color:'#ef4444',fontSize:12 }}>Archive</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Record<string,unknown>[]>([])
  const [tasks,    setTasks]    = useState<Record<string,unknown>[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'active'|'all'|'completed'>('active')
  const [domainFilter, setDomainFilter] = useState('all')
  const [selected, setSelected] = useState<Record<string,unknown>|null>(null)
  const [adding,   setAdding]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/projects?include=tasks')
    const d   = res.ok ? await res.json() : {}
    setProjects(d.projects ?? [])
    setTasks(d.tasks ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveProject(id: string, data: unknown) {
    if (id) {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      })
      if (res.ok) {
        const { project } = await res.json()
        setProjects(p => p.map(pr => pr.id === id ? project : pr))
        if (selected?.id === id) setSelected(project)
      }
    } else {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    load()
  }

  async function deleteProject(id: string) {
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, status: 'cancelled' } : pr))
  }

  const visible = projects.filter(p => {
    if (filter==='active' && !['active','on_hold'].includes(p.status)) return false
    if (filter==='completed' && p.status!=='completed') return false
    if (domainFilter!=='all' && p.domain!==domainFilter) return false
    return true
  })

  const totalActive = projects.filter(p=>p.status==='active').length
  const avgProgress = projects.filter(p=>p.status==='active').reduce((s,p)=>s+(p.progress||0),0) / (totalActive||1)

  return (
    <div className="fade-in">
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:700,marginBottom:4 }}>Projects</h1>
          <p style={{ fontSize:13,color:'var(--pios-muted)' }}>
            {totalActive} active · avg {Math.round(avgProgress)}% complete
          </p>
        </div>
        <button className="pios-btn pios-btn-primary" onClick={()=>setAdding(true)} style={{ fontSize:12 }}>+ New project</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex',gap:10,marginBottom:20,flexWrap:'wrap' as const,alignItems:'center' }}>
        <div style={{ display:'flex',gap:4 }}>
          {[['active','Active'],['all','All'],['completed','Completed']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v as 'active' | 'all' | 'completed')} style={{ padding:'5px 12px',borderRadius:20,fontSize:11,border:'1px solid var(--pios-border)',background:filter===v?'var(--pios-surface)':'transparent',color:filter===v?'var(--pios-text)':'var(--pios-muted)',fontWeight:filter===v?600:400,cursor:'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ width:'1px',height:20,background:'var(--pios-border)' }} />
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' as const }}>
          {(['all',...DOMAINS] as const).map(d=>(
            <button key={d} onClick={()=>setDomainFilter(d)} style={{ padding:'4px 10px',borderRadius:20,fontSize:11,border:'none',cursor:'pointer',background:domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-surface2)',color:domainFilter===d?'#0a0b0d':'var(--pios-muted)',fontWeight:domainFilter===d?600:400 }}>
              {d==='all'?'All':domainLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ textAlign:'center' as const,padding:'40px',color:'var(--pios-muted)',fontSize:13 }}>Loading…</p>
      : visible.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const,padding:'48px 24px' }}>
          <div style={{ fontSize:32,marginBottom:12 }}>◈</div>
          <div style={{ fontSize:15,fontWeight:700,marginBottom:8 }}>No projects here</div>
          <p style={{ fontSize:13,color:'var(--pios-muted)',marginBottom:16 }}>
            {filter==='completed'?'No completed projects yet.':'Add a project to start tracking progress.'}
          </p>
          <button className="pios-btn pios-btn-primary" onClick={()=>setAdding(true)} style={{ fontSize:13 }}>+ New project</button>
        </div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {visible.map(p => {
            const pt = tasks.filter(t=>t.project_id===p.id)
            const done = pt.filter(t=>t.status==='done').length
            return (
              <div key={(p as Record<string,unknown>).id as string} onClick={()=>setSelected(p)} className="pios-card" style={{ cursor:'pointer',borderTop:`3px solid ${p.colour||domainColour(p.domain)}`,padding:'14px 16px',transition:'border-color 0.15s' }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,marginBottom:4,lineHeight:1.3 }}>{p.title}</div>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' as const,alignItems:'center' }}>
                      <span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:domainColour(p.domain)+'20',color:domainColour(p.domain) }}>{domainLabel(p.domain)}</span>
                      <span style={{ fontSize:10,padding:'1px 6px',borderRadius:3,background:(STATUS_COLOUR[p.status]??'#64748b')+'20',color:STATUS_COLOUR[p.status]??'#64748b' }}>{p.status?.replace('_',' ')}</span>
                    </div>
                  </div>
                </div>
                {p.description && <p style={{ fontSize:11,color:'var(--pios-muted)',lineHeight:1.5,marginBottom:10 }}>{p.description.slice(0,80)}{p.description.length>80?'…':''}</p>}
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:11,color:'var(--pios-dim)' }}>Progress</span>
                    <span style={{ fontSize:11,fontWeight:700,color:p.colour||domainColour(p.domain) }}>{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} colour={p.colour||domainColour(p.domain)} />
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'var(--pios-dim)' }}>
                  {p.due_date ? <span>Due {formatRelative(p.due_date)}</span> : <span/>}
                  {pt.length>0 && <span>{done}/{pt.length} tasks</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(selected||adding) && (
        <ProjectDrawer
          project={selected ?? { id:'',title:'',domain:'personal',status:'active',priority:'medium',progress:0 }}
          tasks={tasks}
          onClose={()=>{ setSelected(null); setAdding(false) }}
          onSave={saveProject}
          onDelete={deleteProject}
        />
      )}
    </div>
  )
}
