'use client'
// PIOS™ v3.5.0 | Sprint K — Onboarding Dashboard | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react'

const CAT_COL: Record<string,string> = {
  identity:'#4f8ef7', professional:'#0A7A7A', academic:'#7c3aed',
  platform:'#C9A84C', integration:'#22c55e',
}
const CAT_LABEL: Record<string,string> = {
  identity:'Identity & AI', professional:'Professional', academic:'Academic',
  platform:'Platform', integration:'Integrations',
}

interface Step {
  id:string; label:string; desc:string; category:string; priority:number
  action_url:string; completed:boolean
}

export default function OnboardingPage() {
  const [data,        setData]        = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [msgLoad,     setMsgLoad]     = useState(false)
  const [welcomeMsg,  setWelcomeMsg]  = useState<string|null>(null)
  const [activeFilter,setActiveFilter]= useState<string>('all')

  useEffect(() => {
    fetch('/api/onboarding').then(r=>r.json()).then(d => {
      setData(d.ok?d:null); setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

  async function getNextSteps() {
    if (!data) return
    setMsgLoad(true); setWelcomeMsg(null)
    try {
      const r = await fetch('/api/onboarding', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'next-steps',
          pending_steps: data.priority_pending,
          user_context: 'CEO/Founder of VeritasIQ Technologies Ltd, DBA candidate at University of Portsmouth',
        }),
      })
      const d = await r.json()
      setWelcomeMsg(d.message ?? null)
    } catch {}
    setMsgLoad(false)
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'3rem',color:'var(--color-text-tertiary)',fontSize:13}}>
      <Loader2 size={16}/> Checking platform readiness…
    </div>
  )

  if (!data) return (
    <div style={{padding:'2rem',fontSize:13,color:'var(--color-text-tertiary)'}}>Unable to load onboarding data.</div>
  )

  const C = {navy:'#0D2B52',teal:'#0A7A7A',gold:'#C9A84C'}
  const card = {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,padding:'16px 18px',marginBottom:10}
  const steps: Step[] = data.steps ?? []
  const filtered = activeFilter==='all' ? steps : activeFilter==='pending' ? steps.filter((s:Step)=>!s.completed) : steps.filter((s:Step)=>s.category===activeFilter)

  const readiness = data.readiness_pct ?? 0
  const readinessCol = readiness>=80?'#22c55e':readiness>=50?'#f59e0b':'#ef4444'

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0}}>Platform Readiness</h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>
            {data.completed_count}/{data.total_steps} steps complete · Readiness {readiness}%
          </p>
        </div>
        <button onClick={getNextSteps} disabled={msgLoad}
          style={{borderRadius:8,border:'none',background:C.navy,color:'#fff',padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6,opacity:msgLoad?0.6:1}}>
          {msgLoad?<Loader2 size={12}/>:<Sparkles size={12}/>} {msgLoad?'Generating…':'Get AI recommendations'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{...card,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)'}}>Overall readiness</span>
          <span style={{fontSize:22,fontWeight:700,color:readinessCol}}>{readiness}%</span>
        </div>
        <div style={{height:8,background:'var(--color-border-tertiary)',borderRadius:4,overflow:'hidden',marginBottom:14}}>
          <div style={{height:'100%',width:`${readiness}%`,background:readinessCol,borderRadius:4,transition:'width 0.5s'}}/>
        </div>
        {/* Category breakdown */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {Object.entries(data.by_category??{}).map(([cat,stat]:any)=>(
            <div key={cat} style={{textAlign:'center'}}>
              <div style={{fontSize:11,fontWeight:500,color:CAT_COL[cat]??'#999',marginBottom:3}}>{CAT_LABEL[cat]??cat}</div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)'}}>{stat.completed}/{stat.total}</div>
              <div style={{height:3,background:'var(--color-border-tertiary)',borderRadius:2,marginTop:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${stat.total>0?Math.round(stat.completed/stat.total*100):0}%`,background:CAT_COL[cat]??'#999',borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI recommendations */}
      {welcomeMsg && (
        <div style={{...card,borderLeft:`3px solid ${C.gold}`,background:`${C.gold}08`,marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:500,color:C.gold,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <Sparkles size={11}/> AI RECOMMENDATIONS
          </p>
          <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{welcomeMsg}</pre>
        </div>
      )}

      {/* Priority pending */}
      {(data.priority_pending??[]).length>0 && (
        <div style={{...card,borderLeft:`3px solid #ef4444`,marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:500,color:'#b91c1c',marginBottom:10}}>⚡ PRIORITY ACTIONS</p>
          {(data.priority_pending as Step[]).map((step,i)=>(
            <div key={step.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
              <span style={{fontSize:18,fontWeight:700,color:'var(--color-text-tertiary)',minWidth:20}}>{i+1}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:1}}>{step.label}</p>
                <p style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{step.desc}</p>
              </div>
              <a href={step.action_url} style={{fontSize:12,color:CAT_COL[step.category]??C.navy,textDecoration:'none',display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
                Go <ArrowRight size={11}/>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {['all','pending',...Object.keys(CAT_COL)].map(f=>(
          <button key={f} onClick={()=>setActiveFilter(f)}
            style={{fontSize:11,padding:'4px 12px',borderRadius:20,border:'none',cursor:'pointer',
              background:activeFilter===f?(CAT_COL[f]??C.navy):'var(--color-background-secondary)',
              color:activeFilter===f?'#fff':'var(--color-text-secondary)',fontWeight:activeFilter===f?500:400}}>
            {f==='all'?`All (${steps.length})`:f==='pending'?`Pending (${steps.filter((s:Step)=>!s.completed).length})`:CAT_LABEL[f]??f}
          </button>
        ))}
      </div>

      {/* Step list */}
      {filtered.map((step:Step) => (
        <div key={step.id} style={{...card,opacity:step.completed?0.7:1,borderLeft:`3px solid ${step.completed?'#22c55e':(CAT_COL[step.category]??'#999')}`}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {step.completed
              ? <CheckCircle2 size={18} color='#22c55e' style={{flexShrink:0}}/>
              : <Circle size={18} color={CAT_COL[step.category]??'#999'} style={{flexShrink:0}}/>
            }
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',textDecoration:step.completed?'line-through':'none'}}>{step.label}</p>
                <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,background:`${CAT_COL[step.category]??'#999'}18`,color:CAT_COL[step.category]??'#999'}}>{CAT_LABEL[step.category]??step.category}</span>
                <span style={{fontSize:10,color:'var(--color-text-tertiary)'}}>P{step.priority}</span>
              </div>
              <p style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{step.desc}</p>
            </div>
            {!step.completed && (
              <a href={step.action_url}
                style={{borderRadius:8,border:`0.5px solid ${CAT_COL[step.category]??C.navy}44`,background:'transparent',color:CAT_COL[step.category]??C.navy,padding:'5px 12px',fontSize:11,textDecoration:'none',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4}}>
                Start <ArrowRight size={10}/>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
