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
    } catch (err) { console.error('[PIOS]', err) }
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
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddMod(!showAddMod)} style={{ fontSize:12 }}>+ Module</button>
          <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAddSes(!showAddSes)} style={{ fontSize:12 }}>+ Session</button>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAddCh(!showAddCh)} style={{ fontSize:12 }}>+ Chapter</button>
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
          <div key={(s as Record<string,unknown>).label as string} className="pios-card-sm" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.colour, marginBottom:2, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Research Context (M058 Starter) */}
      <ResearchContextCard />

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
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--ai)' }}>Add Programme Module</div>
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
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--saas)' }}>Log Supervision Session</div>
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


      {/* DBA Programme Milestones */}
      <MilestonesSection />

      {/* Literature Discovery & Paper Analysis */}
      <LiteratureSection />

      {/* Modules + Sessions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="pios-card">
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

        <div className="pios-card">
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

// ─── Research Context Card (M058 Starter Module) ──────────────────────────────
type ResearchContextData = {
  programme?: string; institution?: string; supervisor?: string
  research_title?: string; research_topic?: string; research_question?: string
  keywords?: string[]; thesis_synopsis?: string; research_philosophy?: string
  methodology_approach?: string; geographic_focus?: string; industry_focus?: string
  theoretical_lens?: string; preferred_citation_style?: string
  setup_complete?: boolean
}

function ResearchContextCard() {
  const [ctx,     setCtx]     = useState<ResearchContextData | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState<ResearchContextData>({})
  const ACC = 'var(--academic)'

  useEffect(() => {
    fetch('/api/academic/research-context')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.context) { setCtx(d.context as ResearchContextData); setForm(d.context as ResearchContextData) } })
      .catch(() => null)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/academic/research-context', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, keywords: typeof form.keywords === 'string' ? (form.keywords as unknown as string).split(',').map((k: string) => k.trim()).filter(Boolean) : form.keywords }),
      })
      const d = r.ok ? await r.json() : null
      if (d?.ok) { setCtx(d.context as ResearchContextData); setForm(d.context as ResearchContextData); setEditing(false) }
    } catch { /* silent */ }
    setSaving(false)
  }

  if (!ctx && !editing) return null

  const inp: React.CSSProperties = { display:'block', width:'100%', padding:'7px 11px', background:'var(--pios-surface2)', border:'1px solid var(--pios-border2)', borderRadius:7, color:'var(--pios-text)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const label: React.CSSProperties = { fontSize:10, fontWeight:600, color:'var(--pios-muted)', letterSpacing:'0.04em', display:'block', marginBottom:3 }

  return (
    <div className="pios-card" style={{ marginBottom:16, borderLeft:`3px solid ${ACC}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: editing ? 14 : 0 }}>
        <div>
          <span style={{ fontSize:13, fontWeight:700 }}>Research Context</span>
          {!editing && ctx?.setup_complete && (
            <span style={{ marginLeft:8, fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(52,211,153,0.15)', color:'#34d399' }}>Configured</span>
          )}
          {!editing && !ctx?.setup_complete && (
            <span style={{ marginLeft:8, fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(245,158,11,0.15)', color:'var(--saas)' }}>Using defaults</span>
          )}
          {!editing && ctx?.research_topic && (
            <span style={{ marginLeft:8, fontSize:11, color:'var(--pios-muted)' }}>{ctx.research_topic}</span>
          )}
        </div>
        <button onClick={()=>setEditing(e=>!e)} style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${ACC}40`, background:'transparent', color:ACC, cursor:'pointer' }}>
          {editing ? '✕ Cancel' : '✎ Edit'}
        </button>
      </div>

      {editing && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <span style={label}>Programme</span>
              <select style={{ ...inp, width:'auto', minWidth:100 }} value={form.programme ?? 'DBA'} onChange={e=>setForm(p=>({...p,programme:e.target.value}))}>
                {['DBA','PhD','MRes','MSc','MBA','Other'].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Institution</span>
              <input style={inp} value={form.institution ?? ''} onChange={e=>setForm(p=>({...p,institution:e.target.value}))} placeholder="e.g. University of Portsmouth" />
            </div>
            <div>
              <span style={label}>Research Title</span>
              <input style={inp} value={form.research_title ?? ''} onChange={e=>setForm(p=>({...p,research_title:e.target.value}))} placeholder="Thesis title…" />
            </div>
            <div>
              <span style={label}>Research Topic (short)</span>
              <input style={inp} value={form.research_topic ?? ''} onChange={e=>setForm(p=>({...p,research_topic:e.target.value}))} placeholder="e.g. AI forecasting FM GCC" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <span style={label}>Primary Research Question</span>
              <input style={inp} value={form.research_question ?? ''} onChange={e=>setForm(p=>({...p,research_question:e.target.value}))} placeholder="How can…?" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <span style={label}>Keywords (comma-separated)</span>
              <input style={inp} value={Array.isArray(form.keywords) ? form.keywords.join(', ') : (form.keywords ?? '')} onChange={e=>setForm(p=>({...p,keywords:e.target.value as unknown as string[]}))} placeholder="AI forecasting, facilities management, GCC…" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <span style={label}>Thesis Synopsis (1–3 paragraphs — used for AI relevance scoring)</span>
              <textarea style={{ ...inp, resize:'vertical', minHeight:80 }} value={form.thesis_synopsis ?? ''} onChange={e=>setForm(p=>({...p,thesis_synopsis:e.target.value}))} placeholder="Describe your research, methodology, and contribution…" rows={4} />
            </div>
            <div>
              <span style={label}>Research Philosophy</span>
              <input style={inp} value={form.research_philosophy ?? ''} onChange={e=>setForm(p=>({...p,research_philosophy:e.target.value}))} placeholder="e.g. Pragmatism" />
            </div>
            <div>
              <span style={label}>Methodology Approach</span>
              <input style={inp} value={form.methodology_approach ?? ''} onChange={e=>setForm(p=>({...p,methodology_approach:e.target.value}))} placeholder="e.g. Mixed methods, case study" />
            </div>
            <div>
              <span style={label}>Geographic Focus</span>
              <input style={inp} value={form.geographic_focus ?? ''} onChange={e=>setForm(p=>({...p,geographic_focus:e.target.value}))} placeholder="e.g. GCC, MENA" />
            </div>
            <div>
              <span style={label}>Industry Focus</span>
              <input style={inp} value={form.industry_focus ?? ''} onChange={e=>setForm(p=>({...p,industry_focus:e.target.value}))} placeholder="e.g. Facilities Management" />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <span style={label}>Theoretical Lens</span>
              <input style={inp} value={form.theoretical_lens ?? ''} onChange={e=>setForm(p=>({...p,theoretical_lens:e.target.value}))} placeholder="e.g. Socio-technical systems, TAM…" />
            </div>
            <div>
              <span style={label}>Default Citation Style</span>
              <select style={{ ...inp, width:'auto' }} value={form.preferred_citation_style ?? 'apa'} onChange={e=>setForm(p=>({...p,preferred_citation_style:e.target.value}))}>
                {['apa','chicago','harvard'].map(v=><option key={v} value={v}>{v.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={save} disabled={saving} style={{ fontSize:12 }}>{saving ? 'Saving…' : 'Save Research Context'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}
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
    } catch (err) { console.error('[PIOS]', err) }
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
    } catch (err) { console.error('[PIOS]', err) }
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
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(null)
  }

  if (loading) return null

  return (
    <div className="pios-card">
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

// ─── Literature Discovery & Paper Analysis (M059 + M060) ─────────────────────
type LitPaper = {
  id?: string; title: string; authors: string[]; year: number | null
  abstract: string | null; doi: string | null; arxiv_id: string | null
  semantic_scholar_id: string | null; openalex_id: string | null
  journal: string | null; venue: string | null; source_api: string
  citation_count: number; pdf_url: string | null; relevance_score: number | null
  is_saved?: boolean; linked_chapter_id?: string | null
  glossary_count?: number; thesis_alignment_score?: number | null
  study_quality_score?: number | null
}

function RelevancePill({ score }: { score: number | null }) {
  if (score === null) return null
  const pct  = Math.round(score * 100)
  const col  = score >= 0.7 ? '#34d399' : score >= 0.4 ? 'var(--saas)' : 'var(--pios-dim)'
  return <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:col+'20', color:col, fontWeight:700 }}>{pct}% rel.</span>
}

function ScoreBadge({ value, label, color }: { value: number | null; label: string; color: string }) {
  if (value === null) return null
  return (
    <div style={{ textAlign:'center', minWidth:48 }}>
      <div style={{ fontSize:15, fontWeight:700, color }}>{Math.round(value)}</div>
      <div style={{ fontSize:9, color:'var(--pios-dim)' }}>{label}</div>
    </div>
  )
}

function LiteratureSection() {
  const [tab,          setTab]          = useState<'search'|'library'>('search')
  const [scopusInfo,   setScopusInfo]   = useState<{has_access:boolean;institution?:string;method?:string;redirect_url?:string|null;api_enabled?:boolean}|null>(null)
  const [query,        setQuery]        = useState('')
  const [searching,    setSearching]    = useState(false)
  const [results,      setResults]      = useState<LitPaper[]>([])
  const [library,      setLibrary]      = useState<LitPaper[]>([])
  const [loadingLib,   setLoadingLib]   = useState(false)
  const [savingId,     setSavingId]     = useState<string|null>(null)
  const [analyzingId,  setAnalyzingId]  = useState<string|null>(null)
  const [selected,     setSelected]     = useState<string[]>([])
  const [comparing,    setComparing]    = useState(false)
  const [comparison,   setComparison]   = useState<Record<string,unknown>|null>(null)
  const [expandedId,   setExpandedId]   = useState<string|null>(null)
  const [glossary,     setGlossary]     = useState<{term:string;definition:string;context?:string}[]>([])
  const [showGlossary, setShowGlossary] = useState(false)
  const [exportingAnki,setExportingAnki]= useState(false)
  const [bibStyle,     setBibStyle]     = useState<'apa'|'chicago'|'harvard'>('apa')
  const [bibOutput,    setBibOutput]    = useState<string|null>(null)
  const [generatingBib,setGeneratingBib]= useState(false)
  const [ingesting,    setIngesting]    = useState(false)
  const [ingestMsg,    setIngestMsg]    = useState<string|null>(null)
  const [graphStats,   setGraphStats]   = useState<{papers:number;authors:number;citations:number;fields?:string[]}|null>(null)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [runningCronNow, setRunningCronNow] = useState(false)
  const [runNowMsg,      setRunNowMsg]      = useState<string|null>(null)
  const [cronStatus,   setCronStatus]   = useState<{
    configured: boolean
    event_logging_enabled?: boolean
    success_count: number
    failure_count: number
    last_run: {
      completed_at?: string | null
      status?: string | null
      papers_upserted?: number | null
      authors_upserted?: number | null
      links_upserted?: number | null
      notes?: string | null
    } | null
  }|null>(null)
  const [loadingCron,  setLoadingCron]  = useState(false)

  const loadLibrary = useCallback(async () => {
    setLoadingLib(true)
    try {
      const r = await fetch('/api/academic/literature?saved=true')
      const d = r.ok ? await r.json() : {}
      setLibrary((d.literature ?? []) as LitPaper[])
    } catch { /* silent */ }
    setLoadingLib(false)
  }, [])

  useEffect(() => { if (tab === 'library') loadLibrary() }, [tab, loadLibrary])

  useEffect(() => {
    if (tab !== 'library') return
    loadCitationGraphStats()
    loadCitationGraphCronStatus()
  }, [tab])

  useEffect(() => {
    fetch('/api/academic/institutional-access')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.access) setScopusInfo({
          has_access:   d.access.scopus_access ?? false,
          institution:  d.access.institution_name ?? null,
          method:       d.access.api_access_enabled ? 'api' : 'redirect',
          redirect_url: d.access.web_access_url ?? null,
          api_enabled:  d.access.api_access_enabled ?? false,
        })
      })
      .catch(() => null)
  }, [])

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true); setResults([])
    try {
      const searchSources = ['semantic_scholar', 'openalex', 'arxiv', 'crossref', ...(scopusInfo?.api_enabled ? ['scopus'] : [])]
      const r = await fetch('/api/academic/literature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query, sources: searchSources, log_scopus_redirect: scopusInfo?.method === 'redirect' }),
      })
      const d = r.ok ? await r.json() : {}
      setResults((d.results ?? []) as LitPaper[])
    } catch { /* silent */ }
    setSearching(false)
  }

  async function savePaper(paper: LitPaper) {
    const key = paper.doi ?? paper.title
    setSavingId(key)
    try {
      await fetch('/api/academic/literature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', paper }),
      })
      setResults(prev => prev.map(p => (p.doi ?? p.title) === key ? { ...p, is_saved: true } : p))
    } catch { /* silent */ }
    setSavingId(null)
  }

  async function analyzePaper(id: string) {
    setAnalyzingId(id)
    try {
      const r = await fetch('/api/academic/literature/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', literature_id: id }),
      })
      const d = r.ok ? await r.json() : {}
      if (d.ok) {
        setLibrary(prev => prev.map(p => p.id === id ? {
          ...p,
          thesis_alignment_score: d.analysis?.thesis_alignment_score ?? p.thesis_alignment_score,
          study_quality_score:    d.analysis?.study_quality_score ?? p.study_quality_score,
          glossary_count:         d.glossary?.length ?? p.glossary_count,
        } : p))
      }
    } catch { /* silent */ }
    setAnalyzingId(null)
  }

  async function compare() {
    if (selected.length < 2) return
    setComparing(true); setComparison(null)
    try {
      const r = await fetch('/api/academic/literature/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare', literature_ids: selected }),
      })
      const d = r.ok ? await r.json() : {}
      setComparison(d.comparison ?? null)
    } catch { /* silent */ }
    setComparing(false)
  }

  async function exportAnki() {
    setExportingAnki(true)
    try {
      const r = await fetch('/api/academic/literature/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'anki', literature_ids: selected }),
      })
      if (r.ok) {
        const blob = await r.blob()
        const url  = URL.createObjectURL(blob)
        const a    = Object.assign(document.createElement('a'), { href: url, download: `pios_glossary_anki_${Date.now()}.txt` })
        a.click(); URL.revokeObjectURL(url)
      }
    } catch { /* silent */ }
    setExportingAnki(false)
  }

  async function generateBibliography() {
    const ids = library.filter(p => p.id && (selected.length === 0 || selected.includes(p.id!))).map(p => p.id!)
    if (ids.length === 0) return
    setGeneratingBib(true); setBibOutput(null)
    try {
      const r = await fetch('/api/academic/literature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bibliography', literature_ids: ids, style: bibStyle }),
      })
      const d = r.ok ? await r.json() : {}
      setBibOutput(d.formatted ?? null)
    } catch { /* silent */ }
    setGeneratingBib(false)
  }

  async function loadGlossary() {
    try {
      const r = await fetch('/api/academic/literature/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_glossary' }),
      })
      const d = r.ok ? await r.json() : {}
      setGlossary((d.glossary ?? []) as {term:string;definition:string;context?:string}[])
      setShowGlossary(true)
    } catch { /* silent */ }
  }

  async function ingestToProprietaryDb() {
    setIngesting(true)
    setIngestMsg(null)
    try {
      const ids = selected.length > 0 ? selected : library.map(p => p.id).filter(Boolean) as string[]
      const r = await fetch('/api/academic/proprietary-db/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ literature_ids: ids, saved_only: true }),
      })
      const d = r.ok ? await r.json() : {}
      if (d.ok) {
        setIngestMsg(`Ingested ${d.papers_upserted ?? 0} papers, ${d.authors_upserted ?? 0} authors, ${d.links_upserted ?? 0} links.`)
      } else {
        setIngestMsg(d.error ?? 'Ingestion failed.')
      }
    } catch {
      setIngestMsg('Ingestion failed.')
    }
    setIngesting(false)
  }

  async function loadCitationGraphStats() {
    setLoadingGraph(true)
    try {
      const r = await fetch('/api/citation-graph/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_database_stats' }),
      })
      const d = r.ok ? await r.json() : null
      if (d) {
        setGraphStats({
          papers: d.papers ?? 0,
          authors: d.authors ?? 0,
          citations: d.citations ?? 0,
          fields: (d.fields ?? []) as string[],
        })
      }
    } catch { /* silent */ }
    setLoadingGraph(false)
  }

  async function loadCitationGraphCronStatus() {
    setLoadingCron(true)
    try {
      const r = await fetch('/api/citation-graph/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_cron_status' }),
      })
      const d = r.ok ? await r.json() : null
      if (d) {
        setCronStatus({
          configured: Boolean(d.configured),
          event_logging_enabled: Boolean(d.event_logging_enabled),
          success_count: Number(d.success_count ?? 0),
          failure_count: Number(d.failure_count ?? 0),
          last_run: d.last_run ?? null,
        })
      }
    } catch { /* silent */ }
    setLoadingCron(false)
  }

  async function runCitationGraphNow() {
    setRunningCronNow(true)
    setRunNowMsg(null)
    try {
      const r = await fetch('/api/citation-graph/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const d = r.ok ? await r.json() : await r.json().catch(() => null)

      if (!r.ok || !d?.ok) {
        setRunNowMsg(`Run failed: ${d?.error ?? 'Unknown error'}`)
      } else {
        const result = d.result ?? {}
        setRunNowMsg(
          `Run complete: ${Number(result.papers_ingested ?? 0)} papers, ` +
          `${Number(result.authors_upserted ?? 0)} authors, ` +
          `${Number(result.links_upserted ?? 0)} links.`
        )
        await Promise.all([loadCitationGraphStats(), loadCitationGraphCronStatus()])
      }
    } catch {
      setRunNowMsg('Run failed: request error.')
    }
    setRunningCronNow(false)
  }

  const ACC = 'var(--academic)'
  const tabStyle = (active: boolean) => ({
    fontSize:11, fontWeight:600, padding:'5px 14px', borderRadius:20, cursor:'pointer', border:'none',
    background: active ? ACC : 'transparent',
    color: active ? '#fff' : 'var(--pios-muted)',
    transition: 'all 0.15s',
  } as React.CSSProperties)

  return (
    <div className="pios-card">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>Literature Discovery</div>
          <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:1 }}>
            Search Semantic Scholar · OpenAlex · arXiv · Crossref — AI relevance scoring
          </div>
        </div>
        {scopusInfo?.has_access && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', borderRadius:20, background:'rgba(108,142,255,0.1)', border:'1px solid rgba(108,142,255,0.25)', fontSize:11 }}>
            <span style={{ fontWeight:600, color:'var(--academic)' }}>🎓 {scopusInfo.institution}</span>
            {scopusInfo.api_enabled
              ? <span style={{ padding:'1px 8px', borderRadius:10, background:'rgba(52,211,153,0.2)', color:'#34d399', fontSize:10, fontWeight:600 }}>Scopus API Active</span>
              : <a href={scopusInfo.redirect_url ?? 'https://www.scopus.com'} target="_blank" rel="noopener noreferrer"
                   style={{ padding:'1px 10px', borderRadius:10, background:'rgba(108,142,255,0.2)', color:'var(--academic)', fontSize:10, fontWeight:600, textDecoration:'none' }}>
                   Open Scopus ↗
                 </a>
            }
          </div>
        )}
        <div style={{ display:'flex', gap:4 }}>
          <button style={tabStyle(tab==='search')} onClick={()=>setTab('search')}>Search</button>
          <button style={tabStyle(tab==='library')} onClick={()=>setTab('library')}>My Library</button>
        </div>
      </div>

      {/* ── Search tab ─────────────────────────────────────────────────────── */}
      {tab === 'search' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <input
              className="pios-input" style={{ flex:1, fontSize:13 }}
              value={query} onChange={e=>setQuery(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&runSearch()}
              placeholder="e.g. AI forecasting facilities management GCC…"
            />
            <button className="pios-btn pios-btn-primary" onClick={runSearch} disabled={searching||!query.trim()} style={{ fontSize:12, whiteSpace:'nowrap' as const }}>
              {searching ? '⟳ Searching…' : '⌕ Search'}
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ fontSize:11, color:'var(--pios-dim)', marginBottom:10 }}>
              {results.length} papers found · sorted by AI relevance
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {results.map((p, i) => {
              const key     = p.doi ?? p.title
              const saving  = savingId === key
              const saved   = p.is_saved
              const expanded= expandedId === key
              return (
                <div key={i} style={{ padding:'12px 14px', borderRadius:8, background:'var(--pios-surface2)', border:`1px solid ${p.relevance_score && p.relevance_score >= 0.7 ? 'rgba(52,211,153,0.25)' : 'transparent'}` }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:2 }}>
                        <span style={{ fontSize:12, fontWeight:600, lineHeight:1.4 }}>{p.title}</span>
                        <RelevancePill score={p.relevance_score} />
                      </div>
                      <div style={{ fontSize:10, color:'var(--pios-dim)', marginBottom:4 }}>
                        {p.authors.slice(0,3).join(', ')}{p.authors.length>3?' et al.':''} · {p.year ?? 'n.d.'} · {p.journal ?? p.venue ?? p.source_api}
                        {p.citation_count > 0 && <span> · {p.citation_count} citations</span>}
                      </div>
                      {expanded && p.abstract && (
                        <p style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5, marginBottom:6 }}>{p.abstract.slice(0,400)}…</p>
                      )}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                        <button onClick={()=>setExpandedId(expanded ? null : key)} style={{ fontSize:10, color:ACC, background:'none', border:'none', cursor:'pointer', padding:0 }}>{expanded?'▲ Hide':'▼ Abstract'}</button>
                        {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'var(--pios-muted)' }}>↗ PDF</a>}
                        {p.doi && <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'var(--pios-muted)' }}>↗ DOI</a>}
                      </div>
                    </div>
                    <button
                      onClick={()=>savePaper(p)} disabled={saving||saved}
                      style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px solid ${ACC}40`, background:saved?ACC+'20':'transparent', color:saved?ACC:'var(--pios-muted)', cursor:saved?'default':'pointer', whiteSpace:'nowrap' as const, flexShrink:0 }}>
                      {saving ? '⟳' : saved ? '✓ Saved' : '+ Save'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Library tab ─────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div>
          {/* Toolbar */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' as const, alignItems:'center' }}>
            <div style={{ fontSize:11, color:'var(--pios-dim)', flex:1 }}>
              {library.length} papers saved
              {selected.length > 0 && <span style={{ marginLeft:8, color:ACC }}>· {selected.length} selected</span>}
              {cronStatus?.last_run?.completed_at && cronStatus.last_run.status === 'success' && (
                <span style={{ marginLeft:8, color:'var(--fm)' }}>
                  · last successful run {formatRelative(cronStatus.last_run.completed_at)}
                </span>
              )}
            </div>
            <button className="pios-btn pios-btn-ghost" onClick={ingestToProprietaryDb} disabled={ingesting || library.length === 0} style={{ fontSize:11 }}>
              {ingesting ? '⟳ Ingesting…' : '⛁ Build PIOS DB'}
            </button>
            <button className="pios-btn pios-btn-ghost" onClick={loadCitationGraphStats} disabled={loadingGraph} style={{ fontSize:11 }}>
              {loadingGraph ? '⟳ Loading…' : '◎ Graph Stats'}
            </button>
            <button className="pios-btn pios-btn-ghost" onClick={loadCitationGraphCronStatus} disabled={loadingCron} style={{ fontSize:11 }}>
              {loadingCron ? '⟳ Loading…' : '⌚ Cron Status'}
            </button>
            <button className="pios-btn pios-btn-ghost" onClick={runCitationGraphNow} disabled={runningCronNow} style={{ fontSize:11 }}>
              {runningCronNow ? '⟳ Running…' : '▶ Run Now'}
            </button>
            {selected.length >= 2 && (
              <button className="pios-btn pios-btn-ghost" onClick={compare} disabled={comparing} style={{ fontSize:11 }}>
                {comparing ? '⟳ Comparing…' : '⇄ Compare Methods'}
              </button>
            )}
            <button className="pios-btn pios-btn-ghost" onClick={exportAnki} disabled={exportingAnki} style={{ fontSize:11 }}>
              {exportingAnki ? '⟳' : '↓ Anki'}
            </button>
            <button className="pios-btn pios-btn-ghost" onClick={loadGlossary} style={{ fontSize:11 }}>📖 Glossary</button>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <select value={bibStyle} onChange={e=>setBibStyle(e.target.value as 'apa'|'chicago'|'harvard')} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid var(--pios-border)', background:'var(--pios-surface2)', color:'var(--pios-text)', cursor:'pointer' }}>
                <option value="apa">APA</option>
                <option value="chicago">Chicago</option>
                <option value="harvard">Harvard</option>
              </select>
              <button className="pios-btn pios-btn-ghost" onClick={generateBibliography} disabled={generatingBib} style={{ fontSize:11 }}>
                {generatingBib ? '⟳' : '¶ Bibliography'}
              </button>
            </div>
            <button className="pios-btn pios-btn-ghost" onClick={loadLibrary} style={{ fontSize:11 }}>↺</button>
          </div>

          {ingestMsg && (
            <div style={{ marginBottom:12, padding:'8px 10px', borderRadius:8, background:'rgba(108,142,255,0.08)', borderLeft:'3px solid var(--academic)', fontSize:11, color:'var(--pios-muted)' }}>
              {ingestMsg}
            </div>
          )}

          {runNowMsg && (
            <div style={{ marginBottom:12, padding:'8px 10px', borderRadius:8, background:'rgba(108,142,255,0.08)', borderLeft:'3px solid var(--academic)', fontSize:11, color:'var(--pios-muted)' }}>
              {runNowMsg}
            </div>
          )}

          {graphStats && (
            <div style={{ marginBottom:12, padding:'10px 12px', borderRadius:8, background:'rgba(16,185,129,0.08)', borderLeft:'3px solid #10b981' }}>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' as const, fontSize:11 }}>
                <span><strong>{graphStats.papers}</strong> papers</span>
                <span><strong>{graphStats.authors}</strong> authors</span>
                <span><strong>{graphStats.citations}</strong> citations</span>
                {graphStats.fields && graphStats.fields.length > 0 && <span>{graphStats.fields.slice(0, 4).join(', ')}</span>}
              </div>
            </div>
          )}

          {cronStatus && (
            <div style={{ marginBottom:12, padding:'10px 12px', borderRadius:8, background:'rgba(245,158,11,0.08)', borderLeft:'3px solid var(--saas)' }}>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' as const, fontSize:11, marginBottom:4 }}>
                <span><strong>{cronStatus.success_count}</strong> recent successes</span>
                <span><strong>{cronStatus.failure_count}</strong> recent failures</span>
                {cronStatus.last_run?.completed_at && <span>last run {formatRelative(cronStatus.last_run.completed_at)}</span>}
                {cronStatus.last_run?.status && (
                  <span style={{ color: cronStatus.last_run.status === 'success' ? 'var(--fm)' : 'var(--dng)' }}>
                    {String(cronStatus.last_run.status)}
                  </span>
                )}
              </div>
              {cronStatus.last_run && (
                <div style={{ fontSize:10, color:'var(--pios-muted)' }}>
                  {Number(cronStatus.last_run.papers_upserted ?? 0)} papers · {Number(cronStatus.last_run.authors_upserted ?? 0)} authors · {Number(cronStatus.last_run.links_upserted ?? 0)} links
                </div>
              )}
              {cronStatus.event_logging_enabled === false && (
                <div style={{ marginTop:4, fontSize:10, color:'var(--saas)' }}>
                  Event history logging is disabled until CITATION_GRAPH_CRON_ACTOR_USER_ID is set.
                </div>
              )}
            </div>
          )}

          {/* Bibliography output */}
          {bibOutput && (
            <div style={{ marginBottom:12, padding:'12px 14px', borderRadius:8, background:'rgba(108,142,255,0.06)', borderLeft:'3px solid var(--academic)', position:'relative' as const }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:ACC }}>Bibliography ({bibStyle.toUpperCase()})</span>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>navigator.clipboard.writeText(bibOutput)} style={{ fontSize:10, color:'var(--pios-dim)', background:'none', border:'none', cursor:'pointer' }}>Copy</button>
                  <button onClick={()=>setBibOutput(null)} style={{ fontSize:10, color:'var(--pios-dim)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                </div>
              </div>
              <pre style={{ fontSize:10, color:'var(--pios-muted)', lineHeight:1.6, whiteSpace:'pre-wrap' as const, margin:0 }}>{bibOutput}</pre>
            </div>
          )}

          {/* Glossary panel */}
          {showGlossary && (
            <div style={{ marginBottom:12, padding:'12px 14px', borderRadius:8, background:'var(--pios-surface2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600 }}>Glossary ({glossary.length} terms)</span>
                <button onClick={()=>setShowGlossary(false)} style={{ fontSize:10, color:'var(--pios-dim)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
              </div>
              <div style={{ maxHeight:200, overflowY:'auto' as const, display:'flex', flexDirection:'column', gap:6 }}>
                {glossary.map((g, i) => (
                  <div key={i} style={{ fontSize:11 }}>
                    <span style={{ fontWeight:600, color:ACC }}>{g.term}</span>
                    <span style={{ color:'var(--pios-muted)', marginLeft:6 }}>— {g.definition}</span>
                  </div>
                ))}
                {glossary.length === 0 && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>No glossary terms yet. Analyse some papers first.</span>}
              </div>
            </div>
          )}

          {/* Comparison result */}
          {comparison && (
            <div style={{ marginBottom:12, padding:'12px 14px', borderRadius:8, background:'rgba(108,142,255,0.06)', borderLeft:'3px solid var(--academic)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:ACC }}>Methodology Comparison</span>
                <button onClick={()=>setComparison(null)} style={{ fontSize:10, color:'var(--pios-dim)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
              </div>
              {(comparison.common_themes as string[])?.length > 0 && (
                <div style={{ marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--pios-muted)', marginBottom:3 }}>COMMON THEMES</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const }}>
                    {(comparison.common_themes as string[]).map((t, i) => (
                      <span key={i} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:ACC+'15', color:ACC }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {Boolean(comparison.recommended_approach) && (
                <p style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5, marginTop:8 }}>{String(comparison.recommended_approach)}</p>
              )}
            </div>
          )}

          {/* Library list */}
          {loadingLib ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--pios-dim)', fontSize:12 }}>Loading…</div>
          ) : library.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--pios-dim)', fontSize:12 }}>
              No papers saved yet. Use Search to find and save papers.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {library.map(p => {
                const isSelected = p.id ? selected.includes(p.id) : false
                const analyzing  = analyzingId === p.id
                return (
                  <div key={p.id} style={{ padding:'12px 14px', borderRadius:8, background:'var(--pios-surface2)', border:`1px solid ${isSelected ? ACC+'50' : 'transparent'}` }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      {p.id && (
                        <input type="checkbox" checked={isSelected}
                          onChange={e => setSelected(prev => e.target.checked ? [...prev, p.id!] : prev.filter(id => id !== p.id))}
                          style={{ marginTop:3, accentColor:ACC, flexShrink:0 }} />
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:2, lineHeight:1.4 }}>{p.title}</div>
                        <div style={{ fontSize:10, color:'var(--pios-dim)', marginBottom:6 }}>
                          {p.authors?.slice(0,3).join(', ')}{(p.authors?.length??0)>3?' et al.':''} · {p.year ?? 'n.d.'} · {p.journal ?? p.venue ?? p.source_api}
                        </div>
                        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                          <ScoreBadge value={p.thesis_alignment_score??null} label="Thesis %" color={ACC} />
                          <ScoreBadge value={p.study_quality_score??null} label="Quality" color="#34d399" />
                          {(p.glossary_count ?? 0) > 0 && (
                            <span style={{ fontSize:10, color:'var(--pios-dim)' }}>{p.glossary_count} terms</span>
                          )}
                          {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'var(--pios-muted)' }}>↗ PDF</a>}
                        </div>
                      </div>
                      {p.id && (
                        <button
                          onClick={()=>analyzePaper(p.id!)} disabled={analyzing}
                          style={{ fontSize:11, padding:'4px 12px', borderRadius:8, border:`1px dashed rgba(167,139,250,0.4)`, background:'rgba(167,139,250,0.06)', color:'var(--ai)', cursor:'pointer', whiteSpace:'nowrap' as const }}>
                          {analyzing ? '⟳ Analysing…' : '✦ Analyse'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
