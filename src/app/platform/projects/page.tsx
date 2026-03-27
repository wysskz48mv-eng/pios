'use client'
import { useEffect, useState, useCallback } from 'react'
import { domainColour, domainLabel, formatRelative } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Projects v3.0 — UIX upgrade · all logic preserved
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const DOMAINS    = ['academic','fm_consulting','saas','business','personal'] as const
const STATUSES   = ['active','on_hold','completed','cancelled'] as const
const PRIORITIES = ['critical','high','medium','low'] as const

const STATUS_COLOUR: Record<string,string> = {
  active:'var(--fm)', on_hold:'var(--saas)', completed:'var(--academic)', cancelled:'var(--pios-dim)',
}

const sel: React.CSSProperties = {
  display:'block', width:'100%', padding:'9px 12px',
  background:'var(--pios-surface2)', border:'1px solid var(--pios-border2)',
  borderRadius:8, color:'var(--pios-text)', fontSize:13,
  fontFamily:'var(--font-sans)', outline:'none',
}
const inp: React.CSSProperties = { ...sel }

function Bar({ v, c }: { v:number; c:string }) {
  return (
    <div style={{ height:4, background:'var(--pios-surface3)', borderRadius:99, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,v)}%`, background:c, borderRadius:99, transition:'width 0.4s' }} />
    </div>
  )
}

function Tag({ children, color }: { children:React.ReactNode; color:string }) {
  return <span style={{ fontSize:9.5, fontWeight:600, padding:'2px 7px', borderRadius:5, background:`${color}12`, color }}>{children}</span>
}

// ── Drawer ───────────────────────────────────────────────────────────────────
function ProjectDrawer({ project, tasks, onClose, onSave, onDelete }: {
  project:any; tasks:any[]; onClose:()=>void; onSave:(id:string,d:unknown)=>void; onDelete:(id:string)=>void
}) {
  const [editing, setEditing] = useState(!project.id)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    title:project.title??'', description:project.description??'',
    domain:project.domain??'personal', status:project.status??'active',
    priority:project.priority??'medium', progress:project.progress??0,
    start_date:project.start_date??'', due_date:project.due_date??'',
    colour:project.colour??domainColour(project.domain??'personal'),
  })
  function f(k:string,v:unknown) { setForm(p=>({...p,[k]:v})) }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true); await onSave(project.id, form); setSaving(false)
    if (project.id) setEditing(false); else onClose()
  }

  const projTasks = tasks.filter((t:any) => t.project_id === project.id)
  const doneTasks = projTasks.filter((t:any) => t.status === 'done').length

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.55)' }} />
      <div style={{ position:'relative',width:460,background:'var(--pios-surface)',borderLeft:'1px solid var(--pios-border)',height:'100%',overflowY:'auto',padding:28,display:'flex',flexDirection:'column',gap:16 }}>

        {/* Gradient top rule */}
        <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, ${form.colour}, var(--ai))` }} />

        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
          <div style={{ flex:1,minWidth:0 }}>
            {editing
              ? <input style={{ ...inp, fontSize:17, fontWeight:700, marginBottom:6 }} value={form.title} onChange={e=>f('title',e.target.value)} autoFocus placeholder="Project title…" />
              : <h2 style={{ fontFamily:'var(--font-display)',fontSize:17,fontWeight:400,letterSpacing:'-0.02em',lineHeight:1.3,marginBottom:6 }}>{project.title}</h2>}
            {!editing && (
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                <Tag color={STATUS_COLOUR[project.status]??'var(--pios-dim)'}>{project.status?.replace('_',' ')}</Tag>
                <Tag color={domainColour(project.domain)}>{domainLabel(project.domain)}</Tag>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--pios-muted)',fontSize:18,marginLeft:10 }}>✕</button>
        </div>

        {editing ? (
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            <textarea style={{ ...inp,resize:'vertical',fontFamily:'inherit',minHeight:80 }} placeholder="Description…" rows={3} value={form.description} onChange={e=>f('description',e.target.value)} />
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Domain',   key:'domain',   as:'select', opts:DOMAINS.map(d=>({v:d,l:domainLabel(d)})) },
                { label:'Status',   key:'status',   as:'select', opts:STATUSES.map(s=>({v:s,l:s.replace('_',' ')})) },
                { label:'Priority', key:'priority', as:'select', opts:PRIORITIES.map(p=>({v:p,l:p})) },
                { label:'Progress %', key:'progress', as:'number' },
                { label:'Start date', key:'start_date', as:'date' },
                { label:'Due date',   key:'due_date',   as:'date' },
              ].map((field:any) => (
                <div key={field.key}>
                  <div style={{ fontSize:10,color:'var(--pios-dim)',letterSpacing:'0.05em',textTransform:'uppercase',fontWeight:600,marginBottom:5 }}>{field.label}</div>
                  {field.as === 'select'
                    ? <select style={sel} value={(form as any)[field.key]} onChange={e=>f(field.key,e.target.value)}>
                        {field.opts.map((o:any) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    : <input type={field.as} style={inp} value={(form as any)[field.key]} onChange={e=>f(field.key,field.as==='number'?parseInt(e.target.value)||0:e.target.value)} min={0} max={100} />
                  }
                </div>
              ))}
            </div>
            <div style={{ display:'flex',gap:8,marginTop:4 }}>
              <button onClick={save} disabled={saving} style={{ flex:1,padding:'11px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:400,cursor:'pointer' }}>
                {saving?'Saving…':project.id?'Save changes':'Create project'}
              </button>
              <button onClick={()=>project.id?setEditing(false):onClose()} style={{ padding:'11px 16px',borderRadius:9,border:'1px solid var(--pios-border2)',background:'transparent',color:'var(--pios-muted)',fontSize:13,cursor:'pointer',fontFamily:'var(--font-sans)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {project.description && <div style={{ fontSize:13,color:'var(--pios-muted)',lineHeight:1.65,padding:'12px 14px',borderRadius:9,background:'var(--pios-surface2)' }}>{project.description}</div>}
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12 }}>
                <span style={{ color:'var(--pios-muted)' }}>Progress</span>
                <span style={{ fontFamily:'var(--font-display)',fontWeight:400,color:form.colour }}>{project.progress}%</span>
              </div>
              <Bar v={project.progress} c={form.colour} />
              <input type="range" min={0} max={100} value={form.progress}
                onChange={e=>f('progress',parseInt(e.target.value))}
                onMouseUp={()=>onSave(project.id,{progress:form.progress})}
                style={{ width:'100%',marginTop:10,cursor:'pointer',accentColor:form.colour }} />
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
              {[
                { label:'Due',      value:project.due_date?formatRelative(project.due_date):'No deadline' },
                { label:'Priority', value:project.priority },
                { label:'Tasks',    value:projTasks.length>0?`${doneTasks}/${projTasks.length} done`:'No tasks linked' },
                { label:'Domain',   value:domainLabel(project.domain) },
              ].map(fi => (
                <div key={fi.label} style={{ padding:'9px 11px',borderRadius:8,background:'var(--pios-surface2)' }}>
                  <div style={{ fontSize:9.5,color:'var(--pios-dim)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,marginBottom:3 }}>{fi.label}</div>
                  <div style={{ fontSize:12.5,fontWeight:600 }}>{fi.value}</div>
                </div>
              ))}
            </div>
            {projTasks.length > 0 && (
              <div>
                <div style={{ fontSize:10,fontWeight:700,color:'var(--pios-dim)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.07em' }}>Linked tasks ({projTasks.length})</div>
                <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                  {projTasks.slice(0,6).map((t:any) => (
                    <div key={t.id} style={{ display:'flex',gap:8,alignItems:'center',padding:'7px 10px',borderRadius:7,background:'var(--pios-surface2)' }}>
                      <span style={{ width:7,height:7,borderRadius:'50%',background:t.status==='done'?'var(--fm)':t.status==='in_progress'?'var(--academic)':'var(--pios-dim)',flexShrink:0,display:'inline-block' }} />
                      <span style={{ fontSize:12,flex:1,textDecoration:t.status==='done'?'line-through':'none',color:t.status==='done'?'var(--pios-dim)':'var(--pios-text)' }}>{t.title}</span>
                      {t.due_date&&<span style={{ fontSize:10,color:'var(--pios-dim)' }}>{formatRelative(t.due_date)}</span>}
                    </div>
                  ))}
                  {projTasks.length>6&&<div style={{ fontSize:11,color:'var(--pios-dim)',textAlign:'center' }}>+{projTasks.length-6} more</div>}
                </div>
              </div>
            )}
            <div style={{ display:'flex',gap:8,marginTop:'auto',paddingTop:8 }}>
              <button onClick={()=>setEditing(true)} style={{ flex:1,padding:'9px',borderRadius:9,border:'1px solid var(--pios-border2)',background:'transparent',color:'var(--pios-text)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-sans)' }}>✎ Edit</button>
              <button onClick={()=>{onDelete(project.id);onClose()}} style={{ padding:'9px 14px',borderRadius:9,border:'1px solid rgba(224,82,114,0.3)',background:'none',cursor:'pointer',color:'var(--dng)',fontSize:12,fontFamily:'var(--font-sans)' }}>Archive</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Project = { id:string; title?:string; status?:string; domain?:string; progress?:number; description?:string; colour?:string; start_date?:string; due_date?:string; priority?:string }
type PTask   = { id:string; title?:string; status?:string; priority?:string; domain?:string; project_id?:string; due_date?:string }

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [projects,     setProjects]     = useState<Project[]>([])
  const [tasks,        setTasks]        = useState<PTask[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<'active'|'all'|'completed'>('active')
  const [domainFilter, setDomainFilter] = useState('all')
  const [selected,     setSelected]     = useState<Project|null>(null)
  const [adding,       setAdding]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/projects?include=tasks')
    const d   = res.ok ? await res.json() : {}
    setProjects(d.projects ?? [])
    setTasks(d.tasks ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveProject(id:string, data:unknown) {
    if (id) {
      const res = await fetch('/api/projects',{ method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...(data as any)}) })
      if (res.ok) { const { project } = await res.json(); setProjects(p=>p.map(pr=>pr.id===id?project:pr)); if(selected?.id===id)setSelected(project) }
    } else { await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}) }
    load()
  }

  async function deleteProject(id:string) {
    await fetch(`/api/projects?id=${id}`,{method:'DELETE'})
    setProjects(p=>p.map(pr=>pr.id===id?{...pr,status:'cancelled'}:pr))
  }

  const visible = projects.filter(p => {
    if (filter==='active' && !['active','on_hold'].includes(String(p.status??''))) return false
    if (filter==='completed' && p.status!=='completed') return false
    if (domainFilter!=='all' && p.domain!==domainFilter) return false
    return true
  })

  const totalActive  = projects.filter(p=>p.status==='active').length
  const avgProgress  = projects.filter(p=>p.status==='active').reduce((s,p)=>s+(p.progress||0),0) / (totalActive||1)

  return (
    <div className="fade-up">

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)',fontSize:22,fontWeight:400,color:'var(--pios-text)',letterSpacing:'-0.03em',marginBottom:4 }}>Projects</h1>
          <p style={{ fontSize:12,color:'var(--pios-muted)' }}>{totalActive} active · avg {Math.round(avgProgress)}% complete</p>
        </div>
        <button onClick={()=>setAdding(true)} style={{ padding:'8px 16px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:400,cursor:'pointer' }}>+ New project</button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center' }}>
        <div style={{ display:'flex',gap:4,padding:3,borderRadius:9,background:'var(--pios-surface2)' }}>
          {([['active','Active'],['all','All'],['completed','Done']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:'5px 12px',borderRadius:7,fontSize:11.5,border:'none',background:filter===v?'var(--ai-subtle)':'transparent',color:filter===v?'var(--ai)':'var(--pios-muted)',fontWeight:filter===v?600:400,cursor:'pointer',fontFamily:'var(--font-sans)' }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
          {(['all',...DOMAINS] as const).map(d=>(
            <button key={d} onClick={()=>setDomainFilter(d)} style={{ padding:'4px 10px',borderRadius:20,fontSize:11,border:`1px solid ${domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-border)'}`,cursor:'pointer',background:domainFilter===d?`${domainColour(d==='all'?'personal':d)}12`:'transparent',color:domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-muted)',fontWeight:domainFilter===d?600:400,fontFamily:'var(--font-sans)',transition:'all 0.12s' }}>
              {d==='all'?'All domains':domainLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {[1,2,3,4,5,6].map(i=><div key={i} className="pios-skeleton" style={{ height:160,borderRadius:12 }} />)}
        </div>
      ) : visible.length===0 ? (
        <div style={{ background:'var(--pios-surface)',border:'1px solid var(--pios-border)',borderRadius:14,padding:'52px 24px',textAlign:'center' }}>
          <div style={{ fontSize:32,marginBottom:12,opacity:0.3 }}>◈</div>
          <div style={{ fontFamily:'var(--font-display)',fontSize:15,fontWeight:400,marginBottom:8 }}>No projects here</div>
          <p style={{ fontSize:13,color:'var(--pios-muted)',marginBottom:18 }}>{filter==='completed'?'No completed projects yet.':'Add your first project to start tracking progress.'}</p>
          <button onClick={()=>setAdding(true)} style={{ padding:'8px 18px',borderRadius:9,border:'none',background:'var(--ai)',color:'#fff',fontFamily:'var(--font-sans)',fontSize:13,fontWeight:400,cursor:'pointer' }}>+ New project</button>
        </div>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {visible.map(p => {
            const color  = p.colour || domainColour(String(p.domain??''))
            const pt     = tasks.filter(t=>t.project_id===p.id)
            const done   = pt.filter(t=>t.status==='done').length
            return (
              <div key={p.id} onClick={()=>setSelected(p)}
                style={{ background:'var(--pios-surface)',border:'1px solid var(--pios-border)',borderRadius:14,padding:'14px 16px',cursor:'pointer',borderTop:`2px solid ${color}`,transition:'border-color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=color}
                onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.borderColor='var(--pios-border)'; (e.currentTarget as HTMLDivElement).style.borderTopColor=color }}>
                <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontFamily:'var(--font-display)',fontSize:13.5,fontWeight:400,marginBottom:5,lineHeight:1.3,letterSpacing:'-0.01em' }}>{p.title}</div>
                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      <Tag color={domainColour(String(p.domain??''))}>{domainLabel(String(p.domain??''))}</Tag>
                      <Tag color={STATUS_COLOUR[String(p.status??'')]??'var(--pios-dim)'}>{String(p.status??'').replace('_',' ')}</Tag>
                    </div>
                  </div>
                </div>
                {p.description && <p style={{ fontSize:11,color:'var(--pios-muted)',lineHeight:1.55,marginBottom:10 }}>{p.description.slice(0,80)}{p.description.length>80?'…':''}</p>}
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:10.5,color:'var(--pios-dim)' }}>Progress</span>
                    <span style={{ fontFamily:'var(--font-display)',fontSize:11,fontWeight:400,color }}>{p.progress}%</span>
                  </div>
                  <Bar v={Number(p.progress??0)} c={color} />
                </div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:10.5,color:'var(--pios-dim)' }}>
                  {p.due_date?<span>Due {formatRelative(p.due_date)}</span>:<span/>}
                  {pt.length>0&&<span>{done}/{pt.length} tasks</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(selected||adding) && (
        <ProjectDrawer
          project={selected??{id:'',title:'',domain:'personal',status:'active',priority:'medium',progress:0}}
          tasks={tasks}
          onClose={()=>{setSelected(null);setAdding(false)}}
          onSave={saveProject}
          onDelete={deleteProject}
        />
      )}
    </div>
  )
}
