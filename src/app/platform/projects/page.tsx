'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { domainColour, domainLabel, formatRelative } from '@/lib/utils'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title:'', domain:'personal', description:'', due_date:'' })
  const supabase = createClient()

  useEffect(() => { load() }, [])
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('projects').select('*').eq('user_id',user.id).order('created_at',{ascending:false})
    setProjects(data ?? [])
    setLoading(false)
  }
  async function add() {
    if (!form.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('projects').insert({ ...form, user_id:user.id, status:'active', progress:0, colour:domainColour(form.domain) })
    setForm({ title:'', domain:'personal', description:'', due_date:'' })
    setShowAdd(false); load()
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontSize:'22px', fontWeight:700 }}>Projects</h1>
        <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:'12px' }}>+ New Project</button>
      </div>
      {showAdd && (
        <div className="pios-card" style={{ marginBottom:'16px', borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'10px', marginBottom:'10px' }}>
            <input className="pios-input" placeholder="Project name…" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))}>
              {['academic','fm_consulting','saas','business','personal'].map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} />
          </div>
          <input className="pios-input" placeholder="Description (optional)…" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{ marginBottom:'10px' }} />
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="pios-btn pios-btn-primary" onClick={add} style={{ fontSize:'12px' }}>Create Project</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:'12px' }}>Cancel</button>
          </div>
        </div>
      )}
      {loading ? <p style={{ color:'var(--pios-muted)', textAlign:'center', padding:'40px' }}>Loading…</p> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
          {projects.map(p => (
            <div key={p.id} className="pios-card" style={{ borderTop:`3px solid ${p.colour||domainColour(p.domain)}` }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:600 }}>{p.title}</div>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'20px', background:`${domainColour(p.domain)}20`, color:domainColour(p.domain) }}>{domainLabel(p.domain)}</span>
                </div>
                <span style={{ fontSize:'10px', color:'var(--pios-dim)' }}>{p.status}</span>
              </div>
              {p.description && <p style={{ fontSize:'12px', color:'var(--pios-muted)', marginBottom:'12px', lineHeight:1.5 }}>{p.description}</p>}
              <div style={{ marginBottom:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', color:'var(--pios-dim)' }}>Progress</span>
                  <span style={{ fontSize:'11px', color:'var(--pios-muted)' }}>{p.progress}%</span>
                </div>
                <div style={{ height:'6px', background:'var(--pios-surface2)', borderRadius:'3px' }}>
                  <div style={{ height:'100%', width:`${p.progress}%`, background:p.colour||domainColour(p.domain), borderRadius:'3px', transition:'width 0.3s' }} />
                </div>
              </div>
              {p.due_date && <div style={{ fontSize:'11px', color:'var(--pios-dim)' }}>Due {formatRelative(p.due_date)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
