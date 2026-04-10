// @ts-nocheck
'use client'
// PIOS™ v3.7.1 | Sprint P — Deadline Tracker | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, Plus, Sparkles, X, ExternalLink } from 'lucide-react'

const CAT_ICON = { professional:'💼', academic:'🎓', technical:'🔧', personal:'👤' }
const PRI_COL  = { critical:'#b91c1c', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' }

export default function DeadlineTrackerPage() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ title:'', subtitle:'', due_date:'', category:'professional', priority:'high' })
  const [saving,    setSaving]    = useState(false)
  const [planLoad,  setPlanLoad]  = useState(null)
  const [plans,     setPlans]     = useState({})

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/deadline-tracker')
      const d = await r.json()
      if (d.ok) setData(d)
    } catch (err) { console.error('[PIOS]', err) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!form.title || !form.due_date) return
    setSaving(true)
    try {
      await fetch('/api/deadline-tracker', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setShowForm(false)
      setForm({ title:'', subtitle:'', due_date:'', category:'professional', priority:'high' })
      load()
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(false)
  }

  async function remove(id) {
    await fetch('/api/deadline-tracker?id=' + id, { method:'DELETE' })
    setData(prev => prev ? { ...prev, deadlines: prev.deadlines.filter(d => d.id !== id) } : prev)
  }

  async function genPlan(deadline) {
    setPlanLoad(deadline.id)
    try {
      const r = await fetch('/api/deadline-tracker?action=ai-plan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deadline }),
      })
      const d = await r.json()
      setPlans(prev => ({ ...prev, [deadline.id]: d.plan }))
    } catch (err) { console.error('[PIOS]', err) }
    setPlanLoad(null)
  }

  const C = { navy:'#0D2B52', gold:'#C9A84C', teal:'#0A7A7A' }
  const card = { background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px', marginBottom:10 }
  const inp  = { width:'100%', padding:'8px 12px', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-primary)', fontSize:13, fontFamily:'inherit' }

  return (
    <div style={{ fontFamily:'var(--font-sans,system-ui)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', margin:0 }}>Deadline Tracker</h1>
          <p style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>Critical dates · Countdown · AI action plans</p>
        </div>
        <button onClick={() => setShowForm(f => !f)}
          style={{ borderRadius:8, border:'none', background:C.navy, color:'#fff', padding:'7px 14px', cursor:'pointer', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:5 }}>
          <Plus size={11}/> Add deadline
        </button>
      </div>

      {/* Summary badges */}
      {data?.summary && (
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {[
            { l:'Overdue',  v:data.summary.overdue,  col:'#b91c1c' },
            { l:'Critical (≤7d)', v:data.summary.critical, col:'#ef4444' },
            { l:'Upcoming (≤30d)', v:data.summary.upcoming, col:'#f59e0b' },
          ].map(k => (
            <div key={k.l} style={{ padding:'6px 14px', borderRadius:8, background:'var(--color-background-secondary)', fontSize:12 }}>
              <span style={{ color:'var(--color-text-tertiary)' }}>{k.l}: </span>
              <span style={{ fontWeight:700, color:k.col }}>{k.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ ...card, borderLeft:`3px solid ${C.teal}`, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <p style={{ fontSize:13, fontWeight:500 }}>Add deadline</p>
            <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-tertiary)' }}><X size={14}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:8 }}>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Title *" style={inp}/>
            <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={inp}/>
            <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={inp}>
              {['professional','academic','technical','personal'].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={inp}>
              {['critical','high','medium','low'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <input value={form.subtitle} onChange={e=>setForm(f=>({...f,subtitle:e.target.value}))} placeholder="Subtitle / details" style={{ ...inp, marginBottom:10 }}/>
          <button onClick={add} disabled={saving||!form.title||!form.due_date}
            style={{ borderRadius:8, border:'none', background:C.teal, color:'#fff', padding:'7px 16px', cursor:'pointer', fontSize:13, fontWeight:500, opacity:saving||!form.title||!form.due_date?0.5:1 }}>
            {saving?'Saving…':'Add'}
          </button>
        </div>
      )}

      {/* Deadlines */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'3rem', color:'var(--color-text-tertiary)', fontSize:13 }}>
          <Loader2 size={16}/> Loading…
        </div>
      ) : (data?.deadlines ?? []).map(dl => (
        <div key={dl.id} style={{ ...card, borderLeft:`4px solid ${dl.urgency_col}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <span style={{ fontSize:14 }}>{CAT_ICON[dl.category]??'📅'}</span>
                <span style={{ fontSize:15, fontWeight:600, color:'var(--color-text-primary)' }}>{dl.title}</span>
                {dl.pinned && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:`${C.gold}20`, color:C.gold, fontWeight:600 }}>PINNED</span>}
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:`${PRI_COL[dl.priority]??'#94a3b8'}15`, color:PRI_COL[dl.priority]??'#94a3b8', fontWeight:600 }}>
                  {dl.priority}
                </span>
              </div>
              {dl.subtitle && <p style={{ fontSize:12, color:'var(--color-text-secondary)', lineHeight:1.5, marginBottom:4 }}>{dl.subtitle}</p>}
              <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--color-text-tertiary)' }}>
                <span>Due: {new Date(dl.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</span>
                {dl.due_time && <span>{dl.due_time}</span>}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
              <div style={{ textAlign:'center', padding:'8px 14px', borderRadius:10, background:`${dl.urgency_col}12` }}>
                <p style={{ fontSize:26, fontWeight:800, color:dl.urgency_col, lineHeight:1 }}>{dl.days_left}</p>
                <p style={{ fontSize:9, color:dl.urgency_col, fontWeight:600 }}>DAYS LEFT</p>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {dl.action_url && (
                  <a href={dl.action_url} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                    <ExternalLink size={10}/> Go
                  </a>
                )}
                <button onClick={() => genPlan(dl)} disabled={planLoad===dl.id}
                  style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'none', background:'transparent', color:C.gold, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                  {planLoad===dl.id?<Loader2 size={10}/>:<Sparkles size={10}/>} Plan
                </button>
                {!dl.pinned && (
                  <button onClick={() => remove(dl.id)}
                    style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'none', background:'transparent', color:'var(--color-text-tertiary)', cursor:'pointer' }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AI plan */}
          {plans[dl.id] && (
            <div style={{ marginTop:12, padding:'10px 12px', borderRadius:8, background:`${C.gold}08`, borderLeft:`3px solid ${C.gold}` }}>
              <p style={{ fontSize:10, fontWeight:600, color:C.gold, marginBottom:6 }}>AI ACTION PLAN</p>
              <pre style={{ whiteSpace:'pre-wrap', fontSize:12, lineHeight:1.6, fontFamily:'inherit', margin:0, color:'var(--color-text-primary)' }}>{plans[dl.id]}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
