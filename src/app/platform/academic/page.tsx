'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, formatDate } from '@/lib/utils'

const ACCENT   = '#6c8eff'
const ACCENT10 = 'rgba(108,142,255,0.08)'

const STATUS_COLOURS: Record<string, string> = {
  not_started:    'var(--pios-dim)',
  in_progress:    '#6c8eff',
  draft_complete: '#f59e0b',
  under_review:   '#a78bfa',
  submitted:      '#2dd4a0',
  passed:         '#22c55e',
  failed:         '#ef4444',
  enrolled:       '#6c8eff',
  complete:       '#22c55e',
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOURS[status] ?? 'var(--pios-dim)'
  return <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:c+'20', color:c, whiteSpace:'nowrap' }}>{status.replace(/_/g,' ')}</span>
}

function Bar({ value, max, colour = ACCENT }: { value:number; max:number; colour?:string }) {
  const pct = Math.min(100, max > 0 ? (value/max)*100 : 0)
  return (
    <div style={{ height:6, background:'var(--pios-surface2)', borderRadius:3 }}>
      <div style={{ height:'100%', width:`${pct}%`, background:colour, borderRadius:3, transition:'width 0.4s' }} />
    </div>
  )
}

export default function AcademicPage() {
  const [modules,  setModules]  = useState<any[]>([])
  const [chapters, setChapters] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editingId,  setEditingId]   = useState<string|null>(null)
  const [editWords,  setEditWords]   = useState<Record<string,number>>({})
  const [editStatus, setEditStatus]  = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [showAddCh,  setShowAddCh]  = useState(false)
  const [showAddMod, setShowAddMod] = useState(false)
  const [showAddSes, setShowAddSes] = useState(false)
  const [chForm, setChForm] = useState({ chapter_num:'', title:'', status:'not_started', word_count:'0', target_words:'8000', notes:'' })
  const [modForm, setModForm] = useState({ title:'', module_type:'taught', status:'enrolled', deadline:'', credits:'' })
  const [sesForm, setSesForm] = useState({ supervisor:'Dr. Supervisor', session_date:new Date().toISOString().slice(0,10), format:'online', duration_mins:'60', notes:'', action_items:'' })
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [mR,cR,sR] = await Promise.all([
      supabase.from('academic_modules').select('*').eq('user_id',user.id).order('sort_order'),
      supabase.from('thesis_chapters').select('*').eq('user_id',user.id).order('chapter_num'),
      supabase.from('supervision_sessions').select('*').eq('user_id',user.id).order('session_date',{ascending:false}).limit(10),
    ])
    setModules(mR.data??[])
    setChapters(cR.data??[])
    setSessions(sR.data??[])
    const wc:Record<string,number>={}, st:Record<string,string>={}
    for (const c of (cR.data??[])) { wc[c.id]=c.word_count??0; st[c.id]=c.status??'not_started' }
    setEditWords(wc); setEditStatus(st)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveChapter(id:string) {
    setSaving(true)
    await supabase.from('thesis_chapters').update({ word_count:editWords[id]??0, status:editStatus[id], updated_at:new Date().toISOString() }).eq('id',id)
    setEditingId(null); setSaving(false); load()
  }

  async function addChapter() {
    if (!chForm.title.trim()||!chForm.chapter_num) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('thesis_chapters').insert({ user_id:user.id, chapter_num:parseInt(chForm.chapter_num), title:chForm.title, status:chForm.status, word_count:parseInt(chForm.word_count)||0, target_words:parseInt(chForm.target_words)||8000, notes:chForm.notes })
    setChForm({ chapter_num:'', title:'', status:'not_started', word_count:'0', target_words:'8000', notes:'' })
    setShowAddCh(false); setSaving(false); load()
  }

  async function addModule() {
    if (!modForm.title.trim()) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('academic_modules').insert({ user_id:user.id, title:modForm.title, module_type:modForm.module_type, status:modForm.status, deadline:modForm.deadline||null, credits:parseInt(modForm.credits)||null, sort_order:modules.length })
    setModForm({ title:'', module_type:'taught', status:'enrolled', deadline:'', credits:'' })
    setShowAddMod(false); setSaving(false); load()
  }

  async function updateModuleStatus(id:string, status:string) {
    await supabase.from('academic_modules').update({ status, updated_at:new Date().toISOString() }).eq('id',id); load()
  }

  async function addSession() {
    if (!sesForm.notes.trim()) return
    setSaving(true)
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('supervision_sessions').insert({ user_id:user.id, supervisor:sesForm.supervisor, session_date:sesForm.session_date, format:sesForm.format, duration_mins:parseInt(sesForm.duration_mins)||60, notes:sesForm.notes, action_items:sesForm.action_items?sesForm.action_items.split('\n').filter(Boolean):[] })
    setSesForm({ supervisor:'Dr. Supervisor', session_date:new Date().toISOString().slice(0,10), format:'online', duration_mins:'60', notes:'', action_items:'' })
    setShowAddSes(false); setSaving(false); load()
  }

  const totalWords  = chapters.reduce((s,c)=>s+(c.word_count||0),0)
  const targetWords = chapters.reduce((s,c)=>s+(c.target_words||8000),0)
  const thesisPct   = targetWords>0?Math.round((totalWords/targetWords)*100):0
  const chapsDone   = chapters.filter(c=>['submitted','passed','draft_complete'].includes(c.status)).length
  const modsDone    = modules.filter(m=>['passed','complete'].includes(m.status)).length

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><div style={{ width:20, height:20, border:'2px solid rgba(108,142,255,0.2)', borderTopColor:ACCENT, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /></div>

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:24, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Academic Lifecycle</h1>
          <p style={{ color:'var(--pios-muted)', fontSize:13 }}>DBA · University of Portsmouth · AI-enabled forecasting in GCC FM contexts</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddMod(!showAddMod)} style={{ fontSize:12 }}>+ Module</button>
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddSes(!showAddSes)} style={{ fontSize:12 }}>+ Session</button>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAddCh(!showAddCh)} style={{ fontSize:12 }}>+ Chapter</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Thesis progress', value:`${thesisPct}%`, sub:`${totalWords.toLocaleString()} / ${targetWords.toLocaleString()} words`, colour:ACCENT },
          { label:'Chapters done', value:`${chapsDone}/${chapters.length}`, sub:'draft complete or submitted', colour:'#a78bfa' },
          { label:'Modules done', value:`${modsDone}/${modules.length}`, sub:'passed or complete', colour:'#2dd4a0' },
          { label:'Supervision', value:sessions.length, sub:'sessions logged', colour:'#f59e0b' },
        ].map(s=>(
          <div key={s.label} className="pios-card-sm" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.colour, marginBottom:2, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Add chapter form */}
      {showAddCh && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:ACCENT+'40' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:ACCENT }}>Add Thesis Chapter</div>
          <div style={{ display:'grid', gridTemplateColumns:'60px 1fr auto auto', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Ch #" type="number" value={chForm.chapter_num} onChange={e=>setChForm(p=>({...p,chapter_num:e.target.value}))} />
            <input className="pios-input" placeholder="Chapter title…" value={chForm.title} onChange={e=>setChForm(p=>({...p,title:e.target.value}))} />
            <input className="pios-input" placeholder="Words" type="number" style={{ width:100 }} value={chForm.word_count} onChange={e=>setChForm(p=>({...p,word_count:e.target.value}))} />
            <input className="pios-input" placeholder="Target" type="number" style={{ width:100 }} value={chForm.target_words} onChange={e=>setChForm(p=>({...p,target_words:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Notes (optional)…" value={chForm.notes} onChange={e=>setChForm(p=>({...p,notes:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={chForm.status} onChange={e=>setChForm(p=>({...p,status:e.target.value}))}>
              {['not_started','in_progress','draft_complete','under_review','submitted'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={addChapter} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Add Chapter'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddCh(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add module form */}
      {showAddMod && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#a78bfa' }}>Add Programme Module</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Module title…" value={modForm.title} onChange={e=>setModForm(p=>({...p,title:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={modForm.module_type} onChange={e=>setModForm(p=>({...p,module_type:e.target.value}))}>
              {['taught','research','viva','conference','elective'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select className="pios-input" style={{ width:'auto' }} value={modForm.status} onChange={e=>setModForm(p=>({...p,status:e.target.value}))}>
              {['enrolled','in_progress','submitted','passed','failed'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={modForm.deadline} onChange={e=>setModForm(p=>({...p,deadline:e.target.value}))} />
            <input className="pios-input" placeholder="Credits" type="number" style={{ width:80 }} value={modForm.credits} onChange={e=>setModForm(p=>({...p,credits:e.target.value}))} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={addModule} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Add Module'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddMod(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add session form */}
      {showAddSes && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#f59e0b' }}>Log Supervision Session</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Supervisor name…" value={sesForm.supervisor} onChange={e=>setSesForm(p=>({...p,supervisor:e.target.value}))} />
            <input type="date" className="pios-input" style={{ width:'auto' }} value={sesForm.session_date} onChange={e=>setSesForm(p=>({...p,session_date:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={sesForm.format} onChange={e=>setSesForm(p=>({...p,format:e.target.value}))}>
              {['online','in_person','phone','email'].map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
            <input className="pios-input" placeholder="Mins" type="number" style={{ width:70 }} value={sesForm.duration_mins} onChange={e=>setSesForm(p=>({...p,duration_mins:e.target.value}))} />
          </div>
          <textarea className="pios-input" placeholder="Session notes — what was discussed, feedback received…" rows={3} style={{ width:'100%', resize:'vertical', marginBottom:8, fontFamily:'inherit' }} value={sesForm.notes} onChange={e=>setSesForm(p=>({...p,notes:e.target.value}))} />
          <textarea className="pios-input" placeholder="Action items (one per line)…" rows={2} style={{ width:'100%', resize:'vertical', marginBottom:8, fontFamily:'inherit' }} value={sesForm.action_items} onChange={e=>setSesForm(p=>({...p,action_items:e.target.value}))} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={addSession} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Log Session'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddSes(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Thesis chapters */}
      <div className="pios-card" style={{ marginBottom:16, borderLeft:`3px solid ${ACCENT}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Thesis Chapters</div>
            <div style={{ fontSize:12, color:'var(--pios-muted)' }}>{totalWords.toLocaleString()} / {targetWords.toLocaleString()} words · {thesisPct}% complete</div>
          </div>
          <span style={{ fontSize:11, color:ACCENT, fontWeight:600 }}>{chapsDone}/{chapters.length} complete</span>
        </div>
        <Bar value={totalWords} max={targetWords} />
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
          {chapters.length===0 ? (
            <p style={{ textAlign:'center', color:'var(--pios-dim)', fontSize:13, padding:'24px 0' }}>No chapters yet. Click <strong>+ Chapter</strong> to start tracking.</p>
          ) : chapters.map(ch => {
            const editing = editingId===ch.id
            return (
              <div key={ch.id} style={{ padding:'12px 14px', borderRadius:8, background:editing?ACCENT10:'var(--pios-surface2)', border:`1px solid ${editing?ACCENT+'40':'transparent'}`, transition:'all 0.15s' }}>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ fontSize:11, color:'var(--pios-dim)', fontWeight:700, minWidth:28, paddingTop:2 }}>Ch.{ch.chapter_num}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{ch.title}</span>
                      {!editing && <Badge status={editStatus[ch.id]??ch.status} />}
                    </div>
                    <Bar value={editWords[ch.id]??ch.word_count??0} max={ch.target_words??8000} />
                    {editing ? (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginTop:10 }}>
                        <input className="pios-input" type="number" placeholder="Word count" value={editWords[ch.id]??0} onChange={e=>setEditWords(p=>({...p,[ch.id]:parseInt(e.target.value)||0}))} autoFocus style={{ fontSize:13 }} />
                        <select className="pios-input" style={{ width:'auto', fontSize:12 }} value={editStatus[ch.id]??ch.status} onChange={e=>setEditStatus(p=>({...p,[ch.id]:e.target.value}))}>
                          {['not_started','in_progress','draft_complete','under_review','submitted','passed'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                        </select>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="pios-btn pios-btn-primary" onClick={()=>saveChapter(ch.id)} disabled={saving} style={{ fontSize:11, padding:'6px 12px' }}>{saving?'…':'Save'}</button>
                          <button className="pios-btn pios-btn-ghost" onClick={()=>setEditingId(null)} style={{ fontSize:11, padding:'6px 10px' }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:5 }}>
                        <span style={{ fontSize:11, color:'var(--pios-muted)' }}>{(editWords[ch.id]??ch.word_count??0).toLocaleString()} / {(ch.target_words??8000).toLocaleString()} words</span>
                        <button onClick={()=>setEditingId(ch.id)} style={{ fontSize:11, color:ACCENT, background:'none', border:'none', cursor:'pointer', padding:'2px 8px', borderRadius:4 }}>Update ✎</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modules + Sessions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="pios-card">
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Programme Modules</div>
          {modules.length===0 ? <p style={{ color:'var(--pios-dim)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No modules yet</p> : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {modules.map(m=>(
                <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:8, background:'var(--pios-surface2)', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{m.module_type}</span>
                      {m.credits&&<span style={{ fontSize:10, color:'var(--pios-dim)' }}>· {m.credits} cr</span>}
                      {m.deadline&&<span style={{ fontSize:10, color:'var(--pios-dim)' }}>· {formatRelative(m.deadline)}</span>}
                    </div>
                  </div>
                  <select value={m.status} onChange={e=>updateModuleStatus(m.id,e.target.value)} style={{ fontSize:10, padding:'2px 6px', borderRadius:12, border:'none', cursor:'pointer', background:(STATUS_COLOURS[m.status]??'var(--pios-dim)')+'20', color:STATUS_COLOURS[m.status]??'var(--pios-dim)', fontWeight:600, outline:'none', flexShrink:0 }}>
                    {['enrolled','in_progress','submitted','passed','failed','complete'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pios-card">
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Supervision Log</div>
          {sessions.length===0 ? <p style={{ color:'var(--pios-dim)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No sessions logged yet</p> : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sessions.map(s=>(
                <div key={s.id} style={{ padding:'12px', borderRadius:8, background:'var(--pios-surface2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{s.supervisor||'Supervisor'}</span>
                    <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{formatDate(s.session_date)}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--pios-dim)', marginBottom:s.notes?4:0 }}>{s.format?.replace('_',' ')} · {s.duration_mins}m</div>
                  {s.notes&&<p style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5, marginBottom:s.action_items?.length?4:0 }}>{s.notes.slice(0,130)}{s.notes.length>130?'…':''}</p>}
                  {s.action_items?.length>0&&(
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {(Array.isArray(s.action_items)?s.action_items:[]).slice(0,3).map((item:string,i:number)=>(
                        <div key={i} style={{ fontSize:10, color:'#f59e0b', display:'flex', gap:4 }}>
                          <span>▶</span><span style={{ lineHeight:1.4 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
