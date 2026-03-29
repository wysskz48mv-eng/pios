// @ts-nocheck
'use client'
// PIOS™ v3.5.1 | Sprint L — Daily Brief | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, Zap } from 'lucide-react'

export default function DailyBriefPage() {
  const [brief,     setBrief]     = useState(null)
  const [snapshot,  setSnapshot]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [regen,     setRegen]     = useState(false)
  const [genAt,     setGenAt]     = useState(null)
  const [cached,    setCached]    = useState(false)

  async function load(force=false) {
    force ? setRegen(true) : setLoading(true)
    try {
      const r = await fetch('/api/cos/daily-brief', { method: force ? 'POST' : 'GET' })
      const d = await r.json()
      if (d.ok) {
        setBrief(d.brief_text)
        setSnapshot(d.state_snapshot)
        setGenAt(d.generated_at)
        setCached(d.cached)
      }
    } catch {}
    force ? setRegen(false) : setLoading(false)
  }

  useEffect(() => { load() }, [])

  const C = { navy:'#0D2B52', gold:'#C9A84C', teal:'#0A7A7A' }
  const card = { background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px', marginBottom:12 }

  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const daysToQ = snapshot?.days_to_qiddiya ?? Math.max(0, Math.ceil((new Date('2026-04-14').getTime() - Date.now()) / 86400_000))

  return (
    <div style={{ fontFamily:'var(--font-sans,system-ui)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <Zap size={18} color={C.gold}/>
            <h1 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', margin:0 }}>Morning Brief</h1>
            {cached && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#eff6ff', color:'#1d4ed8' }}>cached</span>}
          </div>
          <p style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>{today}</p>
        </div>
        <button onClick={() => load(true)} disabled={regen}
          style={{ borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'transparent', color:'var(--color-text-secondary)', padding:'7px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:12, opacity:regen?0.5:1 }}>
          {regen ? <Loader2 size={12}/> : <RefreshCw size={12}/>}
          {regen ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      {/* Deadline pulse header */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Qiddiya deadline', val:`${daysToQ}d`, sub:'14 Apr 2026', col:daysToQ<14?'#ef4444':daysToQ<21?'#f59e0b':'#22c55e' },
          { label:'DBA progress',     val:`${snapshot?.dba_progress ?? '—'}%`, sub:'thesis completion', col:snapshot?.dba_progress<30?'#ef4444':'var(--color-text-primary)' },
          { label:'Overdue tasks',    val:snapshot?.overdue ?? '—', sub:'need action', col:snapshot?.overdue>0?'#b91c1c':undefined },
          { label:'Due today',        val:snapshot?.due_today ?? '—', sub:'today & tomorrow', col:undefined },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--color-background-secondary)', borderRadius:10, padding:'12px 14px' }}>
            <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:3 }}>{k.label}</p>
            <p style={{ fontSize:20, fontWeight:600, color:k.col??'var(--color-text-primary)', marginBottom:2 }}>{k.val}</p>
            <p style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Brief */}
      {loading ? (
        <div style={{ ...card, display:'flex', alignItems:'center', gap:10, padding:'2rem', color:'var(--color-text-tertiary)', fontSize:13 }}>
          <Loader2 size={16}/> Generating your morning brief…
        </div>
      ) : brief ? (
        <div style={{ ...card, borderLeft:`3px solid ${C.gold}`, background:'var(--color-background-secondary)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontSize:11, fontWeight:500, color:C.gold, display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={11}/> CHIEF OF STAFF DAILY BRIEF
            </p>
            {genAt && <p style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{new Date(genAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</p>}
          </div>
          <pre style={{ whiteSpace:'pre-wrap', fontSize:14, lineHeight:1.8, fontFamily:'inherit', margin:0, color:'var(--color-text-primary)' }}>{brief}</pre>
        </div>
      ) : (
        <div style={{ ...card, textAlign:'center', padding:'3rem', color:'var(--color-text-tertiary)' }}>
          <p style={{ fontSize:30, marginBottom:12 }}>☀</p>
          <p style={{ fontSize:14, fontWeight:500, color:'var(--color-text-secondary)', marginBottom:6 }}>Brief not yet generated</p>
          <p style={{ fontSize:12 }}>Click Regenerate to create today's morning brief.</p>
        </div>
      )}

      {/* Context note */}
      {brief && (
        <div style={{ marginTop:6, fontSize:11, color:'var(--color-text-tertiary)', lineHeight:1.5 }}>
          Generated by Claude Haiku 4.5 · Cached daily · Aggregates tasks, meetings, IP alerts, DBA chapters, insights
          · Runs automatically at 07:00 UTC when CRON_SECRET is configured
        </div>
      )}
    </div>
  )
}
