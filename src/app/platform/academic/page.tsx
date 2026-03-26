'use client'
import { useEffect, useState, useCallback } from 'react'
import { formatRelative, formatDate } from '@/lib/utils'

const ACCENT   = 'var(--academic)'
const ACCENT10 = 'rgba(108,142,255,0.08)'

const STATUS_COLOURS: Record<string, string> = {
  not_started:    'var(--pios-dim)',
  in_progress:    'var(--academic)',
  draft_complete: 'var(--saas)',
  under_review:   'var(--ai)',
  submitted:      'var(--fm)',
  passed:         'var(--fm)',
  failed:         'var(--dng)',
  enrolled:       'var(--academic)',
  complete:       'var(--fm)',
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

type AcademicModule = {
  id: string; title: string; status: string; deadline?: string
  module_type?: string; grade?: string; credits?: number
  start_date?: string; end_date?: string; notes?: string
}
type ThesisChapter = {
  id: string; chapter_num: number; title: string; status: string
  word_count?: number; target_words?: number; content?: string
  ai_feedback?: string; updated_at?: string
}

type SupervisorSession = {
  id: string; supervisor?: string; session_date?: string; format?: string
  duration_mins?: number; notes?: string; action_items?: string
}

type MilestoneRecord = {
  id: string; title?: string; status?: string; deadline?: string
  target_date?: string; days_until?: number | null; is_overdue?: boolean
  category?: string; notes?: string
}

type AiReview = {
  overall_assessment?: string; pace_detail?: string; pace_status?: string
  risk?: string; immediate_actions?: string[]
  [key: string]: unknown
}

type AcademicSummary = {
  total?: number; completed?: number; in_progress?: number; upcoming?: number
  overdue?: number; totalCredits?: number; completedCredits?: number
  title?: string; next?: {title?: string; deadline?: string}
}

export default function AcademicPage() {
  const [modules,  setModules]  = useState<AcademicModule[]>([])
  const [chapters, setChapters] = useState<ThesisChapter[]>([])
  const [sessions, setSessions] = useState<SupervisorSession[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editingId,  setEditingId]   = useState<string|null>(null)
  const [editWords,  setEditWords]   = useState<Record<string,number>>({})
  const [editStatus, setEditStatus]  = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [showAddCh,  setShowAddCh]  = useState(false)
  const [showAddMod, setShowAddMod] = useState(false)
  const [showAddSes, setShowAddSes] = useState(false)
  const [exportingThesis, setExportingThesis] = useState(false)
  const [chForm, setChForm] = useState({ chapter_num:'', title:'', status:'not_started', word_count:'0', target_words:'8000', notes:'' })
  const [modForm, setModForm] = useState({ title:'', module_type:'taught', status:'enrolled', deadline:'', credits:'' })
  const [sesForm, setSesForm] = useState({ supervisor:'Dr. Supervisor', session_date:new Date().toISOString().slice(0,10), format:'online', duration_mins:'60', notes:'', action_items:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/academic')
    const d   = res.ok ? await res.json() : {}
    const chapters     = d.chapters ?? []
    const weeklyDelta  = d.thesis_summary?.weekly_delta ?? null
    setModules(d.modules ?? [])
    setChapters(chapters)
    setSessions(d.sessions ?? [])
    setWeeklyDelta(weeklyDelta)
    const wc:Record<string,number>={}, st:Record<string,string>={}
    for (const c of chapters) { wc[c.id]=c.word_count??0; st[c.id]=c.status??'not_started' }
    setEditWords(wc); setEditStatus(st)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveChapter(id:string) {
    setSaving(true)
    await fetch('/api/academic', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ entity:'chapter', id, word_count: editWords[id]??0, status: editStatus[id] }) })
    setEditingId(null); setSaving(false); load()
  }

  async function addChapter() {
    if (!chForm.title.trim()||!chForm.chapter_num) return
    setSaving(true)
    await fetch('/api/academic', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'create_chapter', chapter_num:chForm.chapter_num, title:chForm.title, status:chForm.status, word_count:chForm.word_count||0, target_words:chForm.target_words||8000, notes:chForm.notes }) })
    setChForm({ chapter_num:'', title:'', status:'not_started', word_count:'0', target_words:'8000', notes:'' })
    setShowAddCh(false); setSaving(false); load()
  }

  async function addModule() {
    if (!modForm.title.trim()) return
    setSaving(true)
    await fetch('/api/academic', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'create_module', title:modForm.title, module_type:modForm.module_type, status:modForm.status, deadline:modForm.deadline||null, credits:modForm.credits||null }) })
    setModForm({ title:'', module_type:'taught', status:'enrolled', deadline:'', credits:'' })
    setShowAddMod(false); setSaving(false); load()
  }

  async function updateModuleStatus(id:string, status:string) {
    await fetch('/api/academic', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ entity:'module', id, status }) }); load()
  }

  async function addSession() {
    if (!sesForm.notes.trim()) return
    setSaving(true)
    await fetch('/api/academic', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'create_session', supervisor:sesForm.supervisor, session_date:sesForm.session_date, format:sesForm.format, duration_mins:sesForm.duration_mins||60, notes:sesForm.notes, action_items:sesForm.action_items||'' }) })
    setSesForm({ supervisor:'Dr. Supervisor', session_date:new Date().toISOString().slice(0,10), format:'online', duration_mins:'60', notes:'', action_items:'' })
    setShowAddSes(false); setSaving(false); load()
  }

  const totalWords  = chapters.reduce((s,c)=>s+(c.word_count||0),0)
  const targetWords = chapters.reduce((s,c)=>s+(c.target_words||8000),0)
  const thesisPct   = targetWords>0?Math.round((totalWords/targetWords)*100):0
  const [aiReview,      setAiReview]      = useState<AiReview|null>(null)
  const [weeklyDelta,   setWeeklyDelta]   = useState<number|null>(null)
  const [aiReviewLoading, setAiReviewLoading] = useState(false)

  async function exportThesis(chapterId?: string) {
    setExportingThesis(true)
    try {
      const r = await fetch('/api/academic/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: chapterId ?? null }),
      })
      if (r.ok) {
        const blob = await r.blob()
        const url  = URL.createObjectURL(blob)
        const disp = r.headers.get('Content-Disposition') ?? ''
        const name = disp.match(/filename="([^"]+)"/)?.[1] ?? 'thesis_export.md'
        const a    = Object.assign(document.createElement('a'), { href: url, download: name })
        a.click(); URL.revokeObjectURL(url)
      }
    } catch { /* non-fatal */ }
    finally { setExportingThesis(false) }
  }

  async function runAIThesisReview() {
    setAiReviewLoading(true); setAiReview(null)
    const res = await fetch('/api/academic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ai_thesis_review', chapters, modules }),
    })
    const d = res.ok ? await res.json() : {}
    if (d.review) setAiReview((d as Record<string,unknown>).review as AiReview)
    setAiReviewLoading(false)
  }
  const chapsDone   = chapters.filter(c=>['submitted','passed','draft_complete'].includes(c.status)).length
  // Velocity: words needed ÷ days to nearest module deadline
  const nearestDeadline = modules.map(m=>m.deadline).filter(Boolean).sort()[0]
  const daysToDeadline  = nearestDeadline
    ? Math.max(1, Math.round((new Date(nearestDeadline).getTime()-Date.now())/(86400000)))
    : null
  const wordsRemaining  = Math.max(0, targetWords - totalWords)
  const wordsPerDay     = daysToDeadline && daysToDeadline > 0
    ? Math.ceil(wordsRemaining / daysToDeadline)
    : null
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
          <button className="btn-v3-ghost" onClick={()=>setShowAddMod(!showAddMod)} style={{ fontSize:12 }}>+ Module</button>
          <button className="btn-v3-ghost" onClick={()=>setShowAddSes(!showAddSes)} style={{ fontSize:12 }}>+ Session</button>
          <button className="btn-v3-primary" onClick={()=>setShowAddCh(!showAddCh)} style={{ fontSize:12 }}>+ Chapter</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Thesis progress', value:`${thesisPct}%`, sub:`${totalWords.toLocaleString()} / ${targetWords.toLocaleString()} words`, colour:ACCENT },
          { label:'Chapters done', value:`${chapsDone}/${chapters.length}`, sub:'draft complete or submitted', colour:'var(--ai)' },
          { label:'Modules done', value:`${modsDone}/${modules.length}`, sub:'passed or complete', colour:'var(--fm)' },
          { label:'Supervision', value:sessions.length, sub:'sessions logged', colour:'var(--saas)' },
          { label:'Words/day needed', value: wordsPerDay ? wordsPerDay.toLocaleString() : '—', sub: daysToDeadline ? `${daysToDeadline} days to deadline` : 'no deadline set', colour: wordsPerDay && wordsPerDay > 500 ? 'var(--dng)' : wordsPerDay && wordsPerDay > 250 ? 'var(--saas)' : 'var(--fm)' },
          { label:'Written this week', value: weeklyDelta !== null ? weeklyDelta.toLocaleString() : '—', sub: weeklyDelta !== null ? (weeklyDelta >= (wordsPerDay??0)*7 ? 'On pace ✓' : 'Below pace') : 'No snapshot yet', colour: weeklyDelta === null ? '#64748b' : weeklyDelta >= (wordsPerDay??0)*7 ? 'var(--fm)' : 'var(--saas)' },
        ].map(s=>(
          <div key={(s as Record<string,unknown>).label as string} className="card-v3-sm" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.colour, marginBottom:2, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Add chapter form */}
      {showAddCh && (
        <div className="card-v3" style={{ marginBottom:16, borderColor:ACCENT+'40' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:ACCENT }}>Add Thesis Chapter</div>
          <div style={{ display:'grid', gridTemplateColumns:'60px 1fr auto auto', gap:8, marginBottom:8 }}>
            <input className="inp-v3" placeholder="Ch #" type="number" value={chForm.chapter_num} onChange={e=>setChForm(p=>({...p,chapter_num:e.target.value}))} />
            <input className="inp-v3" placeholder="Chapter title…" value={chForm.title} onChange={e=>setChForm(p=>({...p,title:e.target.value}))} />
            <input className="inp-v3" placeholder="Words" type="number" style={{ width:100 }} value={chForm.word_count} onChange={e=>setChForm(p=>({...p,word_count:e.target.value}))} />
            <input className="inp-v3" placeholder="Target" type="number" style={{ width:100 }} value={chForm.target_words} onChange={e=>setChForm(p=>({...p,target_words:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:8 }}>
            <input className="inp-v3" placeholder="Notes (optional)…" value={chForm.notes} onChange={e=>setChForm(p=>({...p,notes:e.target.value}))} />
            <select className="inp-v3" style={{ width:'auto' }} value={chForm.status} onChange={e=>setChForm(p=>({...p,status:e.target.value}))}>
              {['not_started','in_progress','draft_complete','under_review','submitted'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-v3-primary" onClick={addChapter} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Add Chapter'}</button>
            <button className="btn-v3-ghost" onClick={()=>setShowAddCh(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add module form */}
      {showAddMod && (
        <div className="card-v3" style={{ marginBottom:16, borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--ai)' }}>Add Programme Module</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, marginBottom:8 }}>
            <input className="inp-v3" placeholder="Module title…" value={modForm.title} onChange={e=>setModForm(p=>({...p,title:e.target.value}))} />
            <select className="inp-v3" style={{ width:'auto' }} value={modForm.module_type} onChange={e=>setModForm(p=>({...p,module_type:e.target.value}))}>
              {['taught','research','viva','conference','elective'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select className="inp-v3" style={{ width:'auto' }} value={modForm.status} onChange={e=>setModForm(p=>({...p,status:e.target.value}))}>
              {['enrolled','in_progress','submitted','passed','failed'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <input type="date" className="inp-v3" style={{ width:'auto' }} value={modForm.deadline} onChange={e=>setModForm(p=>({...p,deadline:e.target.value}))} />
            <input className="inp-v3" placeholder="Credits" type="number" style={{ width:80 }} value={modForm.credits} onChange={e=>setModForm(p=>({...p,credits:e.target.value}))} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-v3-primary" onClick={addModule} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Add Module'}</button>
            <button className="btn-v3-ghost" onClick={()=>setShowAddMod(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add session form */}
      {showAddSes && (
        <div className="card-v3" style={{ marginBottom:16, borderColor:'rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--saas)' }}>Log Supervision Session</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, marginBottom:8 }}>
            <input className="inp-v3" placeholder="Supervisor name…" value={sesForm.supervisor} onChange={e=>setSesForm(p=>({...p,supervisor:e.target.value}))} />
            <input type="date" className="inp-v3" style={{ width:'auto' }} value={sesForm.session_date} onChange={e=>setSesForm(p=>({...p,session_date:e.target.value}))} />
            <select className="inp-v3" style={{ width:'auto' }} value={sesForm.format} onChange={e=>setSesForm(p=>({...p,format:e.target.value}))}>
              {['online','in_person','phone','email'].map(f=><option key={f} value={f}>{f.replace('_',' ')}</option>)}
            </select>
            <input className="inp-v3" placeholder="Mins" type="number" style={{ width:70 }} value={sesForm.duration_mins} onChange={e=>setSesForm(p=>({...p,duration_mins:e.target.value}))} />
          </div>
          <textarea className="inp-v3" placeholder="Session notes — what was discussed, feedback received…" rows={3} style={{ width:'100%', resize:'vertical', marginBottom:8, fontFamily:'inherit' }} value={sesForm.notes} onChange={e=>setSesForm(p=>({...p,notes:e.target.value}))} />
          <textarea className="inp-v3" placeholder="Action items (one per line)…" rows={2} style={{ width:'100%', resize:'vertical', marginBottom:8, fontFamily:'inherit' }} value={sesForm.action_items} onChange={e=>setSesForm(p=>({...p,action_items:e.target.value}))} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-v3-primary" onClick={addSession} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Log Session'}</button>
            <button className="btn-v3-ghost" onClick={()=>setShowAddSes(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Thesis chapters */}
      <div className="card-v3" style={{ marginBottom:16, borderLeft:`3px solid ${ACCENT}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Thesis Chapters</div>
            <div style={{ fontSize:12, color:'var(--pios-muted)' }}>{totalWords.toLocaleString()} / {targetWords.toLocaleString()} words · {thesisPct}% complete</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:ACCENT, fontWeight:600 }}>{chapsDone}/{chapters.length} complete</span>
            <button onClick={() => exportThesis()} disabled={exportingThesis || chapters.length===0}
              style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:'1px solid rgba(99,179,237,0.4)',
                background:'rgba(99,179,237,0.06)', color:'#63b3ed', cursor:'pointer', whiteSpace:'nowrap' as const }}>
              {exportingThesis ? '⟳ Exporting…' : '↓ Export MD'}
            </button>
            <button onClick={runAIThesisReview} disabled={aiReviewLoading || chapters.length===0}
              style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:'1px dashed rgba(167,139,250,0.4)',
                background:'rgba(167,139,250,0.06)', color:'var(--ai)', cursor:'pointer', whiteSpace:'nowrap' as const }}>
              {aiReviewLoading ? '⟳ Reviewing…' : '✦ AI Review'}
            </button>
          </div>
        </div>
        <Bar value={totalWords} max={targetWords} />
        {aiReview && (
          <div style={{ margin:'12px 0 0', padding:'12px 14px', borderRadius:8,
            background:'rgba(167,139,250,0.06)', borderLeft:'3px solid var(--ai)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--ai)', marginBottom:6 }}>
              ✦ AI Thesis Review
              <span style={{ marginLeft:8, padding:'2px 8px', borderRadius:10, fontSize:10,
                background: aiReview.pace_status==='on_track'?'rgba(34,197,94,0.15)':aiReview.pace_status==='behind'||aiReview.pace_status==='at_risk'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)',
                color: aiReview.pace_status==='on_track'?'var(--fm)':aiReview.pace_status==='behind'||aiReview.pace_status==='at_risk'?'var(--dng)':'var(--saas)',
              }}>{String(aiReview.pace_status ?? "").replace('_',' ').toUpperCase()}</span>
            </div>
            <p style={{ fontSize:12, color:'var(--pios-text)', lineHeight:1.6, margin:'0 0 8px' }}>{String(aiReview.overall_assessment ?? "")}</p>
            <p style={{ fontSize:11, color:'var(--pios-muted)', margin:'0 0 6px' }}>{String(aiReview.pace_detail ?? "")}</p>
            {Boolean(aiReview.risk) && (
              <p style={{ fontSize:11, color:'var(--saas)', margin:'0 0 6px' }}>⚠ {String(aiReview.risk ?? "")}</p>
            )}
            {Array.isArray(aiReview.immediate_actions) && ((aiReview.immediate_actions as string[]) ?? []).length > 0 && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--pios-muted)', marginBottom:4 }}>IMMEDIATE ACTIONS</div>
                {(aiReview.immediate_actions as string[]).map((a:string, i:number) => (
                  <div key={i} style={{ fontSize:11, color:'var(--pios-text)', padding:'3px 0',
                    borderTop:'1px solid var(--ai-subtle)', display:'flex', gap:8 }}>
                    <span style={{ color:'var(--ai)', minWidth:14 }}>{i+1}.</span>{a}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setAiReview(null)}
              style={{ marginTop:8, fontSize:10, color:'var(--pios-dim)', background:'none', border:'none', cursor:'pointer' }}>
              Dismiss
            </button>
          </div>
        )}
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
          {chapters.length===0 ? (
            <p style={{ textAlign:'center', color:'var(--pios-dim)', fontSize:13, padding:'24px 0' }}>No chapters yet. Click <strong>+ Chapter</strong> to start tracking.</p>
          ) : chapters.map(ch => {
            const editing = editingId===ch.id
            return (
              <div key={(ch as Record<string,unknown>).id as string} style={{ padding:'12px 14px', borderRadius:8, background:editing?ACCENT10:'var(--pios-surface2)', border:`1px solid ${editing?ACCENT+'40':'transparent'}`, transition:'all 0.15s' }}>
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
                        <input className="inp-v3" type="number" placeholder="Word count" value={editWords[ch.id]??0} onChange={e=>setEditWords(p=>({...p,[ch.id]:parseInt(e.target.value)||0}))} autoFocus style={{ fontSize:13 }} />
                        <select className="inp-v3" style={{ width:'auto', fontSize:12 }} value={editStatus[ch.id]??ch.status} onChange={e=>setEditStatus(p=>({...p,[ch.id]:e.target.value}))}>
                          {['not_started','in_progress','draft_complete','under_review','submitted','passed'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                        </select>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn-v3-primary" onClick={()=>saveChapter(ch.id)} disabled={saving} style={{ fontSize:11, padding:'6px 12px' }}>{saving?'…':'Save'}</button>
                          <button className="btn-v3-ghost" onClick={()=>setEditingId(null)} style={{ fontSize:11, padding:'6px 10px' }}>✕</button>
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


      {/* DBA Programme Milestones */}
      <MilestonesSection />

      {/* Modules + Sessions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card-v3">
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Programme Modules</div>
          {modules.length===0 ? <p style={{ color:'var(--pios-dim)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No modules yet</p> : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {modules.map(m=>(
                <div key={m.id as string} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:8, background:'var(--pios-surface2)', gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(m.title ?? "")}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{String(m.module_type ?? "")}</span>
                      {m.credits&&<span style={{ fontSize:10, color:'var(--pios-dim)' }}>· {String(m.credits ?? "")} cr</span>}
                      {m.deadline&&<span style={{ fontSize:10, color:'var(--pios-dim)' }}>· {formatRelative(String(m.deadline ?? ""))}</span>}
                    </div>
                  </div>
                  <select value={String(m.status ?? "")} onChange={e=>updateModuleStatus(m.id,e.target.value)} style={{ fontSize:10, padding:'2px 6px', borderRadius:12, border:'none', cursor:'pointer', background:(STATUS_COLOURS[String(m.status ?? '')]??'var(--pios-dim)')+'20', color:STATUS_COLOURS[String(m.status ?? '')]??'var(--pios-dim)', fontWeight:600, outline:'none', flexShrink:0 }}>
                    {['enrolled','in_progress','submitted','passed','failed','complete'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-v3">
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Supervision Log</div>
          {sessions.length===0 ? <p style={{ color:'var(--pios-dim)', fontSize:12, textAlign:'center', padding:'20px 0' }}>No sessions logged yet</p> : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sessions.map(s=>(
                <div key={(s as Record<string,unknown>).id as string} style={{ padding:'12px', borderRadius:8, background:'var(--pios-surface2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>{s.supervisor||'Supervisor'}</span>
                    <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{formatDate(s.session_date ?? "")}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--pios-dim)', marginBottom:s.notes?4:0 }}>{s.format?.replace('_',' ')} · {s.duration_mins}m</div>
                  {s.notes&&<p style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5, marginBottom:s.action_items?.length?4:0 }}>{s.notes.slice(0,130)}{s.notes.length>130?'…':''}</p>}
                  {(Number(s.action_items?.length ?? 0) > 0)&&(
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {String(s.action_items ?? '').split('\n').filter(Boolean).slice(0,3).map((item:string,i:number)=>(
                        <div key={i} style={{ fontSize:10, color:'var(--saas)', display:'flex', gap:4 }}>
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

// ─── DBA Milestones Section ───────────────────────────────────────────────────
const MILESTONE_STATUS_COLOURS: Record<string, string> = {
  upcoming:    '#60a5fa',
  in_progress: 'var(--saas)',
  submitted:   'var(--ai)',
  passed:      '#34d399',
  failed:      '#f87171',
  deferred:    '#94a3b8',
  waived:      '#94a3b8',
  skipped:     '#64748b',
}

const DBA_MILESTONES_TEMPLATE = [
  { title: 'Programme Registration', milestone_type: 'registration',     category: 'administrative' },
  { title: 'Ethics Approval',         milestone_type: 'ethics_approval',  category: 'academic'       },
  { title: 'Literature Review',       milestone_type: 'literature_review',category: 'research'       },
  { title: 'Research Proposal',       milestone_type: 'research_proposal',category: 'academic'       },
  { title: 'Upgrade Review',          milestone_type: 'upgrade',          category: 'academic'       },
  { title: 'Data Collection',         milestone_type: 'data_collection',  category: 'research'       },
  { title: 'Analysis Complete',       milestone_type: 'analysis',         category: 'research'       },
  { title: 'Thesis Submission',       milestone_type: 'thesis_submission',category: 'academic'       },
  { title: 'Viva Voce',               milestone_type: 'viva',             category: 'academic'       },
  { title: 'Award Conferred',         milestone_type: 'award',            category: 'academic'       },
]

function MilestonesSection() {
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([])
  const [summary,    setSummary]    = useState<Record<string,unknown>|null>(null)
  const [loading,    setLoading]    = useState(true)
  const [seeding,    setSeeding]    = useState(false)
  const [saving,     setSaving]     = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/milestones', { credentials: 'include' })
      const d = await r.json()
      if (d.ok) { setMilestones(((d as any).milestones ?? []) as MilestoneRecord[]) }
    } catch { /* silent — table may not exist until M011 runs */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const seedMilestones = async () => {
    setSeeding(true)
    try {
      await Promise.all(DBA_MILESTONES_TEMPLATE.map(m =>
        fetch('/api/milestones', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(m),
        })
      ))
      await load()
    } catch { /* silent */ }
    setSeeding(false)
  }

  const updateStatus = async (id: string, status: string) => {
    setSaving(id)
    try {
      await fetch('/api/milestones', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      })
      setMilestones(prev => prev.map((m: MilestoneRecord) => m.id === id ? { ...m, status } : m) as MilestoneRecord[])
    } catch { /* silent */ }
    setSaving(null)
  }

  if (loading) return null

  return (
    <div className="card-v3">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>DBA Programme Milestones</div>
          {summary && (
            <div style={{ fontSize:11, color:'var(--pios-dim)', marginTop:2 }}>
              {Number(summary?.completed ?? 0)}/{Number(summary?.total ?? 0)} complete
              {Boolean(Number(summary?.overdue ?? 0) > 0) && <span style={{ color:'#f87171', marginLeft:6 }}>· {Number(summary?.overdue ?? 0)} overdue</span>}
              {Boolean(summary?.next) && <span style={{ color:'var(--pios-muted)', marginLeft:6 }}>· next: {String((summary?.next as any)?.title ?? "")}</span>}
            </div>
          )}
        </div>
        {milestones.length === 0 && (
          <button onClick={seedMilestones} disabled={seeding}
            style={{ fontSize:11, padding:'5px 12px', borderRadius:8, border:'1px solid var(--pios-border)', background:'var(--pios-surface2)', color:'var(--pios-muted)', cursor:'pointer' }}>
            {seeding ? 'Seeding…' : 'Seed DBA milestones'}
          </button>
        )}
      </div>

      {milestones.length === 0 ? (
        <p style={{ color:'var(--pios-dim)', fontSize:12, textAlign:'center', padding:'16px 0' }}>
          No milestones yet. Run migration 011, then click "Seed DBA milestones".
        </p>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
          {milestones.map(m => (
            <div key={m.id as string} style={{
              padding:'10px 12px', borderRadius:8, background:'var(--pios-surface2)',
              borderLeft:`3px solid ${MILESTONE_STATUS_COLOURS[String(m.status ?? '')]??'var(--pios-border)'}`,
              opacity: ['waived','skipped'].includes(String(m.status ?? '')) ? 0.5 : 1,
            }}>
              <div style={{ fontSize:11, fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{String(m.title ?? "")}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <select
                  value={String(m.status ?? "")}
                  disabled={saving === m.id}
                  onChange={e => updateStatus(m.id, e.target.value)}
                  style={{ fontSize:9, padding:'2px 5px', borderRadius:8, border:'none',
                    background:(MILESTONE_STATUS_COLOURS[String(m.status ?? '')]??'#64748b')+'22',
                    color:MILESTONE_STATUS_COLOURS[String(m.status ?? '')]??'var(--pios-dim)',
                    fontWeight:700, cursor:'pointer', outline:'none', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {['upcoming','in_progress','submitted','passed','failed','deferred','waived'].map(s =>
                    <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                  )}
                </select>
                {Boolean(m.target_date) && (
                  <span style={{ fontSize:9, color: m.is_overdue ? '#f87171' : 'var(--pios-dim)' }}>
                    {m.is_overdue ? '⚠ ' : ''}{(m.days_until ?? null) !== null ? (Number(m.days_until) < 0 ? `${Math.abs(Number(m.days_until))}d overdue` : `${Number(m.days_until)}d`) : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
